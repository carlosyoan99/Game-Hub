/**
 * i18n.js
 * Sistema de traducción ES/EN para el hub y todos los juegos.
 *
 * Uso en JS:
 *   import { t } from '../../engine/i18n.js';
 *   ctx.fillText(t('breakout.score', { n: 42 }), 10, 28);
 *
 * Uso en HTML (data-i18n):
 *   <span data-i18n="menu.eyebrow">Selecciona un juego</span>
 *   Llamar a applyI18n() tras cada cambio de idioma o al cargar la página.
 *
 * Fallback: si una clave no existe en EN, se usa ES.
 *          si una clave no existe en ningún lado, se muestra la clave.
 */

import { SettingsManager } from './SettingsManager.js';

// ══════════════════════════════════════════════════════════════════════════
//  Traducciones
// ══════════════════════════════════════════════════════════════════════════

/** @type {Object<string, {es: string, en: string}>} */
const TRANSLATIONS = {

  // ── Hub: menú ────────────────────────────────────────────────────────

  'menu.eyebrow':            { es: 'Selecciona un juego',             en: 'Select a game' },
  'menu.searchPlaceholder':  { es: 'Buscar juegos...',              en: 'Search games...' },
  'menu.empty':              { es: 'No se encontraron juegos',        en: 'No games found' },
  'menu.level':              { es: 'Nivel',                           en: 'Level' },
  'menu.back':               { es: '← Menú',                          en: '← Menu' },

  // ── Hub: settings ────────────────────────────────────────────────────

  'settings.title':          { es: 'CONFIGURACIÓN',                   en: 'SETTINGS' },
  'settings.appearance':     { es: 'APARIENCIA',                      en: 'APPEARANCE' },
  'settings.theme':          { es: 'Tema',                            en: 'Theme' },
  'settings.language':       { es: 'Idioma',                          en: 'Language' },
  'settings.reducedMotion':  { es: 'Animaciones',                     en: 'Animations' },
  'settings.audio':          { es: 'AUDIO',                           en: 'AUDIO' },
  'settings.masterVol':      { es: 'Vol. maestro',                    en: 'Master Vol.' },
  'settings.sfxVol':         { es: 'Vol. SFX',                        en: 'SFX Vol.' },
  'settings.musicVol':       { es: 'Vol. música',                     en: 'Music Vol.' },
  'settings.haptics':        { es: 'HÁPTICO',                         en: 'HAPTICS' },
  'settings.vibration':      { es: 'Vibración',                       en: 'Vibration' },
  'settings.close':          { es: 'Cerrar',                          en: 'Close' },
  'settings.aspectRatio':   { es: 'Proporción',                      en: 'Aspect Ratio' },
  'settings.crtEffect':     { es: 'Efecto CRT',                      en: 'CRT Effect' },

  // ── Niveles (dificultad) ─────────────────────────────────────────────

  'level.easy':              { es: 'Fácil',                           en: 'Easy' },
  'level.medium':            { es: 'Medio',                           en: 'Medium' },
  'level.hard':              { es: 'Difícil',                         en: 'Hard' },
  'level.expert':            { es: 'Experto',                         en: 'Expert' },
  'level.impossible':        { es: 'Imposible',                       en: 'Impossible' },

  // ── Estados de juego (compartidos) ───────────────────────────────────

  'game.levelComplete':      { es: '¡NIVEL COMPLETADO!',              en: 'LEVEL COMPLETE!' },
  'game.continue':           { es: 'Click o Espacio para continuar',  en: 'Click or Space to continue' },
  'game.restart':            { es: 'Click o Espacio para reiniciar',  en: 'Click or Space to restart' },
  'game.gameOver':           { es: 'GAME OVER',                       en: 'GAME OVER' },
  'game.score':              { es: 'Puntos: {n}',                     en: 'Score: {n}' },
  'game.record':             { es: 'Récord: {n}',                     en: 'Record: {n}' },
  'game.victory':            { es: '¡VICTORIA!',                      en: 'VICTORY!' },
  'game.defeat':             { es: 'DERROTA',                         en: 'DEFEAT' },
  'game.power':              { es: 'POTENCIA',                        en: 'POWER' },
  'game.wave':               { es: 'Oleada: {n}',                     en: 'Wave: {n}' },
  'game.round':              { es: 'Ronda: {n}',                      en: 'Round: {n}' },
  'game.turn':               { es: 'Turno: {n}',                      en: 'Turn: {n}' },
  'game.wind':               { es: 'VIENTO',                          en: 'WIND' },
  'game.lives':              { es: 'Vidas: {n}',                       en: 'Lives: {n}' },
  'game.paused':             { es: 'PAUSA',                            en: 'PAUSED' },
  'game.selectDifficulty':   { es: 'SELECCIONAR DIFICULTAD',            en: 'SELECT DIFFICULTY' },

  // ── Gamepad ───────────────────────────────────────────────────────────

  'gamepad.connected':       { es: '🎮 Gamepad conectado: {name}',     en: '🎮 Gamepad connected: {name}' },
  'gamepad.disconnected':    { es: '🎮 Gamepad desconectado',           en: '🎮 Gamepad disconnected' },
  'gamepad.tooltip':         { es: 'Gamepad conectado',                en: 'Gamepad connected' },

  // ── Fullscreen ───────────────────────────────────────────────────────

  'fullscreen.enter':        { es: '⛶ Pantalla completa',              en: '⛶ Fullscreen' },
  'fullscreen.exit':         { es: '⛶ Salir fullscreen',               en: '⛶ Exit fullscreen' },

  // ── Progresión ───────────────────────────────────────────────────────

  'progression.profile':         { es: 'PERFIL',                          en: 'PROFILE' },
  'progression.level':           { es: 'Nivel {n}',                       en: 'Level {n}' },
  'progression.xp':              { es: 'XP: {n}/{m}',                     en: 'XP: {n}/{m}' },
  'progression.stats':           { es: 'ESTADÍSTICAS',                    en: 'STATISTICS' },
  'progression.achievements':    { es: 'LOGROS',                          en: 'ACHIEVEMENTS' },
  'progression.unlockables':     { es: 'DESBLOQUEABLES',                  en: 'UNLOCKABLES' },
  'progression.totalPlayed':     { es: 'Partidas: {n}',                   en: 'Games played: {n}' },
  'progression.totalTime':       { es: 'Tiempo: {n}s',                    en: 'Time: {n}s' },
  'progression.totalAch':        { es: 'Logros: {n}/{m}',                 en: 'Achievements: {n}/{m}' },
  'progression.bestScore':       { es: 'Mejor: {n}',                      en: 'Best: {n}' },
  'progression.wins':            { es: 'Victorias: {n}',                  en: 'Wins: {n}' },
  'progression.plays':           { es: 'Jugado: {n} veces',               en: 'Played: {n} times' },
  'progression.locked':          { es: '🔒 Bloqueado',                    en: '🔒 Locked' },
  'progression.unlocked':        { es: '✅ Desbloqueado',                  en: '✅ Unlocked' },
  'progression.reset':           { es: 'Resetear progreso',               en: 'Reset progress' },
  'progression.resetConfirm':    { es: '¿Resetear todo el progreso?',     en: 'Reset all progress?' },
  'progression.newAchievement':  { es: '🏆 ¡Logro: {name}!',              en: '🏆 Achievement: {name}!' },
  'progression.dailyBonus':      { es: '🔥 Bonus diario: +30 XP',         en: '🔥 Daily bonus: +30 XP' },
  'progression.highscores':      { es: 'RÉCORDS',                          en: 'HIGH SCORES' },
  'progression.hsEmpty':         { es: 'Juega algunas partidas para ver tus récords.', en: 'Play some games to see your high scores.' },

  // Niveles
  'progression.level1':  { es: 'Novato',           en: 'Novice' },
  'progression.level2':  { es: 'Aprendiz',         en: 'Learner' },
  'progression.level3':  { es: 'Jugador',          en: 'Player' },
  'progression.level4':  { es: 'Veterano',         en: 'Veteran' },
  'progression.level5':  { es: 'Experto',          en: 'Expert' },
  'progression.level6':  { es: 'Maestro',          en: 'Master' },
  'progression.level7':  { es: 'Leyenda',          en: 'Legend' },
  'progression.level8':  { es: 'Leyenda II',       en: 'Legend II' },
  'progression.level9':  { es: 'Leyenda III',      en: 'Legend III' },
  'progression.level10': { es: '⭐ Leyenda Suprema', en: '⭐ Supreme Legend' },







  // ── Snake boss achievements ─────────────────────────────────────────


  // ── Pong boss achievements ──────────────────────────────────────────


  // ── Flappy Bird boss achievements ───────────────────────────────────


  // ── Centipede achievements ──────────────────────────────────────────


  // ── Mario-like achievements ────────────────────────────────────────


  // ── Space Invaders achievements ─────────────────────────────────


  // ── Galaga achievements ──────────────────────────────────────────


  // ── Frogger achievements ─────────────────────────────────────────


  // ── Tetris achievements ──────────────────────────────────────────


  // ── Pac-Man achievements ─────────────────────────────────────────


  // ── Donkey Kong achievements ─────────────────────────────────────


  // ── Missile Command achievements ─────────────────────────────────


  // ── Platformer achievements ──────────────────────────────────────


  // ── Fancy Pants achievements ─────────────────────────────────────


  // ── Coop Platformer achievements ─────────────────────────────────


  // ── Trick Quiz achievements ──────────────────────────────────────


  // ── Papa's Pizzeria achievements ─────────────────────────────────


  // ── Stick RPG achievements ───────────────────────────────────────


  // ── Crush the Castle achievements ────────────────────────────────


  // ── Bowman achievements ──────────────────────────────────────────


  // ── Bloons TD achievements ───────────────────────────────────────


  // ── Territory War achievements ───────────────────────────────────


  // ── Swords and Souls achievements ────────────────────────────────


  // ── Henry Stickmin achievements ──────────────────────────────────







  // ── Contra-like achievements ───────────────────────────────────────────




  // ── Metroid-like achievements ────────────────────────────────────────────




  // ── Space Harrier achievements ───────────────────────────────────────────




  // ── OutRun-like achievements ────────────────────────────────────────────












  // ── Street Fighter achievements ────────────────────────────────────────


  // ── Golden Axe achievements ────────────────────────────────────────────


  // ── Guitar Hero achievements ───────────────────────────────────────────


  // ── Bejeweled achievements ─────────────────────────────────────────────


  // ── Lemonade Stand achievements ───────────────────────────────────────



  // ── Desbloqueables (cosméticos) ────────────────────────────────────────

  'prog.unlock.skinAsteroidsGold':  { es: 'Nave Asteroide Dorada',          en: 'Golden Asteroid Ship' },
  'prog.unlock.skinPacmanBlue':    { es: 'Pac-Man Azul',                    en: 'Blue Pac-Man' },
  'prog.unlock.skinShipNeon':      { es: 'Nave Neón',                       en: 'Neon Ship' },
  'prog.unlock.widePaddle':        { es: 'Paleta Ancha',                    en: 'Wide Paddle' },
  'prog.unlock.extraLife':         { es: 'Vida Extra',                      en: 'Extra Life' },
  'prog.unlock.modeSpeedrun':      { es: 'Modo Speedrun',                   en: 'Speedrun Mode' },
  'prog.unlock.modeEndless':       { es: 'Modo Infinito',                   en: 'Endless Mode' },
  'prog.unlock.modeHardcore':      { es: 'Modo Hardcore',                   en: 'Hardcore Mode' },
  'prog.unlock.scanlines':         { es: 'Líneas de Scan (CRT)',            en: 'Scanlines (CRT)' },
  'prog.unlock.retroBorder':       { es: 'Marco Retro',                     en: 'Retro Border' },
};

