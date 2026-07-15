/**
 * ProgressionManager
 * Sistema completo de progresión de jugador: perfil, XP, niveles, logros
 * y desbloqueables. Todo persistido en localStorage.
 *
 * Uso:
 *   import { ProgressionManager } from './ProgressionManager.js';
 *
 *   // Al iniciar partida
 *   ProgressionManager.recordGamePlay('breakout', score, won, duration);
 *
 *   // Al ocurrir un hito
 *   ProgressionManager.checkAchievement('breakout', 'first-blood');
 *
 *   // Consultar perfil
 *   ProgressionManager.xp;
 *   ProgressionManager.level;
 *   ProgressionManager.totalGamesPlayed;
 *
 * Singleton — misma instancia en todo el hub y juegos.
 */

const STORAGE_KEY = 'gamehub:progression';

// ─── Niveles y XP ──────────────────────────────────────────────────────

const LEVELS = [
  { level: 1,  xpRequired: 0,     title: 'progression.level1' },
  { level: 2,  xpRequired: 200,   title: 'progression.level2' },
  { level: 3,  xpRequired: 500,   title: 'progression.level3' },
  { level: 4,  xpRequired: 1000,  title: 'progression.level4' },
  { level: 5,  xpRequired: 2000,  title: 'progression.level5' },
  { level: 6,  xpRequired: 3500,  title: 'progression.level6' },
  { level: 7,  xpRequired: 5500,  title: 'progression.level7' },
  { level: 8,  xpRequired: 7500,  title: 'progression.level8' },
  { level: 9,  xpRequired: 10000, title: 'progression.level9' },
  { level: 10, xpRequired: 13000, title: 'progression.level10' },
];

const MAX_LEVEL = LEVELS[LEVELS.length - 1].level;
const XP_PER_LEVEL_AFTER_MAX = 3000;

// ─── Acciones que dan XP ───────────────────────────────────────────────

const XP_REWARDS = {
  play:         10,   // Jugar una partida
  win:          50,   // Ganar/completar un juego
  achievement:  100,  // Desbloquear logro
  daily:        30,   // Jugar 3 juegos diferentes en un día
  newBestScore: 25,   // Superar récord personal
  beatBoss:     75,   // Vencer a un jefe final
};

// ─── Definiciones de items desbloqueables ──────────────────────────────

/**
 * Items que se pueden desbloquear: skins, power-ups, modos, etc.
 * Cada item tiene un id único, una clave i18n, un icono,
 * y opcionalmente un achievementId que lo desbloquea automáticamente.
 */
const UNLOCKABLE_ITEMS = [
  // ── Skins ────────────────────────────────────────────────────────
  { id: 'skin-asteroids-gold',   name: 'prog.unlock.skinAsteroidsGold',   icon: 'star',    achId: 'wave-10' },
  { id: 'skin-pacman-blue',      name: 'prog.unlock.skinPacmanBlue',      icon: 'star',    achId: null,     xpRequired: 500 },
  { id: 'skin-ship-neon',        name: 'prog.unlock.skinShipNeon',       icon: 'star',    achId: null,     xpRequired: 1000 },

  // ── Power-ups iniciales ──────────────────────────────────────────
  { id: 'powerup-wide-paddle',   name: 'prog.unlock.widePaddle',          icon: 'bolt',    achId: 'brick-breaker', xpRequired: 0 },
  { id: 'powerup-extra-life',    name: 'prog.unlock.extraLife',          icon: 'heart',   achId: 'immortal',      xpRequired: 0 },

  // ── Modos extra ──────────────────────────────────────────────────
  { id: 'mode-speedrun',         name: 'prog.unlock.modeSpeedrun',        icon: 'clock',   achId: 'unbeatable',    xpRequired: 0 },
  { id: 'mode-endless',          name: 'prog.unlock.modeEndless',         icon: 'refresh', achId: null,             xpRequired: 2000 },
  { id: 'mode-hardcore',         name: 'prog.unlock.modeHardcore',        icon: 'skull',   achId: 'wave-10',       xpRequired: 0 },

  // ── Cosméticos ───────────────────────────────────────────────────
  { id: 'cosmetic-scanlines',    name: 'prog.unlock.scanlines',           icon: 'gear',    achId: null,             xpRequired: 300 },
  { id: 'cosmetic-retro-border', name: 'prog.unlock.retroBorder',         icon: 'gear',    achId: null,             xpRequired: 1500 },
];

