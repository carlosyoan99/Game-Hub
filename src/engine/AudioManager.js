/**
 * AudioManager
 * Gestor de audio basado en Web Audio API para juegos Canvas 2D.
 *
 * Soporta:
 *   - Carga y reproducción de archivos de audio (WAV/MP3/Ogg) des de buffers
 *   - Sonidos procedimentales (beep, noise, y SFX comunes sin archivos)
 *   - Música de fondo en loop
 *   - Volumen maestro, SFX y música por separado, persistidos en localStorage
 *   - Gestión automática de autoplay (AudioContext suspendido)
 *
 * Singleton: una instancia global compartida por todos los juegos.
 * El AudioContext se crea bajo demanda en la primera llamada a resume()
 * (que debe hacerse en respuesta a un gesto del usuario: click/touch/keydown).
 *
 * Uso básico:
 *   import { AudioManager } from '../../engine/AudioManager.js';
 *
 *   // En init() del juego, atar al primer input del usuario:
 *   // (El hub main.js puede llamarlo al hacer click en una carta)
 *   AudioManager.resume();
 *
 *   // Sonidos procedimentales (sin archivos):
 *   AudioManager.beep(440, 0.15, 0.3);
 *   AudioManager.sfx({ type: 'jump' });
 *   AudioManager.sfx({ type: 'coin' });
 *   AudioManager.sfx({ type: 'hit' });
 *   AudioManager.sfx({ type: 'shoot' });
 *   AudioManager.sfx({ type: 'explosion' });
 *
 *   // Cargar y reproducir archivos:
 *   await AudioManager.load('mi-sonido', './assets/sonido.mp3');
 *   AudioManager.play('mi-sonido');
 *
 *   // Música de fondo:
 *   AudioManager.playMusic('./assets/bg.mp3');
 *   AudioManager.stopMusic();
 *
 *   // Volumen (persistido en localStorage):
 *   AudioManager.setMasterVolume(0.8);
 *   AudioManager.setSfxVolume(1.0);
 *   AudioManager.setMusicVolume(0.5);
 */

import { clamp } from './CollisionUtils.js';

const STORAGE_KEY = 'gamehub:audio:volumes';

class AudioManagerImpl {
  constructor() {
    /** @type {AudioContext|null} Se crea bajo demanda en resume(). */
    this._ctx = null;
    /** @type {GainNode|null} Nodo de volumen maestro. */
    this._masterGain = null;
    /** @type {GainNode|null} Nodo de volumen SFX. */
    this._sfxGain = null;
    /** @type {GainNode|null} Nodo de volumen música. */
    this._musicGain = null;

    /** @type {Map<string, AudioBuffer>} Búferes de audio cargados. */
    this._buffers = new Map();
    /** @type {AudioBufferSourceNode|null} Fuente de música actual. */
    this._musicSource = null;
    /** @type {boolean} ¿Se ha reanudado el contexto? */
    this._resumed = false;
    /** @type {boolean} ¿Silenciado? */
    this._muted = false;
    /** @type {number[]} IDs de setTimeout pendientes para limpiar en destroy. */
    this._timeoutIds = [];

    // Volúmenes con valores por defecto.
    this._masterVolume = 0.8;
    this._sfxVolume = 1.0;
    this._musicVolume = 0.5;

    this._loadVolumes();
  }

  // ------------------------------------------------------------------
  //  Inicialización del contexto
  // ------------------------------------------------------------------

