// Менеджер звука и озвучки для игры «Ваня Бежит»

class AudioManager {
  constructor() {
    this.soundEnabled = localStorage.getItem('sound_enabled') !== 'false';
    this.currentMusic = null;
    this.currentVoice = null;
    this.lastVoiceTime = 0;
    
    // Пути к аудиофайлам
    this.paths = {
      // Музыка
      menuMusic: 'audio/music/menu_music.mp3',
      runMusic: 'audio/music/run_music.mp3',
      
      // Спецэффекты
      pickup: 'audio/sfx/pickup.mp3',
      crash: 'audio/sfx/crash.mp3',
      puk: 'audio/sfx/puk.mp3',
      
      // Голоса
      voiceVanyaSpawn: 'audio/voices/voice4.mp3',
      voiceVanyaBox: 'audio/voices/voice10.mp3',
      
      voiceBabushka: [
        'audio/voices/voice1.mp3',
        'audio/voices/voice2.mp3'
      ],
      
      voiceLiza: [
        'audio/voices/voice5.mp3',
        'audio/voices/voice6.mp3',
        'audio/voices/voice7.mp3'
      ]
    };
    
    // Предварительно созданные аудио-элементы для музыки
    this.musicElements = {
      menu: this.createAudio(this.paths.menuMusic, true),
      run: this.createAudio(this.paths.runMusic, true)
    };
  }

  // Создание аудио с заглушкой ошибок
  createAudio(src, loop = false) {
    const audio = new Audio(src);
    audio.loop = loop;
    audio.addEventListener('error', (e) => {
      // Игнорируем ошибки отсутствия файлов, чтобы игра продолжала работать
      console.warn(`Аудиофайл не найден или не может быть загружен: ${src}`);
    });
    return audio;
  }

  // Включение/выключение звука
  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('sound_enabled', this.soundEnabled);
    
    if (!this.soundEnabled) {
      this.stopAll();
    } else {
      // Возобновляем музыку, если она должна играть
      if (this.currentMusic) {
        this.playMusic(this.currentMusic);
      }
    }
    return this.soundEnabled;
  }

  // Запуск фоновой музыки
  playMusic(type) {
    this.currentMusic = type;
    if (!this.soundEnabled) return;

    // Останавливаем всю музыку
    Object.values(this.musicElements).forEach(el => {
      el.pause();
      el.currentTime = 0;
    });

    const targetMusic = this.musicElements[type];
    if (targetMusic) {
      targetMusic.volume = 0.4; // Чуть тише голосов
      targetMusic.play().catch(err => {
        console.warn("Браузер заблокировал автовоспроизведение музыки. Ждем взаимодействия.");
      });
    }
  }

  // Остановка всей музыки
  stopMusic() {
    Object.values(this.musicElements).forEach(el => {
      el.pause();
    });
  }

  // Воспроизведение короткого SFX
  playSFX(type) {
    if (!this.soundEnabled) return;
    
    const src = this.paths[type];
    if (!src) return;

    const sfx = this.createAudio(src);
    sfx.volume = 0.6;
    sfx.play().catch(() => {});
  }

  // Воспроизведение голоса с учетом приоритетов и задержек
  playVoice(src, force = false) {
    if (!this.soundEnabled) return;
    
    const now = Date.now();
    
    // Если голос уже играет, и это не принудительно, отменяем
    if (this.currentVoice && !this.currentVoice.paused && !force) {
      return false;
    }

    // Останавливаем предыдущий голос
    if (this.currentVoice) {
      this.currentVoice.pause();
      this.currentVoice = null;
    }

    const voice = this.createAudio(src);
    voice.volume = 1.0;
    this.currentVoice = voice;
    this.lastVoiceTime = now;
    
    voice.play().catch(() => {});
    return true;
  }

  // Озвучка спавна Вани
  playVanyaSpawn() {
    this.playVoice(this.paths.voiceVanyaSpawn, true);
  }

  // Озвучка полета Вани в коробке
  playVanyaBox() {
    this.playVoice(this.paths.voiceVanyaBox, true);
  }

  // Случайная озвучка бабушки
  playBabushkaVoice() {
    const chance = Math.random();
    // Вероятность 35% и задержка минимум 4 секунды между голосами
    if (chance < 0.35 && (Date.now() - this.lastVoiceTime > 4000)) {
      const idx = Math.floor(Math.random() * this.paths.voiceBabushka.length);
      this.playVoice(this.paths.voiceBabushka[idx]);
    }
  }

  // Случайная озвучка Лизы (погоня)
  playLizaVoice() {
    // Вызывается из игрового цикла по таймеру, играет раз в 8-15 секунд
    const idx = Math.floor(Math.random() * this.paths.voiceLiza.length);
    this.playVoice(this.paths.voiceLiza[idx]);
  }

  // Остановка всего звука
  stopAll() {
    this.stopMusic();
    if (this.currentVoice) {
      this.currentVoice.pause();
      this.currentVoice = null;
    }
  }
}

// Экспортируем синглтон менеджера звуков
export const audioManager = new AudioManager();
export default audioManager;
