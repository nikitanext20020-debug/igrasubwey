// Класс игрока Вани для игры «Ваня Бежит»
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { audioManager } from './audio.js';
import { uiManager } from './ui.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
    this.manualFartCharges = 0;
    this.manualFartActive = false;

    // Состояния бонусов
    this.activeBonus = null; // 'box' или 'fart'
    this.boxTimer = 0;
    this.presentationMode = 'run';

    // Для коллизий
    this.width = 1.0;
    this.height = 1.8;
    this.depth = 0.8;
    this.previousZ = 0;

    this.buildCharacter();
    this.reset();

    // Подключение FBX
    this.fbxModel = null;
    this.presentationFBX = null;
    this.presentationMixer = null;
    this.jumpFBX = null;
    this.jumpMixer = null;
    this.jumpAction = null;
    this.mixer = null;
    this.fbxActions = {};
    this.loadPresentationModel();
    setTimeout(() => this.loadFBXModel(), 500);
    setTimeout(() => this.loadJumpModel(), 1500);
    setTimeout(() => this.loadCrashModel(), 2500);
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
      color: 0xc7e9a0, // Светлый короткий след, чтобы не собирался в темную стену
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    });
    this.fartGeo = new THREE.SphereGeometry(0.13, 4, 4);
  }

  reset() {
    this.mesh.visible = true; // Сброс видимости родительской группы после возрождения!
    this.mesh.position.set(0, 0, 0);
    this.previousZ = 0;
    this.targetX = 0;
    this.currentLane = 0;
    this.yVelocity = 0;
    this.isGrounded = true;
    this.isJumping = false;
    this.isSliding = false;
    this.isDead = false;
    this.isStumbling = false; // Важно сбросить флаг смерти для повторного старта!
    this.runSpeed = CONFIG.INITIAL_SPEED;
    
    this.fartFuel = CONFIG.FART_MAX_FUEL;
    this.isFarting = false;
    this.pinkGinBoostTimer = 0;
    this.manualFartCharges = 0;
    this.manualFartActive = false;
    
    this.activeBonus = null;
    this.boxTimer = 0;
    
    this.boxBonusGroup.visible = false;
    
    // Fallback-примитивы больше не показываем: в кадре должна быть только загруженная FBX-модель.
    this.setCharacterVisible(true);
    if (this.fbxModel) {
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
      this.restartJumpAnimation();
      this.syncRuntimeModelVisibility(this.activeBonus !== 'box');
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
    this.setCharacterVisible(false);
    audioManager.playVanyaBox();
  }

  setFartCharges(charges) {
    this.manualFartCharges = Math.max(0, Math.min(CONFIG.FART_MAX_RUN_CHARGES, charges));
    this.manualFartActive = false;
    this.fartFuel = CONFIG.FART_MAX_FUEL;
    uiManager.updateBonusHUD('fart', this.manualFartCharges > 0 ? 100 : 0);
  }

  // Активация/деактивация пука
  setFarting(farting) {
    if (this.isDead || this.activeBonus === 'box') {
      this.isFarting = false;
      if (this.activeBonus === 'box') this.syncRuntimeModelVisibility(false);
      return;
    }

    const wasFarting = this.isFarting;
    const previousBonus = this.activeBonus;

    if (!farting && this.pinkGinBoostTimer > 0 && this.fartFuel > 0) {
      return;
    }
    
    if (farting && this.pinkGinBoostTimer <= 0 && !this.manualFartActive && this.manualFartCharges > 0) {
      this.manualFartCharges--;
      this.manualFartActive = true;
      this.fartFuel = CONFIG.FART_MAX_FUEL;
    }

    const canUseFart = this.manualFartActive || this.pinkGinBoostTimer > 0;
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

    if (!wasFarting && this.isFarting) {
      this.restartJumpAnimation();
    }

    if (wasFarting !== this.isFarting || previousBonus !== this.activeBonus) {
      this.syncRuntimeModelVisibility(this.activeBonus !== 'box');
    }
  }

  // Временный бонус с трассы: Розовый джин дает полный заряд и автополет.
  activatePinkGinBoost() {
    if (this.isDead || this.activeBonus === 'box') return;

    this.fartFuel = CONFIG.FART_MAX_FUEL;
    this.pinkGinBoostTimer = CONFIG.PINK_GIN_BOOST_DURATION;
    this.isFarting = true;
    this.activeBonus = 'fart';
    this.restartJumpAnimation();
    this.syncRuntimeModelVisibility(true);
    audioManager.playSFX('puk');
    uiManager.updateBonusHUD('fart', 100);
  }

  // Обновление состояния в игровом цикле (deltaTime в секундах)
  update(dt) {
    const wasJumpPoseActive = this.isJumpPoseActive();

    // 1. Постепенное увеличение скорости
    if (!this.isDead) {
      this.previousZ = this.mesh.position.z;
      this.runSpeed = Math.min(this.runSpeed + CONFIG.ACCELERATION * dt, CONFIG.MAX_SPEED);
      this.mesh.position.z += this.runSpeed * dt;
    }

    if (this.pinkGinBoostTimer > 0 && this.activeBonus !== 'box') {
      this.pinkGinBoostTimer = Math.max(0, this.pinkGinBoostTimer - dt * 1000);
      if (this.pinkGinBoostTimer <= 0 && !this.manualFartActive) {
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
        this.setCharacterVisible(true);
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
        this.manualFartActive = false;
        this.setFarting(false);
      }
    } 
    // 6. Обычная физика прыжка и падения (гравитация)
    else {
      // Восстановление топлива реактивного пука, если не пукаем
      if (this.manualFartActive) {
        uiManager.updateBonusHUD('fart', (this.fartFuel / CONFIG.FART_MAX_FUEL) * 100);
      } else if (this.pinkGinBoostTimer <= 0) {
        uiManager.updateBonusHUD('fart', this.manualFartCharges > 0 ? 100 : 0);
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
          this.syncRuntimeModelVisibility(this.activeBonus !== 'box');
        }
      }
    }

    if (wasJumpPoseActive !== this.isJumpPoseActive()) {
      this.syncRuntimeModelVisibility(this.activeBonus !== 'box');
    }

    // Обновляем частицы
    this.updateFartParticles(dt);
    // Обновляем только активную модель Вани, чтобы скрытые скелеты не тратили кадр.
    const useJumpModel = this.shouldUseJumpModel();
    if (this.jumpMixer && useJumpModel) {
      this.jumpMixer.update(dt);
    }
    if (this.presentationMixer && this.presentationMode === 'idle') {
      this.presentationMixer.update(dt);
    }
    if (this.crashMixer && this.isStumbling) {
      this.crashMixer.update(dt);
    }
    if (this.mixer && !useJumpModel && this.presentationMode !== 'idle' && !this.isStumbling && this.activeBonus !== 'box') {
      this.updateFBXAnimations();
      this.mixer.update(dt);
    } else if (!this.mixer) {
      this.animateCharacter(dt);
    }

    // Flicker effect when invulnerable/stumbled
    const isInvuln = window.__game && window.__game.state === 'PLAYING' && window.__game.collisionCooldown > 0;
    if (isInvuln) {
      const flash = (Math.floor(Date.now() / 90) % 2) === 0;
      this.setCharacterMeshOpacity(flash ? 0.35 : 0.85);
    } else {
      this.setCharacterMeshOpacity(1.0);
    }
  }

  // Генерация облаков газа под Ваней
  emitFartParticles() {
    const pCount = 1;
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
        velY: -0.65 - Math.random() * 1.1,
        velZ: -2.5 - Math.random() * 2,
        life: 0.32 + Math.random() * 0.22
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
      
      p.mesh.scale.multiplyScalar(1 + dt * 0.8); // мягкое расширение газа

      if (p.life <= 0) {
        this.fartParticleGroup.remove(p.mesh);
        // Не удаляем разделяемую геометрию this.fartGeo!
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

  setCharacterVisible(visible) {
    this.syncRuntimeModelVisibility(visible);
  }

  playCrashAnimation() {
    if (this.crashAction && this.crashFBX) {
      // Прячем основные модели, показываем crash
      if (this.fbxModel) this.fbxModel.visible = false;
      if (this.jumpFBX) this.jumpFBX.visible = false;
      if (this.modelGroup) this.modelGroup.visible = false;
      
      this.crashFBX.visible = true;
      this.crashAction.reset();
      this.crashAction.play();
    }
  }

  stopCrashAnimation() {
    if (this.crashAction && this.crashFBX) {
      this.crashFBX.visible = false;
      this.crashAction.stop();
      this.syncRuntimeModelVisibility(this.activeBonus !== 'box');
    }
  }

  isJumpPoseActive() {
    return this.isJumping || this.isFarting || (this.activeBonus === 'fart' && !this.isGrounded);
  }

  shouldUseJumpModel() {
    return Boolean(
      this.jumpFBX &&
      this.presentationMode !== 'idle' &&
      this.activeBonus !== 'box' &&
      this.isJumpPoseActive()
    );
  }

  restartJumpAnimation() {
    if (!this.jumpAction) return;

    this.jumpAction.paused = false;
    this.jumpAction.reset().play();
    if (this.jumpMixer) this.jumpMixer.update(0);
  }

  syncRuntimeModelVisibility(visible = true) {
    if (this.activeBonus === 'box') {
      if (this.fbxModel) this.fbxModel.visible = false;
      if (this.jumpFBX) this.jumpFBX.visible = false;
      if (this.crashFBX) this.crashFBX.visible = false;
      if (this.modelGroup) this.modelGroup.visible = false;
      if (this.presentationFBX) this.presentationFBX.visible = false;
    } else {
      // Обычный бег/прыжок
      const isIdle = this.presentationMode === 'idle';
      const useJumpModel = Boolean(this.jumpFBX && !isIdle && this.isJumpPoseActive());
      
      if (this.fbxModel) {
        this.fbxModel.visible = visible && !isIdle && !useJumpModel && !this.isStumbling;
      }
      if (this.jumpFBX) {
        this.jumpFBX.visible = visible && !isIdle && useJumpModel && !this.isStumbling;
      }
      if (this.crashFBX) {
        this.crashFBX.visible = visible && !isIdle && this.isStumbling;
      }
      if (this.modelGroup) {
        // Показываем примитивного Ваню только если нет реальных моделей
        const hasRealModel = this.fbxModel || useJumpModel || (isIdle && this.presentationFBX);
        this.modelGroup.visible = !hasRealModel && visible && !this.isStumbling;
      }
      if (this.presentationFBX) {
        this.presentationFBX.visible = visible && isIdle;
      }
    }
  }

  setPresentationMode(mode) {
    this.presentationMode = mode;

    if (this.fbxActions && this.fbxActions[mode]) {
      if (this.currentAction && this.currentAction !== this.fbxActions[mode]) {
        this.currentAction.fadeOut(0.15);
      }
      this.currentAction = this.fbxActions[mode];
      this.currentAction.paused = false;
      this.currentAction.reset().fadeIn(0.15).play();
    } else if (this.currentAction) {
      if (mode === 'idle') {
        const clip = this.currentAction.getClip();
        this.currentAction.paused = false;
        this.currentAction.time = clip ? clip.duration * 0.45 : 0;
        if (this.mixer) this.mixer.update(0);
        this.currentAction.paused = true;
      } else {
        this.currentAction.paused = false;
      }
    }

    this.syncRuntimeModelVisibility(this.activeBonus !== 'box');

    if (!this.fbxModel) {
      const relaxed = mode === 'idle';
      this.modelGroup.rotation.set(0, 0, 0);
      this.bodyParts.leftLeg.rotation.x = relaxed ? 0.08 : 0;
      this.bodyParts.rightLeg.rotation.x = relaxed ? -0.08 : 0;
      this.bodyParts.leftArm.rotation.x = relaxed ? -0.12 : 0;
      this.bodyParts.rightArm.rotation.x = relaxed ? 0.12 : 0;
    }
  }

  updatePresentation(dt) {
    if (this.presentationMixer && this.presentationFBX && this.presentationFBX.visible) {
      this.presentationMixer.update(dt);
      return;
    }

    if (this.mixer) {
      this.mixer.update(dt);
    }

    const time = performance.now() * 0.001;
    const breath = Math.sin(time * 2) * 0.025;

    if (this.fbxModel) {
      this.fbxModel.position.y = breath;
      return;
    }

    this.modelGroup.position.y = breath;
    this.bodyParts.head.position.y = 1.48 + breath * 0.7;
  }

  // Загрузка GLB модели
  loadFBXModel() {
    const loader = new GLTFLoader();
    loader.load('models/vanya.glb', (gltf) => {
      try {
        const model = gltf.scene;
        this.fbxModel = model;
        
        // Скрываем наши примитивы
        this.modelGroup.visible = false;
        
        model.scale.setScalar(0.85); 
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
        
        // Настройка теней
        model.traverse(child => {
          if (child && child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        this.mesh.add(model);
        
        // Подключение анимаций GLTF
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(model);
          this.fbxActions = {};
          
          gltf.animations.forEach(clip => {
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
          
          this.currentAction = this.fbxActions['run'] || this.mixer.clipAction(gltf.animations[0]);
          if (this.currentAction) {
            this.currentAction.play();
          }
        }
        this.setCharacterVisible(this.activeBonus !== 'box');
        this.setPresentationMode(this.presentationMode);
        console.log('Vanya GLB Model loaded successfully!');
      } catch (e) {
        console.error('Error parsing Vanya GLB Model:', e);
        this.fbxModel = null;
        this.modelGroup.visible = false;
      }
    }, undefined, (err) => {
      console.warn('Vanya GLB Model file models/vanya.glb not found.');
    });
  }

  loadPresentationModel() {
    const loader = new GLTFLoader();
    loader.load('models/vanyaidet.glb', (gltf) => {
      try {
        const model = gltf.scene;
        this.presentationFBX = model;
        model.scale.setScalar(0.85);
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
        model.visible = false;

        model.traverse(child => {
          if (child && child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.mesh.add(model);

        if (gltf.animations && gltf.animations.length > 0) {
          this.presentationMixer = new THREE.AnimationMixer(model);
          const action = this.presentationMixer.clipAction(gltf.animations[0]);
          action.play();
        }

        this.setCharacterVisible(this.activeBonus !== 'box');
        this.setPresentationMode(this.presentationMode);
        console.log('Vanya presentation GLB loaded successfully!');
      } catch (e) {
        console.error('Error parsing Vanya presentation GLB:', e);
        this.presentationFBX = null;
      }
    }, undefined, () => {
      console.warn('Vanya presentation model models/vanyaidet.glb not found.');
    });
  }

  loadJumpModel() {
    const loader = new GLTFLoader();
    const candidates = [
      'models/vanyajump.glb',
      'models/vanyaprygaet.glb',
      'models/vanya_jump.glb',
      'models/jump.glb',
      'models/pryzhok.glb'
    ];

    const tryLoad = (index) => {
      if (index >= candidates.length) {
        console.warn(`Vanya jump model not found.`);
        return;
      }

      const url = candidates[index];
      loader.load(url, (gltf) => {
        try {
          const model = gltf.scene;
          this.jumpFBX = model;
          model.scale.setScalar(0.85);
          model.position.set(0, 0, 0);
          model.rotation.set(0, 0, 0);
          model.visible = false;

          model.traverse(child => {
            if (child && child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          this.mesh.add(model);

          if (gltf.animations && gltf.animations.length > 0) {
            this.jumpMixer = new THREE.AnimationMixer(model);
            this.jumpAction = this.jumpMixer.clipAction(gltf.animations[0]);
            this.jumpAction.play();
            if (this.isJumpPoseActive()) this.restartJumpAnimation();
          }

          this.syncRuntimeModelVisibility(this.activeBonus !== 'box');
          console.log(`Vanya jump GLB loaded successfully: ${url}`);
        } catch (e) {
          console.error('Error parsing Vanya jump GLB:', e);
          this.jumpFBX = null;
          this.jumpMixer = null;
          this.jumpAction = null;
        }
      }, undefined, () => tryLoad(index + 1));
    };

    tryLoad(0);
  }

  loadCrashModel() {
    const loader = new GLTFLoader();
    loader.load('models/vanyacrash.glb', (gltf) => {
      try {
        const model = gltf.scene;
        this.crashFBX = model;
        model.scale.setScalar(0.85);
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
        model.visible = false;

        model.traverse(child => {
          if (child && child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.mesh.add(model);

        if (gltf.animations && gltf.animations.length > 0) {
          this.crashMixer = new THREE.AnimationMixer(model);
          const action = this.crashMixer.clipAction(gltf.animations[0]);
          action.clampWhenFinished = true;
          action.loop = THREE.LoopOnce;
          this.crashAction = action;
        }
        
        console.log(`Vanya crash GLB loaded successfully`);
      } catch (e) {
        console.error('Error parsing Vanya crash GLB:', e);
      }
    }, undefined, () => console.warn('vanyacrash.glb not found'));
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
    const minZ = Math.min(this.previousZ, this.mesh.position.z);
    const maxZ = Math.max(this.previousZ, this.mesh.position.z);
    const sweptDepth = Math.max(this.depth, maxZ - minZ + this.depth);
    const centerZ = (minZ + maxZ) / 2;

    return new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(
        this.mesh.position.x,
        this.mesh.position.y + this.height / 2,
        centerZ
      ),
      new THREE.Vector3(this.width, this.height, sweptDepth)
    );
  }

  setCharacterMeshOpacity(opacity) {
    const applyOpacity = (obj) => {
      obj.traverse(child => {
        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(mat => {
            if (!mat.userData.hasOwnProperty('originalOpacity')) {
              mat.userData.originalOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
              mat.userData.originalTransparent = mat.transparent !== undefined ? mat.transparent : false;
            }
            mat.transparent = opacity < 1.0 ? true : mat.userData.originalTransparent;
            mat.opacity = opacity < 1.0 ? opacity : mat.userData.originalOpacity;
          });
        }
      });
    };

    if (this.fbxModel) applyOpacity(this.fbxModel);
    if (this.jumpFBX) applyOpacity(this.jumpFBX);
    if (this.presentationFBX) applyOpacity(this.presentationFBX);
    if (this.modelGroup) applyOpacity(this.modelGroup);
  }
}
