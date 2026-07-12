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
   * @param {string} opts.type  Tipo de sonido. Ver switch para lista completa.
   * @param {number} [opts.volume=1]  Volumen relativo (0-1).
   */
  sfx({ type, volume = 1 }) {
    // No pushear timeouts ni crear sonidos si el contexto aún no se ha reanudado.
    if (!this._resumed) return;

    switch (type) {
      // ── Genéricos ─────────────────────────────────────────────────

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
        // Barrido descendente rápido (laser genérico).
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

      // ── Space Invaders ───────────────────────────────────────────

      case 'space_invaders_shoot': {
        // 3 tonos descendentes rápidos (clásico arcade).
        if (!this.ready) return;
        const t = this._ctx.currentTime;
        [600, 500, 400].forEach((f, i) => {
          const osc = this._ctx.createOscillator();
          const g = this._ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = f;
          g.gain.setValueAtTime(volume * 0.15, t + i * 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.06);
          osc.connect(g);
          g.connect(this._sfxGain);
          osc.start(t + i * 0.04);
          osc.stop(t + i * 0.04 + 0.1);
        });
        break;
      }

      case 'space_invaders_explosion':
        // Pop corto + ruido (alien explota).
        this.beep(300, 0.06, volume * 0.4, 'square');
        this.noise(0.06, volume * 0.3, 4000);
        break;

      // ── Pac-Man ──────────────────────────────────────────────────

      case 'pacman_chomp': {
        // Dos tonos alternados (wakka wakka).
        const t = this._ctx.currentTime;
        this.beep(330, 0.07, volume * 0.25, 'square');
        this._timeoutIds.push(setTimeout(() => this.beep(280, 0.07, volume * 0.25), 70));
        break;
      }

      case 'pacman_death':
        // Secuencia descendente (muerte clásica).
        if (!this.ready) return;
        {
          const t = this._ctx.currentTime;
          [500, 420, 350, 280, 210, 140].forEach((f, i) => {
            const osc = this._ctx.createOscillator();
            const g = this._ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = f;
            g.gain.setValueAtTime(volume * 0.3, t + i * 0.12);
            g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.15);
            osc.connect(g);
            g.connect(this._sfxGain);
            osc.start(t + i * 0.12);
            osc.stop(t + i * 0.12 + 0.2);
          });
        }
        break;

      // ── Tetris ───────────────────────────────────────────────────

      case 'tetris_clear':
        // Arpegio ascendente (línea completada).
        this.beep(523, 0.08, volume * 0.35);
        this._timeoutIds.push(setTimeout(() => this.beep(659, 0.08, volume * 0.35), 80));
        this._timeoutIds.push(setTimeout(() => this.beep(784, 0.08, volume * 0.35), 160));
        break;

      case 'tetris_drop':
        // Golpe grave corto (pieza fijada).
        this.beep(120, 0.06, volume * 0.5, 'square');
        this.noise(0.04, volume * 0.3, 600);
        break;

      // ── Galaga ───────────────────────────────────────────────────

      case 'galaga_shoot': {
        // Disparo más agudo y corto que el genérico.
        if (!this.ready) return;
        const t = this._ctx.currentTime;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.06);
        gain.gain.setValueAtTime(volume * 0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain);
        gain.connect(this._sfxGain);
        osc.start(0);
        osc.stop(t + 0.15);
        break;
      }

      // ── Frogger ──────────────────────────────────────────────────

      case 'frogger_hop':
        // Chirrido corto (salto de rana).
        this.beep(600, 0.04, volume * 0.3, 'square');
        this._timeoutIds.push(setTimeout(() => this.beep(800, 0.03, volume * 0.2), 20));
        break;

      case 'frogger_squish':
        // Golpe sordo (muerte).
        this.noise(0.1, volume * 0.7, 400);
        this.beep(80, 0.15, volume * 0.6, 'square');
        break;

      // ── Centipede ────────────────────────────────────────────────

      case 'centipede_shoot':
        // Tick rápido (disparo de centípede).
        this.beep(2000, 0.03, volume * 0.2, 'square');
        break;

      case 'centipede_hit':
        // Pop (hongo destruido/segmento golpeado).
        this.beep(500, 0.04, volume * 0.35, 'square');
        this.noise(0.04, volume * 0.2, 3000);
        break;

      // ── Missile Command ──────────────────────────────────────────

      case 'missile_launch': {
        // Barrido ascendente (misil lanzado).
        if (!this.ready) return;
        const t = this._ctx.currentTime;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(1000, t + 0.15);
        gain.gain.setValueAtTime(volume * 0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(this._sfxGain);
        osc.start(0);
        osc.stop(t + 0.25);
        break;
      }

      case 'missile_explosion':
        // Explosión más grave y prolongada.
        this.noise(0.4, volume * 0.7, 1500);
        this.beep(40, 0.5, volume * 0.6, 'sawtooth');
        break;

      // ── Asteroids ────────────────────────────────────────────────

      case 'asteroids_shoot': {
        // Láser agudo y rápido.
        if (!this.ready) return;
        const t = this._ctx.currentTime;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1500, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.08);
        gain.gain.setValueAtTime(volume * 0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain);
        gain.connect(this._sfxGain);
        osc.start(0);
        osc.stop(t + 0.18);
        break;
      }

      case 'asteroids_explosion':
        // Estruendo grave (astroide roto).
        this.noise(0.5, volume * 0.6, 1200);
        this.beep(50, 0.6, volume * 0.5, 'sawtooth');
        break;

      // ── Donkey Kong ──────────────────────────────────────────────

      case 'dk_jump':
        // Rebote elástico (salto de Mario en DK).
        this.beep(400, 0.05, volume * 0.35, 'triangle');
        this._timeoutIds.push(setTimeout(() => this.beep(700, 0.05, volume * 0.25), 50));
        break;

      // ── Breakout ──────────────────────────────────────────────────

      case 'breakout_hit':
        // Rebote de la pelota.
        this.beep(600, 0.04, volume * 0.35, 'triangle');
        break;

      case 'breakout_brick':
        // Ladrillo roto (dos tonos).
        this.beep(523, 0.06, volume * 0.3, 'square');
        this._timeoutIds.push(setTimeout(() => this.beep(784, 0.05, volume * 0.2), 30));
        break;

      // ── Snake ─────────────────────────────────────────────────────

      case 'snake_eat':
        // Comida coleccionada.
        this.beep(600, 0.06, volume * 0.3, 'square');
        this._timeoutIds.push(setTimeout(() => this.beep(900, 0.08, volume * 0.25), 50));
        break;

      case 'snake_die':
        // Muerte de la serpiente.
        this.noise(0.15, volume * 0.5, 1000);
        this.beep(100, 0.2, volume * 0.5, 'square');
        break;

      // ── Pong ──────────────────────────────────────────────────────

      case 'pong_hit':
        // Golpe de paleta (más metálico que el hit genérico).
        this.beep(400, 0.05, volume * 0.5, 'square');
        this.noise(0.03, volume * 0.3, 2000);
        break;

      case 'pong_score':
        // Punto anotado.
        this.beep(800, 0.08, volume * 0.35, 'square');
        this._timeoutIds.push(setTimeout(() => this.beep(600, 0.12, volume * 0.3), 80));
        break;

      // ── Flappy Bird ───────────────────────────────────────────────

      case 'flappy_flap':
        // Aleteo corto.
        this.beep(700, 0.03, volume * 0.25, 'square');
        this._timeoutIds.push(setTimeout(() => this.beep(500, 0.02, volume * 0.15), 15));
        break;

      case 'flappy_score':
        // Pase de tubería.
        this.beep(1047, 0.06, volume * 0.3, 'square');
        break;

      // ── Platformer ────────────────────────────────────────────────

      case 'platformer_jump':
        // Salto más ligero que el genérico.
        this.beep(350, 0.07, volume * 0.35, 'square');
        this._timeoutIds.push(setTimeout(() => this.beep(700, 0.05, volume * 0.25), 35));
        break;

      // ── Fancy Pants ───────────────────────────────────────────────

      case 'fancy_jump':
        // Salto con más cuerpo.
        this.beep(250, 0.1, volume * 0.35, 'triangle');
        this._timeoutIds.push(setTimeout(() => this.beep(600, 0.06, volume * 0.3), 50));
        break;

      case 'fancy_walljump': {
        // Salto de pared (sonido más energético).
        if (!this.ready) return;
        const t = this._ctx.currentTime;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(900, t + 0.08);
        gain.gain.setValueAtTime(volume * 0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain);
        gain.connect(this._sfxGain);
        osc.start(0);
        osc.stop(t + 0.15);
        break;
      }

      // ── Coop Platformer ───────────────────────────────────────────

      case 'coop_jump':
        // Salto cooperativo.
        this.beep(300, 0.07, volume * 0.3, 'sine');
        this._timeoutIds.push(setTimeout(() => this.beep(550, 0.06, volume * 0.25), 40));
        break;

      case 'coop_lever':
        // Palanca accionada (clic metálico).
        this.beep(800, 0.04, volume * 0.25, 'square');
        this._timeoutIds.push(setTimeout(() => this.beep(1000, 0.03, volume * 0.2), 20));
        break;

      // ── Trick Quiz ────────────────────────────────────────────────

      case 'tquiz_correct':
        // Respuesta correcta (campanita).
        this.beep(784, 0.1, volume * 0.35, 'sine');
        this._timeoutIds.push(setTimeout(() => this.beep(1047, 0.15, volume * 0.3), 100));
        break;

      case 'tquiz_wrong':
        // Respuesta incorrecta (buzz).
        this.beep(150, 0.15, volume * 0.5, 'square');
        this.noise(0.08, volume * 0.3, 500);
        break;

      // ── Papa's Pizzeria ───────────────────────────────────────────

      case 'papa_serve':
        // Pizza servida.
        this.beep(660, 0.06, volume * 0.3, 'triangle');
        this._timeoutIds.push(setTimeout(() => this.beep(880, 0.08, volume * 0.25), 60));
        break;

      case 'papa_burn':
        // Orden quemada.
        this.noise(0.12, volume * 0.5, 800);
        this.beep(200, 0.1, volume * 0.4, 'sawtooth');
        break;

      // ── Stick RPG ─────────────────────────────────────────────────

      case 'stick_buy':
        // Compra realizada.
        this.beep(523, 0.06, volume * 0.3, 'square');
        this._timeoutIds.push(setTimeout(() => this.beep(659, 0.06, volume * 0.25), 60));
        this._timeoutIds.push(setTimeout(() => this.beep(784, 0.1, volume * 0.2), 120));
        break;

      case 'stick_fight':
        // Golpe de pelea.
        this.noise(0.06, volume * 0.5, 600);
        this.beep(200, 0.06, volume * 0.4, 'square');
        break;

      // ── Crush the Castle ──────────────────────────────────────────

      case 'castle_shoot': {
        // Catapulta disparando.
        if (!this.ready) return;
        const t2 = this._ctx.currentTime;
        const osc2 = this._ctx.createOscillator();
        const g2 = this._ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(150, t2);
        osc2.frequency.exponentialRampToValueAtTime(500, t2 + 0.1);
        g2.gain.setValueAtTime(volume * 0.3, t2);
        g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.15);
        osc2.connect(g2);
        g2.connect(this._sfxGain);
        osc2.start(0);
        osc2.stop(t2 + 0.2);
        break;
      }

      case 'castle_hit':
        // Impacto del proyectil.
        this.noise(0.08, volume * 0.5, 1200);
        this.beep(250, 0.08, volume * 0.4, 'square');
        break;

      case 'castle_destroy':
        // Estructura derrumbada.
        this.noise(0.3, volume * 0.6, 1000);
        this.beep(60, 0.35, volume * 0.5, 'sawtooth');
        break;

      // ── Bowman ────────────────────────────────────────────────────

      case 'bowman_fire': {
        // Flecha disparada (silbido).
        if (!this.ready) return;
        const t3 = this._ctx.currentTime;
        const osc3 = this._ctx.createOscillator();
        const g3 = this._ctx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(1200, t3);
        osc3.frequency.exponentialRampToValueAtTime(300, t3 + 0.12);
        g3.gain.setValueAtTime(volume * 0.15, t3);
        g3.gain.exponentialRampToValueAtTime(0.001, t3 + 0.15);
        osc3.connect(g3);
        g3.connect(this._sfxGain);
        osc3.start(0);
        osc3.stop(t3 + 0.2);
        break;
      }

      case 'bowman_hit':
        // Flecha impacta.
        this.noise(0.05, volume * 0.4, 2000);
        this.beep(400, 0.04, volume * 0.35, 'square');
        break;

      // ── Bloons TD ─────────────────────────────────────────────────

      case 'bloons_pop':
        // Globo reventado.
        this.beep(2000, 0.02, volume * 0.15, 'square');
        break;

      case 'bloons_place':
        // Torre colocada.
        this.beep(400, 0.06, volume * 0.3, 'triangle');
        this._timeoutIds.push(setTimeout(() => this.beep(600, 0.06, volume * 0.25), 50));
        break;

      // ── Territory War ─────────────────────────────────────────────

      case 'territory_attack':
        // Ataque.
        this.beep(300, 0.08, volume * 0.35, 'square');
        this.noise(0.04, volume * 0.3, 1000);
        break;

      case 'territory_hit':
        // Unidad golpeada.
        this.beep(200, 0.05, volume * 0.4, 'square');
        break;

      // ── Swords and Souls ──────────────────────────────────────────

      case 'swords_attack': {
        // Espada cortando (barrido descendente).
        if (!this.ready) return;
        const t4 = this._ctx.currentTime;
        const osc4 = this._ctx.createOscillator();
        const g4 = this._ctx.createGain();
        osc4.type = 'sawtooth';
        osc4.frequency.setValueAtTime(600, t4);
        osc4.frequency.exponentialRampToValueAtTime(200, t4 + 0.06);
        g4.gain.setValueAtTime(volume * 0.2, t4);
        g4.gain.exponentialRampToValueAtTime(0.001, t4 + 0.1);
        osc4.connect(g4);
        g4.connect(this._sfxGain);
        osc4.start(0);
        osc4.stop(t4 + 0.15);
        break;
      }

      case 'swords_hit':
        // Golpe recibido.
        this.noise(0.06, volume * 0.5, 600);
        this.beep(150, 0.08, volume * 0.45, 'square');
        break;

      case 'swords_train':
        // Entrenamiento completado.
        this.beep(523, 0.06, volume * 0.3, 'triangle');
        break;

      case 'swords_buy':
        // Objeto comprado.
        this.beep(659, 0.08, volume * 0.35, 'sine');
        this._timeoutIds.push(setTimeout(() => this.beep(880, 0.1, volume * 0.3), 80));
        break;

      // ── Henry Stickmin ────────────────────────────────────────────

      case 'henry_choose':
        // Opción seleccionada.
        this.beep(440, 0.04, volume * 0.25, 'sine');
        break;

      case 'henry_success':
        // Opción exitosa.
        this.beep(523, 0.08, volume * 0.35, 'sine');
        this._timeoutIds.push(setTimeout(() => this.beep(784, 0.08, volume * 0.35), 80));
        this._timeoutIds.push(setTimeout(() => this.beep(1047, 0.15, volume * 0.35), 160));
        break;

      case 'henry_fail':
        // Opción fallida.
        this.beep(250, 0.12, volume * 0.5, 'square');
        this.noise(0.08, volume * 0.3, 400);
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
