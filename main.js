// Главная точка входа игры «Ваня Бежит»
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { audioManager } from './src/audio.js';
import { uiManager } from './src/ui.js';
import { Player } from './src/player.js';
import { Pursuer } from './src/pursuer.js';
import { WorldGenerator } from './src/world.js';
import { ObstacleManager } from './src/obstacles.js';
import { CollectibleManager } from './src/collectibles.js';

class Game {
  constructor() {
    this.state = 'MENU'; // 'MENU', 'PLAYING', 'PAUSED', 'GAMEOVER'
    
    // Игровой счет и бутылки за текущий забег
    this.score = 0;
    this.collectedBottles = 0;
    
    // Таймер дельта-времени
    this.clock = new THREE.Clock();

    this.initEngine();
    this.initObjects();
    this.initInput();
    
    // Инициализируем UI и связываем коллбэки
    uiManager.init({
      onStart: () => this.startGame(),
      onResume: () => this.resumeGame(),
      onQuit: () => this.quitToMenu()
    });

    // Запускаем игровой цикл
    this.animate();

    // Запускаем музыку меню сразу
    audioManager.playMusic('menu');
    
    // Переводим камеру в режим меню
    this.setupCameraForMenu();
  }

  // Инициализация Three.js движка (сцена, рендерер, камера, свет, туман)
  initEngine() {
    this.canvas = document.getElementById('gameCanvas');
    
    // Сцена
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2b3c); // Синеватые сумерки во дворе
    
    // Туман (Fog) скрывает прогрузку новых чанков
    this.scene.fog = new THREE.FogExp2(0x1a2b3c, 0.015);

    // Камера
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Рендерер
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Освещение
    // 1. Мягкий полусферический свет (небо/земля)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // 2. Направленный свет с тенями (имитация заходящего солнца / фонаря)
    this.dirLight = new THREE.DirectionalLight(0xffaa66, 1.0);
    this.dirLight.position.set(10, 25, 10);
    this.dirLight.castShadow = true;
    
    // Настройка теней для оптимизации
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 80;
    const d = 25;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;

    this.scene.add(this.dirLight);

