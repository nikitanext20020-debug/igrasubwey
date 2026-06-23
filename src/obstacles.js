// Модуль препятствий (Бабушек) для игры «Ваня Бежит»
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { audioManager } from './audio.js?v=5';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

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
      asphalt: new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.9 }),
      plastic: new THREE.MeshStandardMaterial({ color: 0xff6b00, roughness: 0.55 }),
      warning: new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.55 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 }),
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
    this.babushkaFallFBX = null;
    this.babushkaAnimations = null;
    this.babushkaFallAnimations = null;

    // Пулы объектов для оптимизации производительности (предотвращают лаги при клонировании скелетов)
    this.babushkaPool = [];
    this.babushkaFallPool = [];
    this.debrisPool = [];
    this.activeDebris = [];
    this.debrisGeometry = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.debrisLifetime = 0.55;
    this.debrisPiecesPerBurst = 6;
    this.debrisMaterialSets = {
      trash: [this.materials.bag, this.materials.metal, this.materials.plastic],
      cone_pack: [this.materials.plastic, this.materials.rope],
      bench: [this.materials.wood, this.materials.metal],
      roadblock: [this.materials.warning, this.materials.asphalt, this.materials.metal],
      barrier: [this.materials.warning, this.materials.asphalt, this.materials.metal]
    };
    this.assetTrackers = {
      standingBabushka: this.createReadyTracker(),
      fallingBabushka: this.createReadyTracker()
    };
    this.readyPromise = Promise.all(Object.values(this.assetTrackers).map(tracker => tracker.promise));

    setTimeout(() => this.loadFBXModel(), 2000);
  }

  createReadyTracker() {
    let resolve;
    const promise = new Promise(done => {
      resolve = done;
    });
    return { promise, resolve, done: false };
  }

  markReady(tracker) {
    if (!tracker || tracker.done) return;
    tracker.done = true;
    tracker.resolve();
  }

  // Загрузка GLB модели бабушки
  loadFBXModel() {
    const loader = new GLTFLoader();
    loader.load('models/babkastoit.glb', (gltf) => {
      try {
        this.babushkaFBX = gltf.scene;
        this.babushkaFBX.traverse(child => {
          if (child.isSkinnedMesh) {
            if (child.geometry) {
              // Sanitize skinWeight to fix NaN coordinates issue in Mixamo models
              if (child.geometry.attributes.skinWeight) {
                const arr = child.geometry.attributes.skinWeight.array;
                for (let i = 0; i < arr.length; i++) {
                  if (isNaN(arr[i])) {
                    arr[i] = 0;
                  }
                }
                child.geometry.attributes.skinWeight.needsUpdate = true;
              }
              child.geometry.boundingBox = null;
              child.geometry.boundingSphere = null;
            }
            child.boundingBox = null;
            child.boundingSphere = null;
          }
        });
        this.babushkaAnimations = gltf.animations;
        console.log(`Babushka standing GLB Model loaded successfully! animations=${gltf.animations.length}`);
      } catch (e) {
        console.error('Error parsing Babushka standing GLB Model:', e);
        this.babushkaFBX = null;
        this.babushkaAnimations = null;
      } finally {
        this.markReady(this.assetTrackers.standingBabushka);
      }
    }, undefined, (err) => {
      console.warn('Babushka standing GLB Model file models/babkastoit.glb not found.');
      this.markReady(this.assetTrackers.standingBabushka);
    });

    loader.load('models/babkapadait.glb', (gltf) => {
      try {
        this.babushkaFallFBX = gltf.scene;
        this.babushkaFallFBX.traverse(child => {
          if (child.isSkinnedMesh) {
            if (child.geometry) {
              // Sanitize skinWeight to fix NaN coordinates issue in Mixamo models
              if (child.geometry.attributes.skinWeight) {
                const arr = child.geometry.attributes.skinWeight.array;
                for (let i = 0; i < arr.length; i++) {
                  if (isNaN(arr[i])) {
                    arr[i] = 0;
                  }
                }
                child.geometry.attributes.skinWeight.needsUpdate = true;
              }
              child.geometry.boundingBox = null;
              child.geometry.boundingSphere = null;
            }
            child.boundingBox = null;
            child.boundingSphere = null;
          }
        });
        this.babushkaFallAnimations = gltf.animations;
        this.prewarmBabushkaFallPool(2);
        console.log(`Babushka fall GLB Model loaded successfully! animations=${gltf.animations.length}`);
      } catch (e) {
        console.error('Error parsing Babushka fall GLB Model:', e);
        this.babushkaFallFBX = null;
        this.babushkaFallAnimations = null;
      } finally {
        this.markReady(this.assetTrackers.fallingBabushka);
      }
    }, undefined, (err) => {
      console.warn('Babushka fall GLB Model file models/babkapadait.glb not found.');
      this.markReady(this.assetTrackers.fallingBabushka);
    });
  }

  // Очистка всех препятствий
  reset() {
    this.clearDebris();
    this.obstacles.forEach(obs => {
      this.scene.remove(obs.mesh);
      if (obs.type === 'babushka') {
        this.recycleVisuals(obs);
      } else {
        this.disposeMesh(obs.mesh);
      }
    });
    this.obstacles = [];
  }

  // Спавн препятствий на новом чанке: микс "живых" и городских преград.
  spawnObstaclesForChunk(chunkStartZ, chunkLength) {
    const beforeCount = this.obstacles.length;
    const numGroups = 3 + Math.floor(Math.random() * 2); // 3-4 группы на чанк (уменьшено)
    const step = chunkLength / numGroups;

    // Редкий спавн одной бабушки на чанк (с вероятностью 30%) вместо двух обязательных
    if (this.babushkaFBX && Math.random() < 0.3) {
      const lane = Math.floor(Math.random() * 3) - 1;
      this.spawnSingleBabushka(lane, chunkStartZ + 15 + Math.random() * 30, Math.random() > 0.6);
    }

    for (let i = 0; i < numGroups; i++) {
      const zPos = chunkStartZ + i * step + 15 + Math.random() * 10;
      
      const groupType = Math.floor(Math.random() * 5); // 5 типов

      if (groupType === 0) {
        if (this.babushkaFBX && Math.random() < 0.35) {
          // Одиночная бабушка
          const lane = Math.floor(Math.random() * 3) - 1;
          const isMoving = Math.random() < 0.25;
          this.spawnSingleBabushka(lane, zPos, isMoving);
        } else {
          const lane = Math.floor(Math.random() * 3) - 1;
          this.spawnLaneObstacle(lane, zPos, Math.random() > 0.5 ? 'trash' : 'bench');
        }
      } 
      else if (groupType === 1) {
        // Две полосы заняты разными городскими штуками
        const freeLane = Math.floor(Math.random() * 3) - 1;
        for (let lane = -1; lane <= 1; lane++) {
          if (lane !== freeLane) {
            this.spawnLaneObstacle(lane, zPos + Math.random() * 2, Math.random() > 0.5 ? 'cone_pack' : 'trash');
          }
        }
      } 
      else if (groupType === 2) {
        const lane = Math.floor(Math.random() * 3) - 1;
        this.spawnLaneObstacle(lane, zPos, Math.random() > 0.5 ? 'roadblock' : 'bench');
      }
      else if (groupType === 3) {
        const freeLane = Math.floor(Math.random() * 3) - 1;
        for (let lane = -1; lane <= 1; lane++) {
          if (lane !== freeLane) {
            const type = lane === 0 ? 'roadblock' : 'cone_pack';
            this.spawnLaneObstacle(lane, zPos + Math.abs(lane) * 1.35, type);
          }
        }
      }
      else {
        const lane = Math.floor(Math.random() * 3) - 1;
        this.spawnLaneObstacle(lane, zPos, Math.random() > 0.5 ? 'trash' : 'cone_pack');
      }
    }

    const spawned = this.obstacles.slice(beforeCount);
    const babushkaCount = spawned.filter(obs => obs.type === 'babushka').length;
    console.log(`Spawned obstacles for chunk ${Math.round(chunkStartZ)}: babushka=${babushkaCount}, total=${spawned.length}`);
  }

  normalizeVisualToHeight(object, targetHeight) {
    object.traverse(child => {
      if (child.isSkinnedMesh) {
        if (child.geometry) {
          child.geometry.boundingBox = null;
          child.geometry.boundingSphere = null;
        }
        child.boundingBox = null;
        child.boundingSphere = null;
      }
    });
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);

    if (size.y > 0.001) {
      const scaleFix = targetHeight / size.y;
      object.scale.multiplyScalar(scaleFix);
    }

    const fixedBox = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    fixedBox.getCenter(center);
    // Skinned animation bone matrices handle local origin alignment; do not offset visual group positions
    // object.position.x -= center.x;
    // object.position.z -= center.z;
    // object.position.y -= fixedBox.min.y;
  }

  spawnLaneObstacle(lane, zPos, type) {
    const group = new THREE.Group();
    group.position.set(lane * CONFIG.LANE_WIDTH, 0, zPos);
    this.scene.add(group);

    let width = 1.15;
    let height = 1.1;
    let depth = 0.9;
    let colliderWidth = null;
    let colliderHeight = null;
    let colliderDepth = null;

    if (type === 'roadblock') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.55, 0.32), this.materials.warning);
      base.position.y = 0.32;
      base.castShadow = true;

      const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.08, 0.34), this.materials.asphalt);
      stripe1.position.set(0, 0.42, 0.01);
      stripe1.rotation.z = 0.28;

      const stripe2 = stripe1.clone();
      stripe2.position.y = 0.2;
      stripe2.rotation.z = -0.28;

      const legGeo = new THREE.BoxGeometry(0.12, 0.55, 0.16);
      const legL = new THREE.Mesh(legGeo, this.materials.metal);
      legL.position.set(-0.45, 0.25, -0.08);
      const legR = legL.clone();
      legR.position.x = 0.45;

      group.add(base, stripe1, stripe2, legL, legR);
      height = 0.85;
    } else if (type === 'cone_pack') {
      const coneGeo = new THREE.ConeGeometry(0.25, 0.75, 16);
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(coneGeo, this.materials.plastic);
        cone.position.set((i - 1) * 0.32, 0.38, (i % 2) * 0.28);
        cone.castShadow = true;

        const band = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.32), this.materials.rope);
        band.position.copy(cone.position);
        band.position.y = 0.42;
        group.add(cone, band);
      }
      width = 1.05;
      height = 0.8;
    } else if (type === 'bench') {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.16, 0.48), this.materials.wood);
      seat.position.y = 0.45;
      seat.castShadow = true;

      const back = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.42, 0.12), this.materials.wood);
      back.position.set(0, 0.78, -0.22);
      back.castShadow = true;

      const legGeo = new THREE.BoxGeometry(0.1, 0.45, 0.1);
      const legA = new THREE.Mesh(legGeo, this.materials.metal);
      legA.position.set(-0.48, 0.22, -0.12);
      const legB = legA.clone();
      legB.position.x = 0.48;
      const legC = legA.clone();
      legC.position.z = 0.15;
      const legD = legB.clone();
      legD.position.z = 0.15;

      group.rotation.y = Math.random() > 0.5 ? 0.18 : -0.18;
      group.add(seat, back, legA, legB, legC, legD);
      width = 1.45;
      height = 0.95;
      depth = 0.75;
    } else {
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.9, 12), this.materials.bag);
      bin.position.y = 0.45;
      bin.castShadow = true;

      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 12), this.materials.metal);
      lid.position.y = 0.95;
      lid.castShadow = true;

      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), this.materials.plastic);
      bottle.position.set(0.28, 0.18, 0.18);
      bottle.rotation.z = 0.75;
      group.add(bin, lid, bottle);
      width = 0.9;
      height = 1.05;
      colliderWidth = 1.65;
      colliderHeight = 1.35;
      colliderDepth = 2.0;
    }

    this.obstacles.push({
      type: 'street',
      obstacleType: type,
      lane,
      mesh: group,
      width,
      height,
      depth,
      colliderWidth,
      colliderHeight,
      colliderDepth,
      isMoving: false,
      moveSpeed: 0,
      voicePlayed: true
    });
  }

  // Создание одиночной бабушки
  spawnSingleBabushka(lane, zPos, isMoving) {
    const babushka = new THREE.Group();
    babushka.position.set(lane * CONFIG.LANE_WIDTH, 0, zPos);
    this.scene.add(babushka);

    let mixer = null;
    let visual = null;

    if (this.babushkaFBX) {
      if (this.babushkaPool.length > 0) {
        visual = this.babushkaPool.pop();
      } else {
        visual = SkeletonUtils.clone(this.babushkaFBX);
        
        // Настраиваем масштаб (аналогично игроку и преследователю)
        visual.scale.setScalar(0.8); 
        this.normalizeVisualToHeight(visual, 0.95);
        
        visual.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      }

      visual.position.set(0, 0, 0);
      visual.rotation.set(0, Math.PI, 0); // Поворачиваем лицом к игроку
      babushka.add(visual);

      // Анимации для бабушки
      if (this.babushkaAnimations && this.babushkaAnimations.length > 0) {
        if (!visual.userData.mixer) {
          visual.userData.mixer = new THREE.AnimationMixer(visual);
          let clip = this.babushkaAnimations[0];
          
          // Пытаемся найти анимацию ходьбы или бега
          const walkClip = this.babushkaAnimations.find(c => {
            const name = c.name.toLowerCase();
            return name.includes('walk') || name.includes('run') || name.includes('go') || name.includes('move');
          });
          if (walkClip) clip = walkClip;

          visual.userData.action = visual.userData.mixer.clipAction(clip);
        }
        mixer = visual.userData.mixer;
        visual.userData.action.reset().play();
      }
    } else {
      this.scene.remove(babushka);
      this.spawnLaneObstacle(lane, zPos, isMoving ? 'roadblock' : 'trash');
      return;
    }

    // Логика препятствия
    this.obstacles.push({
      type: 'babushka',
      lane,
      mesh: babushka,
      visual,
      width: 1.05,
      height: 0.98,
      depth: 1.05,
      colliderWidth: 1.18,
      colliderHeight: 1.15,
      colliderDepth: 1.35,
      isMoving,
      moveSpeed: 0,
      voicePlayed: false,
      wasHit: false, // Было ли столкновение
      mixer
    });
  }

  recycleVisuals(obs) {
    if (obs.type === 'babushka' && obs.visual) {
      obs.mesh.remove(obs.visual);
      if (obs.wasHit) {
        this.babushkaFallPool.push(obs.visual);
      } else {
        this.babushkaPool.push(obs.visual);
      }
      obs.visual = null;
    }
  }

  playHitEffect(obs) {
    if (!obs || obs.wasHit) return;

    if (obs.type !== 'babushka') {
      this.playStreetHitEffect(obs);
      return;
    }

    if (!this.babushkaFallFBX) {
      obs.wasHit = true;
      return;
    }

    if (obs.visual) {
      // Отправляем стоячую бабушку в пул
      obs.mesh.remove(obs.visual);
      this.babushkaPool.push(obs.visual);
      obs.visual = null;
    }

    // Достаем падающую бабушку из пула или создаем
    const fall = this.babushkaFallPool.pop() || this.createBabushkaFallVisual();

    fall.position.set(0, 0, 0);
    fall.rotation.set(0, Math.PI, 0);

    obs.mesh.add(fall);
    obs.visual = fall;
    obs.wasHit = true;

    if (this.babushkaFallAnimations && this.babushkaFallAnimations.length > 0) {
      if (!fall.userData.mixer) {
        fall.userData.mixer = new THREE.AnimationMixer(fall);
        const action = fall.userData.mixer.clipAction(this.babushkaFallAnimations[0]);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        fall.userData.action = action;
      }
      obs.mixer = fall.userData.mixer;
      fall.userData.action.reset().play();
    }
  }

  createBabushkaFallVisual() {
    const fall = SkeletonUtils.clone(this.babushkaFallFBX);
    fall.scale.setScalar(0.8);
    this.normalizeVisualToHeight(fall, 0.85);
    fall.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return fall;
  }

  prewarmBabushkaFallPool(count) {
    if (!this.babushkaFallFBX) return;
    while (this.babushkaFallPool.length < count) {
      this.babushkaFallPool.push(this.createBabushkaFallVisual());
    }
  }

  playStreetHitEffect(obs) {
    obs.wasHit = true;

    if (!obs.mesh) return;

    obs.mesh.visible = false;
    const center = obs.mesh.position.clone();
    center.y = obs.type === 'barrier'
      ? Math.max(0.45, (obs.yPos || obs.height * 0.5) * 0.8)
      : Math.max(0.42, (obs.height || 1) * 0.45);
    this.spawnDebris(center, obs);
  }

  createDebrisBurst() {
    const group = new THREE.Group();
    group.visible = false;
    group.userData.age = 0;
    group.userData.pieces = [];

    for (let i = 0; i < this.debrisPiecesPerBurst; i++) {
      const piece = new THREE.Mesh(this.debrisGeometry, this.materials.metal);
      piece.castShadow = false;
      piece.receiveShadow = false;
      piece.userData.velocity = new THREE.Vector3();
      piece.userData.spin = new THREE.Vector3();
      group.add(piece);
      group.userData.pieces.push(piece);
    }

    return group;
  }

  spawnDebris(center, obs) {
    const burst = this.debrisPool.pop() || this.createDebrisBurst();
    const materialKey = obs.obstacleType || obs.type;
    const materials = this.debrisMaterialSets[materialKey] || this.debrisMaterialSets.barrier;
    const width = Math.min(obs.width || 1.2, 3.2);
    const depth = Math.min(obs.depth || 0.8, 1.6);

    burst.position.copy(center);
    burst.visible = true;
    burst.userData.age = 0;

    for (let i = 0; i < burst.userData.pieces.length; i++) {
      const piece = burst.userData.pieces[i];
      piece.visible = true;
      piece.material = materials[i % materials.length];
      piece.position.set(
        (Math.random() - 0.5) * width * 0.55,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * depth * 0.55
      );
      piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      piece.scale.setScalar(0.75 + Math.random() * 0.7);
      piece.userData.velocity.set(
        (Math.random() - 0.5) * 2.4,
        1.2 + Math.random() * 1.15,
        -1.5 - Math.random() * 1.8
      );
      piece.userData.spin.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8
      );
    }

    this.scene.add(burst);
    this.activeDebris.push(burst);
  }

  clearDebris() {
    for (let i = this.activeDebris.length - 1; i >= 0; i--) {
      this.recycleDebrisBurst(i);
    }
  }

  recycleDebrisBurst(index) {
    const burst = this.activeDebris[index];
    if (!burst) return;

    if (burst.parent) {
      burst.parent.remove(burst);
    }
    burst.visible = false;
    this.activeDebris.splice(index, 1);
    if (this.debrisPool.length < 18) {
      this.debrisPool.push(burst);
    }
  }

  updateDebris(dt) {
    for (let i = this.activeDebris.length - 1; i >= 0; i--) {
      const burst = this.activeDebris[i];
      burst.userData.age += dt;

      if (burst.userData.age >= this.debrisLifetime) {
        this.recycleDebrisBurst(i);
        continue;
      }

      for (const piece of burst.userData.pieces) {
        const velocity = piece.userData.velocity;
        const spin = piece.userData.spin;
        velocity.y -= 5.8 * dt;
        piece.position.x += velocity.x * dt;
        piece.position.y += velocity.y * dt;
        piece.position.z += velocity.z * dt;
        piece.rotation.x += spin.x * dt;
        piece.rotation.y += spin.y * dt;
        piece.rotation.z += spin.z * dt;

        if (piece.position.y < -0.28) {
          piece.position.y = -0.28;
          velocity.y *= -0.18;
        }
      }
    }
  }

  // Создание барьера на все 3 полосы (прыжок или подкат)
  spawnThreeLaneBarrier(zPos, type) {
    const barrierGroup = new THREE.Group();
    barrierGroup.position.set(0, 0, zPos);
    this.scene.add(barrierGroup);

    let height = 0.85;
    let width = CONFIG.LANE_WIDTH * 3;
    let depth = 0.45;
    let yPos = 0.42;

    if (type === 'jump') {
      // --- НИЗКИЙ БАРЬЕР ДЛЯ ПРЫЖКА ---
      const fenceGeo = new THREE.BoxGeometry(width, 0.28, 0.16);
      const fence = new THREE.Mesh(fenceGeo, this.materials.warning);
      fence.position.y = 0.22;
      fence.castShadow = true;
      fence.receiveShadow = true;
      barrierGroup.add(fence);

      const stripeGeo = new THREE.BoxGeometry(width, 0.05, 0.18);
      const stripeA = new THREE.Mesh(stripeGeo, this.materials.asphalt);
      stripeA.position.y = 0.29;
      const stripeB = stripeA.clone();
      stripeB.position.y = 0.16;
      barrierGroup.add(stripeA, stripeB);

      height = 0.58; // Низкое препятствие для прыжка
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
      const rope = new THREE.Mesh(ropeGeo, this.materials.warning);
      rope.position.y = 1.62;
      barrierGroup.add(rope);

      // Висящее белье (ковры / простыни)
      const numClothes = 4;
      const cWidth = width / (numClothes + 1);
      
      for (let i = 0; i < numClothes; i++) {
        const xOffset = -width / 2 + (i + 1) * cWidth;
        const clothGeo = new THREE.BoxGeometry(0.72, 0.52, 0.05);
        const clothMat = this.materials.cloth[i % this.materials.cloth.length];
        const cloth = new THREE.Mesh(clothGeo, clothMat);
        cloth.position.set(xOffset, 1.28, 0);
        cloth.castShadow = true;
        barrierGroup.add(cloth);
      }

      height = 1.85;
      yPos = 1.35; // Центр коллизии находится вверху, так как снизу свободное пространство!
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
    this.updateDebris(dt);

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
      if (obs.type === 'babushka' && !obs.voicePlayed && obs.mesh.position.z - playerZ < 12 && obs.mesh.position.z > playerZ) {
        audioManager.playBabushkaVoice();
        obs.voicePlayed = true; // Пытаемся воспроизвести один раз для каждой бабушки
      }

      // 3. Удаление препятствий, оставшихся далеко позади игрока
      if (obs.mesh.position.z < playerZ - 15) {
        this.scene.remove(obs.mesh);
        if (obs.type === 'babushka') {
          this.recycleVisuals(obs);
        } else {
          this.disposeMesh(obs.mesh);
        }
        this.obstacles.splice(i, 1);
      }
    }
  }

  // Проверка столкновений
  checkCollisions(player) {
    if (player.isInvulnerable()) return null; // Игрок неуязвим (в коробке или высоко на пуке)

    const playerCollider = player.getCollider();
    const colliderPadding = new THREE.Vector3(0.28, 0.08, 1.25);

    for (let obs of this.obstacles) {
      if (obs.wasHit) continue;

      // Вычисляем collider для препятствия
      let obsCollider;
      if (obs.type === 'barrier') {
        if (obs.barrierType === 'slide') {
          // Высокий барьер (веревка с бельем). 
          // Коллизия перекрывает диапазон от Y = 1.0 до Y = 2.2
          // Если игрок делает подкат, его collider находится ниже Y = 0.9, и он проскальзывает.
          obsCollider = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(obs.mesh.position.x, obs.yPos, obs.mesh.position.z),
            new THREE.Vector3(obs.width + colliderPadding.x, 1.2, obs.depth + colliderPadding.z)
          );
        } else {
          // Низкий барьер для прыжка. Перекрывает низ от Y = 0 до Y = 1.25.
          // Если игрок прыгает, его collider взлетает выше Y = 1.25, и он перепрыгивает.
          obsCollider = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(obs.mesh.position.x, obs.yPos, obs.mesh.position.z),
            new THREE.Vector3(obs.width + colliderPadding.x, obs.height + colliderPadding.y, obs.depth + colliderPadding.z)
          );
        }
      } else {
        // Одиночные препятствия и городские объекты: чуть расширяем collider,
        // чтобы быстрый бег не выглядел как пробегание сквозь край модели.
        obsCollider = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(obs.mesh.position.x, obs.height / 2, obs.mesh.position.z),
          new THREE.Vector3(
            (obs.colliderWidth || obs.width) + colliderPadding.x,
            (obs.colliderHeight || obs.height) + colliderPadding.y,
            (obs.colliderDepth || obs.depth) + colliderPadding.z
          )
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
