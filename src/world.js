// Модуль генерации игрового мира для игры «Ваня Бежит»
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { TextureGenerator } from './textures.js';

export class WorldGenerator {
  constructor(scene) {
    this.scene = scene;
    this.chunkLength = 60; // Длина одного чанка
    this.activeChunks = [];
    this.spawnedZ = 0;     // Конечная точка последнего сгенерированного чанка
    
    // Создаем процедурные текстуры
    const roadTex = TextureGenerator.createNoiseTexture('#3a3d40', 12);
    const sidewalkTex = TextureGenerator.createNoiseTexture('#6e7377', 15);
    const grassTex = TextureGenerator.createNoiseTexture('#3d5a3a', 20);
    const curbTex = TextureGenerator.createNoiseTexture('#cccccc', 8);

    // Материалы для переиспользования
    this.materials = {
      road: new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 }),
      sidewalk: new THREE.MeshStandardMaterial({ map: sidewalkTex, roughness: 0.9 }),
      grass: new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }),
      curb: new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.8 }),
      
      balcony: new THREE.MeshStandardMaterial({ color: 0x7c5a43, roughness: 0.9 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 }),
      
      treeTrunk: new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 }),
      treeLeaves: new THREE.MeshStandardMaterial({ color: 0x2e5c1e, roughness: 0.9 }),
      benchWood: new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 }),
      benchMetal: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }),
      trashCan: new THREE.MeshStandardMaterial({ color: 0x4a4f52, roughness: 0.8 }),
      
      // Машина (разные цвета)
      carColors: [
        new THREE.MeshStandardMaterial({ color: 0x990000, roughness: 0.5, metalness: 0.3 }),
        new THREE.MeshStandardMaterial({ color: 0x000099, roughness: 0.5, metalness: 0.3 }),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0.3 }),
        new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.3 })
      ],
      carGlass: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, opacity: 0.8, transparent: true }),
      wheel: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }),
      
      puddle: new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.8 }),
      pigeon: new THREE.MeshStandardMaterial({ color: 0x8a9ba8, roughness: 0.9 })
    };

    // Наборы материалов для хрущёвок разных цветов
    this.khrushchyovkaMaterialArrays = [
      this.createKhrushchyovkaMaterialArray('#9fa3a6'), // Серый
      this.createKhrushchyovkaMaterialArray('#c8c3b7'), // Бежевый
      this.createKhrushchyovkaMaterialArray('#a9b8c4')  // Блёкло-голубой
    ];
  }

  // Вспомогательный метод для создания массива материалов на 6 граней коробки хрущёвки
  createKhrushchyovkaMaterialArray(colorHex) {
    const facadeTex = TextureGenerator.createKhrushchyovkaTexture(colorHex);
    const concreteTex = TextureGenerator.createNoiseTexture(colorHex, 8);

    const facadeMat = new THREE.MeshStandardMaterial({
      map: facadeTex,
      roughness: 0.9
    });

    const concreteMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.9
    });

    // Порядок граней BoxGeometry: [+X, -X, +Y, -Y, +Z, -Z]
    return [
      facadeMat,    // +X (Фасад)
      facadeMat,    // -X (Фасад)
      this.materials.roof, // +Y (Крыша)
      concreteMat,  // -Y (Низ)
      concreteMat,  // +Z (Торец)
      concreteMat   // -Z (Торец)
    ];
  }

  // Сброс и первоначальная генерация мира
  reset() {
    // Удаляем старые чанки
    this.activeChunks.forEach(chunk => {
      this.scene.remove(chunk.group);
      this.disposeHierarchy(chunk.group);
    });
    this.activeChunks = [];
    this.spawnedZ = -20; // Начинаем чуть сзади игрока

    // Генерируем 3 начальных чанка
    for (let i = 0; i < 3; i++) {
      this.generateChunk();
    }
  }

  // Обновление мира на основе позиции игрока Z
  update(playerZ) {
    // Если игрок приближается к концу предпоследнего чанка, создаем новый
    if (playerZ > this.spawnedZ - this.chunkLength * 2) {
      this.generateChunk();
    }

    // Удаляем чанки, которые остались далеко сзади
    if (this.activeChunks.length > 0 && playerZ > this.activeChunks[0].endZ + 20) {
      const oldChunk = this.activeChunks.shift();
      this.scene.remove(oldChunk.group);
      this.disposeHierarchy(oldChunk.group);
    }
  }

  // Генерация одного чанка дороги и декораций
  generateChunk() {
    const startZ = this.spawnedZ;
    const endZ = startZ + this.chunkLength;
    this.spawnedZ = endZ;

    const chunkGroup = new THREE.Group();
    chunkGroup.position.z = startZ;
    this.scene.add(chunkGroup);

    // 1. Дорожная основа (3 полосы)
    const roadWidth = CONFIG.LANE_WIDTH * 3;
    const roadGeo = new THREE.BoxGeometry(roadWidth, 0.4, this.chunkLength);
    const roadMesh = new THREE.Mesh(roadGeo, this.materials.road);
    roadMesh.position.set(0, -0.2, this.chunkLength / 2);
    roadMesh.receiveShadow = true;
    chunkGroup.add(roadMesh);

    // 2. Бордюры (Curb) слева и справа от дороги
    const curbGeo = new THREE.BoxGeometry(0.2, 0.5, this.chunkLength);
    const curbL = new THREE.Mesh(curbGeo, this.materials.curb);
    curbL.position.set(-roadWidth / 2, 0.05, this.chunkLength / 2);
    curbL.receiveShadow = true;
    const curbR = curbL.clone();
    curbR.position.x = roadWidth / 2;
    chunkGroup.add(curbL, curbR);

    // 3. Тратуары и газоны
    const sidewalkWidth = 3;
    const sidewalkGeo = new THREE.BoxGeometry(sidewalkWidth, 0.3, this.chunkLength);
    
    // Слева
    const sideL = new THREE.Mesh(sidewalkGeo, this.materials.sidewalk);
    sideL.position.set(-roadWidth / 2 - sidewalkWidth / 2, -0.1, this.chunkLength / 2);
    sideL.receiveShadow = true;
    
    // Справа
    const sideR = sideL.clone();
    sideR.position.x = roadWidth / 2 + sidewalkWidth / 2;
    chunkGroup.add(sideL, sideR);

    // Газоны за тротуарами
    const grassWidth = 20;
    const grassGeo = new THREE.BoxGeometry(grassWidth, 0.2, this.chunkLength);
    const grassL = new THREE.Mesh(grassGeo, this.materials.grass);
    grassL.position.set(-roadWidth / 2 - sidewalkWidth - grassWidth / 2, -0.15, this.chunkLength / 2);
    grassL.receiveShadow = true;
    
    const grassR = grassL.clone();
    grassR.position.x = roadWidth / 2 + sidewalkWidth + grassWidth / 2;
    chunkGroup.add(grassL, grassR);

    // Добавляем лужи на дороге
    this.spawnPuddles(chunkGroup);

    // 4. Генерация хрущёвок по бокам (чуть глубже на газоне)
    // Хрущёвки стоят на расстоянии X = ±15
    this.spawnKhrushchyovkas(chunkGroup);

    // 5. Заполнение двора деталями (деревья, лавочки, детские площадки, припаркованные машины)
    this.spawnYardDecorations(chunkGroup);

    const chunk = {
      startZ,
      endZ,
      group: chunkGroup,
      obstacles: [],
      coins: []
    };

    this.activeChunks.push(chunk);
    return chunk;
  }

  // Генерация луж
  spawnPuddles(group) {
    const numPuddles = Math.floor(Math.random() * 2);
    for (let i = 0; i < numPuddles; i++) {
      const sizeX = 1 + Math.random() * 1.5;
      const sizeZ = 1.5 + Math.random() * 2;
      const puddleGeo = new THREE.BoxGeometry(sizeX, 0.02, sizeZ);
      const puddle = new THREE.Mesh(puddleGeo, this.materials.puddle);
      
      const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
      const posX = lane * CONFIG.LANE_WIDTH + (Math.random() - 0.5) * 0.5;
      const posZ = Math.random() * this.chunkLength;
      
      puddle.position.set(posX, 0.01, posZ);
      group.add(puddle);
    }
  }

  // Создание модульных пятиэтажных хрущёвок с текстурами фасадов
  spawnKhrushchyovkas(group) {
    const buildingLength = 28;
    const buildingWidth = 12;
    const buildingHeight = 16; // 5 этажей

    // Слева и справа
    const sides = [-16, 16];
    
    sides.forEach(xPos => {
      // Спавним 2 дома по длине чанка (длина чанка 60, дома по 28 метров с зазором)
      for (let zOffset = 5; zOffset < this.chunkLength; zOffset += buildingLength + 4) {
        const building = new THREE.Group();
        building.position.set(xPos, buildingHeight / 2 - 0.1, zOffset + buildingLength / 2);
        
        // Рандомный набор текстурированных материалов для здания
        const mats = this.khrushchyovkaMaterialArrays[Math.floor(Math.random() * this.khrushchyovkaMaterialArrays.length)];
        
        // Основной каркас
        const bodyGeo = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingLength);
        const body = new THREE.Mesh(bodyGeo, mats);
        body.castShadow = true;
        body.receiveShadow = true;
        building.add(body);
        
        // Крыша
        const roofGeo = new THREE.BoxGeometry(buildingWidth + 0.4, 0.4, buildingLength + 0.4);
        const roof = new THREE.Mesh(roofGeo, this.materials.roof);
        roof.position.y = buildingHeight / 2 + 0.2;
        roof.castShadow = true;
        building.add(roof);

        // Объемные балконы (шторки/окна уже нарисованы на текстуре фасада, 
        // поэтому мы вешаем только 3D балконы для ощущения глубины)
        const floors = 5;
        const windowRows = 5; // соответствует разметке окон на текстуре (cols=6, но с отступами)
        const winFace = xPos > 0 ? -1 : 1; // Направление во двор
        const balconyGeo = new THREE.BoxGeometry(1.2, 0.8, 2.2);

        for (let floor = 1; floor < floors; floor++) { // со 2 этажа
          const yVal = -buildingHeight / 2 + 1.8 + floor * 3.0; // Высота каждого этажа
          
          for (let row = 0; row < windowRows; row++) {
            const zVal = -buildingLength / 2 + 3.0 + row * 5.5; // Соответствует положению окон
            
            // Балконы спавним выборочно поверх текстуры
            if (row !== 2 && Math.random() > 0.6) {
              const balcony = new THREE.Mesh(balconyGeo, this.materials.balcony);
              balcony.position.set(winFace * (buildingWidth / 2 + 0.6), yVal - 0.3, zVal);
              balcony.castShadow = true;
              balcony.receiveShadow = true;
              building.add(balcony);

              // Натянутая веревка с бельем на балконе
              if (Math.random() > 0.5) {
                const clothGeo = new THREE.BoxGeometry(0.1, 0.3, 0.3);
                const clothColors = [0xffffff, 0xff5555, 0x5555ff, 0xffff55];
                const clothMat = new THREE.MeshStandardMaterial({ color: clothColors[Math.floor(Math.random() * clothColors.length)] });
                const cloth = new THREE.Mesh(clothGeo, clothMat);
                cloth.position.set(winFace * (buildingWidth / 2 + 0.9), yVal + 0.1, zVal + (Math.random() - 0.5) * 1.0);
                building.add(cloth);
              }
            }
          }
        }

        // Подъездный козырек внизу по центру
        const canopyGeo = new THREE.BoxGeometry(2.5, 0.2, 2);
        const canopy = new THREE.Mesh(canopyGeo, this.materials.roof);
        canopy.position.set(winFace * (buildingWidth / 2 + 1.0), -buildingHeight / 2 + 2.5, 0);
        canopy.castShadow = true;
        building.add(canopy);

        const doorGeo = new THREE.BoxGeometry(0.1, 2.0, 1.2);
        const door = new THREE.Mesh(doorGeo, this.materials.roof);
        door.position.set(winFace * (buildingWidth / 2 + 0.05), -buildingHeight / 2 + 1.0, 0);
        building.add(door);

        group.add(building);
      }
    });
  }

  // Создание декораций во дворе (лавочки, детские площадки, деревья, припаркованные машины)
  spawnYardDecorations(group) {
    const leftSideX = -8;
    const rightSideX = 8;
    
    // Спавним декорации с шагом по длине чанка
    for (let zVal = 10; zVal < this.chunkLength - 10; zVal += 15) {
      
      // --- ЛЕВАЯ СТОРОНА ---
      if (Math.random() > 0.4) {
        // Дерево или лавочка
        if (Math.random() > 0.5) {
          this.createTree(group, leftSideX - Math.random() * 2, zVal);
        } else {
          this.createBench(group, leftSideX, zVal, Math.PI / 2);
          if (Math.random() > 0.5) {
            this.createTrashCan(group, leftSideX, zVal + 1.8);
          }
        }
      }

      // --- ПРАВАЯ СТОРОНА ---
      if (Math.random() > 0.4) {
        if (Math.random() > 0.6) {
          // Старая советская машина
          this.createSovietCar(group, rightSideX + 1.5, zVal, 0);
        } else {
          // Игровая площадка (качели / горка)
          this.createPlaygroundItem(group, rightSideX + 1, zVal);
        }
      }
    }

    // Случайные голуби на дороге или обочине
    const numPigeons = Math.floor(Math.random() * 3);
    for (let i = 0; i < numPigeons; i++) {
      const pigeon = new THREE.Group();
      
      // Маленькая модель голубя
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.25), this.materials.pigeon);
      body.position.y = 0.05;
      body.castShadow = true;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), this.materials.pigeon);
      head.position.set(0, 0.12, 0.08);
      
      pigeon.add(body, head);
      
      const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
      const pX = lane * CONFIG.LANE_WIDTH + (Math.random() - 0.5) * 1.5;
      const pZ = Math.random() * this.chunkLength;
      
      pigeon.position.set(pX, 0.01, pZ);
      group.add(pigeon);
    }
  }

  // Создание дерева (сглаженная круглая листва)
  createTree(group, x, z) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);

    // Ствол
    const trunkHeight = 2.5 + Math.random() * 1.5;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, trunkHeight, 8);
    const trunk = new THREE.Mesh(trunkGeo, this.materials.treeTrunk);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // Листва (Перекрывающиеся сферы для органичности)
    const leavesGeo = new THREE.SphereGeometry(1.2 + Math.random() * 0.3, 10, 10);
    const leaves = new THREE.Mesh(leavesGeo, this.materials.treeLeaves);
    leaves.position.y = trunkHeight;
    leaves.castShadow = true;
    tree.add(leaves);

    // Второй шар листвы сбоку
    const leaves2Geo = new THREE.SphereGeometry(0.8 + Math.random() * 0.2, 8, 8);
    const leaves2 = new THREE.Mesh(leaves2Geo, this.materials.treeLeaves);
    leaves2.position.set(0.4, trunkHeight + 0.5, -0.3);
    leaves2.castShadow = true;
    tree.add(leaves2);

    // Третий шар листвы с другого боку
    if (Math.random() > 0.4) {
      const leaves3Geo = new THREE.SphereGeometry(0.7, 8, 8);
      const leaves3 = new THREE.Mesh(leaves3Geo, this.materials.treeLeaves);
      leaves3.position.set(-0.4, trunkHeight + 0.3, 0.3);
      leaves3.castShadow = true;
      tree.add(leaves3);
    }

    group.add(tree);
  }

  // Создание лавочки
  createBench(group, x, z, rotationY) {
    const bench = new THREE.Group();
    bench.position.set(x, 0.2, z);
    bench.rotation.y = rotationY;

    // Сиденье
    const seatGeo = new THREE.BoxGeometry(2.0, 0.08, 0.6);
    const seat = new THREE.Mesh(seatGeo, this.materials.benchWood);
    seat.position.y = 0.2;
    seat.castShadow = true;
    bench.add(seat);

    // Спинка
    const backGeo = new THREE.BoxGeometry(2.0, 0.4, 0.08);
    const back = new THREE.Mesh(backGeo, this.materials.benchWood);
    back.position.set(0, 0.5, -0.28);
    back.castShadow = true;
    bench.add(back);

    // Ножки (ножки из черного металла)
    const legGeo = new THREE.BoxGeometry(0.08, 0.4, 0.08);
    const leg1 = new THREE.Mesh(legGeo, this.materials.benchMetal);
    leg1.position.set(-0.9, 0, 0.2);
    
    const leg2 = leg1.clone();
    leg2.position.set(0.9, 0, 0.2);
    
    const leg3 = leg1.clone();
    leg3.position.set(-0.9, 0, -0.2);
    
    const leg4 = leg1.clone();
    leg4.position.set(0.9, 0, -0.2);

    bench.add(leg1, leg2, leg3, leg4);
    group.add(bench);
  }

  // Создание мусорки
  createTrashCan(group, x, z) {
    const binGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 6);
    const bin = new THREE.Mesh(binGeo, this.materials.trashCan);
    bin.position.set(x, 0.3, z);
    bin.castShadow = true;
    group.add(bin);
  }

  // Создание старой машины (ВАЗ / Жигули)
  createSovietCar(group, x, z, rotationY) {
    const car = new THREE.Group();
    car.position.set(x, 0.35, z);
    car.rotation.y = rotationY;

    const carColorMat = this.materials.carColors[Math.floor(Math.random() * this.materials.carColors.length)];

    // Кузов низ
    const bodyGeo = new THREE.BoxGeometry(1.6, 0.5, 3.2);
    const body = new THREE.Mesh(bodyGeo, carColorMat);
    body.castShadow = true;
    body.receiveShadow = true;
    car.add(body);

    // Кабина верх
    const cabinGeo = new THREE.BoxGeometry(1.4, 0.45, 1.8);
    const cabin = new THREE.Mesh(cabinGeo, carColorMat);
    cabin.position.set(0, 0.45, -0.1);
    cabin.castShadow = true;
    car.add(cabin);

    // Стекла
    const glassGeo = new THREE.BoxGeometry(1.42, 0.3, 1.2);
    const glass = new THREE.Mesh(glassGeo, this.materials.carGlass);
    glass.position.set(0, 0.48, -0.1);
    car.add(glass);

    // Колеса
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 8);
    // Поворачиваем колеса набок
    wheelGeo.rotateZ(Math.PI / 2);

    const w1 = new THREE.Mesh(wheelGeo, this.materials.wheel);
    w1.position.set(-0.8, -0.2, 0.9);
    w1.castShadow = true;
    
    const w2 = w1.clone();
    w2.position.set(0.8, -0.2, 0.9);

    const w3 = w1.clone();
    w3.position.set(-0.8, -0.2, -0.9);

    const w4 = w1.clone();
    w4.position.set(0.8, -0.2, -0.9);

    car.add(w1, w2, w3, w4);
    group.add(car);
  }

  // Создание элемента детской площадки
  createPlaygroundItem(group, x, z) {
    const pg = new THREE.Group();
    pg.position.set(x, 0, z);

    if (Math.random() > 0.5) {
      // --- Советские качели ---
      // Стойки
      const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 5);
      const leftPole = new THREE.Mesh(poleGeo, this.materials.benchMetal);
      leftPole.position.set(-0.8, 1.1, 0);
      leftPole.rotation.z = 0.15;
      
      const rightPole = leftPole.clone();
      rightPole.position.x = 0.8;
      rightPole.rotation.z = -0.15;

      // Перекладина
      const topBarGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 5);
      topBarGeo.rotateZ(Math.PI / 2);
      const topBar = new THREE.Mesh(topBarGeo, this.materials.benchMetal);
      topBar.position.y = 2.2;

      // Сидушка на цепях
      const ropeGeo = new THREE.BoxGeometry(0.02, 1.2, 0.02);
      const ropeL = new THREE.Mesh(ropeGeo, this.materials.benchMetal);
      ropeL.position.set(-0.3, 1.5, 0);
      
      const ropeR = ropeL.clone();
      ropeR.position.x = 0.3;

      const boardGeo = new THREE.BoxGeometry(0.7, 0.05, 0.35);
      const board = new THREE.Mesh(boardGeo, this.materials.benchWood);
      board.position.set(0, 0.9, 0);

      pg.add(leftPole, rightPole, topBar, ropeL, ropeR, board);
    } else {
      // --- Советская горка ---
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x0088cc, roughness: 0.5 });
      const slideMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.2, metalness: 0.8 }); // Стальной скат

      // Каркас лестницы
      const ladderGeo = new THREE.BoxGeometry(0.08, 1.8, 0.08);
      const l1 = new THREE.Mesh(ladderGeo, metalMat);
      l1.position.set(-0.4, 0.9, 1.5);
      
      const l2 = l1.clone();
      l2.position.x = 0.4;

      // Спуск горки (под углом)
      const rampGeo = new THREE.BoxGeometry(0.8, 0.08, 2.5);
      const ramp = new THREE.Mesh(rampGeo, slideMat);
      ramp.position.set(0, 0.8, 0);
      ramp.rotation.x = -0.6; // наклон
      ramp.castShadow = true;

      // Площадка наверху
      const platformGeo = new THREE.BoxGeometry(0.8, 0.08, 0.6);
      const platform = new THREE.Mesh(platformGeo, metalMat);
      platform.position.set(0, 1.7, 1.2);

      pg.add(l1, l2, ramp, platform);
    }

    group.add(pg);
  }

  // Очистка памяти для удаляемого чанка
  disposeHierarchy(obj) {
    obj.traverse(child => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        // Примечание: материалы не удаляем, так как они переиспользуются из кэша (this.materials)
      }
    });
  }
}
