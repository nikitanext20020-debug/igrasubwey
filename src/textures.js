// Модуль процедурной генерации текстур для игры «Ваня Бежит»
import * as THREE from 'three';

export class TextureGenerator {
  // Генерация текстуры фасада хрущёвки
  static createKhrushchyovkaTexture(baseColorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // 1. Заливаем базовым цветом
    ctx.fillStyle = baseColorHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Добавляем текстурный шум бетона (грязь и шероховатость)
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 20; // Интенсивность шума
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
      data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // 3. Рисуем подтеки грязи сверху вниз (эффект старого здания)
    for (let i = 0; i < 15; i++) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 150 + Math.random() * 200);
      gradient.addColorStop(0, 'rgba(40, 35, 30, 0.4)');
      gradient.addColorStop(1, 'rgba(40, 35, 30, 0.0)');
      ctx.fillStyle = gradient;
      
      const x = Math.random() * canvas.width;
      const w = 30 + Math.random() * 80;
      ctx.fillRect(x, 0, w, canvas.height);
    }

    // Подтеки грязи снизу вверх (налет от земли)
    const bottomGrad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - 80);
    bottomGrad.addColorStop(0, 'rgba(50, 45, 40, 0.6)');
    bottomGrad.addColorStop(1, 'rgba(50, 45, 40, 0.0)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

    // 4. Панельные швы (советские бетонные плиты)
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(30, 30, 30, 0.55)'; // Темные швы
    
    const rows = 5; // 5 этажей
    const cols = 6; // 6 секций панелей
    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;

    // Сетка швов
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellHeight);
      ctx.lineTo(canvas.width, r * cellHeight);
      ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellWidth, 0);
      ctx.lineTo(c * cellWidth, canvas.height);
      ctx.stroke();
    }

    // 5. Рисуем окна в каждой ячейке
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Координаты центра панели
        const cellX = c * cellWidth;
        const cellY = r * cellHeight;
        
        // Размеры окна относительно панели
        const winW = cellWidth * 0.42;
        const winH = cellHeight * 0.52;
        const winX = cellX + (cellWidth - winW) / 2;
        const winY = cellY + (cellHeight - winH) / 2 - 5; // чуть приподнято

        // Рисуем бетонный отлив снизу окна
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(winX - 5, winY + winH, winW + 10, 8); // Тень отлива
        ctx.fillStyle = '#b0b5b8'; // Светлый бетон
        ctx.fillRect(winX - 4, winY + winH, winW + 8, 6);

        // Рама окна (белый пластик или серое дерево)
        ctx.fillStyle = '#e8eae6';
        ctx.fillRect(winX, winY, winW, winH);

        // Стекла окон
        const glassPadding = 6;
        const glassW = (winW - glassPadding * 3) / 2;
        const glassH = winH - glassPadding * 2;

        // Левое и правое стекло
        for (let g = 0; g < 2; g++) {
          const gX = winX + glassPadding + g * (glassW + glassPadding);
          const gY = winY + glassPadding;

          // Рандомно: свет горит (желтый) или выключен (отражение неба)
          const isLightOn = Math.random() > 0.4;
          const glassGrad = ctx.createLinearGradient(gX, gY, gX, gY + glassH);

          if (isLightOn) {
            glassGrad.addColorStop(0, '#ffeeaa');
            glassGrad.addColorStop(1, '#ffc233');
          } else {
            glassGrad.addColorStop(0, '#1d324b');
            glassGrad.addColorStop(1, '#0e1824');
          }
          
          ctx.fillStyle = glassGrad;
          ctx.fillRect(gX, gY, glassW, glassH);

          // Рамы форточки (деление стекол)
          ctx.strokeStyle = '#e8eae6';
          ctx.lineWidth = 3;
          ctx.beginPath();
          // Горизонтальная форточка в левом стекле
          if (g === 0) {
            ctx.moveTo(gX, gY + glassH * 0.35);
            ctx.lineTo(gX + glassW, gY + glassH * 0.35);
          }
          // Вертикальный делитель в правом стекле
          if (g === 1) {
            ctx.moveTo(gX + glassW * 0.5, gY);
            ctx.lineTo(gX + glassW * 0.5, gY + glassH);
          }
          ctx.stroke();

          // Добавим легкие шторки в окна с включенным светом
          if (isLightOn && Math.random() > 0.5) {
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(230, 200, 200, 0.7)' : 'rgba(200, 220, 230, 0.7)';
            ctx.beginPath();
            ctx.moveTo(gX, gY);
            ctx.lineTo(gX + glassW * 0.4, gY);
            ctx.lineTo(gX, gY + glassH * 0.9);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // Генерация бесшовной текстуры шума для асфальта/земли
  static createNoiseTexture(colorHex, noiseStrength = 15) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const val = (Math.random() - 0.5) * noiseStrength;
      data[i] = Math.min(255, Math.max(0, data[i] + val));
      data[i+1] = Math.min(255, Math.max(0, data[i+1] + val));
      data[i+2] = Math.min(255, Math.max(0, data[i+2] + val));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }
}
