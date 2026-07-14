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

  'registry.breakout.title':  { es: 'Breakout',                       en: 'Breakout' },
  'registry.breakout.tagline':{ es: 'Rebotes y destrucción de ladrillos', en: 'Bouncing and brick destruction' },
  'registry.snake.title':     { es: 'Snake',                          en: 'Snake' },
  'registry.snake.tagline':   { es: 'Movimiento en cuadrícula y colisión propia', en: 'Grid movement and self-collision' },
  'registry.pong.title':      { es: 'Pong',                           en: 'Pong' },
  'registry.pong.tagline':    { es: 'Rebote con ángulo variable vs. IA', en: 'Angle-based bounce vs. AI' },
  'registry.flappy-bird.title':   { es: 'Flappy Bird',                en: 'Flappy Bird' },
  'registry.flappy-bird.tagline': { es: 'Gravedad constante y scroll infinito', en: 'Constant gravity and infinite scroll' },
  'registry.asteroids.title': { es: 'Asteroids',                      en: 'Asteroids' },
  'registry.asteroids.tagline':{ es: 'Física de nave: empuje, fricción y wraparound', en: 'Ship physics: thrust, friction, wraparound' },
  'registry.platformer.title':   { es: 'Platformer',                  en: 'Platformer' },
  'registry.platformer.tagline': { es: 'Tilemap, colisión pixel-perfect y cámara con seguimiento', en: 'Tilemap, pixel-perfect collision, tracking camera' },
  'registry.fancy-pants.title':   { es: 'Fancy Pants',                en: 'Fancy Pants' },
  'registry.fancy-pants.tagline': { es: 'Movimiento fluido, hang time y salto en pared', en: 'Fluid movement, hang time, wall jump' },
  'registry.coop-platformer.title':   { es: 'Fuego y Agua',           en: 'Fire and Water' },
  'registry.coop-platformer.tagline': { es: 'Cooperativo local: plataforma móvil y palanca', en: 'Local co-op: moving platforms and levers' },
  'registry.trick-quiz.title':   { es: 'Trivia Trampa',               en: 'Trick Quiz' },
  'registry.trick-quiz.tagline': { es: 'Máquina de estados: preguntas trampa y zonas ocultas', en: 'State machine: trick questions and hidden zones' },
  'registry.papa-pizzeria.title':   { es: "Papa's Pizzeria",          en: "Papa's Pizzeria" },
  'registry.papa-pizzeria.tagline': { es: 'Colas, temporizadores y multitarea culinaria', en: 'Queues, timers, and culinary multitasking' },
  'registry.stick-rpg.title':   { es: 'Stick RPG',                    en: 'Stick RPG' },
  'registry.stick-rpg.tagline': { es: 'Días, energía, diálogos y cambio de escenas', en: 'Days, energy, dialogues, scene switching' },
  'registry.crush-the-castle.title':   { es: 'Crush the Castle',      en: 'Crush the Castle' },
  'registry.crush-the-castle.tagline': { es: 'Proyectiles con física en estructuras', en: 'Physics projectiles on structures' },
  'registry.bowman.title':   { es: 'Bowman',                          en: 'Bowman' },
  'registry.bowman.tagline': { es: 'Tiro parabólico con viento',      en: 'Parabolic shot with wind' },
  'registry.bloons-td.title':{ es: 'Bloons TD',                       en: 'Bloons TD' },
  'registry.bloons-td.tagline':{ es: 'Waypoints + torres defensivas', en: 'Waypoints + defensive towers' },
  'registry.territory-war.title':   { es: 'Territory War',            en: 'Territory War' },
  'registry.territory-war.tagline': { es: 'IA de bots, turnos y captura de territorio', en: 'Bot AI, turns, and territory capture' },
  'registry.swords-and-souls.title':   { es: 'Swords and Souls',      en: 'Swords and Souls' },
  'registry.swords-and-souls.tagline': { es: 'Entrenamiento, combate por turnos y subida de nivel', en: 'Training, turn-based combat, leveling up' },
  'registry.henry-stickmin.title':   { es: 'Henry Stickmin',          en: 'Henry Stickmin' },
  'registry.henry-stickmin.tagline': { es: 'Árbol de decisiones, finales múltiples y humor', en: 'Decision tree, multiple endings, humor' },

  // ── Registro: juegos retro/arcade ───────────────────────────────────────

  'registry.space-invaders.title':    { es: 'Space Invaders',           en: 'Space Invaders' },
  'registry.space-invaders.tagline':  { es: 'Disparos verticales con oleadas de aliens', en: 'Vertical shooter with alien waves' },
  'registry.centipede.title':         { es: 'Centipede',                en: 'Centipede' },
  'registry.centipede.tagline':       { es: 'Cienpiés serpenteante y hongos', en: 'Serpentine centipede and mushrooms' },
  'registry.missile-command.title':   { es: 'Missile Command',          en: 'Missile Command' },
  'registry.missile-command.tagline': { es: 'Defensa antimisiles con el ratón', en: 'Anti-missile defense with mouse aim' },
  'registry.galaga.title':            { es: 'Galaga',                   en: 'Galaga' },
  'registry.galaga.tagline':          { es: 'Formaciones y bombardeo en picada', en: 'Formations and dive-bomb attacks' },
  'registry.frogger.title':           { es: 'Frogger',                  en: 'Frogger' },
  'registry.frogger.tagline':         { es: 'Cruza la carretera y el río', en: 'Cross the road and the river' },
  'registry.tetris.title':            { es: 'Tetris',                   en: 'Tetris' },
  'registry.tetris.tagline':          { es: 'Piezas que caen, rotación y líneas', en: 'Falling pieces, rotation, line clearing' },
  'registry.pac-man.title':           { es: 'Pac-Man',                  en: 'Pac-Man' },
  'registry.pac-man.tagline':         { es: 'Laberinto, puntos y fantasmas con IA', en: 'Maze, dots, and ghost AI' },
  'registry.donkey-kong.title':       { es: 'Donkey Kong',              en: 'Donkey Kong' },
  'registry.donkey-kong.tagline':     { es: 'Barriles, escaleras y rescate', en: 'Barrels, ladders, and rescue' },

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
