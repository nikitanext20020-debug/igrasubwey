// Класс преследователя Лизы для игры «Ваня Бежит»
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { audioManager } from './audio.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

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

    this.buildCharacter();
    this.reset();

    // Подключение FBX Лизы
    this.fbxModel = null;
    this.mixer = null;
    this.fbxActions = {};
    this.loadFBXModel();
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
  }

  reset() {
    this.mesh.position.set(0, 0, -CONFIG.LIZA_DISTANCE);
    this.relativeZ = -CONFIG.LIZA_DISTANCE;
    this.targetRelativeZ = -CONFIG.LIZA_DISTANCE;
    this.voiceTimer = this.getRandomVoiceInterval();

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
    if (this.mixer) {
      this.mixer.update(dt);
      
      // Если догнала игрока (Game Over) - переключаем на idle
      if (this.targetRelativeZ === 0 && this.fbxActions && this.fbxActions['idle']) {
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
      audioManager.playLizaVoice();
      this.voiceTimer = this.getRandomVoiceInterval();
    }
  }

  // Приближение Лизы к игроку при столкновении/спотыкании
  catchUp() {
    this.targetRelativeZ = 0; // Лиза ловит Ваню вплотную
  }

  // Загрузка FBX модели Лизы
  loadFBXModel() {
    const loader = new FBXLoader();
    loader.load('models/liza.fbx', (fbx) => {
      try {
        this.fbxModel = fbx;
        
        // Скрываем примитивы
        this.modelGroup.visible = false;
        
        // Масштабирование
        fbx.scale.setScalar(0.008); 
        fbx.position.set(0, 0, 0);
        fbx.rotation.set(0, 0, 0);
        
        // Тени
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
              if (name.includes('idle') || name.includes('catch') || name.includes('stand')) key = 'idle';
              else if (name.includes('run') || name.includes('walk') || name.includes('chase')) key = 'run';
              
              this.fbxActions[key] = this.mixer.clipAction(clip);
            }
          });
          
          this.currentAction = this.fbxActions['run'] || this.mixer.clipAction(fbx.animations[0]);
          if (this.currentAction) {
            this.currentAction.play();
          }
        }
        console.log('Liza FBX Model loaded successfully!');
      } catch (e) {
        console.error('Error parsing Liza FBX Model:', e);
        this.fbxModel = null;
        this.modelGroup.visible = true; // Восстанавливаем примитивы
      }
    }, undefined, (err) => {
      console.warn('Liza FBX Model file models/liza.fbx not found. Playing with fallback rounded primitives.');
    });
  }
}
