// Класс игрока Вани для игры «Ваня Бежит»
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { audioManager } from './audio.js';
import { uiManager } from './ui.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.scene.add(this.mesh);

    // Состояние движения
    this.currentLane = 0; // -1: левая, 0: центр, 1: правая
    this.targetX = 0;
    this.yVelocity = 0;
    this.isGrounded = true;
    this.isJumping = false;
    this.isSliding = false;
    this.slideTimer = 0;

    // Параметры скорости и набора очков
    this.runSpeed = CONFIG.INITIAL_SPEED;
    
    // Энергия для реактивного пука
    this.fartFuel = CONFIG.FART_MAX_FUEL;
    this.isFarting = false;
    this.pinkGinBoostTimer = 0;

    // Состояния бонусов
    this.activeBonus = null; // 'box' или 'fart'
    this.boxTimer = 0;

    // Для коллизий
    this.width = 1.0;
    this.height = 1.8;
    this.depth = 0.8;

    this.buildCharacter();
    this.reset();

    // Подключение FBX
    this.fbxModel = null;
    this.mixer = null;
    this.fbxActions = {};
    this.loadFBXModel();
  }

  // Создание low-poly 3D-модели Вани из примитивов
  buildCharacter() {
    this.bodyParts = {};

    // Материалы
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 }); // Кожа
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.6 }); // Оранжевое худи
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1a337a, roughness: 0.7 }); // Синие джинсы
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }); // Белые кроссовки
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 }); // Каштановые волосы

    // Родительский контейнер модели (для вращений/подкатов)
    this.modelGroup = new THREE.Group();
    this.mesh.add(this.modelGroup);

    // Сглаженный торс (Цилиндр)
    const torsoGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.8, 10);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 0.9;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.modelGroup.add(torso);
    this.bodyParts.torso = torso;

    // Круглая голова (Сфера)
    const headGeo = new THREE.SphereGeometry(0.24, 12, 12);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 1.48, 0);
    head.castShadow = true;
    this.modelGroup.add(head);
    this.bodyParts.head = head;

    // Волосы (Объемная сфера на затылке)
    const hairGeo = new THREE.SphereGeometry(0.25, 10, 10);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 1.54, -0.05);
    hair.scale.set(1.02, 0.9, 1.05);
    this.modelGroup.add(hair);

    // Ноги (Цилиндры)
    const legGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.6, 8);
    
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.16, 0.3, 0);
    leftLeg.castShadow = true;
    this.modelGroup.add(leftLeg);
    this.bodyParts.leftLeg = leftLeg;

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.16, 0.3, 0);
    rightLeg.castShadow = true;
    this.modelGroup.add(rightLeg);
    this.bodyParts.rightLeg = rightLeg;

    // Обувь (Сплюснутые округлые сферы)
    const shoeGeo = new THREE.SphereGeometry(0.13, 10, 10);
    
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(-0.16, 0.04, 0.06);
    leftShoe.scale.set(0.9, 0.6, 1.5); // вытягиваем по оси Z
    leftShoe.castShadow = true;
    this.modelGroup.add(leftShoe);
    this.bodyParts.leftShoe = leftShoe;

    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0.16, 0.04, 0.06);
    rightShoe.scale.set(0.9, 0.6, 1.5);
    rightShoe.castShadow = true;
    this.modelGroup.add(rightShoe);
    this.bodyParts.rightShoe = rightShoe;

    // Руки (Цилиндры)
    const armGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.6, 8);
    
    const leftArm = new THREE.Mesh(armGeo, shirtMat);
    leftArm.position.set(-0.36, 0.9, 0);
    leftArm.castShadow = true;
    this.modelGroup.add(leftArm);
    this.bodyParts.leftArm = leftArm;

    const rightArm = new THREE.Mesh(armGeo, shirtMat);
    rightArm.position.set(0.36, 0.9, 0);
    rightArm.castShadow = true;
    this.modelGroup.add(rightArm);
    this.bodyParts.rightArm = rightArm;

    // --- БОНУС 1: КОРОБКА-САМОЛЁТ ---
    this.boxBonusGroup = new THREE.Group();
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.9 }); // Картон
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xc2a47c, roughness: 0.9 }); 
    const propMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
    
    // Основная коробка вокруг игрока
    const boxGeo = new THREE.BoxGeometry(1.3, 1.2, 1.3);
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.position.y = 0.7;
    boxMesh.castShadow = true;
    this.boxBonusGroup.add(boxMesh);
    
    // Крылья
    const wingLGeo = new THREE.BoxGeometry(1.2, 0.05, 0.5);
    const wingL = new THREE.Mesh(wingLGeo, wingMat);
    wingL.position.set(-1.1, 0.9, 0);
    wingL.castShadow = true;
    const wingR = wingL.clone();
    wingR.position.x = 1.1;
    this.boxBonusGroup.add(wingL, wingR);

    // Пропеллер спереди
    const propBaseGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 5);
    propBaseGeo.rotateX(Math.PI / 2);
    const propBase = new THREE.Mesh(propBaseGeo, propMat);
    propBase.position.set(0, 0.7, 0.75);
    this.boxBonusGroup.add(propBase);

    const propBladeGeo = new THREE.BoxGeometry(1.0, 0.1, 0.04);
    this.propBlade = new THREE.Mesh(propBladeGeo, propMat);
    this.propBlade.position.set(0, 0.7, 0.85);
    this.boxBonusGroup.add(this.propBlade);

    this.boxBonusGroup.visible = false;
    this.mesh.add(this.boxBonusGroup);

    // --- СИСТЕМА ЧАСТИЦ ДЛЯ РЕАКТИВНОГО ПУКА ---
    this.fartParticles = [];
    this.fartParticleGroup = new THREE.Group();
    this.scene.add(this.fartParticleGroup);
    
    this.fartMaterial = new THREE.MeshBasicMaterial({
      color: 0x5a7d32, // Зеленоватый газ
      transparent: true,
      opacity: 0.6
    });
    this.fartGeo = new THREE.SphereGeometry(0.2, 4, 4);
  }

  reset() {
    this.mesh.position.set(0, 0, 0);
    this.targetX = 0;
    this.currentLane = 0;
    this.yVelocity = 0;
    this.isGrounded = true;
    this.isJumping = false;
    this.isSliding = false;
    this.isDead = false; // Важно сбросить флаг смерти для повторного старта!
    this.runSpeed = CONFIG.INITIAL_SPEED;
    
    this.fartFuel = CONFIG.FART_MAX_FUEL;
    this.isFarting = false;
    this.pinkGinBoostTimer = 0;
    
    this.activeBonus = null;
    this.boxTimer = 0;
    
    this.boxBonusGroup.visible = false;
    
    // Показываем примитивы только если FBX модель не загружена
    this.modelGroup.visible = !this.fbxModel;
    if (this.fbxModel) {
      this.fbxModel.visible = true;
      this.fbxModel.position.set(0, 0, 0);
      this.fbxModel.rotation.set(0, 0, 0);
    }
    
    if (this.mixer) {
      this.mixer.stopAllAction();
      if (this.fbxActions && this.fbxActions['run']) {
        this.currentAction = this.fbxActions['run'];
        this.currentAction.play();
      }
    }
    
    // Сброс вращений и масштаба примитивов
    this.modelGroup.position.set(0, 0, 0);
    this.modelGroup.scale.set(1, 1, 1);
    this.modelGroup.rotation.set(0, 0, 0);

    // Очистка частиц
    this.fartParticles.forEach(p => this.fartParticleGroup.remove(p.mesh));
    this.fartParticles = [];
  }

  // Смена полосы движения
  changeLane(dir) {
    if (this.isDead) return;
    
    let newLane = this.currentLane + dir;
    if (newLane >= -1 && newLane <= 1) {
      this.currentLane = newLane;
      this.targetX = this.currentLane * CONFIG.LANE_WIDTH;
    }
  }

  // Прыжок
  jump() {
    if (this.isDead || this.activeBonus === 'box') return;
    
    // Если мы на земле, прыгаем
    if (this.isGrounded && !this.isSliding) {
      this.yVelocity = CONFIG.JUMP_FORCE;
      this.isGrounded = false;
      this.isJumping = true;
    }
  }

  // Подкат
  slide() {
    if (this.isDead || this.activeBonus === 'box') return;
    
    if (this.isGrounded && !this.isSliding) {
      this.isSliding = true;
      this.slideTimer = CONFIG.SLIDE_DURATION;
      
      // Анимация сплющивания/наклона модели игрока
      this.modelGroup.scale.y = 0.5;
      this.modelGroup.position.y = -0.2;
      this.height = 0.9; // уменьшаем высоту коллизии
    }
  }

  // Покупка/Активация Коробки-самолета
  activateBoxBonus() {
    this.activeBonus = 'box';
    this.boxTimer = CONFIG.BOX_DURATION;
    this.boxBonusGroup.visible = true;
    this.modelGroup.visible = false;
    audioManager.playVanyaBox();
  }

  // Активация/деактивация пука
  setFarting(farting) {
    if (this.isDead || this.activeBonus === 'box') {
      this.isFarting = false;
      return;
    }

    if (!farting && this.pinkGinBoostTimer > 0 && this.fartFuel > 0) {
      return;
    }
    
    const canUseFart = uiManager.inventory.fart || this.pinkGinBoostTimer > 0;
    if (farting && canUseFart && this.fartFuel > 5) {
      if (!this.isFarting) {
        audioManager.playSFX('puk');
      }
      this.isFarting = true;
      this.activeBonus = 'fart';
    } else {
      this.isFarting = false;
      if (this.activeBonus === 'fart' && this.isGrounded) {
        this.activeBonus = null;
      }
    }
  }

  // Временный бонус с трассы: Розовый джин дает полный заряд и автополет.
  activatePinkGinBoost() {
    if (this.isDead || this.activeBonus === 'box') return;

    this.fartFuel = CONFIG.FART_MAX_FUEL;
    this.pinkGinBoostTimer = CONFIG.PINK_GIN_BOOST_DURATION;
    this.isFarting = true;
    this.activeBonus = 'fart';
    audioManager.playSFX('puk');
    uiManager.updateBonusHUD('fart', 100);
  }

  // Обновление состояния в игровом цикле (deltaTime в секундах)
  update(dt) {
    // 1. Постепенное увеличение скорости
    if (!this.isDead) {
      this.runSpeed = Math.min(this.runSpeed + CONFIG.ACCELERATION * dt, CONFIG.MAX_SPEED);
      this.mesh.position.z += this.runSpeed * dt;
    }

    if (this.pinkGinBoostTimer > 0 && this.activeBonus !== 'box') {
      this.pinkGinBoostTimer = Math.max(0, this.pinkGinBoostTimer - dt * 1000);
      if (this.pinkGinBoostTimer <= 0 && !uiManager.inventory.fart) {
        this.isFarting = false;
        if (this.activeBonus === 'fart') this.activeBonus = null;
        uiManager.updateBonusHUD('fart', 0);
      }
    }

    // 2. Сглаживание перемещения между полосами (X)
    this.mesh.position.x = THREE.MathUtils.lerp(
      this.mesh.position.x,
      this.targetX,
      CONFIG.LANE_CHANGE_SPEED * dt
    );

    // 3. Обработка подката
    if (this.isSliding) {
      this.slideTimer -= dt * 1000;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.modelGroup.scale.y = 1.0;
        this.modelGroup.position.y = 0;
        this.height = 1.8;
      }
    }

    // 4. Обработка полета Коробки-самолета
    if (this.activeBonus === 'box') {
      this.boxTimer -= dt * 1000;
      
      // В коробке летим на высоте Y = 4.5
      const targetY = 4.5;
      this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, 5 * dt);
      this.yVelocity = 0;
      this.isGrounded = false;

      // Вращаем пропеллер коробки
      if (this.propBlade) {
        this.propBlade.rotation.z += 25 * dt;
      }

      // Обновляем шкалу в HUD
      uiManager.updateBonusHUD('box', (this.boxTimer / CONFIG.BOX_DURATION) * 100);

      if (this.boxTimer <= 0) {
        this.activeBonus = null;
        this.boxBonusGroup.visible = false;
        this.modelGroup.visible = true;
        uiManager.updateBonusHUD('box', 0);
      }
    } 
    // 5. Обработка реактивного пука
    else if (this.isFarting) {
      // Расход топлива
      this.fartFuel = Math.max(0, this.fartFuel - CONFIG.FART_DEPLETE_RATE * dt);
      
      // Тяга вверх
      this.yVelocity = this.pinkGinBoostTimer > 0 ? CONFIG.PINK_GIN_BOOST_FORCE : CONFIG.FART_FORCE;
      this.isGrounded = false;
      this.mesh.position.y += this.yVelocity * dt;
      if (this.mesh.position.y > CONFIG.FART_MAX_HEIGHT) {
        this.mesh.position.y = CONFIG.FART_MAX_HEIGHT;
        this.yVelocity = 0;
      }

      // Создаем частицы пука
      this.emitFartParticles(dt);

      uiManager.updateBonusHUD('fart', (this.fartFuel / CONFIG.FART_MAX_FUEL) * 100);

      if (this.fartFuel <= 0) {
        this.pinkGinBoostTimer = 0;
        this.setFarting(false);
      }
    } 
    // 6. Обычная физика прыжка и падения (гравитация)
    else {
      // Восстановление топлива реактивного пука, если не пукаем
      if (uiManager.inventory.fart && this.fartFuel < CONFIG.FART_MAX_FUEL) {
        this.fartFuel = Math.min(CONFIG.FART_MAX_FUEL, this.fartFuel + CONFIG.FART_REGEN_RATE * dt);
        uiManager.updateBonusHUD('fart', (this.fartFuel / CONFIG.FART_MAX_FUEL) * 100);
      } else if (!uiManager.inventory.fart && this.pinkGinBoostTimer <= 0) {
        uiManager.updateBonusHUD('fart', 0);
      }

      if (!this.isGrounded) {
        this.yVelocity -= CONFIG.GRAVITY * dt;
        this.mesh.position.y += this.yVelocity * dt;

        // Падение на асфальт
        if (this.mesh.position.y <= 0) {
          this.mesh.position.y = 0;
          this.yVelocity = 0;
          this.isGrounded = true;
          this.isJumping = false;
          if (this.activeBonus === 'fart') this.activeBonus = null;
        }
      }
    }

    // Обновляем частицы
    this.updateFartParticles(dt);

    // Обновляем FBX анимации или псевдо-анимацию
    if (this.mixer) {
      this.mixer.update(dt);
      this.updateFBXAnimations();
    } else {
      this.animateCharacter(dt);
    }
  }

  // Генерация облаков газа под Ваней
  emitFartParticles() {
    const pCount = 2;
    for (let i = 0; i < pCount; i++) {
      const pMesh = new THREE.Mesh(this.fartGeo, this.fartMaterial);
      
      // Позиция под ногами Вани
      pMesh.position.set(
        this.mesh.position.x + (Math.random() - 0.5) * 0.4,
        this.mesh.position.y + 0.1,
        this.mesh.position.z - 0.3
      );
      
      this.fartParticleGroup.add(pMesh);
      
      this.fartParticles.push({
        mesh: pMesh,
        velX: (Math.random() - 0.5) * 1.5,
        velY: -1 - Math.random() * 2,
        velZ: -this.runSpeed * 0.5 + (Math.random() - 0.5) * 2,
        life: 0.6 + Math.random() * 0.4
      });
    }
  }

  // Обновление частиц
  updateFartParticles(dt) {
    for (let i = this.fartParticles.length - 1; i >= 0; i--) {
      const p = this.fartParticles[i];
      p.life -= dt;
      
      p.mesh.position.x += p.velX * dt;
      p.mesh.position.y += p.velY * dt;
      p.mesh.position.z += p.velZ * dt;
      
      p.mesh.scale.multiplyScalar(1 + dt * 1.5); // расширение газа

      if (p.life <= 0) {
        this.fartParticleGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.fartParticles.splice(i, 1);
      }
    }
  }

  // Плавная анимация конечностей при беге, прыжках и полетах
  animateCharacter(dt) {
    if (this.isDead) return;

    const time = Date.now() * 0.008 * (this.runSpeed / CONFIG.INITIAL_SPEED);

    // Если загружена FBX модель, но у нее нет костей/анимаций
    if (this.fbxModel && !this.mixer) {
      this.fbxModel.position.y = Math.sin(time * 2) * 0.05; // покачивание вверх-вниз при беге
      this.fbxModel.rotation.y = Math.sin(time) * 0.05;      // покачивание влево-вправо
      return;
    }

    if (this.activeBonus === 'box') {
      // В коробке покачиваемся
      this.boxBonusGroup.rotation.z = Math.sin(time * 0.5) * 0.08;
      this.boxBonusGroup.rotation.x = Math.cos(time * 0.5) * 0.04;
      return;
    }

    if (this.isFarting || (this.activeBonus === 'fart' && !this.isGrounded)) {
      // Полет на пуке - ноги поджаты, руки вверх/в стороны
      this.bodyParts.leftLeg.rotation.x = -1.2;
      this.bodyParts.rightLeg.rotation.x = -1.2;
      this.bodyParts.leftArm.rotation.z = 1.0;
      this.bodyParts.rightArm.rotation.z = -1.0;
      this.bodyParts.leftArm.rotation.x = 0;
      this.bodyParts.rightArm.rotation.x = 0;
      return;
    }

    if (this.isJumping) {
      // В прыжке
      this.bodyParts.leftLeg.rotation.x = -0.5;
      this.bodyParts.rightLeg.rotation.x = 0.2;
      this.bodyParts.leftArm.rotation.x = 1.0;
      this.bodyParts.rightArm.rotation.x = -1.0;
      return;
    }

    if (this.isSliding) {
      // В подкате
      this.bodyParts.leftLeg.rotation.x = -1.5;
      this.bodyParts.rightLeg.rotation.x = -1.5;
      this.bodyParts.leftArm.rotation.x = -0.8;
      this.bodyParts.rightArm.rotation.x = -0.8;
      return;
    }

    // Обычный бег - циклическое вращение ног и рук
    const angle = Math.sin(time) * 0.8;
    this.bodyParts.leftLeg.rotation.x = angle;
    this.bodyParts.rightLeg.rotation.x = -angle;
    
    this.bodyParts.leftArm.rotation.x = -angle * 0.9;
    this.bodyParts.rightArm.rotation.x = angle * 0.9;
    
    this.bodyParts.leftArm.rotation.z = -0.05;
    this.bodyParts.rightArm.rotation.z = 0.05;

    // Движение обуви за ногами
    this.bodyParts.leftShoe.rotation.x = angle;
    this.bodyParts.rightShoe.rotation.x = -angle;

    // Небольшое покачивание головы и туловища при беге
    this.bodyParts.head.position.y = 1.5 + Math.sin(time * 2) * 0.04;
    this.bodyParts.torso.position.y = 0.9 + Math.sin(time * 2) * 0.02;
  }

  // Проверка неуязвимости
  isInvulnerable() {
    return this.activeBonus === 'box' || (this.activeBonus === 'fart' && this.mesh.position.y > 1.0);
  }

  // Загрузка FBX модели
  loadFBXModel() {
    const loader = new FBXLoader();
    loader.load('models/vanya.fbx', (fbx) => {
      try {
        this.fbxModel = fbx;
        
        // Скрываем наши примитивы
        this.modelGroup.visible = false;
        
        // Настраиваем масштаб (FBX обычно смоделирован в см, уменьшаем до метров)
        fbx.scale.setScalar(0.0085); 
        fbx.position.set(0, 0, 0);
        fbx.rotation.set(0, 0, 0);
        
        // Настройка теней
        fbx.traverse(child => {
          if (child && child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        this.mesh.add(fbx);
        
        // Подключение анимаций FBX
        if (fbx.animations && fbx.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(fbx);
          this.fbxActions = {};
          
          fbx.animations.forEach(clip => {
            if (clip) {
              const name = (clip.name || '').toLowerCase();
              let key = 'run';
              if (name.includes('idle')) key = 'idle';
              else if (name.includes('jump') || name.includes('up') || name.includes('fly')) key = 'jump';
              else if (name.includes('slide') || name.includes('crouch') || name.includes('down')) key = 'slide';
              else if (name.includes('run') || name.includes('walk') || name.includes('go')) key = 'run';
              
              this.fbxActions[key] = this.mixer.clipAction(clip);
            }
          });
          
          this.currentAction = this.fbxActions['run'] || this.mixer.clipAction(fbx.animations[0]);
          if (this.currentAction) {
            this.currentAction.play();
          }
        }
        console.log('Vanya FBX Model loaded successfully!');
      } catch (e) {
        console.error('Error parsing Vanya FBX Model:', e);
        this.fbxModel = null;
        this.modelGroup.visible = true; // Восстанавливаем примитивы
      }
    }, undefined, (err) => {
      console.warn('Vanya FBX Model file models/vanya.fbx not found. Playing with fallback rounded primitives.');
    });
  }

  // Обновление состояния анимаций FBX
  updateFBXAnimations() {
    if (!this.fbxActions) return;
    
    let targetAnim = 'run';
    if (this.isDead) targetAnim = 'idle';
    else if (this.activeBonus === 'box') targetAnim = 'idle';
    else if (this.isFarting) targetAnim = 'jump';
    else if (this.isJumping) targetAnim = 'jump';
    else if (this.isSliding) targetAnim = 'slide';

    const action = this.fbxActions[targetAnim];
    if (action && action !== this.currentAction) {
      this.currentAction.fadeOut(0.2);
      this.currentAction = action;
      this.currentAction.reset().fadeIn(0.2).play();
    }
  }

  // Получение Bounding Box для коллизий
  getCollider() {
    return new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(
        this.mesh.position.x,
        this.mesh.position.y + this.height / 2,
        this.mesh.position.z
      ),
      new THREE.Vector3(this.width, this.height, this.depth)
    );
  }
}
