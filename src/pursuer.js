// Класс преследователя Лизы для игры «Ваня Бежит»
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { audioManager } from './audio.js?v=4';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Pursuer {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.scene.add(this.mesh);

    // Расстояние сзади игрока
    this.relativeZ = -CONFIG.LIZA_DISTANCE;
    this.targetRelativeZ = -CONFIG.LIZA_DISTANCE;

    // Таймер озвучки Лизы (каждые 8-15 секунд)
    this.voiceTimer = this.getRandomVoiceInterval();
    this.presentationMode = 'run';
    this.kickFallbackTime = 0;
    this.kickEffectGroup = null;
    this.kickEffectParts = {};

    this.buildCharacter();
    this.reset();

    // Подключение GLB Лизы
    this.fbxModel = null;
    this.kickFBX = null;
    this.kickAnimations = null;
    this.kickMixer = null;
    this.mixer = null;
    this.fbxActions = {};
    this.assetTrackers = {
      liza: this.createReadyTracker(),
      kick: this.createReadyTracker()
    };
    this.readyPromise = Promise.all(Object.values(this.assetTrackers).map(tracker => tracker.promise));
    this.loadFBXModel();
    setTimeout(() => this.loadKickModel(), 1000);
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

  // Создание low-poly 3D-модели Лизы из примитивов
  buildCharacter() {
    this.bodyParts = {};

    // Материалы
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 }); // Кожа
    const coatMat = new THREE.MeshStandardMaterial({ color: 0xe0115f, roughness: 0.6 }); // Ярко-розовое пальто
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }); // Черные леггинсы
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.9 }); // Желтые волосы (блондинка)
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }); // Черная обувь

    // Контейнер модели
    this.modelGroup = new THREE.Group();
    this.mesh.add(this.modelGroup);

    // Сглаженный торс (Цилиндр)
    const torsoGeo = new THREE.CylinderGeometry(0.24, 0.18, 0.75, 10);
    const torso = new THREE.Mesh(torsoGeo, coatMat);
    torso.position.y = 0.85;
    torso.castShadow = true;
    this.modelGroup.add(torso);
    this.bodyParts.torso = torso;

    // Круглая голова (Сфера)
    const headGeo = new THREE.SphereGeometry(0.22, 12, 12);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 1.38, 0);
    head.castShadow = true;
    this.modelGroup.add(head);
    this.bodyParts.head = head;

    // Волосы (Объемная сфера на голове)
    const hairGeo = new THREE.SphereGeometry(0.23, 10, 10);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 1.42, -0.04);
    hair.scale.set(1.02, 0.95, 1.05);
    this.modelGroup.add(hair);

    // Ноги (Цилиндры)
    const legGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.55, 8);
    
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.14, 0.28, 0);
    leftLeg.castShadow = true;
    this.modelGroup.add(leftLeg);
    this.bodyParts.leftLeg = leftLeg;

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.14, 0.28, 0);
    rightLeg.castShadow = true;
    this.modelGroup.add(rightLeg);
    this.bodyParts.rightLeg = rightLeg;

    // Обувь (Сплюснутые сферы)
    const shoeGeo = new THREE.SphereGeometry(0.11, 8, 8);
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(-0.14, 0.03, 0.04);
    leftShoe.scale.set(0.9, 0.6, 1.4);
    leftShoe.castShadow = true;
    this.modelGroup.add(leftShoe);

    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0.14, 0.03, 0.04);
    rightShoe.scale.set(0.9, 0.6, 1.4);
    rightShoe.castShadow = true;
    this.modelGroup.add(rightShoe);

    // Руки (Цилиндры)
    const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.55, 8);
    
    const leftArm = new THREE.Mesh(armGeo, coatMat);
    leftArm.position.set(-0.31, 0.85, 0);
    leftArm.castShadow = true;
    this.modelGroup.add(leftArm);
    this.bodyParts.leftArm = leftArm;

    const rightArm = new THREE.Mesh(armGeo, coatMat);
    rightArm.position.set(0.31, 0.85, 0);
    rightArm.castShadow = true;
    this.modelGroup.add(rightArm);
    this.bodyParts.rightArm = rightArm;

    this.createKickEffect(pantsMat, shoeMat);
  }

  createKickEffect(pantsMat, shoeMat) {
    const group = new THREE.Group();
    group.visible = false;
    group.position.set(0.18, 0.58, 0.2);

    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.74), pantsMat);
    leg.position.set(0, 0, 0.28);
    leg.castShadow = true;

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.3), shoeMat);
    shoe.position.set(0, -0.01, 0.78);
    shoe.castShadow = true;

    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.018, 8, 24, Math.PI * 1.35),
      new THREE.MeshBasicMaterial({
        color: 0xff4fa3,
        transparent: true,
        opacity: 0.72,
        depthWrite: false
      })
    );
    arc.position.set(0, 0.06, 0.76);
    arc.rotation.set(Math.PI / 2, 0.2, -0.55);

    group.add(leg, shoe, arc);
    this.mesh.add(group);

    this.kickEffectGroup = group;
    this.kickEffectParts = { leg, shoe, arc };
  }

  reset() {
    this.mesh.position.set(0, 0, -CONFIG.LIZA_SAFE_DISTANCE);
    this.relativeZ = -CONFIG.LIZA_SAFE_DISTANCE;
    this.targetRelativeZ = -CONFIG.LIZA_SAFE_DISTANCE;
    this.voiceTimer = this.getRandomVoiceInterval();
    this.kickFallbackTime = 0;

    this.presentationMode = 'run';
    this.syncModelVisibility(true);
    if (this.fbxModel) {
      this.fbxModel.position.set(0, 0, 0);
      this.fbxModel.rotation.set(0, 0, 0);
    }
    if (this.kickEffectGroup) {
      this.kickEffectGroup.visible = false;
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
      if (this.fbxActions && this.fbxActions['run']) {
        this.currentAction = this.fbxActions['run'];
        this.currentAction.play();
      }
    }
  }

  getRandomVoiceInterval() {
    // 8-15 секунд
    return 8000 + Math.random() * 7000;
  }

  // Обновление состояния Лизы в игровом цикле
  update(dt, playerPosition, playerSpeed, isPlaying) {
    if (!isPlaying) return;

    // 1. Интерполяция положения по X за игроком (Лиза бежит четко за Ваней)
    this.mesh.position.x = THREE.MathUtils.lerp(
      this.mesh.position.x,
      playerPosition.x,
      12 * dt
    );

    // 2. Движение по Z: Лиза следует за игроком с некоторым сглаживанием
    this.relativeZ = THREE.MathUtils.lerp(
      this.relativeZ,
      this.targetRelativeZ,
      CONFIG.LIZA_CATCH_SPEED * dt
    );
    this.mesh.position.z = playerPosition.z + this.relativeZ;

    // Y высота повторяет высоту игрока, если Лиза прыгает за ним,
    // но в Subway Surfers преследователь обычно бежит по земле.
    // Сделаем так, чтобы Лиза бежала строго по земле.
    this.mesh.position.y = 0;

    // 3. Анимация бега
    this.syncModelVisibility(true);
    this.updateKickFallback(dt);

    if (this.presentationMode === 'kick' && this.kickMixer) {
      this.kickMixer.update(dt);
    } else if (this.mixer) {
      this.mixer.update(dt);
      
      // Если догнала игрока (Game Over) - переключаем на idle
      if (this.targetRelativeZ === 0 && this.fbxActions && this.fbxActions['idle'] && !this.fbxActions['kick']) {
        const action = this.fbxActions['idle'];
        if (action !== this.currentAction) {
          this.currentAction.fadeOut(0.2);
          this.currentAction = action;
          this.currentAction.reset().fadeIn(0.2).play();
        }
      }
    } else {
      // Энергичная анимация бега примитивов
      const time = Date.now() * 0.012 * (playerSpeed / CONFIG.INITIAL_SPEED);
      const angle = Math.sin(time) * 1.0; // Более размашистый бег, чем у Вани

      this.bodyParts.leftLeg.rotation.x = angle;
      this.bodyParts.rightLeg.rotation.x = -angle;
      
      this.bodyParts.leftArm.rotation.x = -angle * 1.1;
      this.bodyParts.rightArm.rotation.x = angle * 1.1;
    }

    // Вращение/покачивание для статичной FBX модели
    if (this.fbxModel && !this.mixer) {
      const time = Date.now() * 0.012 * (playerSpeed / CONFIG.INITIAL_SPEED);
      this.fbxModel.position.y = Math.sin(time * 2) * 0.05;
      this.fbxModel.rotation.y = Math.sin(time) * 0.05;
    }

    // Наклон вперед при беге примитива
    if (!this.fbxModel) {
      this.modelGroup.rotation.x = 0.2;
    }

    // 4. Периодическое воспроизведение фраз погони (каждые 8-15 сек)
    this.voiceTimer -= dt * 1000;
    if (this.voiceTimer <= 0) {
      if (!window.__game || window.__game.state !== 'GAMEOVER') {
        audioManager.playLizaVoice();
      }
      this.voiceTimer = this.getRandomVoiceInterval();
    }
  }

  // Приближение Лизы к игроку при столкновении/спотыкании
  catchUp() {
    this.targetRelativeZ = 0; // Лиза ловит Ваню вплотную
    this.setPresentationMode('kick');
  }

  setChaseDistance(distance) {
    const clamped = THREE.MathUtils.clamp(distance, CONFIG.LIZA_CATCH_DISTANCE, CONFIG.LIZA_SAFE_DISTANCE);
    this.targetRelativeZ = -clamped;
  }

  recoverDistance(dt) {
    const currentDistance = Math.abs(this.targetRelativeZ);
    const nextDistance = Math.min(CONFIG.LIZA_SAFE_DISTANCE, currentDistance + CONFIG.LIZA_RECOVERY_RATE * dt);
    this.targetRelativeZ = -nextDistance;
  }

  getDangerPercent() {
    const distance = Math.abs(this.relativeZ);
    const range = CONFIG.LIZA_SAFE_DISTANCE - CONFIG.LIZA_CATCH_DISTANCE;
    return THREE.MathUtils.clamp(((CONFIG.LIZA_SAFE_DISTANCE - distance) / range) * 100, 0, 100);
  }

  setPresentationMode(mode) {
    this.presentationMode = mode;
    if (mode === 'kick') {
      this.kickFallbackTime = 0;
    }

    if (mode === 'kick' && this.kickMixer && this.kickAnimations && this.kickAnimations.length > 0) {
      const action = this.kickMixer.clipAction(this.kickAnimations[0]);
      action.reset().fadeIn(0.04).play();
    }

    if (this.fbxActions && this.fbxActions[mode]) {
      if (this.currentAction && this.currentAction !== this.fbxActions[mode]) {
        this.currentAction.fadeOut(0.15);
      }
      this.currentAction = this.fbxActions[mode];
      this.currentAction.paused = false;
      this.currentAction.reset().fadeIn(mode === 'kick' ? 0.04 : 0.15).play();
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

    this.syncModelVisibility(true);

    if (!this.fbxModel) {
      this.modelGroup.rotation.set(0, 0, 0);
      this.bodyParts.leftLeg.rotation.x = mode === 'idle' ? 0.06 : 0;
      this.bodyParts.rightLeg.rotation.x = mode === 'idle' ? -0.06 : 0;
      this.bodyParts.leftArm.rotation.x = mode === 'idle' ? -0.1 : 0;
      this.bodyParts.rightArm.rotation.x = mode === 'idle' ? 0.1 : 0;
    }
  }

  updatePresentation(dt) {
    this.syncModelVisibility(true);
    this.updateKickFallback(dt);

    if (this.presentationMode === 'kick' && this.kickMixer) {
      this.kickMixer.update(dt);
    } else if (this.mixer) {
      this.mixer.update(dt);
    }

    const time = performance.now() * 0.001;
    const breath = Math.sin(time * 2.1) * 0.02;

    if (this.fbxModel) {
      this.fbxModel.position.y = breath;
      return;
    }

    this.modelGroup.position.y = breath;
    this.bodyParts.head.position.y = 1.38 + breath * 0.7;
  }

  syncModelVisibility(visible = true) {
    this.modelGroup.visible = false;
    
    const showKick = visible && this.presentationMode === 'kick';
    const showNormal = visible && !showKick;
    
    if (this.fbxModel) this.fbxModel.visible = showNormal;
    if (this.kickFBX) this.kickFBX.visible = showKick;
  }

  updateKickFallback(dt) {
    // If the game is in the MENU state, never show the fallback kick leg
    if (window.__game && window.__game.state === 'MENU') {
      if (this.kickEffectGroup) this.kickEffectGroup.visible = false;
      return;
    }

    if (this.kickFBX) {
      if (this.kickEffectGroup) this.kickEffectGroup.visible = false;
      return;
    }

    if (this.fbxActions['kick']) {
      if (this.kickEffectGroup) this.kickEffectGroup.visible = false;
      return;
    }

    if (this.presentationMode !== 'kick') {
      if (this.fbxModel) {
        this.fbxModel.rotation.x = 0;
        this.fbxModel.rotation.z = 0;
        this.fbxModel.position.z = 0;
      }
      if (this.kickEffectGroup) {
        this.kickEffectGroup.visible = false;
      }
      return;
    }

    this.kickFallbackTime += dt;
    const phase = (this.kickFallbackTime * 3.8) % 1;
    const windUp = THREE.MathUtils.smoothstep(phase, 0.05, 0.28);
    const returnBack = 1 - THREE.MathUtils.smoothstep(phase, 0.55, 0.95);
    const snap = Math.max(0, windUp * returnBack);

    if (this.fbxModel) {
      this.fbxModel.rotation.x = -0.1 * snap;
      this.fbxModel.rotation.z = 0.08 * snap;
      this.fbxModel.position.z = 0.14 * snap;
    }

    if (this.kickEffectGroup) {
      this.kickEffectGroup.visible = true;
      this.kickEffectGroup.position.set(
        0.18,
        0.56 + 0.06 * snap,
        0.16 + 0.34 * snap
      );
      this.kickEffectGroup.rotation.x = -0.55 * snap;
      this.kickEffectGroup.rotation.y = -0.16 + 0.24 * snap;
      this.kickEffectGroup.scale.setScalar(0.92 + 0.18 * snap);
    }
  }

  // Загрузка GLB модели Лизы
  loadFBXModel() {
    const loader = new GLTFLoader();
    loader.load('models/liza.glb', (gltf) => {
      try {
        const model = gltf.scene;
        this.fbxModel = model;
        
        // Скрываем примитивы: в кадре должна быть только загруженная FBX-модель.
        this.modelGroup.visible = false;
        
        // Масштабирование
        model.scale.setScalar(0.8); 
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
        
        // Тени
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
              if (name.includes('idle') || name.includes('catch') || name.includes('stand')) key = 'idle';
              else if (name.includes('run') || name.includes('walk') || name.includes('chase')) key = 'run';
              
              this.fbxActions[key] = this.mixer.clipAction(clip);
            }
          });
          
          this.currentAction = this.fbxActions['run'] || this.mixer.clipAction(gltf.animations[0]);
          if (this.currentAction) {
            this.currentAction.play();
          }
        }
        this.setPresentationMode(this.presentationMode);
        console.log('Liza GLB Model loaded successfully!');
      } catch (e) {
        console.error('Error parsing Liza GLB Model:', e);
        this.fbxModel = null;
        this.modelGroup.visible = false;
      } finally {
        this.markReady(this.assetTrackers.liza);
      }
    }, undefined, (err) => {
      console.warn('Liza GLB Model file models/liza.glb not found.');
      this.markReady(this.assetTrackers.liza);
    });
  }

  loadKickModel() {
    const loader = new GLTFLoader();
    loader.load('models/lizanoga.glb', (gltf) => {
      try {
        const model = gltf.scene;
        this.kickFBX = model;
        model.visible = false;

        // Масштабирование
        model.scale.setScalar(0.8); 
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);

        model.traverse(child => {
          if (child && child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.mesh.add(model);

        if (gltf.animations && gltf.animations.length > 0) {
          this.kickAnimations = gltf.animations;
          this.kickMixer = new THREE.AnimationMixer(model);
          const action = this.kickMixer.clipAction(gltf.animations[0]);
          action.play();
        }

        this.syncModelVisibility(true);
        console.log('Liza kick GLB loaded successfully!');
      } catch (e) {
        console.error('Error parsing Liza kick GLB:', e);
        this.kickFBX = null;
      } finally {
        this.markReady(this.assetTrackers.kick);
      }
    }, undefined, () => {
      console.warn('Liza kick model models/lizanoga.glb not found.');
      this.markReady(this.assetTrackers.kick);
    });
  }
}
