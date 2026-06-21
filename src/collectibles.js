// Модуль собираемых предметов (Бутылок джина и бонусов) для игры «Ваня Бежит»
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { audioManager } from './audio.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export class CollectibleManager {
  constructor(scene) {
    this.scene = scene;
    this.items = [];

    // Материалы
    this.materials = {
      glassGreen: new THREE.MeshStandardMaterial({
        color: 0x2ecc71,
        roughness: 0.1,
        metalness: 0.5,
        transparent: true,
        opacity: 0.95
      }),
      glassPink: new THREE.MeshStandardMaterial({
        color: 0xff4081,
        roughness: 0.1,
        metalness: 0.5,
        transparent: true,
        opacity: 0.95
      }),
      label: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
      cap: new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.8, roughness: 0.3 }),
      boxCardboard: new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.9 }),
      wings: new THREE.MeshStandardMaterial({ color: 0xc2a47c, roughness: 0.9 }),
      pinkAura: new THREE.MeshBasicMaterial({
        color: 0xff4fa3,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    };

    this.pinkGinTexture = new THREE.TextureLoader().load('assets/pink-gin.png');
    this.pinkGinTexture.colorSpace = THREE.SRGBColorSpace;
    this.pinkGinTexture.anisotropy = 4;

    // Подключение FBX Бутылки
    this.bottleFBX = null;
    this.loadFBXModel();
  }

  // Загрузка FBX модели бутылки
  loadFBXModel() {
    const loader = new FBXLoader();
    loader.load('models/bottle.fbx', (fbx) => {
      try {
        this.bottleFBX = fbx;
        console.log('Bottle FBX Model loaded successfully!');
      } catch (e) {
        console.error('Error parsing Bottle FBX Model:', e);
        this.bottleFBX = null;
      }
    }, undefined, (err) => {
      console.warn('Bottle FBX Model file models/bottle.fbx not found. Playing with fallback rounded primitives.');
    });
  }

  // Очистка всех предметов на сцене
  reset() {
    this.items.forEach(item => {
      this.scene.remove(item.mesh);
      this.disposeMesh(item.mesh);
    });
    this.items = [];
  }

  // Генерация предметов для чанка
  spawnCollectiblesForChunk(chunkStartZ, chunkLength) {
    const numRows = 3 + Math.floor(Math.random() * 2); // 3 или 4 ряда бутылок
    const step = chunkLength / numRows;

    for (let i = 0; i < numRows; i++) {
      const zPos = chunkStartZ + i * step + 8 + Math.random() * 5;
      const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1

      // Выбираем паттерн: 
      // 0: Прямая линия из 4-х бутылок джина
      // 1: Дуга/Арка (для прыжка) из 4-х бутылок джина
      // 2: Змейка из бутылок, 3: одиночный бонус на дорожке
      const pattern = Math.floor(Math.random() * 9);

      if (pattern < 3) {
        // Линия бутылок
        this.spawnLine(lane, zPos, 4, 1.8);
      } 
      else if (pattern < 5) {
        // Арка бутылок
        this.spawnArc(lane, zPos, 4, 1.8);
      }
      else if (pattern < 7) {
        // Змейка бутылок между полосами
        this.spawnZigzag(lane, zPos, 5, 1.55);
      } 
      else {
        // Рандомный бонус на дорожке
        const bonusType = Math.random() > 0.5 ? 'box_flight' : 'fart_refill';
        this.spawnBonusItem(lane, zPos, bonusType);
      }
    }
  }

  // Спавн 3D модели бутылки джина
  createBottleMesh(isPink = false) {
    const bottleGroup = new THREE.Group();

    if (this.bottleFBX) {
      const clone = this.bottleFBX.clone();
      
      // Настраиваем масштаб (подбираем размер, чтобы бутылка была высотой примерно 0.6м)
      clone.scale.setScalar(0.0055); 
      clone.position.set(0, 0.15, 0);
      clone.rotation.set(0, 0, 0);
      
      const glassMat = isPink ? this.materials.glassPink : this.materials.glassGreen;
      
      clone.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (isPink) {
            child.material = glassMat;
          }
        }
      });
      
      bottleGroup.add(clone);
      return bottleGroup;
    }

    const glassMat = isPink ? this.materials.glassPink : this.materials.glassGreen;

    // 1. Корпус бутылки
    const bodyGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8);
    const body = new THREE.Mesh(bodyGeo, glassMat);
    body.position.y = 0.25;
    body.castShadow = true;
    bottleGroup.add(body);

    // 2. Горлышко бутылки
    const neckGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8);
    const neck = new THREE.Mesh(neckGeo, glassMat);
    neck.position.y = 0.6;
    neck.castShadow = true;
    bottleGroup.add(neck);

    // 3. Этикетка с надписью "ДЖИН"
    const labelGeo = new THREE.CylinderGeometry(0.125, 0.125, 0.22, 8);
    const label = new THREE.Mesh(labelGeo, this.materials.label);
    label.position.y = 0.25;
    bottleGroup.add(label);

    // 4. Крышка
    const capGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8);
    const cap = new THREE.Mesh(capGeo, this.materials.cap);
    cap.position.y = 0.73;
    bottleGroup.add(cap);

    return bottleGroup;
  }

  // Спавн 3D модели бонуса на дорожке
  createBonusMesh(type) {
    const bonusGroup = new THREE.Group();

    if (type === 'box_flight') {
      // Модель летящей коробки в миниатюре
      const boxGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const box = new THREE.Mesh(boxGeo, this.materials.boxCardboard);
      box.position.y = 0.2;
      box.castShadow = true;
      
      const wingGeo = new THREE.BoxGeometry(0.4, 0.02, 0.15);
      const wingL = new THREE.Mesh(wingGeo, this.materials.wings);
      wingL.position.set(-0.3, 0.25, 0);
      
      const wingR = wingL.clone();
      wingR.position.x = 0.3;

      bonusGroup.add(box, wingL, wingR);
    } 
    else {
      // Розовая бутылка (Розовый джин) в легком свечении
      const pinkBottle = this.createBottleMesh(true);
      pinkBottle.scale.set(1.2, 1.2, 1.2);

      const photo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.pinkGinTexture,
        transparent: true,
        depthWrite: false
      }));
      photo.position.set(0, 0.62, 0.08);
      photo.scale.set(0.9, 1.25, 1);

      const ringGeo = new THREE.TorusGeometry(0.55, 0.035, 8, 40);
      const ring = new THREE.Mesh(ringGeo, this.materials.pinkAura);
      ring.position.y = 0.1;
      ring.rotation.x = Math.PI / 2;

      const glowGeo = new THREE.SphereGeometry(0.72, 16, 12);
      const glow = new THREE.Mesh(glowGeo, this.materials.pinkAura);
      glow.position.y = 0.55;

      const light = new THREE.PointLight(0xff4fa3, 1.2, 4);
      light.position.y = 0.8;

      bonusGroup.add(glow, pinkBottle, photo, ring, light);
    }

    return bonusGroup;
  }

  // Создание линии бутылок
  spawnLine(lane, startZ, count, spacing) {
    for (let i = 0; i < count; i++) {
      const bottle = this.createBottleMesh(false);
      const zPos = startZ + i * spacing;
      
      bottle.position.set(lane * CONFIG.LANE_WIDTH, 0.5, zPos);
      this.scene.add(bottle);

      this.items.push({
        type: 'gin',
        mesh: bottle,
        radius: 0.4,
        value: 1
      });
    }
  }

  // Создание дуги/арки (для сбора в прыжке)
  spawnArc(lane, startZ, count, spacing) {
    for (let i = 0; i < count; i++) {
      const bottle = this.createBottleMesh(false);
      const zPos = startZ + i * spacing;
      
      // Вычисляем высоту по синусоиде (арка)
      const angle = (i / (count - 1)) * Math.PI;
      const height = 0.5 + Math.sin(angle) * 1.5; // макс высота 2.0м

      bottle.position.set(lane * CONFIG.LANE_WIDTH, height, zPos);
      this.scene.add(bottle);

      this.items.push({
        type: 'gin',
        mesh: bottle,
        radius: 0.4,
        value: 1
      });
    }
  }

  // Создание змейки бутылок между полосами
  spawnZigzag(startLane, startZ, count, spacing) {
    for (let i = 0; i < count; i++) {
      const bottle = this.createBottleMesh(false);
      const lane = THREE.MathUtils.clamp(startLane + (i % 3) - 1, -1, 1);
      const height = 0.55 + (i % 2) * 0.35;
      const zPos = startZ + i * spacing;

      bottle.position.set(lane * CONFIG.LANE_WIDTH, height, zPos);
      this.scene.add(bottle);

      this.items.push({
        type: 'gin',
        mesh: bottle,
        radius: 0.4,
        value: 1
      });
    }
  }

  // Создание бонусного спецпредмета на дорожке
  spawnBonusItem(lane, zPos, type) {
    const mesh = this.createBonusMesh(type);
    mesh.position.set(lane * CONFIG.LANE_WIDTH, 0.5, zPos);
    this.scene.add(mesh);

    this.items.push({
      type, // 'box_flight' (коробка) или 'fart_refill' (розовый джин)
      mesh,
      radius: 0.6
    });
  }

  // Обновление в игровом цикле
  update(dt, playerZ) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      // 1. Поворот предметов вокруг оси Y для красивого визуального эффекта
      item.mesh.rotation.y += 2.0 * dt;

      // Для бонусов добавим легкое покачивание вверх-вниз
      if (item.type !== 'gin') {
        item.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.005) * 0.15;
      }
      if (item.type === 'fart_refill') {
        item.mesh.rotation.z = Math.sin(Date.now() * 0.004) * 0.08;
      }

      // 2. Удаление предметов, оставшихся далеко сзади
      if (item.mesh.position.z < playerZ - 10) {
        this.scene.remove(item.mesh);
        this.disposeMesh(item.mesh);
        this.items.splice(i, 1);
      }
    }
  }

  // Проверка сбора предметов игроком
  checkPickups(player, onCollectCallback) {
    const playerPos = player.mesh.position;
    
    // Получаем приблизительный коллизионный бокс или сферу игрока
    // Для сбора предметов достаточно проверить расстояние по сферам
    const pX = playerPos.x;
    const pY = playerPos.y + player.height / 2;
    const pZ = playerPos.z;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      const iX = item.mesh.position.x;
      const iY = item.mesh.position.y + 0.3; // Корректировка центра бутылки
      const iZ = item.mesh.position.z;

      // Вычисляем евклидово расстояние в 3D
      const dx = pX - iX;
      const dy = pY - iY;
      const dz = pZ - iZ;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

      // Если произошло столкновение (игрок близко)
      if (dist < (item.radius + 0.5)) {
        // Удаляем с экрана
        this.scene.remove(item.mesh);
        this.disposeMesh(item.mesh);
        this.items.splice(i, 1);

        // Обработка типа сбора
        if (item.type === 'gin') {
          audioManager.playSFX('pickup');
          onCollectCallback('gin', item.value);
        } 
        else if (item.type === 'box_flight') {
          // Активируем полет в коробке мгновенно
          player.activateBoxBonus();
          onCollectCallback('box_flight', 0);
        } 
        else if (item.type === 'fart_refill') {
          // Полное восстановление заряда пука и временный автополет
          player.activatePinkGinBoost();
          onCollectCallback('fart_refill', 0);
        }
      }
    }
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