// ─── Definiciones de logros por juego ──────────────────────────────────

const ACHIEVEMENT_DEFS = {
  breakout: [
    { id: 'first-step',   name: 'prog.breakout.firstStep',   desc: 'prog.breakout.firstStep.desc',   icon: 'star' },
    { id: 'brick-breaker',name: 'prog.breakout.brickBreaker',desc: 'prog.breakout.brickBreaker.desc', icon: 'star' },
    { id: 'impossible',   name: 'prog.breakout.impossible',   desc: 'prog.breakout.impossible.desc',   icon: 'trophy' },
    { id: 'flawless',     name: 'prog.breakout.flawless',     desc: 'prog.breakout.flawless.desc',     icon: 'crown' },
  ],
  snake: [
    { id: 'small-snake',  name: 'prog.snake.small',     desc: 'prog.snake.small.desc',   icon: 'star' },
    { id: 'big-snake',    name: 'prog.snake.big',       desc: 'prog.snake.big.desc',     icon: 'trophy' },
    { id: 'immortal',     name: 'prog.snake.immortal',  desc: 'prog.snake.immortal.desc', icon: 'crown' },
  ],
  pong: [
    { id: 'first-point',  name: 'prog.pong.firstPoint',  desc: 'prog.pong.firstPoint.desc',  icon: 'star' },
    { id: 'win-streak-3', name: 'prog.pong.streak3',     desc: 'prog.pong.streak3.desc',     icon: 'trophy' },
    { id: 'unbeatable',   name: 'prog.pong.unbeatable',  desc: 'prog.pong.unbeatable.desc',  icon: 'crown' },
  ],
  'flappy-bird': [
    { id: 'first-flight', name: 'prog.flappy.firstFlight', desc: 'prog.flappy.firstFlight.desc', icon: 'star' },
    { id: 'pipe-master',  name: 'prog.flappy.pipeMaster',  desc: 'prog.flappy.pipeMaster.desc',  icon: 'trophy' },
    { id: 'bird-legend',  name: 'prog.flappy.legend',      desc: 'prog.flappy.legend.desc',      icon: 'crown' },
  ],
  asteroids: [
    { id: 'first-blast',  name: 'prog.asteroids.firstBlast', desc: 'prog.asteroids.firstBlast.desc', icon: 'star' },
    { id: 'wave-5',       name: 'prog.asteroids.wave5',      desc: 'prog.asteroids.wave5.desc',     icon: 'trophy' },
    { id: 'wave-10',      name: 'prog.asteroids.wave10',     desc: 'prog.asteroids.wave10.desc',    icon: 'crown' },
  ],
};

// ─── Clase Singleton ───────────────────────────────────────────────────

class ProgressionManagerImpl {
  constructor() {
    this._data = this._load();
  }