    // Обработка ресайза
    window.addEventListener('resize', () => this.onWindowResize());
  }

  // Создание игровых объектов и менеджеров
  initObjects() {
    this.worldGen = new WorldGenerator(this.scene);
    this.player = new Player(this.scene);
    this.pursuer = new Pursuer(this.scene);
    this.obstacleManager = new ObstacleManager(this.scene);
    this.collectibleManager = new CollectibleManager(this.scene);

    // Первый запуск мира (для меню)
    this.worldGen.reset();
  }

  // Настройка ракурса камеры для главного меню (крупный план Вани)
  setupCameraForMenu() {
    this.camera.position.set(0, 1.6, 3.5);
    this.camera.lookAt(new THREE.Vector3(0, 0.9, 0));
  }

  // Обновление положения камеры в процессе бега (слежение за Ваней)
  updateCamera(dt) {
    if (this.state === 'PAUSED') return;

    // Целевая позиция камеры (сзади и сверху над игроком)
    let targetCamY = this.player.mesh.position.y + 3.0;
    
    // В коробке-самолете камера отдаляется дальше
    let targetCamZ = this.player.mesh.position.z - 6.5;
    if (this.player.activeBonus === 'box') {
      targetCamY = this.player.mesh.position.y + 4.5;
      targetCamZ = this.player.mesh.position.z - 9.0;
    } else if (this.player.activeBonus === 'fart') {
      targetCamY = this.player.mesh.position.y + 3.8;
      targetCamZ = this.player.mesh.position.z - 8.0;
    }

    const targetCamX = THREE.MathUtils.lerp(this.camera.position.x, this.player.mesh.position.x * 0.7, 5 * dt);

    this.camera.position.set(
      targetCamX,
      THREE.MathUtils.lerp(this.camera.position.y, targetCamY, 6 * dt),
      THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, 8 * dt)
    );

    // Камера смотрит чуть впереди игрока
    const lookAtPos = new THREE.Vector3(
      this.player.mesh.position.x * 0.5,
      this.player.mesh.position.y + 1.2,
      this.player.mesh.position.z + 10
    );
    this.camera.lookAt(lookAtPos);

    // Следование направленного света за игроком для отрисовки теней
    this.dirLight.position.set(
      this.player.mesh.position.x + 15,
      this.player.mesh.position.y + 25,
      this.player.mesh.position.z + 10
    );
    this.dirLight.target = this.player.mesh;
  }

  // Обработка клавиатуры и жестов (свайпы)
  initInput() {
    // 1. Клавиатура (с поддержкой английской и русской раскладок)
    window.addEventListener('keydown', (e) => {
      if (this.state !== 'PLAYING') return;

      const code = e.code;
      const key = e.key.toLowerCase();

      // Движение влево: ArrowLeft, клавиша A (код KeyA / буква 'ф')
      if (code === 'ArrowLeft' || code === 'KeyA' || key === 'a' || key === 'ф') {
        this.player.changeLane(1); // Инвертировано для корректного отображения на экране (+X = Лево)
      }
      // Движение вправо: ArrowRight, клавиша D (код KeyD / буква 'в'), клавиша F (код KeyF / буква 'а')
      else if (
        code === 'ArrowRight' || 
        code === 'KeyD' || 
        code === 'KeyF' || 
        key === 'd' || 
        key === 'f' || 
        key === 'в' || 
        key === 'а'
      ) {
        this.player.changeLane(-1); // Инвертировано для корректного отображения на экране (-X = Право)
      }
      // Прыжок: ArrowUp, клавиша W (код KeyW / буква 'ц')
      else if (code === 'ArrowUp' || code === 'KeyW' || key === 'w' || key === 'ц') {
        this.player.jump();
      }
      // Подкат: ArrowDown, клавиша S (код KeyS / буква 'ы')
      else if (code === 'ArrowDown' || code === 'KeyS' || key === 's' || key === 'ы') {
        this.player.slide();
      }
      // Реактивный пук (зажатие Пробела / Shift)
      else if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight' || key === ' ') {
        this.player.setFarting(true);
      }
      // Пауза
      else if (code === 'Escape') {
        this.pauseGame();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.state !== 'PLAYING') return;

      const code = e.code;
      const key = e.key.toLowerCase();

      if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight' || key === ' ') {
        this.player.setFarting(false);
      }
    });

    // 2. Свайпы и зажатие для мобильных устройств (улучшенное тач-управление)
    let touchStartX = 0;
    let touchStartY = 0;
    let fartTimeout = null;
    let isSwipe = false;
    
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 0) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isSwipe = false;

      if (fartTimeout) clearTimeout(fartTimeout);

      if (this.state === 'PLAYING') {
        // Если палец удерживается на одном месте более 150мс - это полет на пуке
        fartTimeout = setTimeout(() => {
          if (!isSwipe && this.state === 'PLAYING') {
            this.player.setFarting(true);
          }
        }, 150);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 0) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = currentX - touchStartX;
      const dy = currentY - touchStartY;

      // Если сдвиг по любой оси больше 15px - это свайп, отменяем зажатие пука
      if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
        isSwipe = true;
        if (fartTimeout) {
          clearTimeout(fartTimeout);
          fartTimeout = null;
        }
        if (this.state === 'PLAYING') {
          this.player.setFarting(false);
        }
      }

      // Блокируем скролл страницы браузером во время игры
      if (this.state === 'PLAYING') {
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false }); // Важно: passive: false для работы preventDefault()

    window.addEventListener('touchend', (e) => {
      if (fartTimeout) {
        clearTimeout(fartTimeout);
        fartTimeout = null;
      }

      if (this.state === 'PLAYING') {
        this.player.setFarting(false);
      }

      if (e.changedTouches.length === 0) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;

      // Порог чувствительности свайпа
      const threshold = 35;

      if (isSwipe && this.state === 'PLAYING') {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Горизонтальный свайп
          if (Math.abs(deltaX) > threshold) {
            if (deltaX > 0) {
              this.player.changeLane(-1); // Свайп вправо -> движение вправо (-X)
            } else {
              this.player.changeLane(1);  // Свайп влево -> движение влево (+X)
            }
          }
        } else {
          // Вертикальный свайп
          if (Math.abs(deltaY) > threshold) {
            if (deltaY < 0) {
              this.player.jump();
            } else {
              this.player.slide();
            }
          }
        }
      }
    }, { passive: true });
  }

  // Старт нового забега
  startGame() {
    this.state = 'PLAYING';
    this.score = 0;
    this.collectedBottles = 0;

    // Сброс всех компонентов
    this.worldGen.reset();
    this.player.reset();
    this.pursuer.reset();
    this.obstacleManager.reset();
    this.collectibleManager.reset();

    // Запускаем HUD
    uiManager.startHUD();

    // Музыка и звуки
    audioManager.playMusic('run');
    audioManager.playVanyaSpawn();

    // Проверяем, есть ли купленная Коробка-самолет и активируем ее
    if (uiManager.useBox()) {
      this.player.activateBoxBonus();
    }

    this.clock.getDelta(); // Сброс таймера дельты
  }

  // Пауза
  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    audioManager.stopMusic();
    uiManager.showPause(true);
  }

  // Продолжение после паузы
  resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    audioManager.playMusic('run');
    uiManager.showPause(false);
    this.clock.getDelta(); // Сброс дельты перед продолжением
  }

  // Выход в главное меню из паузы
  quitToMenu() {
    this.state = 'MENU';
    audioManager.playMusic('menu');
    uiManager.showScreen('main-menu');
    this.setupCameraForMenu();
    this.player.reset();
    this.pursuer.reset();
  }

  // Столкновение - конец игры
  triggerGameOver() {
    this.state = 'GAMEOVER';
    
    // Проигрываем звук аварии
    audioManager.playSFX('crash');
    audioManager.stopMusic();

    // Лиза подбегает вплотную
    this.pursuer.catchUp();
    this.player.isDead = true;

    // Небольшая задержка перед меню Game Over, чтобы показать сцену поимки
    setTimeout(() => {
      if (this.state === 'GAMEOVER') {
        uiManager.showGameOver(this.score, this.collectedBottles);
      }
    }, 1500);
  }

  // Главный цикл рендеринга и апдейтов физики
  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(this.clock.getDelta(), 0.1); // Ограничиваем дельту для стабильности при фризах

    if (this.state === 'PLAYING') {
      // 1. Обновление мира
      this.worldGen.update(this.player.mesh.position.z);

      // 2. Обновление Вани
      this.player.update(dt);

      // 3. Обновление Лизы
      this.pursuer.update(dt, this.player.mesh.position, this.player.runSpeed, true);

      // 4. Обновление препятствий и проверка столкновений
      this.obstacleManager.update(dt, this.player.mesh.position.z);
      const collision = this.obstacleManager.checkCollisions(this.player);
      if (collision) {
        this.triggerGameOver();
      }

      // 5. Обновление собираемых предметов и проверка сбора
      this.collectibleManager.update(dt, this.player.mesh.position.z);
      this.collectibleManager.checkPickups(this.player, (type, val) => {
        if (type === 'gin') {
          this.collectedBottles += val;
          uiManager.updateHUDBottles(this.collectedBottles);
        } else if (type === 'box_flight') {
          // Коробка-самолет подобрана на трассе
          uiManager.updateBonusHUD('box', 100);
        } else if (type === 'fart_refill') {
          // Розовый джин подобран на трассе
          uiManager.updateBonusHUD('fart', 100);
        }
      });

      // Каждые Z-метров генерируем препятствия/бутылки на новых чанках
      // Логика спавна препятствий привязана к генерации чанков внутри worldGen.
      // Мы проверяем, если создался новый чанк (кол-во активных чанков изменилось или отслеживаем Z)
      this.activeChunksCheck();

      // 6. Подсчет очков на основе пройденного расстояния Z
      this.score = this.player.mesh.position.z * 0.5 + this.collectedBottles * 10;
      uiManager.updateHUDScore(this.score);

    } 
    else if (this.state === 'GAMEOVER') {
      // В Game Over обновляем физику игрока (падение) и бег Лизы, пока она его ловит
      this.player.update(dt);
      this.pursuer.update(dt, this.player.mesh.position, this.player.runSpeed, true);
    } 
    else if (this.state === 'MENU') {
      // В главном меню Ваня и Лиза бегут вперед, мир бесконечно генерируется без препятствий
      this.worldGen.update(this.player.mesh.position.z);
      this.player.update(dt);
      this.pursuer.update(dt, this.player.mesh.position, this.player.runSpeed, true);
      this.activeChunksCheck();
      
      // Направление бега - вперед
      this.player.mesh.rotation.y = 0;
    }

    // Слежение камеры
    this.updateCamera(dt);

    // Рендер сцены
    this.renderer.render(this.scene, this.camera);
  }

  // Проверка чанков для наполнения препятствиями
  activeChunksCheck() {
    this.worldGen.activeChunks.forEach(chunk => {
      // Если чанк еще не наполнен препятствиями
      if (!chunk.hasObstacles) {
        // Первые 40 метров игры (стартовая зона) оставляем свободными
        // Препятствия спавним только во время реальной игры (PLAYING)
        if (this.state === 'PLAYING' && chunk.startZ > 30) {
          this.obstacleManager.spawnObstaclesForChunk(chunk.startZ, this.worldGen.chunkLength);
          this.collectibleManager.spawnCollectiblesForChunk(chunk.startZ, this.worldGen.chunkLength);
        }
        chunk.hasObstacles = true;
      }
    });
  }

  // Корректировка размеров экрана
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Инициализация при загрузке страницы
window.addEventListener('load', () => {
  new Game();
});
