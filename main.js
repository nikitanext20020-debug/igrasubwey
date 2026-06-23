// Главная точка входа игры «Ваня Бежит»
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { audioManager } from './src/audio.js?v=4';
import { uiManager } from './src/ui.js?v=4';
import { Player } from './src/player.js?v=5';
import { Pursuer } from './src/pursuer.js?v=4';
import { WorldGenerator } from './src/world.js?v=2';
import { ObstacleManager } from './src/obstacles.js?v=4';
import { CollectibleManager } from './src/collectibles.js?v=5';

THREE.Cache.enabled = true;

class Game {
  constructor() {
    this.state = 'MENU'; // 'MENU', 'INTRO', 'PLAYING', 'PAUSED', 'GAMEOVER'
    
    // Игровой счет и бутылки за текущий забег
    this.score = 0;
    this.collectedBottles = 0;
    
    // Таймер дельта-времени
    this.clock = new THREE.Clock();
    this.introTimer = 0;
    this.startWithBoxBonus = false;
    this.stumbleLevel = 0;
    this.collisionCooldown = 0;
    this.cleanRunTimer = 0;
    this.pickupTextEl = null;
    this.pickupTextAnimation = null;
    this.assetsReady = false;

    this.initEngine();
    this.initObjects();
    this.initInput();
    
    // Инициализируем UI и связываем коллбэки
    uiManager.init({
      onStart: () => this.startGame(),
      onPause: () => this.pauseGame(),
      onResume: () => this.resumeGame(),
      onQuit: () => this.quitToMenu()
    });
    this.initAssetGate();

    // Запускаем игровой цикл
    this.animate();

    // Запускаем музыку меню сразу
    audioManager.playMusic('menu');
    
    // Переводим сцену в режим меню
    this.setupMenuScene();

    // Авто-пауза при сворачивании игры/вкладки
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') {
        this.pauseGame();
      }
    });
  }

  // Инициализация Three.js движка (сцена, рендерер, камера, свет, туман)
  initEngine() {
    this.canvas = document.getElementById('gameCanvas');
    this.isMobileRuntime = window.innerWidth < 820 || /Android|iPhone|iPad|iPod|Telegram/i.test(navigator.userAgent);
    
    // Сцена
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x18233a); // Ночная база под градиентный sky-dome
    
    // Туман (Fog) скрывает прогрузку новых чанков
    this.scene.fog = new THREE.FogExp2(0x2c405f, 0.0075);

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
      antialias: !this.isMobileRuntime,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = !this.isMobileRuntime;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Освещение
    // 1. Мягкий полусферический свет (небо/земля)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // 2. Направленный свет с тенями (имитация заходящего солнца / фонаря)
    this.dirLight = new THREE.DirectionalLight(0xffaa66, 1.0);
    this.dirLight.position.set(10, 25, 10);
    this.dirLight.castShadow = !this.isMobileRuntime;
    
    // Настройка теней для оптимизации
    this.dirLight.shadow.mapSize.width = this.isMobileRuntime ? 512 : 1024;
    this.dirLight.shadow.mapSize.height = this.isMobileRuntime ? 512 : 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 80;
    const d = 25;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;

    this.scene.add(this.dirLight);
    this.createSkyDome();

    // Обработка ресайза
    window.addEventListener('resize', () => this.onWindowResize());
  }

  createSkyDome() {
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 32;
    skyCanvas.height = 256;
    const ctx = skyCanvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, skyCanvas.height);
    gradient.addColorStop(0, '#10264c');
    gradient.addColorStop(0.42, '#3d5f91');
    gradient.addColorStop(0.72, '#ff9d68');
    gradient.addColorStop(1, '#7b4a6e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, skyCanvas.width, skyCanvas.height);

    const texture = new THREE.CanvasTexture(skyCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(420, 32, 16),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false })
    );
    sky.rotation.y = Math.PI * 0.15;
    this.scene.add(sky);
    this.sky = sky;

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(7, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd6a3 })
    );
    moon.position.set(-72, 92, 92);
    this.scene.add(moon);
    this.moon = moon;

    const starGeo = new THREE.BufferGeometry();
    const starPositions = [];
    const starCount = this.isMobileRuntime ? 45 : 90;
    for (let i = 0; i < starCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 170 + Math.random() * 170;
      starPositions.push(
        Math.cos(angle) * radius,
        65 + Math.random() * 130,
        Math.sin(angle) * radius
      );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xfff2c8, size: 1.6, sizeAttenuation: true, fog: false })
    );
    this.scene.add(stars);
    this.stars = stars;
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

  initAssetGate() {
    const assetPromises = [
      this.player.readyPromise,
      this.pursuer.readyPromise,
      this.obstacleManager.readyPromise,
      this.collectibleManager.readyPromise
    ].filter(Boolean);

    this.setPlayLoading(true);
    Promise.allSettled(assetPromises).then(() => {
      this.assetsReady = true;
      this.setPlayLoading(false);
    });
  }

  setPlayLoading(isLoading) {
    const playButton = document.getElementById('btn-play');
    if (!playButton) return;

    playButton.disabled = isLoading;
    playButton.textContent = isLoading ? 'ЗАГРУЗКА...' : 'ИГРАТЬ';
    playButton.style.cursor = isLoading ? 'wait' : '';
    playButton.style.opacity = isLoading ? '0.72' : '';
  }

  // Настройка витринной сцены меню: Ваня близко к камере, Лиза видна в кадре.
  setupMenuScene() {
    this.worldGen.reset();
    this.player.reset();
    this.pursuer.reset();

    const mobileMenu = this.isMobileRuntime;

    this.player.mesh.position.set(mobileMenu ? -0.62 : -0.35, 0, mobileMenu ? 0.5 : 0.4);
    this.player.mesh.rotation.y = 0;
    this.player.setPresentationMode('idle');

    this.pursuer.mesh.position.set(mobileMenu ? 0.58 : 1.05, 0, mobileMenu ? -0.2 : -0.45);
    this.pursuer.mesh.rotation.y = mobileMenu ? -0.1 : -0.2;
    this.pursuer.setPresentationMode('run');

    this.camera.position.set(0, mobileMenu ? 1.45 : 1.35, mobileMenu ? 3.45 : 3.05);
    this.camera.lookAt(new THREE.Vector3(mobileMenu ? -0.08 : -0.25, 1.05, 0));
  }

  // Постановочная сцена перед забегом: Ваня и Лиза встречаются взглядом.
  setupIntroScene() {
    this.introTimer = 0;

    this.player.mesh.position.set(-0.72, 0, 0.3);
    this.player.mesh.rotation.y = Math.PI / 2;
    this.player.setPresentationMode('idle');

    this.pursuer.mesh.position.set(0.72, 0, 0.3);
    this.pursuer.mesh.rotation.y = -Math.PI / 2;
    this.pursuer.setPresentationMode('kick');

    this.camera.position.set(0, 1.25, 2.75);
    this.camera.lookAt(new THREE.Vector3(0, 1.05, 0.25));
  }

  updateMenuCamera(dt) {
    const mobileMenu = this.isMobileRuntime;
    const time = performance.now() * 0.001;
    const targetBaseX = mobileMenu ? -0.08 : -0.2;
    const sway = mobileMenu ? 0.04 : 0.08;
    const target = new THREE.Vector3(targetBaseX + Math.sin(time * 0.55) * sway, 1.08, 0.05);

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, Math.sin(time * 0.4) * sway, 2 * dt);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, mobileMenu ? 1.45 : 1.35, 3 * dt);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, mobileMenu ? 3.45 : 3.05, 3 * dt);
    this.camera.lookAt(target);
  }

  updateIntroScene(dt) {
    this.introTimer += dt;

    const turnProgress = THREE.MathUtils.smoothstep(this.introTimer, 1.05, 1.75);
    this.player.mesh.rotation.y = THREE.MathUtils.lerp(Math.PI / 2, 0, turnProgress);
    this.pursuer.mesh.rotation.y = THREE.MathUtils.lerp(-Math.PI / 2, 0, turnProgress);
    if (this.introTimer > 1.2 && this.pursuer.presentationMode !== 'run') {
      this.pursuer.setPresentationMode('run');
    }

    this.player.updatePresentation(dt);
    this.pursuer.updatePresentation(dt);
  }

  updateIntroCamera(dt) {
    const progress = THREE.MathUtils.smoothstep(this.introTimer, 0.85, 1.8);
    const startPos = new THREE.Vector3(0, 1.25, 2.75);
    const runPos = new THREE.Vector3(0, 2.4, -4.2);
    const camPos = startPos.lerp(runPos, progress);
    const lookAtPos = new THREE.Vector3(0, 1.1, THREE.MathUtils.lerp(0.25, 6, progress));

    this.camera.position.lerp(camPos, 7 * dt);
    this.camera.lookAt(lookAtPos);
  }

  beginRunAfterIntro() {
    this.state = 'PLAYING';
    this.player.mesh.position.set(0, 0, 0);
    this.player.mesh.rotation.y = 0;
    this.player.setPresentationMode('run');
    this.pursuer.reset();

    audioManager.playMusic('run');
    audioManager.playVanyaSpawn();

    if (this.startWithBoxBonus) {
      this.player.activateBoxBonus();
    }

    this.clock.getDelta();
  }

  // Обновление положения камеры в процессе бега (слежение за Ваней)
  updateCamera(dt) {
    if (this.state === 'PAUSED') return;

    // Смещение скайдома, луны и звезд за игроком
    if (this.sky) {
      this.sky.position.z = this.player.mesh.position.z;
      this.sky.position.x = this.player.mesh.position.x;
    }
    if (this.moon) {
      this.moon.position.z = this.player.mesh.position.z + 92;
      this.moon.position.x = this.player.mesh.position.x - 72;
    }
    if (this.stars) {
      this.stars.position.z = this.player.mesh.position.z;
      this.stars.position.x = this.player.mesh.position.x;
    }

    if (this.state === 'MENU') {
      this.updateMenuCamera(dt);
      return;
    }

    if (this.state === 'INTRO') {
      this.updateIntroCamera(dt);
      return;
    }

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
    if (!this.assetsReady) {
      this.setPlayLoading(true);
      return;
    }

    this.state = 'INTRO';
    this.score = 0;
    this.collectedBottles = 0;
    this.stumbleLevel = 0;
    this.collisionCooldown = 0;
    this.cleanRunTimer = 0;

    // Сброс всех компонентов
    this.worldGen.reset();
    this.player.reset();
    this.pursuer.reset();
    this.obstacleManager.reset();
    this.collectibleManager.reset();

    // Запускаем HUD
    uiManager.startHUD();

    audioManager.stopMusic();
    audioManager.prepareMusic('run');
    this.startWithBoxBonus = uiManager.useBox();
    this.player.setFartCharges(uiManager.useFartChargesForRun());
    this.setupIntroScene();

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
    this.setupMenuScene();
  }

  // Столкновение - конец игры
  triggerGameOver() {
    this.state = 'GAMEOVER';
    
    // При проигрыше музыка и звуки останавливаются
    audioManager.stopAll();

    // Лиза подбегает вплотную
    this.pursuer.catchUp();
    this.player.isDead = true;

    // Взрыв и исчезновение Вани (через небольшую задержку, чтобы Лиза добежала)
    setTimeout(() => {
      if (this.state === 'GAMEOVER') {
        if (this.player.mesh) this.player.mesh.visible = false;
        this.createExplosion(this.player.mesh.position);
        audioManager.playSFX('hit'); // Звук взрыва/удара
      }
    }, 400);

    // Небольшая задержка перед меню Game Over, чтобы показать сцену поимки
    setTimeout(() => {
      if (this.state === 'GAMEOVER') {
        uiManager.showGameOver(this.score, this.collectedBottles);
      }
    }, 2000);
  }

  createExplosion(position) {
    const particleCount = 100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y + 1; // Центр взрыва чуть выше земли
      positions[i * 3 + 2] = position.z;

      velocities.push({
        x: (Math.random() - 0.5) * 15,
        y: (Math.random() - 0.5) * 15 + 10,
        z: (Math.random() - 0.5) * 15
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0xff3300,
      size: 0.6,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);

    if (!this.explosions) this.explosions = [];
    this.explosions.push({ mesh: particles, velocities: velocities, age: 0 });
  }

  createPickupText(text, colorHex, position3D) {
    let el = this.pickupTextEl;
    if (!el) {
      el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.color = '#fff';
      el.style.fontWeight = 'bold';
      el.style.fontSize = '24px';
      el.style.textShadow = '1px 1px 2px #000'; // Optimized shadow
      el.style.pointerEvents = 'none';
      el.style.zIndex = '100';
      this.pickupTextEl = el;
    }

    if (this.pickupTextAnimation) {
      this.pickupTextAnimation.cancel();
    }

    el.innerText = text;
    el.style.display = 'block';
    if (!el.isConnected) {
      document.body.appendChild(el);
    }

    const vector = position3D.clone();
    vector.y += 2.5; 
    vector.project(this.camera);

    const x = (vector.x * .5 + .5) * window.innerWidth;
    const y = (-(vector.y * .5) + .5) * window.innerHeight;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    this.pickupTextAnimation = el.animate([
      { transform: 'translate(-50%, 0) scale(1)', opacity: 1 },
      { transform: 'translate(-50%, -100px) scale(1.5)', opacity: 0 }
    ], {
      duration: 1000,
      easing: 'ease-out'
    });
    this.pickupTextAnimation.onfinish = () => {
      el.style.display = 'none';
    };
  }

  handleCollision(collision) {
    if (!collision) return;

    if (this.collisionCooldown > 0) {
      // If Vanya is currently invulnerable, still trigger the visual hit/destruction effect on the obstacle
      this.obstacleManager.playHitEffect(collision);
      collision.wasHit = true;
      return;
    }

    this.obstacleManager.playHitEffect(collision);
    collision.wasHit = true;
    this.cleanRunTimer = 0;
    this.collisionCooldown = CONFIG.STUMBLE_INVULNERABILITY / 1000;

    if (this.stumbleLevel >= 1) {
      this.triggerGameOver();
      return;
    }

    this.stumbleLevel = 1;
    this.player.runSpeed = Math.max(CONFIG.INITIAL_SPEED * 0.72, this.player.runSpeed * 0.72);
    this.pursuer.setChaseDistance(CONFIG.LIZA_WARNING_DISTANCE);
    audioManager.playSFX('crash');
    
    this.player.isStumbling = true;
    this.player.playCrashAnimation();
    
    setTimeout(() => {
      if (this.state === 'PLAYING') {
        this.player.isStumbling = false;
        this.player.stopCrashAnimation();
      }
    }, 1200);
  }

  updateChasePressure(dt) {
    if (this.collisionCooldown > 0) {
      this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    }

    this.cleanRunTimer += dt * 1000;
    if (this.cleanRunTimer >= CONFIG.LIZA_RECOVERY_DELAY) {
      this.stumbleLevel = 0;
      this.pursuer.recoverDistance(dt);
    }

    uiManager.updateChaseMeter(this.pursuer.getDangerPercent());
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
      this.updateChasePressure(dt);

      // 4. Обновление препятствий и проверка столкновений
      this.obstacleManager.update(dt, this.player.mesh.position.z);
      const collision = this.obstacleManager.checkCollisions(this.player);
      if (collision) {
        this.handleCollision(collision);
      }

      // 5. Обновление собираемых предметов и проверка сбора
      this.collectibleManager.update(dt, this.player.mesh.position.z);
      this.collectibleManager.checkPickups(this.player, (type, val) => {
        if (type === 'gin') {
          this.collectedBottles += val;
          uiManager.updateHUDBottles(this.collectedBottles);
          this.createPickupText(`+${val}`, 0x00ff00, this.player.mesh.position);
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
    else if (this.state === 'INTRO') {
      this.updateIntroScene(dt);

      if (this.introTimer >= 2.05) {
        this.beginRunAfterIntro();
      }
    }
    else if (this.state === 'MENU') {
      this.player.updatePresentation(dt);
      this.pursuer.updatePresentation(dt);
    }

    // Обновление частиц взрыва
    if (this.explosions) {
      for (let i = this.explosions.length - 1; i >= 0; i--) {
        const exp = this.explosions[i];
        exp.age += dt;
        const positions = exp.mesh.geometry.attributes.position.array;
        for (let j = 0; j < exp.velocities.length; j++) {
          positions[j * 3] += exp.velocities[j].x * dt;
          positions[j * 3 + 1] += exp.velocities[j].y * dt;
          positions[j * 3 + 2] += exp.velocities[j].z * dt;
          exp.velocities[j].y -= 30 * dt; // гравитация
        }
        exp.mesh.geometry.attributes.position.needsUpdate = true;
        exp.mesh.material.opacity = 1 - (exp.age / 1.5);
        if (exp.age > 1.5) {
          this.scene.remove(exp.mesh);
          if (exp.mesh.geometry) exp.mesh.geometry.dispose();
          if (exp.mesh.material) exp.mesh.material.dispose();
          this.explosions.splice(i, 1);
        }
      }
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
          if (!this.obstacleManager.babushkaFBX) {
            return;
          }
          this.obstacleManager.spawnObstaclesForChunk(chunk.startZ, this.worldGen.chunkLength);
          this.collectibleManager.spawnCollectiblesForChunk(chunk.startZ, this.worldGen.chunkLength);
          chunk.hasObstacles = true;
        } else if (chunk.startZ <= 30) {
          chunk.hasObstacles = true;
        }
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

function bootGame() {
  if (window.__game) return;
  window.__game = new Game();
}

// Модульные импорты могут выполниться уже после load, особенно на GitHub Pages.
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootGame, { once: true });
} else {
  bootGame();
}