  // ═════════════════════════════════════════════════════════════════════
  //  Persistencia
  // ═════════════════════════════════════════════════════════════════════

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // Convertir array de juegos de hoy a Set (JSON no soporta Sets)
          if (Array.isArray(parsed.gamesPlayedToday)) {
            parsed.gamesPlayedToday = new Set(parsed.gamesPlayedToday);
          }
          return parsed;
        }
      }
    } catch { /* ignorar */ }
    return this._defaults();
  }

  _save() {
    const toStore = { ...this._data };
    // Convertir Set a array para que JSON.stringify funcione
    toStore.gamesPlayedToday = Array.from(this._data.gamesPlayedToday || []);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch { /* localStorage no disponible */ }
  }

  _defaults() {
    return {
      playerName: 'Jugador',
      xp: 0,
      achievements: {},       // gameId → { achievementId: timestamp }
      gameStats: {},          // gameId → { plays, wins, bestScore, totalTime, bestStreak }
      unlockedItems: [],      // [itemId, ...]
      lastPlayedDate: '',     // YYYY-MM-DD para daily bonus
      gamesPlayedToday: [],   // array vacío (se convierte a Set en _load)
      totalGamesPlayed: 0,
      totalPlayTime: 0,       // segundos acumulados
    };
  }

  reset() {
    this._data = this._defaults();
    this._save();
  }

  // ═════════════════════════════════════════════════════════════════════
  //  Perfil
  // ═════════════════════════════════════════════════════════════════════

  get playerName() { return this._data.playerName; }
  set playerName(v) {
    this._data.playerName = String(v).trim() || 'Jugador';
    this._save();
  }

  get xp() { return this._data.xp; }

  get level() {
    let lv = 1;
    for (const l of LEVELS) {
      if (this._data.xp >= l.xpRequired) lv = l.level;
    }
    return lv;
  }

  get levelTitle() {
    const lv = this.level;
    const def = LEVELS.find(l => l.level === lv) || LEVELS[LEVELS.length - 1];
    return def.title;
  }

  get xpForNextLevel() {
    const lv = this.level;
    const next = LEVELS.find(l => l.level === lv + 1);
    if (!next) return Infinity;
    return next.xpRequired;
  }

  get xpProgress() {
    const lv = this.level;
    const current = LEVELS.find(l => l.level === lv) || LEVELS[LEVELS.length - 1];
    const next = LEVELS.find(l => l.level === lv + 1);
    if (!next) return 1;
    return (this._data.xp - current.xpRequired) / (next.xpRequired - current.xpRequired);
  }

  get totalGamesPlayed() { return this._data.totalGamesPlayed; }
  get totalPlayTime() { return this._data.totalPlayTime; }

  /**
   * Añade XP al jugador. Si sube de nivel, el progreso se guarda.
   * @param {number} amount - XP a añadir
   * @param {string} [reason] - Opcional, para depuración
   */
  addXp(amount, reason) {
    this._data.xp += amount;
    this._save();
  }

  // ═════════════════════════════════════════════════════════════════════
  //  Estadísticas por juego
  // ═════════════════════════════════════════════════════════════════════

  getGameStats(gameId) {
    if (!this._data.gameStats[gameId]) {
      this._data.gameStats[gameId] = { plays: 0, wins: 0, bestScore: 0, totalTime: 0, bestStreak: 0 };
    }
    return this._data.gameStats[gameId];
  }

  /**
   * Registra una partida jugada. Actualiza stats, XP, y bonus diario.
   * @param {string} gameId
   * @param {number} score - Puntuación obtenida
   * @param {boolean} won - Si el jugador ganó/completó el juego
   * @param {number} duration - Duración en segundos
   */
  recordGamePlay(gameId, score, won, duration) {
    const stats = this.getGameStats(gameId);
    stats.plays++;
    stats.totalTime += duration;
    this._data.totalGamesPlayed++;
    this._data.totalPlayTime += duration;

    // Mejor puntuación
    let isNewBest = false;
    if (score > stats.bestScore) {
      stats.bestScore = score;
      isNewBest = true;
      if (score > 0) this.addXp(XP_REWARDS.newBestScore, `${gameId}:newBest`);
    }

    // Victoria
    if (won) {
      stats.wins++;
      this.addXp(XP_REWARDS.win, `${gameId}:win`);
    }

    // XP por jugar
    this.addXp(XP_REWARDS.play, `${gameId}:play`);

    // Bonus diario: jugar 3 juegos diferentes
    this._updateDailyBonus(gameId);

    this._save();
  }

  /**
   * Lleva el contador de juegos distintos jugados hoy.
   * Si son al menos 3, da bonus diario una vez.
   */
  _updateDailyBonus(gameId) {
    const today = new Date().toISOString().slice(0, 10);
    if (this._data.lastPlayedDate !== today) {
      this._data.lastPlayedDate = today;
      this._data.gamesPlayedToday = new Set([gameId]);
    } else {
      this._data.gamesPlayedToday.add(gameId);
    }

    if (this._data.gamesPlayedToday.size >= 3) {
      this.addXp(XP_REWARDS.daily, 'daily:3games');
      // Para no dar el bonus múltiples veces, lo marcamos
      this._data.gamesPlayedToday = new Set([gameId, '__daily_claimed__']);
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  //  Logros
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Devuelve las definiciones de logros para un juego.
   * @param {string} gameId
   * @returns {Array<{id: string, name: string, desc: string, icon: string}>}
   */
  getAchievementDefs(gameId) {
    return ACHIEVEMENT_DEFS[gameId] || [];
  }

  /**
   * Devuelve los logros con estado de desbloqueo para un juego.
   * @param {string} gameId
   * @returns {Array<{id: string, name: string, desc: string, icon: string, unlocked: boolean, unlockedAt: number|null}>}
   */
  getAchievements(gameId) {
    const defs = this.getAchievementDefs(gameId);
    const unlocked = this._data.achievements[gameId] || {};
    return defs.map(a => ({
      ...a,
      unlocked: !!unlocked[a.id],
      unlockedAt: unlocked[a.id] || null,
    }));
  }

  /**
   * Comprueba si un logro específico está desbloqueado.
   * @param {string} gameId
   * @param {string} achievementId
   * @returns {boolean}
   */
  isAchievementUnlocked(gameId, achievementId) {
    return !!(this._data.achievements[gameId]?.[achievementId]);
  }

  /**
   * Intenta desbloquear un logro. Si ya estaba desbloqueado, no hace nada.
   * @param {string} gameId
   * @param {string} achievementId
   * @returns {boolean} - true si se desbloqueó ahora
   */
  checkAchievement(gameId, achievementId) {
    const defs = this.getAchievementDefs(gameId);
    const def = defs.find(a => a.id === achievementId);
    if (!def) return false;

    if (!this._data.achievements[gameId]) {
      this._data.achievements[gameId] = {};
    }

    if (this._data.achievements[gameId][achievementId]) {
      return false; // ya desbloqueado
    }

    this._data.achievements[gameId][achievementId] = Date.now();
    this.addXp(XP_REWARDS.achievement, `${gameId}:ach:${achievementId}`);

    // Desbloquear items vinculados a este logro
    for (const item of UNLOCKABLE_ITEMS) {
      if (item.achId === achievementId) {
        this.unlockItem(item.id);
      }
    }

    this._save();
    return true;
  }

  /**
   * Devuelve la cuenta total de logros desbloqueados.
   * @returns {number}
   */
  get totalAchievements() {
    let count = 0;
    for (const gameId of Object.keys(this._data.achievements)) {
      count += Object.keys(this._data.achievements[gameId]).length;
    }
    return count;
  }

  /**
   * Devuelve la cuenta total de logros disponibles.
   * @returns {number}
   */
  get totalAchievable() {
    let count = 0;
    for (const gameId of Object.keys(ACHIEVEMENT_DEFS)) {
      count += ACHIEVEMENT_DEFS[gameId].length;
    }
    return count;
  }

  // ═════════════════════════════════════════════════════════════════════
  //  Desbloqueables
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Verifica si un item está desbloqueado.
   * @param {string} itemId
   * @returns {boolean}
   */
  isUnlocked(itemId) {
    return this._data.unlockedItems.includes(itemId);
  }

  /**
   * Desbloquea un item.
   * @param {string} itemId
   */
  unlockItem(itemId) {
    if (!this._data.unlockedItems.includes(itemId)) {
      this._data.unlockedItems.push(itemId);
      this._save();
    }
  }

  /**
   * Devuelve todos los items desbloqueados.
   * @returns {string[]}
   */
  get unlockedItems() {
    return [...this._data.unlockedItems];
  }
}

// Singleton
export const ProgressionManager = new ProgressionManagerImpl();
