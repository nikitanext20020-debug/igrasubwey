// Модуль препятствий (Бабушек) для игры «Ваня Бежит»
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { audioManager } from './audio.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    
    // Предварительно созданные материалы
    this.materials = {
      skin: new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 }),
      bag: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 }),
      wheel: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 }),
      rope: new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9 }),
      cloth: [
        new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: 0x4444ff, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: 0x44ff44, roughness: 0.8 })
      ],
      // Варианты пальто
      coats: [
        new THREE.MeshStandardMaterial({ color: 0x5a504d, roughness: 0.9 }), // Коричневое
        new THREE.MeshStandardMaterial({ color: 0x3e4a56, roughness: 0.9 }), // Синее
        new THREE.MeshStandardMaterial({ color: 0x4e5844, roughness: 0.9 })  // Зеленовато-серое
      ],
      // Варианты платков
      scarfs: [
        new THREE.MeshStandardMaterial({ color: 0x9c27b0, roughness: 0.8 }), // Фиолетовый
        new THREE.MeshStandardMaterial({ color: 0xe91e63, roughness: 0.8 }), // Розовый
        new THREE.MeshStandardMaterial({ color: 0xff9800, roughness: 0.8 })  // Оранжевый
      ]
    };

    // Подключение FBX Бабушки
    this.babushkaFBX = null;
    this.babushkaAnimations = null;
    this.loadFBXModel();
  }

  // Загрузка FBX модели бабушки
  loadFBXModel() {
    const loader = new FBXLoader();
    loader.load('models/babushka.fbx', (fbx) => {
      try {
        this.babushkaFBX = fbx;
        this.babushkaAnimations = fbx.animations;
        console.log('Babushka FBX Model loaded successfully!');
      } catch (e) {
        console.error('Error parsing Babushka FBX Model:', e);
        this.babushkaFBX = null;
        this.babushkaAnimations = null;
      }
    }, undefined, (err) => {
      console.warn('Babushka FBX Model file models/babushka.fbx not found. Playing with fallback rounded primitives.');
    });
  }

  // Очистка всех препятствий
  reset() {
    this.obstacles.forEach(obs => {
      this.scene.remove(obs.mesh);
      this.disposeMesh(obs.mesh);
    });
    this.obstacles = [];
  }

  // Спавн препятствий на новом чанке (увеличено количество преград)
  spawnObstaclesForChunk(chunkStartZ, chunkLength) {
    const numGroups = 4 + Math.floor(Math.random() * 2); // 4 или 5 групп на чанк (более плотно!)
    const step = chunkLength / numGroups;

    for (let i = 0; i < numGroups; i++) {
      const zPos = chunkStartZ + i * step + 15 + Math.random() * 10;
      
      // Выбираем тип группы: 
      // 0: 1 полоса (обычная бабушка)
      // 1: 2 полосы (две бабушки рядом)
      // 2: 3 полосы (барьер: прыжок или подкат)
      const groupType = Math.floor(Math.random() * 3);

      if (groupType === 0) {
        // Одиночная бабушка
        const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
        const isMoving = Math.random() > 0.6; // движется ли навстречу
        this.spawnSingleBabushka(lane, zPos, isMoving);
      } 
      else if (groupType === 1) {
        // Две полосы заняты
        const freeLane = Math.floor(Math.random() * 3) - 1; // Свободная полоса
        for (let lane = -1; lane <= 1; lane++) {
          if (lane !== freeLane) {
            this.spawnSingleBabushka(lane, zPos, false); // Статичные, чтобы не перегружать игрока
          }
        }
      } 
      else {
        // 3 полосы (барьер)
        const barrierType = Math.random() > 0.5 ? 'jump' : 'slide';
        this.spawnThreeLaneBarrier(zPos, barrierType);
      }
    }
  }

  // Создание одиночной бабушки
  spawnSingleBabushka(lane, zPos, isMoving) {
    const babushka = new THREE.Group();
    babushka.position.set(lane * CONFIG.LANE_WIDTH, 0, zPos);
    this.scene.add(babushka);

    let mixer = null;

    if (this.babushkaFBX) {
      const clone = this.babushkaFBX.clone();
      
      // Настраиваем масштаб (аналогично игроку и преследователю)
      clone.scale.setScalar(0.008); 
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, Math.PI, 0); // Поворачиваем лицом к игроку
      
      clone.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      babushka.add(clone);

      // Анимации для бабушки
      if (this.babushkaAnimations && this.babushkaAnimations.length > 0) {
        mixer = new THREE.AnimationMixer(clone);
        let clip = this.babushkaAnimations[0];
        
        // Пытаемся найти анимацию ходьбы или бега
        const walkClip = this.babushkaAnimations.find(c => {
          const name = c.name.toLowerCase();
          return name.includes('walk') || name.includes('run') || name.includes('go') || name.includes('move');
        });
        if (walkClip) clip = walkClip;

        const action = mixer.clipAction(clip);
        action.play();
      }
    } else {
      const coatMat = this.materials.coats[Math.floor(Math.random() * this.materials.coats.length)];
      const scarfMat = this.materials.scarfs[Math.floor(Math.random() * this.materials.scarfs.length)];

      // 1. Пальто (конусообразное тело)
      const bodyGeo = new THREE.CylinderGeometry(0.25, 0.45, 1.2, 8);
      const body = new THREE.Mesh(bodyGeo, coatMat);
      body.position.y = 0.6;
      body.castShadow = true;
      babushka.add(body);

      // 2. Голова (Сфера)
      const headGeo = new THREE.SphereGeometry(0.2, 10, 10);
      const head = new THREE.Mesh(headGeo, this.materials.skin);
      head.position.set(0, 1.25, 0);
      head.castShadow = true;
      babushka.add(head);

      // 3. Платок (Конус)
      const scarfGeo = new THREE.ConeGeometry(0.24, 0.45, 10);
      const scarf = new THREE.Mesh(scarfGeo, scarfMat);
      scarf.position.set(0, 1.34, -0.03);
      scarf.rotation.x = 0.15;
      scarf.castShadow = true;
      babushka.add(scarf);

      // Узел платка под подбородком
      const knotGeo = new THREE.SphereGeometry(0.06, 6, 6);
      const knot = new THREE.Mesh(knotGeo, scarfMat);
      knot.position.set(0, 1.08, 0.14);
      babushka.add(knot);

      // 4. Сумка-тележка
      const cart = new THREE.Group();
      cart.position.set(0.38, 0, 0.2); // Справа от бабушки
      
      // Сумка
      const bagGeo = new THREE.BoxGeometry(0.28, 0.5, 0.28);
      const bag = new THREE.Mesh(bagGeo, this.materials.bag);
      bag.position.y = 0.35;
      bag.castShadow = true;
      cart.add(bag);

      // Ручка металлическая
      const handleGeo = new THREE.BoxGeometry(0.04, 0.45, 0.04);
      const handle = new THREE.Mesh(handleGeo, this.materials.metal);
      handle.position.set(-0.1, 0.6, -0.1);
      handle.rotation.z = -0.2;
      cart.add(handle);

      // Колеса (Сглаженные цилиндры)
      const wheelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12);
      wheelGeo.rotateZ(Math.PI / 2);
      
      const w1 = new THREE.Mesh(wheelGeo, this.materials.wheel);
      w1.position.set(-0.12, 0.08, 0);
      w1.castShadow = true;
      
      const w2 = w1.clone();
      w2.position.x = 0.12;

      cart.add(w1, w2);
      babushka.add(cart);
    }

    // Логика препятствия
    this.obstacles.push({
      type: 'babushka',
      lane,
      mesh: babushka,
      width: 1.1,
      height: 1.4,
      depth: 0.8,
      isMoving,
      moveSpeed: isMoving ? 5 : 0, // едет навстречу
      voicePlayed: false,
      mixer
    });
  }

  // Создание барьера на все 3 полосы (прыжок или подкат)
  spawnThreeLaneBarrier(zPos, type) {
    const barrierGroup = new THREE.Group();
    barrierGroup.position.set(0, 0, zPos);
    this.scene.add(barrierGroup);

    let height = 1.0;
    let width = CONFIG.LANE_WIDTH * 3;
    let depth = 0.6;
    let yPos = 0.5;

    if (type === 'jump') {
      // --- НИЗКИЙ БАРЬЕР ДЛЯ ПРЫЖКА ---
      const fenceGeo = new THREE.BoxGeometry(width, 0.8, 0.1);
      const fence = new THREE.Mesh(fenceGeo, this.materials.metal);
      fence.position.y = 0.4;
      fence.castShadow = true;
      fence.receiveShadow = true;
      barrierGroup.add(fence);

      // Добавим сглаженную бабушку по центру, которая грозит кулаком
      const bGeo = new THREE.CylinderGeometry(0.15, 0.22, 0.6, 8);
      const b = new THREE.Mesh(bGeo, this.materials.coats[0]);
      b.position.set(0, 0.7, 0);
      
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), this.materials.skin);
      head.position.set(0, 1.05, 0);
      
      const scarf = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 8), this.materials.scarfs[1]);
      scarf.position.set(0, 1.12, 0);

      barrierGroup.add(b, head, scarf);
      
      height = 1.25; // Высота препятствия для прыжка
      yPos = height / 2;
    } 
    else {
      // --- ВЫСОКИЙ БАРЬЕР ДЛЯ ПОДКАТА ---
      // Веревка с бельем на высоте 1.5 метра. Игроку нужно проскользнуть снизу.
      // Столбы по бокам дороги
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 5);
      const poleL = new THREE.Mesh(poleGeo, this.materials.metal);
      poleL.position.set(-width / 2, 1.1, 0);
      poleL.castShadow = true;

      const poleR = poleL.clone();
      poleR.position.x = width / 2;
      barrierGroup.add(poleL, poleR);

      // Веревка
      const ropeGeo = new THREE.BoxGeometry(width, 0.04, 0.04);
      const rope = new THREE.Mesh(ropeGeo, this.materials.rope);
      rope.position.y = 1.9;
      barrierGroup.add(rope);

      // Висящее белье (ковры / простыни)
      const numClothes = 4;
      const cWidth = width / (numClothes + 1);
      
      for (let i = 0; i < numClothes; i++) {
        const xOffset = -width / 2 + (i + 1) * cWidth;
        const clothGeo = new THREE.BoxGeometry(0.9, 0.9, 0.05);
        const clothMat = this.materials.cloth[i % this.materials.cloth.length];
        const cloth = new THREE.Mesh(clothGeo, clothMat);
        cloth.position.set(xOffset, 1.4, 0);
        cloth.castShadow = true;
        barrierGroup.add(cloth);
      }

      height = 2.2;
      yPos = 1.6; // Центр коллизии находится вверху, так как снизу свободное пространство!
      // Для подката: коллизия перекрывает только верхнюю часть. 
      // Если игрок пригнулся (высота игрока = 0.9, y = 0), он не касается верхней рамки.
    }

    this.obstacles.push({
      type: 'barrier',
      barrierType: type, // 'jump' или 'slide'
      mesh: barrierGroup,
      width,
      height,
      depth,
      yPos,
      isMoving: false,
      moveSpeed: 0,
      voicePlayed: false
    });
  }

  // Обновление позиций бабушек в игровом цикле
  update(dt, playerZ) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];

      // 1. Движение движущихся бабушек навстречу
      if (obs.isMoving) {
        obs.mesh.position.z -= obs.moveSpeed * dt;
      }

      // Обновление анимаций FBX, если они есть
      if (obs.mixer) {
        obs.mixer.update(dt);
      }

      // 2. Логика озвучки бабушек:
      // Если бабушка близко перед игроком (по Z в пределах 25 метров) и голос еще не играл
      if (obs.type === 'babushka' && !obs.voicePlayed && obs.mesh.position.z - playerZ < 25 && obs.mesh.position.z > playerZ) {
        audioManager.playBabushkaVoice();
        obs.voicePlayed = true; // Пытаемся воспроизвести один раз для каждой бабушки
      }

      // 3. Удаление препятствий, оставшихся далеко позади игрока
      if (obs.mesh.position.z < playerZ - 15) {
        this.scene.remove(obs.mesh);
        this.disposeMesh(obs.mesh);
        this.obstacles.splice(i, 1);
      }
    }
  }

  // Проверка столкновений
  checkCollisions(player) {
    if (player.isInvulnerable()) return null; // Игрок неуязвим (в коробке или высоко на пуке)

    const playerCollider = player.getCollider();

    for (let obs of this.obstacles) {
      // Вычисляем collider для препятствия
      let obsCollider;
      if (obs.type === 'barrier') {
        if (obs.barrierType === 'slide') {
          // Высокий барьер (веревка с бельем). 
          // Коллизия перекрывает диапазон от Y = 1.0 до Y = 2.2
          // Если игрок делает подкат, его collider находится ниже Y = 0.9, и он проскальзывает.
          obsCollider = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(obs.mesh.position.x, obs.yPos, obs.mesh.position.z),
            new THREE.Vector3(obs.width, 1.2, obs.depth) // Высота коллизии 1.2, висит сверху
          );
        } else {
          // Низкий барьер для прыжка. Перекрывает низ от Y = 0 до Y = 1.25.
          // Если игрок прыгает, его collider взлетает выше Y = 1.25, и он перепрыгивает.
          obsCollider = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(obs.mesh.position.x, obs.yPos, obs.mesh.position.z),
            new THREE.Vector3(obs.width, obs.height, obs.depth)
          );
        }
      } else {
        // Обычная бабушка
        obsCollider = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(obs.mesh.position.x, obs.height / 2, obs.mesh.position.z),
          new THREE.Vector3(obs.width, obs.height, obs.depth)
        );
      }

      // Проверка пересечения
      if (playerCollider.intersectsBox(obsCollider)) {
        return obs;
      }
    }

    return null;
  }

  // Очистка геометрии
  disposeMesh(obj) {
    obj.traverse(child => {
      if (child.isMesh && child.geometry) {
        child.geometry.dispose();
      }
    });
  }
}
