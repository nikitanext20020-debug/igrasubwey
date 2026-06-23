// Менеджер звука и озвучки для игры «Ваня Бежит»

class AudioManager {
  constructor() {
    this.soundEnabled = localStorage.getItem('sound_enabled') !== 'false';
    this.currentMusic = null;
    this.currentVoice = null;
    this.lastVoiceTime = 0;
    this.audioUnlocked = false;
    this.musicBaseVolume = 0.32;
    this.musicDuckedVolume = 0.14;
    this.sfxVolume = 0.52;
    this.musicDuckTimeout = null;
    
    // Пути к аудиофайлам
    this.paths = {
      // Музыка
      menuMusic: 'audio/music/menu_music.m4a',
      runMusic: 'audio/music/run_music.m4a',
      
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
        'audio/voices/voice6.mp3'
      ]
    };
    
    // Предварительно созданные аудио-элементы для музыки
    this.musicElements = {
      menu: this.createAudio(this.paths.menuMusic, true, 'none'),
      run: this.createAudio(this.paths.runMusic, true, 'none')
    };

    this.sfxElements = {
      pickup: this.createAudio(this.paths.pickup, false, 'auto'),
      crash: this.createAudio(this.paths.crash, false, 'auto'),
      puk: this.createAudio(this.paths.puk, false, 'auto')
    };

    this.voiceElements = {};
    [
      this.paths.voiceVanyaSpawn,
      this.paths.voiceVanyaBox,
      ...this.paths.voiceBabushka,
      ...this.paths.voiceLiza
    ].forEach(src => {
      this.voiceElements[src] = this.createAudio(src, false, 'metadata');
    });

    window.addEventListener('pointerdown', () => this.unlockAudio(), { once: true, passive: true });
    window.addEventListener('keydown', () => this.unlockAudio(), { once: true });
  }

  // Создание аудио с заглушкой ошибок
  createAudio(src, loop = false, preload = 'metadata') {
    const audio = new Audio(src);
    audio.loop = loop;
    audio.preload = preload;
    if (preload !== 'none') {
      audio.load();
    }
    audio.addEventListener('error', (e) => {
      // Игнорируем ошибки отсутствия файлов, чтобы игра продолжала работать
      console.warn(`Аудиофайл не найден или не может быть загружен: ${src}`);
    });
    return audio;
  }

  unlockAudio() {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;

    const all = [
      ...Object.values(this.sfxElements),
      ...Object.values(this.voiceElements)
    ];

    all.forEach(audio => {
      audio.load();
    });
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
  prepareMusic(type) {
    const targetMusic = this.musicElements[type];
    if (!targetMusic || !this.soundEnabled || !this.audioUnlocked) return;
    if (targetMusic.readyState === HTMLMediaElement.HAVE_NOTHING) {
      targetMusic.load();
    }
  }

  playMusic(type) {
    this.currentMusic = type;
    if (!this.soundEnabled || !this.audioUnlocked) return;

    // Останавливаем всю музыку
    Object.values(this.musicElements).forEach(el => {
      el.pause();
      el.currentTime = 0;
    });

    const targetMusic = this.musicElements[type];
    if (targetMusic) {
      targetMusic.volume = this.musicBaseVolume;
      if (targetMusic.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        targetMusic.load();
      }
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
    
    const sfx = this.sfxElements[type];
    if (!sfx) return;

    sfx.volume = this.sfxVolume;
    sfx.pause();
    sfx.currentTime = 0;
    sfx.play().catch(() => {});
  }

  duckMusicForVoice(voice) {
    const music = this.musicElements[this.currentMusic];
    if (!music) return;

    if (this.musicDuckTimeout) {
      clearTimeout(this.musicDuckTimeout);
      this.musicDuckTimeout = null;
    }

    music.volume = this.musicDuckedVolume;

    const durationMs = Number.isFinite(voice.duration) && voice.duration > 0
      ? voice.duration * 1000 + 180
      : 1800;

    this.musicDuckTimeout = setTimeout(() => {
      if (this.currentVoice === voice && !voice.paused && !voice.ended) return;
      this.restoreMusicVolume();
    }, durationMs);
  }

  restoreMusicVolume() {
    if (this.musicDuckTimeout) {
      clearTimeout(this.musicDuckTimeout);
      this.musicDuckTimeout = null;
    }

    const music = this.musicElements[this.currentMusic];
    if (music && this.soundEnabled) {
      music.volume = this.musicBaseVolume;
    }
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

    const voice = this.voiceElements[src] || this.createAudio(src);
    voice.volume = 1.0;
    this.currentVoice = voice;
    this.lastVoiceTime = now;
    voice.onended = () => {
      if (this.currentVoice === voice) {
        this.currentVoice = null;
        this.restoreMusicVolume();
      }
    };
    
    voice.pause();
    voice.currentTime = 0;
    this.duckMusicForVoice(voice);
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
    // Вероятность 45% и короткий кулдаун, чтобы фраза звучала около препятствия.
    if (chance < 0.45 && (Date.now() - this.lastVoiceTime > 1800)) {
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
    this.restoreMusicVolume();
  }
}

// Экспортируем синглтон менеджера звуков
export const audioManager = new AudioManager();
export default audioManager;
