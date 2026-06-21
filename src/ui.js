// Менеджер интерфейса (UI) для игры «Ваня Бежит»
import { CONFIG } from '../config.js';
import { audioManager } from './audio.js';

class UIManager {
  constructor() {
    this.bottles = parseInt(localStorage.getItem('gin_bottles')) || 0;
    this.highscore = parseInt(localStorage.getItem('highscore')) || 0;
    
    // Заряды бонусов, доступные для забега
    this.inventory = {
      box: parseInt(localStorage.getItem('inv_box')) || 0,
      fart: localStorage.getItem('inv_fart') === 'true' // Многоразовый разблокируемый апгрейд
    };

    this.onStartGameCallback = null;
    this.onResumeGameCallback = null;
    this.onQuitGameCallback = null;
    this.activeScreen = 'main-menu';
  }

  init(callbacks) {
    this.onStartGameCallback = callbacks.onStart;
    this.onResumeGameCallback = callbacks.onResume;
    this.onQuitGameCallback = callbacks.onQuit;

    this.bindElements();
    this.updateStatsDisplay();
    this.updateShopButtons();
  }

  bindElements() {
    // Получение экранов
    this.screens = {
      'main-menu': document.getElementById('main-menu'),
      'shop-menu': document.getElementById('shop-menu'),
      'hud': document.getElementById('hud'),
      'pause-screen': document.getElementById('pause-screen'),
      'game-over-screen': document.getElementById('game-over-screen')
    };

    // Кнопки главного меню
    document.getElementById('btn-play').addEventListener('click', () => {
      if (this.onStartGameCallback) this.onStartGameCallback();
    });
    document.getElementById('btn-shop').addEventListener('click', () => {
      this.showScreen('shop-menu');
    });

    // Звук
    const btnSound = document.getElementById('btn-sound-toggle');
    btnSound.textContent = audioManager.soundEnabled ? '🔊' : '🔇';
    btnSound.addEventListener('click', () => {
      const enabled = audioManager.toggleSound();
      btnSound.textContent = enabled ? '🔊' : '🔇';
    });

    // Кнопка назад в магазине
    document.getElementById('btn-shop-back').addEventListener('click', () => {
      this.showScreen('main-menu');
    });

    // Покупка бонусов в магазине
    document.getElementById('btn-buy-box').addEventListener('click', () => this.buyItem('box', CONFIG.PRICES.BOX));
    document.getElementById('btn-buy-fart').addEventListener('click', () => this.buyItem('fart', CONFIG.PRICES.FART));
    document.getElementById('btn-buy-napkin').addEventListener('click', () => this.buyItem('napkin', CONFIG.PRICES.NAPKIN));

    // Пауза
    document.getElementById('btn-pause').addEventListener('click', () => {
      this.showPause(true);
    });
    document.getElementById('btn-resume').addEventListener('click', () => {
      this.showPause(false);
      if (this.onResumeGameCallback) this.onResumeGameCallback();
    });
    document.getElementById('btn-quit').addEventListener('click', () => {
      this.showPause(false);
      if (this.onQuitGameCallback) this.onQuitGameCallback();
    });

    // Game Over кнопки
    document.getElementById('btn-restart').addEventListener('click', () => {
      if (this.onStartGameCallback) this.onStartGameCallback();
    });
    document.getElementById('btn-shop-go').addEventListener('click', () => {
      this.showScreen('shop-menu');
    });
    document.getElementById('btn-menu-go').addEventListener('click', () => {
      this.showScreen('main-menu');
    });
  }

  showScreen(screenId) {
    this.activeScreen = screenId;
    Object.keys(this.screens).forEach(id => {
      if (id === screenId) {
        this.screens[id].classList.add('active');
      } else {
        this.screens[id].classList.remove('active');
      }
    });

    // При открытии магазина или меню обновляем баланс
    this.updateStatsDisplay();
    if (screenId === 'shop-menu') {
      this.updateShopButtons();
    }
  }

  showPause(show) {
    if (show) {
      this.screens['pause-screen'].classList.add('active');
    } else {
      this.screens['pause-screen'].classList.remove('active');
    }
  }