// ══════════════════════════════════════════════════════════════════════════
//  Funciones públicas
// ══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene el texto traducido para una clave.
 *
 * @param {string} key       Clave de traducción (p.ej. 'breakout.score').
 * @param {Object} [params]  Opcional. Valores para sustituir {param} en el texto.
 * @param {string} [lang]    Idioma explícito ('es'|'en'). Por defecto usa el
 *                           idioma actual de SettingsManager. Útil para
 *                           generar texto en ambos idiomas (p.ej. búsqueda).
 * @returns {string}         Texto traducido.
 */
export function t(key, params = {}, lang) {
  if (!lang) lang = SettingsManager.language; // 'es' | 'en'
  const entry = TRANSLATIONS[key];
  if (!entry) return key;

  let text = entry[lang];
  if (text == null) text = entry.es; // fallback a español
  if (text == null) return key;

  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, String(v));
  }
  return text;
}

/**
 * Recorre el DOM en busca de atributos data-i18n y reemplaza el
 * textContent de cada elemento por su traducción.
 *
 * Útil para textos estáticos del hub (menú, settings, etc.).
 * Se llama en la carga inicial y cada vez que cambia el idioma.
 */
export function applyI18n() {
  const lang = SettingsManager.language;
  const elements = document.querySelectorAll('[data-i18n]');
  for (const el of elements) {
    const key = el.getAttribute('data-i18n');
    if (!key) continue;
    const entry = TRANSLATIONS[key];
    if (!entry) continue;
    const text = entry[lang] || entry.es;
    if (text != null) el.textContent = text;
  }

  // Actualizar lang del <html>
  document.documentElement.lang = lang;

  // Traducir aria-label del settings-close
  const closeBtn = document.getElementById('settings-close');
  if (closeBtn) {
    const ariaKey = closeBtn.getAttribute('data-i18n');
    if (ariaKey) {
      const entry = TRANSLATIONS[ariaKey];
      if (entry) {
        closeBtn.setAttribute('aria-label', entry[lang] || entry.es);
      }
    }
  }

  // Traducir aria-label del settings-btn
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    const entry = TRANSLATIONS['settings.title'];
    if (entry) {
      settingsBtn.setAttribute('aria-label', entry[lang] || entry.es);
    }
  }

  // Traducir placeholder del search input
  const searchInput = document.getElementById('game-search');
  if (searchInput) {
    const key = searchInput.getAttribute('data-i18n-placeholder');
    if (key) {
      const entry = TRANSLATIONS[key];
      if (entry) {
        searchInput.placeholder = entry[lang] || entry.es;
      }
    }
  }
}