  /**
   * Crea o reanuda el AudioContext. DEBE llamarse desde un gesto del
   * usuario (click, touch, tecla) por la política de autoplay.
   * Es seguro llamarlo múltiples veces.
   */
  resume() {
    if (this._resumed && this._ctx?.state === 'running') return;

    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._masterVolume;
      this._masterGain.connect(this._ctx.destination);

      this._sfxGain = this._ctx.createGain();
      this._sfxGain.gain.value = this._sfxVolume;
      this._sfxGain.connect(this._masterGain);

      this._musicGain = this._ctx.createGain();
      this._musicGain.gain.value = this._musicVolume;
      this._musicGain.connect(this._masterGain);
    }

    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    this._resumed = true;
  }

  /** ¿El contexto de audio está listo para reproducir? */
  get ready() {
    return this._resumed && this._ctx?.state === 'running';
  }

  // ------------------------------------------------------------------
  //  Carga de archivos de audio
  // ------------------------------------------------------------------

  /**
   * Carga un archivo de audio (WAV/MP3/Ogg) en un búfer decodificado.
   * @param {string} key  Identificador para reproducirlo después.
   * @param {string} url  Ruta al archivo de audio.
   * @returns {Promise<AudioBuffer>}
   */
  async load(key, url) {
    if (this._buffers.has(key)) return this._buffers.get(key);

    // Asegurar contexto para decodificar.
    this.resume();

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`AudioManager: no se pudo cargar "${url}" (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this._ctx.decodeAudioData(arrayBuffer);
    this._buffers.set(key, audioBuffer);
    return audioBuffer;
  }

  /**
   * Reproduce un sonido cargado previamente con load().
   * @param {string} key     Identificador del búfer.
   * @param {object} [opts]
   * @param {number} [opts.volume=1]  Volumen relativo (0-1).
   * @param {number} [opts.playbackRate=1]  Velocidad de reproducción.
   * @param {boolean} [opts.loop=false]  ¿Repetir en bucle?
   * @returns {AudioBufferSourceNode|null}
   */
  play(key, opts = {}) {
    if (!this.ready) return null;

    const buffer = this._buffers.get(key);
    if (!buffer) {
      console.warn(`AudioManager: búfer "${key}" no encontrado. Llama a load() primero.`);
      return null;
    }

    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = opts.playbackRate ?? 1;
    source.loop = opts.loop ?? false;

    if (opts.volume != null && opts.volume !== 1) {
      const gain = this._ctx.createGain();
      gain.gain.value = opts.volume;
      source.connect(gain);
      gain.connect(this._sfxGain);
    } else {
      source.connect(this._sfxGain);
    }

    source.start(0);
    return source;
  }

  // ------------------------------------------------------------------
  //  Sonidos procedimentales (sin archivos)
  // ------------------------------------------------------------------

  /**
   * Reproduce un tono senoidal.
   * @param {number} freq      Frecuencia en Hz (p.ej. 440 = La4).
   * @param {number} duration  Duración en segundos.
   * @param {number} [volume=0.3]  Volumen (0-1).
   * @param {string} [type='sine']  Tipo de onda: sine|square|sawtooth|triangle.
   */
  beep(freq, duration, volume = 0.3, type = 'sine') {
    if (!this.ready) return;

    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, this._ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(0);
    osc.stop(this._ctx.currentTime + duration + 0.05);
  }

  /**
   * Reproduce ruido blanco (explosiones, impacto, viento).
   * @param {number} duration  Duración en segundos.
   * @param {number} [volume=0.5]  Volumen (0-1).
   * @param {number} [lowpass=null]  Frecuencia de corte de filtro paso bajo (opcional).
   */
  noise(duration, volume = 0.5, lowpass = null) {
    if (!this.ready) return;

    const bufferSize = this._ctx.sampleRate * duration;
    const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this._ctx.createBufferSource();
    source.buffer = buffer;

    let output = source;
    if (lowpass) {
      const filter = this._ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      source.connect(filter);
      output = filter;
    }

    const gain = this._ctx.createGain();
    gain.gain.setValueAtTime(volume, this._ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + duration);
    output.connect(gain);
    gain.connect(this._sfxGain);
    source.start(0);
    source.stop(this._ctx.currentTime + duration + 0.05);
  }

  /**
   * Reproduce un efecto de sonido predefinido.
   * @param {object} opts
   * @param {'jump'|'coin'|'hit'|'shoot'|'explosion'|'select'|'powerup'} opts.type
   * @param {number} [opts.volume=1]  Volumen relativo (0-1).
   */
  sfx({ type, volume = 1 }) {
    // No pushear timeouts ni crear sonidos si el contexto aún no se ha reanudado.
    if (!this._resumed) return;

    switch (type) {
      case 'jump':
        // Barrido ascendente rápido.
        this.beep(200, 0.12, volume * 0.4);
        this._timeoutIds.push(setTimeout(() => this.beep(500, 0.08, volume * 0.3), 40));
        break;

      case 'coin':
        // Dos tonos ascendentes (clásico Mario).
        this.beep(988, 0.08, volume * 0.35);
        this._timeoutIds.push(setTimeout(() => this.beep(1319, 0.15, volume * 0.35), 80));
        break;

      case 'hit':
        // Ruido corto + tono grave.
        this.noise(0.08, volume * 0.6, 800);
        this.beep(120, 0.1, volume * 0.5, 'square');
        break;

      case 'shoot':
        // Barrido descendente rápido (laser).
        if (!this.ready) return;
        {
          const osc = this._ctx.createOscillator();
          const gain = this._ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(800, this._ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(200, this._ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(volume * 0.25, this._ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + 0.15);
          osc.connect(gain);
          gain.connect(this._sfxGain);
          osc.start(0);
          osc.stop(this._ctx.currentTime + 0.2);
        }
        break;

      case 'explosion':
        this.noise(0.3, volume * 0.8, 2000);
        this.beep(60, 0.4, volume * 0.7, 'sawtooth');
        break;

      case 'select':
        this.beep(660, 0.06, volume * 0.3);
        break;

      case 'powerup':
        this.beep(400, 0.1, volume * 0.35);
        this._timeoutIds.push(setTimeout(() => this.beep(600, 0.1, volume * 0.35), 100));
        this._timeoutIds.push(setTimeout(() => this.beep(800, 0.2, volume * 0.35), 200));
        break;

      default:
        console.warn(`AudioManager: tipo de SFX desconocido "${type}"`);
    }
  }

  // ------------------------------------------------------------------
  //  Música de fondo
  // ------------------------------------------------------------------

  /**
   * Carga y reproduce música de fondo en bucle.
   * Llama a load() internamente si es la primera vez.
   * @param {string} url  Ruta al archivo de música.
   * @param {object} [opts]
   * @param {number} [opts.volume=1]  Volumen relativo (0-1).
   */
  async playMusic(url, opts = {}) {
    this.stopMusic();

    const key = `__music__${url}`;
    let buffer = this._buffers.get(key);
    if (!buffer) {
      buffer = await this.load(key, url);
    }

    if (!this.ready) return;

    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    if (opts.volume != null && opts.volume !== 1) {
      const gain = this._ctx.createGain();
      gain.gain.value = opts.volume;
      source.connect(gain);
      gain.connect(this._musicGain);
    } else {
      source.connect(this._musicGain);
    }

    source.start(0);
    this._musicSource = source;
  }

  /** Detiene la música de fondo actual. */
  stopMusic() {
    if (this._musicSource) {
      try { this._musicSource.stop(); } catch (e) { /* ya terminó */ }
      this._musicSource.disconnect();
      this._musicSource = null;
    }
  }

  // ------------------------------------------------------------------
  //  Control de volumen (persistido)
  // ------------------------------------------------------------------

  /** Volumen maestro (0-1). Afecta a todos los sonidos. */
  get masterVolume() { return this._masterVolume; }
  set masterVolume(v) { this.setMasterVolume(v); }

  setMasterVolume(value) {
    this._masterVolume = clamp(value, 0, 1);
    if (this._masterGain) this._masterGain.gain.value = this._masterVolume;
    this._saveVolumes();
  }

  /** Volumen de efectos SFX (0-1). */
  get sfxVolume() { return this._sfxVolume; }
  set sfxVolume(v) { this.setSfxVolume(v); }

  setSfxVolume(value) {
    this._sfxVolume = clamp(value, 0, 1);
    if (this._sfxGain) this._sfxGain.gain.value = this._sfxVolume;
    this._saveVolumes();
  }

  /** Volumen de música (0-1). */
  get musicVolume() { return this._musicVolume; }
  set musicVolume(v) { this.setMusicVolume(v); }

  setMusicVolume(value) {
    this._musicVolume = clamp(value, 0, 1);
    if (this._musicGain) this._musicGain.gain.value = this._musicVolume;
    this._saveVolumes();
  }

  /** Silencia/restaura todo el audio. */
  setMuted(muted) {
    if (this._masterGain) {
      this._masterGain.gain.value = muted ? 0 : this._masterVolume;
    }
    this._muted = muted;
    this._saveVolumes();
  }

  get muted() {
    return this._muted ?? false;
  }

  // ------------------------------------------------------------------
  //  Persistencia
  // ------------------------------------------------------------------

  _saveVolumes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        master: this._masterVolume,
        sfx: this._sfxVolume,
        music: this._musicVolume,
        muted: this._muted ?? false,
      }));
    } catch { /* localStorage no disponible o lleno */ }
  }

  _loadVolumes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.master != null) this._masterVolume = clamp(data.master, 0, 1);
      if (data.sfx != null) this._sfxVolume = clamp(data.sfx, 0, 1);
      if (data.music != null) this._musicVolume = clamp(data.music, 0, 1);
      if (data.muted != null) this._muted = !!data.muted;
    } catch { /* ignorar */ }
  }

  // ------------------------------------------------------------------
  //  Limpieza
  // ------------------------------------------------------------------

  /** Libera todos los recursos de audio. */
  destroy() {
    this.stopMusic();
    // Cancelar timeouts pendientes.
    for (const id of this._timeoutIds) clearTimeout(id);
    this._timeoutIds = [];
    this._buffers.clear();
    if (this._ctx) {
      this._ctx.close();
      this._ctx = null;
    }
    this._resumed = false;
  }
}

// Singleton compartido por todos los juegos.
export const AudioManager = new AudioManagerImpl();