  // Обновление баланса бутылок и рекордов на экранах
  updateStatsDisplay() {
    // В меню
    document.getElementById('menu-bottles-count').textContent = this.bottles;
    document.getElementById('menu-highscore').textContent = `Рекорд: ${this.highscore}`;
    
    // В магазине
    document.getElementById('shop-bottles-count').textContent = this.bottles;
  }

  // Обновление состояния кнопок покупки в магазине
  updateShopButtons() {
    const btnBox = document.getElementById('btn-buy-box');
    const btnFart = document.getElementById('btn-buy-fart');
    const btnNapkin = document.getElementById('btn-buy-napkin');

    // Кнопка Коробки-самолета
    btnBox.disabled = this.bottles < CONFIG.PRICES.BOX;
    btnBox.textContent = `Купить (${CONFIG.PRICES.BOX} 🍾) [У тебя: ${this.inventory.box}]`;

    // Кнопка Розового джина (многоразовая разблокировка)
    btnFart.disabled = this.bottles < CONFIG.PRICES.FART || this.inventory.fart;
    if (this.inventory.fart) {
      btnFart.textContent = 'Разблокировано';
      btnFart.classList.add('btn-secondary');
    } else {
      btnFart.textContent = `Разблокировать (${CONFIG.PRICES.FART} 🍾)`;
      btnFart.classList.remove('btn-secondary');
    }

    // Кнопка Салфеток
    btnNapkin.disabled = this.bottles < CONFIG.PRICES.NAPKIN;
    btnNapkin.textContent = `Купить (${CONFIG.PRICES.NAPKIN} 🍾)`;
  }

  // Логика покупки бонусов
  buyItem(itemType, price) {
    if (this.bottles < price) return;

    this.bottles -= price;
    localStorage.setItem('gin_bottles', this.bottles);

    if (itemType === 'box') {
      this.inventory.box++;
      localStorage.setItem('inv_box', this.inventory.box);
    } else if (itemType === 'fart') {
      this.inventory.fart = true;
      localStorage.setItem('inv_fart', 'true');
    } else if (itemType === 'napkin') {
      // Бонус 3: перенаправление на заданный URL в новой вкладке
      window.open(CONFIG.NAPKIN_URL, '_blank');
    }

    audioManager.playSFX('pickup'); // Звук успешной операции
    this.updateStatsDisplay();
    this.updateShopButtons();
  }

  // Начать игровой HUD
  startHUD() {
    this.showScreen('hud');
    this.updateHUDBottles(0);
    this.updateHUDScore(0);
    this.hideBonusBadges();
  }

  updateHUDBottles(count) {
    document.getElementById('hud-bottles').textContent = count;
  }

  updateHUDScore(score) {
    const formatted = String(Math.floor(score)).padStart(6, '0');
    document.getElementById('hud-score').textContent = formatted;
  }

  // Отображение активных бонусов в HUD
  updateBonusHUD(type, timeLeftPercent) {
    const badge = document.getElementById(`hud-bonus-${type}`);
    const fill = document.getElementById(`bonus-${type}-fill`);
    
    if (timeLeftPercent > 0) {
      badge.classList.remove('hidden');
      fill.style.width = `${timeLeftPercent}%`;
    } else {
      badge.classList.add('hidden');
    }
  }

  hideBonusBadges() {
    document.getElementById('hud-bonus-box').classList.add('hidden');
    document.getElementById('hud-bonus-fart').classList.add('hidden');
  }

  // Показ Game Over экрана
  showGameOver(runScore, runBottles) {
    this.bottles += runBottles;
    localStorage.setItem('gin_bottles', this.bottles);

    let isNewHigh = false;
    if (runScore > this.highscore) {
      this.highscore = Math.floor(runScore);
      localStorage.setItem('highscore', this.highscore);
      isNewHigh = true;
    }

    document.getElementById('go-score').textContent = Math.floor(runScore);
    document.getElementById('go-highscore').textContent = this.highscore + (isNewHigh ? ' (НОВЫЙ!)' : '');
    document.getElementById('go-bottles').textContent = `+${runBottles}`;

    this.showScreen('game-over-screen');
  }

  // Потребление одноразовой коробки при старте
  useBox() {
    if (this.inventory.box > 0) {
      this.inventory.box--;
      localStorage.setItem('inv_box', this.inventory.box);
      this.updateShopButtons();
      return true;
    }
    return false;
  }
}

export const uiManager = new UIManager();
export default uiManager;