/**
 * Suscribe applyI18n a cambios de idioma en SettingsManager.
 * Devuelve la función unsubscribe por si se necesita limpiar.
 */
export function initI18n() {
  applyI18n();
  return SettingsManager.onChange('language', applyI18n);
}

/**
 * Registra traducciones de un juego en el diccionario global.
 * Mergea (Object.assign) para que las claves del juego se añadan
 * sin borrar las existentes. Si una clave ya existe, se sobrescribe
 * con la del juego (último registro gana).
 *
 * @param {Object<string, {es: string, en: string}>} translations
 */
export function registerTranslations(translations) {
  for (const key of Object.keys(translations)) {
    if (TRANSLATIONS[key]) {
      console.warn('i18n key already registered, overwriting:', key);
    }
  }
  Object.assign(TRANSLATIONS, translations);
}

/**
 * Carga dinámicamente las traducciones de un juego.
 *
 * Intenta import(`../games/${gameId}/i18n.js`). Si el archivo existe,
 * registra sus traducciones en el diccionario global. Si no existe,
 * lanza un console.warn no bloqueante.
 *
 * @param {string} gameId  ID del juego (ej. 'pong', 'breakout')
 * @returns {Promise<void>}
 */
export async function loadGameTranslations(gameId) {
  try {
    const module = await import(`../games/${gameId}/i18n.js`);
    if (module.default) {
      registerTranslations(module.default);
    }
  } catch {
    console.warn('Game i18n not found:', gameId);
  }
}
