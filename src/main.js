import { GameEngine } from './engine/GameEngine.js';
import { GAME_REGISTRY } from './games/registry.js';
import { AudioManager } from './engine/AudioManager.js';
import { SettingsManager } from './engine/SettingsManager.js';
import { t, applyI18n, loadGameTranslations } from './engine/i18n.js';
import { ProgressionManager, registerAchievements, UNLOCKABLE_ITEMS } from './engine/ProgressionManager.js';

const canvas = document.getElementById('game-canvas');
const canvasWrapper = document.getElementById('game-canvas-wrapper');
const loadingIndicator = document.getElementById('loading-indicator');
const menu = document.getElementById('menu');
const gameGrid = document.getElementById('game-grid');
const hud = document.getElementById('game-hud');
const backButton = document.getElementById('back-button');
const currentTitle = document.getElementById('current-title');
const crtFrame = document.getElementById('crt-frame');
const crtScanlines = document.getElementById('crt-scanlines');
const crtVignette = document.getElementById('crt-vignette');
const fullscreenBtn = document.getElementById('fullscreen-btn');

const engine = new GameEngine(canvas);

// ─── Gestión del marco CRT ──────────────────────────────────────────

function applyCRT(enabled) {
  crtFrame.classList.toggle('crt-frame--active', enabled);
  crtScanlines.classList.toggle('crt-scanlines--active', enabled);
  crtVignette.classList.toggle('crt-vignette--active', enabled);
}

// ─── Fullscreen ─────────────────────────────────────────────────────

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
    fullscreenBtn.dataset.i18n = 'fullscreen.exit';
    fullscreenBtn.textContent = '⛶';
  } else {
    document.exitFullscreen?.();
    fullscreenBtn.dataset.i18n = 'fullscreen.enter';
    fullscreenBtn.textContent = '⛶';
  }
}

fullscreenBtn.addEventListener('click', toggleFullscreen);

// Ocultar botón fullscreen en táctil
if ('ontouchstart' in window) {
  fullscreenBtn.classList.add('crt-fullscreen-btn--touch-hidden');
}

// ─── Fit Canvas con AspectRatioManager ──────────────────────────────

function fitCanvas() {
  const topbarEl = document.querySelector('.topbar');
  const topbarHeight = topbarEl ? topbarEl.offsetHeight : 0;

  // En fullscreen real no hay topbar
  const viewportW = document.fullscreenElement
    ? window.screen.width
    : Math.min(window.innerWidth - 32, 1200);
  const viewportH = document.fullscreenElement
    ? window.screen.height
    : Math.min(window.innerHeight - topbarHeight - 48, 800);

  const dims = engine.aspectRatio.getVisibleDimensions(viewportW, viewportH);
  engine.aspectRatio.getBars(viewportW, viewportH);
  engine.resize(dims.width, dims.height);

  // Actualizar visibilidad del botón fullscreen
  fullscreenBtn.hidden = menu.hidden === false;
}

// Activar audio en el primer gesto del usuario (política de autoplay).
function initAudio() {
  AudioManager.resume();
}
// Un solo listener global que se auto-remueve tras el primer uso.
document.addEventListener('click', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });

function _buildMenuCards() {
  gameGrid.textContent = '';
  for (const game of GAME_REGISTRY) {
    const card = document.createElement('button');
    card.className = 'game-card';
    card.append(
      Object.assign(document.createElement('span'), { className: 'game-card__title' }),
      Object.assign(document.createElement('span'), { className: 'game-card__tagline' }),
    );
    card.addEventListener('click', () => launchGame(game));
    gameGrid.appendChild(card);
  }
  _updateMenuTexts();
}

/** Actualiza textos y data attributes de las cards ya creadas según el idioma actual. */
function _updateMenuTexts() {
  const cards = gameGrid.children;
  if (cards.length === 0) return; // init() aún no ha renderizado el menú
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const game = GAME_REGISTRY[i];
    const titleText = t(game.title_i18n);
    const taglineText = t(game.tagline_i18n);
    card.querySelector('.game-card__title').textContent = titleText;
    card.querySelector('.game-card__tagline').textContent = taglineText;
    card.dataset.title = titleText.toLowerCase();
    card.dataset.tagline = taglineText.toLowerCase();
    // Búsqueda bilingüe: id + título/tagline en ES y EN
    card.dataset.searchTokens = [
      game.id,
      t(game.title_i18n, {}, 'es'),
      t(game.title_i18n, {}, 'en'),
      t(game.tagline_i18n, {}, 'es'),
      t(game.tagline_i18n, {}, 'en'),
    ].join(' ').toLowerCase();
  }
}

// ─── Búsqueda en vivo ──────────────────────────────────────────────────

const searchInput = document.getElementById('game-search');
const searchEmpty = document.getElementById('search-empty');

/** Aplica el filtro de búsqueda sobre las cards actuales del grid. */
function _applySearchFilter() {
  const query = searchInput.value.trim().toLowerCase();
  // Dividir query en palabras: TODAS deben aparecer en los tokens del juego
  const queryWords = query ? query.split(/\s+/) : [];
  let visibleCount = 0;

  for (const card of gameGrid.children) {
    // Búsqueda sobre tokens bilingües (id + ES + EN)
    const match = queryWords.length === 0 || queryWords.every(word => card.dataset.searchTokens.includes(word));
    card.hidden = !match;
    if (match) visibleCount++;
  }

  searchEmpty.hidden = visibleCount > 0;
}

searchInput.addEventListener('input', _applySearchFilter);

async function launchGame(gameMeta) {
  // Mostrar loading inmediatamente
  menu.hidden = true;
  settingsBtn.hidden = true;
  hud.hidden = false;
  currentTitle.textContent = t(gameMeta.title_i18n);
  canvasWrapper.hidden = false;  // Muestra el indicador "Cargando..."
  loadingIndicator.hidden = false;

  // Desconectar observer del menú durante el juego
  _menuObserver.disconnect();

  try {
    // Cargar el código del juego y sus traducciones en paralelo
    const [GameClass] = await Promise.all([
      gameMeta.load(),
      loadGameTranslations(gameMeta.id),
    ]);

    // Ocultar loading, inicializar canvas
    loadingIndicator.hidden = true;
    fitCanvas();
    engine.loadGame(new GameClass());
  } catch (err) {
    console.error('Error al cargar el juego:', err);
    loadingIndicator.hidden = true;
    returnToMenu();
  }
}

function returnToMenu() {
  engine.unloadGame();
  canvasWrapper.hidden = true;
  hud.hidden = true;
  menu.hidden = false;
  settingsBtn.hidden = false;

  // Reconectar observer del menú al volver
  _menuObserver.observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  _menuObserver.observe(settingsOverlay, { attributes: true, attributeFilter: ['hidden'] });
  _menuObserver.observe(progOverlay, { attributes: true, attributeFilter: ['hidden'] });
  _checkHubGpContext();
}

backButton.addEventListener('click', returnToMenu);

// ─── Settings Modal ──────────────────────────────────────────────────

const settingsOverlay = document.getElementById('settings-overlay');
const settingsBtn = document.getElementById('settings-btn');
const settingsClose = document.getElementById('settings-close');

function openSettings() {
  settingsOverlay.hidden = false;
  _syncSettingsUI();
}

function closeSettings() {
  settingsOverlay.hidden = true;
}

settingsBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (e) => {    if (e.target === settingsOverlay) closeSettings();
});

// ─── Sincronizar controles con SettingsManager ───────────────────────

function _syncSettingsUI() {
  // Tema
  _syncToggle('settings-theme', SettingsManager.theme);
  // Idioma
  _syncToggle('settings-language', SettingsManager.language);
  // Animaciones
  _syncToggle('settings-motion', String(SettingsManager.reducedMotion));
  // Proporción
  _syncToggle('settings-aspect-ratio', SettingsManager.aspectRatio);
  // CRT
  _syncToggle('settings-crt', String(SettingsManager.crtEffect));
  // Vibración
  _syncToggle('settings-haptic', String(SettingsManager.hapticEnabled));
  // Volúmenes
  const masterEl = document.getElementById('settings-master-vol');
  const masterVal = document.getElementById('settings-master-vol-val');
  const sfxEl = document.getElementById('settings-sfx-vol');
  const sfxVal = document.getElementById('settings-sfx-vol-val');
  const musicEl = document.getElementById('settings-music-vol');
  const musicVal = document.getElementById('settings-music-vol-val');

  masterEl.value = Math.round(SettingsManager.masterVolume * 100);
  masterVal.textContent = masterEl.value;
  sfxEl.value = Math.round(SettingsManager.sfxVolume * 100);
  sfxVal.textContent = sfxEl.value;
  musicEl.value = Math.round(SettingsManager.musicVolume * 100);
  musicVal.textContent = musicEl.value;
}

/** Marca la opción activa de un toggle y la otra inactiva. */
function _syncToggle(id, activeValue) {
  const btn = document.getElementById(id);
  if (!btn) return;
  for (const span of btn.querySelectorAll('.settings-toggle__opt')) {
    span.classList.toggle('settings-toggle__opt--active', span.dataset.value === activeValue);
  }
}

// ─── Toggles: Tema ───────────────────────────────────────────────────
//
// Guard chain: SettingsManager.theme → _set('theme', ...) → onChange
// listeners. No toca AudioManager ni HapticManager — solo DOM y data
// interna. Seguro incluso si los managers están destruidos.

document.getElementById('settings-theme').addEventListener('click', () => {
  const next = SettingsManager.theme === 'dark' ? 'light' : 'dark';
  SettingsManager.theme = next;
  // onChange listener se encarga de _applyTheme y _syncToggle
});

document.getElementById('settings-language').addEventListener('click', () => {
  const next = SettingsManager.language === 'es' ? 'en' : 'es';
  SettingsManager.language = next;
  // onChange handler se encarga de _updateMenuTexts, applyI18n y _syncToggle
});

document.getElementById('settings-motion').addEventListener('click', () => {
  const next = !SettingsManager.reducedMotion;
  SettingsManager.reducedMotion = next;
  // onChange listener se encarga de _applyReducedMotion y _syncToggle
});

// ─── Toggle: Proporción de aspecto ─────────────────────────────────

document.getElementById('settings-aspect-ratio').addEventListener('click', () => {
  const current = SettingsManager.aspectRatio;
  const order = ['4:3', '5:3', '16:9'];
  const idx = order.indexOf(current);
  const next = order[(idx + 1) % order.length];
  SettingsManager.aspectRatio = next;
  engine.setAspectRatio(next);
  _syncToggle('settings-aspect-ratio', next);
});

// ─── Toggle: Efecto CRT ────────────────────────────────────────────

document.getElementById('settings-crt').addEventListener('click', () => {
  const next = !SettingsManager.crtEffect;
  SettingsManager.crtEffect = next;
  applyCRT(next);
  _syncToggle('settings-crt', String(next));
});

// ─── Toggle: Vibración ───────────────────────────────────────────────
//
// Guard chain: SettingsManager.hapticEnabled → HapticManager.enabled.
// HapticManager no tiene destroy() — solo stop() para vibración en
// curso. El setter de enabled es un booleano persistido en localStorage.
// Seguro en cualquier estado del ciclo de vida.

document.getElementById('settings-haptic').addEventListener('click', () => {
  const next = !SettingsManager.hapticEnabled;
  SettingsManager.hapticEnabled = next;
  _syncToggle('settings-haptic', String(next));
});

// ─── Sliders de volumen ──────────────────────────────────────────────
//
// Guard chain: slider → SettingsManager.{master,sfx,music}Volume →
// AudioManager.set{Master,Sfx,Music}Volume(). Estos setters ya tienen
// guard interno: "if (this._masterGain)" (o _sfxGain / _musicGain).
// Si AudioManager fue destruido y los gain nodes son null, el valor
// se persiste en memoria y localStorage sin aplicar al gain. Seguro.

document.getElementById('settings-master-vol').addEventListener('input', (e) => {
  const val = Number(e.target.value);
  // Delegado a AudioManager.setMasterVolume() — guard interno.
  SettingsManager.masterVolume = val / 100;
  document.getElementById('settings-master-vol-val').textContent = val;
});

document.getElementById('settings-sfx-vol').addEventListener('input', (e) => {
  const val = Number(e.target.value);
  // Delegado a AudioManager.setSfxVolume() — guard interno.
  SettingsManager.sfxVolume = val / 100;
  document.getElementById('settings-sfx-vol-val').textContent = val;
});

document.getElementById('settings-music-vol').addEventListener('input', (e) => {
  const val = Number(e.target.value);
  // Delegado a AudioManager.setMusicVolume() — guard interno.
  SettingsManager.musicVolume = val / 100;
  document.getElementById('settings-music-vol-val').textContent = val;
});

// ─── Aplicar tema al HTML ────────────────────────────────────────────

function _applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

// ─── Aplicar reducedMotion al HTML ───────────────────────────────────

function _applyReducedMotion(enabled) {
  document.documentElement.dataset.reducedMotion = String(enabled);
}

// ─── Suscribirse a cambios en SettingsManager ────────────────────────

// Reaccionar a cambios externos (p.ej. otro tab llama a SettingsManager)
SettingsManager.onChange('theme', (value) => {
  _applyTheme(value);
  if (!settingsOverlay.hidden) _syncToggle('settings-theme', value);
});

SettingsManager.onChange('reducedMotion', (value) => {
  _applyReducedMotion(value);
  if (!settingsOverlay.hidden) _syncToggle('settings-motion', String(value));
});

SettingsManager.onChange('language', (value) => {
  _updateMenuTexts();
  applyI18n();
  _applySearchFilter();
  if (!settingsOverlay.hidden) _syncToggle('settings-language', value);
});

SettingsManager.onChange('aspectRatio', (value) => {
  engine.setAspectRatio(value);
  if (!settingsOverlay.hidden) _syncToggle('settings-aspect-ratio', value);
});

SettingsManager.onChange('crtEffect', (value) => {
  applyCRT(value);
  if (!settingsOverlay.hidden) _syncToggle('settings-crt', String(value));
});

// ─── Inicializar estado visual ───────────────────────────────────────

_applyTheme(SettingsManager.theme);
_applyReducedMotion(SettingsManager.reducedMotion);
applyI18n();

// ─── Fullscreen change event ────────────────────────────────────────

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    fullscreenBtn.dataset.i18n = 'fullscreen.enter';
    fullscreenBtn.textContent = '⛶';
    // Re-ajustar canvas al salir de fullscreen
    if (!canvasWrapper.hidden) fitCanvas();
  }
});

// ─── Teclado ─────────────────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  // menu.hidden es true mientras se está jugando, así que Escape solo
  // debe actuar cuando el menú está oculto (hay una partida activa).
  if (e.code === 'Escape') {
    if (!progOverlay.hidden) {
      closeProgression();
      return;
    }
    if (!settingsOverlay.hidden) {
      closeSettings();
      return;
    }
    if (menu.hidden && !document.fullscreenElement) {
      returnToMenu();
    }
  }

  // 's' o 'S' abre/cierra settings (solo si el menú está visible)
  if ((e.key === 's' || e.key === 'S') && !menu.hidden) {
    if (settingsOverlay.hidden) {
      openSettings();
    } else {
      closeSettings();
    }
    e.preventDefault();
  }
});
window.addEventListener('resize', () => {
  if (!canvasWrapper.hidden) fitCanvas();
});

// ════════════════════════════════════════════════════════════════════════
//  PROGRESSION MODAL
// ════════════════════════════════════════════════════════════════════════

const progOverlay = document.getElementById('progression-overlay');
const progClose = document.getElementById('progression-close');
const profileBtn = document.getElementById('profile-btn');

async function openProgression() {
  await _ensureAchievementsLoaded();
  progOverlay.hidden = false;
  _renderProfile();
  _renderAchievements();
  _renderStats();
  _renderUnlockables();
  _renderHighScores();
}

function closeProgression() {
  progOverlay.hidden = true;
}

// ─── Carga diferida de logros ─────────────────────────────────────────
//
// Al abrir el modal por primera vez, importamos dinámicamente los
// achievements de todos los juegos. Los archivos index.js son mínimos
// (∼5 líneas) y el módulo queda cacheado para accesos posteriores.

let _achievementsLoaded = false;

async function _ensureAchievementsLoaded() {
  if (_achievementsLoaded) return;
  const imports = GAME_REGISTRY.map(game =>
    import(`./games/${game.id}/index.js`)
      .then(mod => {
        if (mod.achievements) {
          registerAchievements(game.id, mod.achievements);
        }
      })
      .catch(() => {/* sin logros */})
  );
  await Promise.all(imports);
  _achievementsLoaded = true;
}

profileBtn.addEventListener('click', () => openProgression());
progClose.addEventListener('click', closeProgression);
progOverlay.addEventListener('click', (e) => {
  if (e.target === progOverlay) closeProgression();
});

// ─── Tabs ──────────────────────────────────────────────────────────────

document.querySelectorAll('.progression-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.progression-tab').forEach((t) => t.classList.remove('progression-tab--active'));
    document.querySelectorAll('.progression-panel').forEach((p) => p.classList.remove('progression-panel--active'));

    tab.classList.add('progression-tab--active');
    const panel = document.getElementById(`prog-panel-${tab.dataset.tab}`);
    if (panel) panel.classList.add('progression-panel--active');

    // Re-renderizar según tab
    const tabName = tab.dataset.tab;
    if (tabName === 'achievements') _renderAchievements();
    if (tabName === 'stats') _renderStats();
    if (tabName === 'unlockables') _renderUnlockables();
    if (tabName === 'highscores') _renderHighScores();
  });
});

// ─── Profile Tab ───────────────────────────────────────────────────────

function _renderProfile() {
  const nameInput = document.getElementById('prog-name-input');
  nameInput.value = ProgressionManager.playerName;

  const lv = ProgressionManager.level;
  const lvTitle = ProgressionManager.levelTitle;
  document.getElementById('prog-level-number').textContent = t('progression.level', { n: lv });
  document.getElementById('prog-level-title').textContent = t(lvTitle);

  const xp = ProgressionManager.xp;
  const xpNext = ProgressionManager.xpForNextLevel;
  const xpProgress = ProgressionManager.xpProgress;
  document.getElementById('prog-xp-fill').style.width = `${Math.round(xpProgress * 100)}%`;
  document.getElementById('prog-xp-text').textContent =
    xpNext === Infinity
      ? `XP: ${xp}`
      : `XP: ${xp} / ${xpNext}`;

  const total = ProgressionManager.totalGamesPlayed;
  document.getElementById('prog-stat-played').textContent = total;

  const achCount = ProgressionManager.totalAchievements;
  const achTotal = ProgressionManager.totalAchievable;
  document.getElementById('prog-stat-achievements').textContent = `${achCount} / ${achTotal}`;

  const timeS = ProgressionManager.totalPlayTime;
  const timeStr = timeS < 60 ? `${Math.round(timeS)}s` : `${Math.floor(timeS / 60)}m ${Math.round(timeS % 60)}s`;
  document.getElementById('prog-stat-time').textContent = timeStr;
}

// ─── Name editing ────────────────────────────────────────────────────

document.getElementById('prog-name-input').addEventListener('change', (ev) => {
  ProgressionManager.playerName = ev.target.value;
});

// ─── Reset progress ──────────────────────────────────────────────────

document.getElementById('prog-reset-btn').addEventListener('click', () => {
  if (confirm(t('progression.resetConfirm'))) {
    ProgressionManager.reset();
    _renderProfile();
  }
});

// ─── Achievements Tab ─────────────────────────────────────────────────

let _lastAchGameId = null;

function _buildGameSelect() {
  const select = document.getElementById('prog-ach-game-select');
  select.textContent = '';

  // Juegos con logros definidos — se obtienen dinámicamente del ProgressionManager
  const gameIds = ProgressionManager.getGamesWithAch();
  for (const gameId of gameIds) {
    const defs = ProgressionManager.getAchievementDefs(gameId);
    if (defs.length === 0) continue;
    const opt = document.createElement('option');
    opt.value = gameId;
    const titleKey = `registry.${gameId}.title`;
    opt.textContent = t(titleKey);
    select.appendChild(opt);
  }
}

/** Crea las cards de logros con estructura vacía (1 vez por juego). */
function _buildAchievementCards(gameId) {
  const achievements = ProgressionManager.getAchievements(gameId);
  const grid = document.getElementById('prog-ach-grid');
  grid.textContent = '';

  if (achievements.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.style.cssText = 'color:var(--ink-dim);font-size:12px;text-align:center;padding:20px;';
    emptyMsg.textContent = t('progression.totalPlayed', { n: 0 });
    grid.appendChild(emptyMsg);
    return false;
  }

  for (const ach of achievements) {
    const card = document.createElement('div');
    card.className = 'prog-ach-card';
    card.append(
      Object.assign(document.createElement('div'), { className: 'prog-ach-card__icon' }),
      Object.assign(document.createElement('div'), { className: 'prog-ach-card__name' }),
      Object.assign(document.createElement('div'), { className: 'prog-ach-card__desc' }),
      Object.assign(document.createElement('div'), { className: 'prog-ach-card__status' }),
    );
    grid.appendChild(card);
  }
  return true;
}

/** Actualiza contenidos de las cards de logros ya creadas. */
function _updateAchievementTexts(gameId) {
  const achievements = ProgressionManager.getAchievements(gameId);
  const grid = document.getElementById('prog-ach-grid');
  const cards = grid.children;
  const iconMap = { star: '⭐', trophy: '🏆', crown: '👑' };

  for (let i = 0; i < cards.length; i++) {
    const ach = achievements[i];
    const card = cards[i];
    card.className = `prog-ach-card${ach.unlocked ? '' : ' prog-ach-card--locked'}`;
    card.querySelector('.prog-ach-card__icon').textContent = iconMap[ach.icon] || '⭐';
    card.querySelector('.prog-ach-card__name').textContent = t(ach.name);
    card.querySelector('.prog-ach-card__desc').textContent = t(ach.desc);
    card.querySelector('.prog-ach-card__status').textContent = ach.unlocked ? '✅' : '🔒';
  }
}

function _renderAchievements() {
  const select = document.getElementById('prog-ach-game-select');
  if (select.options.length === 0) _buildGameSelect();

  const gameId = select.value || 'breakout';
  const achievements = ProgressionManager.getAchievements(gameId);

  // Sin logros: mostrar mensaje y marcar como "no cache"
  if (achievements.length === 0) {
    const grid = document.getElementById('prog-ach-grid');
    grid.textContent = '';
    const emptyMsg = document.createElement('p');
    emptyMsg.style.cssText = 'color:var(--ink-dim);font-size:12px;text-align:center;padding:20px;';
    emptyMsg.textContent = t('progression.totalPlayed', { n: 0 });
    grid.appendChild(emptyMsg);
    _lastAchGameId = null;
    return;
  }

  // Solo rebuild si cambió de juego; si es el mismo, actualizar textos
  if (_lastAchGameId !== gameId) {
    _buildAchievementCards(gameId);
    _lastAchGameId = gameId;
  }
  _updateAchievementTexts(gameId);
}

// Cambiar juego en achievements filter
const achSelect = document.getElementById('prog-ach-game-select');
achSelect.addEventListener('change', _renderAchievements);

// ─── Stats Tab ────────────────────────────────────────────────────────

let _statsRowsBuilt = false;

/** Pre-crea una fila por cada juego en el registro (1 vez). */
function _buildStatsRows() {
  const tbody = document.getElementById('prog-stats-tbody');
  tbody.textContent = '';
  for (const _ of GAME_REGISTRY) {
    const tr = document.createElement('tr');
    tr.hidden = true;
    // 5 columnas: juego, jugado, victorias, mejor, tiempo
    for (let c = 0; c < 5; c++) tr.appendChild(document.createElement('td'));
    tbody.appendChild(tr);
  }
  _statsRowsBuilt = true;
}

/** Actualiza textos y visibilidad de las filas de stats. */
function _updateStatsRows() {
  const tbody = document.getElementById('prog-stats-tbody');
  const rows = tbody.children;
  let visibleCount = 0;

  for (let i = 0; i < GAME_REGISTRY.length; i++) {
    const game = GAME_REGISTRY[i];
    const stats = ProgressionManager.getGameStats(game.id);
    const row = rows[i];
    const cols = row.children;

    if (stats.plays === 0) {
      row.hidden = true;
      continue;
    }

    row.hidden = false;
    visibleCount++;
    const timeS = stats.totalTime;
    const timeStr = timeS < 60 ? `${Math.round(timeS)}s` : `${Math.floor(timeS / 60)}m ${Math.round(timeS % 60)}s`;
    cols[0].textContent = t(game.title_i18n);
    cols[1].textContent = stats.plays;
    cols[2].textContent = stats.wins;
    cols[3].textContent = stats.bestScore;
    cols[4].textContent = timeStr;
  }

  // Mensaje vacío (cuando ningún juego ha sido jugado)
  const emptyRowId = 'prog-stats-empty';
  let emptyRow = tbody.querySelector(`#${emptyRowId}`);
  if (visibleCount === 0) {
    if (!emptyRow) {
      emptyRow = document.createElement('tr');
      emptyRow.id = emptyRowId;
      const emptyTd = document.createElement('td');
      emptyTd.colSpan = 5;
      emptyTd.style.cssText = 'text-align:center;color:var(--ink-dim);padding:20px;';
      emptyRow.appendChild(emptyTd);
      tbody.appendChild(emptyRow);
    }
    emptyRow.hidden = false;
    emptyRow.querySelector('td').textContent = t('game.score', { n: 0 });
  } else if (emptyRow) {
    emptyRow.hidden = true;
  }
}

function _renderStats() {
  if (!_statsRowsBuilt) _buildStatsRows();
  _updateStatsRows();
}

// ─── Unlockables Tab ──────────────────────────────────────────────────

// Mapa de iconos: nombre → emoji (fuente única: UNLOCKABLE_ITEMS de ProgressionManager)
const _UNLOCK_ICON_MAP = {
  star: '⭐', bolt: '⚡', heart: '❤️', clock: '⏱️', refresh: '♾️', skull: '💀', gear: '📺', frame: '🖼️',
};

let _unlockCardsBuilt = false;

/** Crea las cards de desbloqueables con estructura vacía (1 sola vez). */
function _buildUnlockCards() {
  const grid = document.getElementById('prog-unlock-grid');
  grid.textContent = '';

  for (const item of UNLOCKABLE_ITEMS) {
    const card = document.createElement('div');
    card.className = 'prog-unlock-card';
    card.append(
      Object.assign(document.createElement('div'), { className: 'prog-unlock-card__icon' }),
      Object.assign(document.createElement('div'), { className: 'prog-unlock-card__name' }),
      Object.assign(document.createElement('div'), { className: 'prog-unlock-card__status' }),
    );
    grid.appendChild(card);
  }
  _unlockCardsBuilt = true;
}

/** Actualiza contenidos de las cards de desbloqueables ya creadas. */
function _updateUnlockTexts() {
  const grid = document.getElementById('prog-unlock-grid');
  const cards = grid.children;

  for (let i = 0; i < cards.length; i++) {
    const item = UNLOCKABLE_ITEMS[i];
    const card = cards[i];
    const unlocked = ProgressionManager.isUnlocked(item.id);
    card.className = `prog-unlock-card${unlocked ? ' prog-unlock-card--unlocked' : ' prog-unlock-card--locked'}`;
    card.querySelector('.prog-unlock-card__icon').textContent = _UNLOCK_ICON_MAP[item.icon] || '⭐';
    card.querySelector('.prog-unlock-card__name').textContent = t(item.name);
    card.querySelector('.prog-unlock-card__status').textContent = unlocked ? t('progression.unlocked') : t('progression.locked');
  }
}

function _renderUnlockables() {
  if (!_unlockCardsBuilt) _buildUnlockCards();
  _updateUnlockTexts();
}
// ─── High Scores Tab ───────────────────────────────────────────────────

let _hsRowsBuilt = false;

/** Pre-crea una fila por cada juego en el registro (1 vez). */
function _buildHighScoreRows() {
  const tbody = document.getElementById('prog-hs-tbody');
  tbody.textContent = '';
  const HS_COL_CLASSES = ['prog-hs-rank', 'prog-hs-game', 'prog-hs-score', 'prog-hs-plays', 'prog-hs-time'];
  for (const game of GAME_REGISTRY) {
    const tr = document.createElement('tr');
    tr.dataset.gameId = game.id;
    for (let c = 0; c < 5; c++) {
      const td = document.createElement('td');
      td.className = HS_COL_CLASSES[c];
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  // Fila de mensaje vacío (oculta por defecto)
  const emptyTr = document.createElement('tr');
  emptyTr.id = 'prog-hs-empty';
  const emptyTd = document.createElement('td');
  emptyTd.colSpan = 5;
  emptyTd.style.cssText = 'text-align:center;color:var(--ink-dim);padding:30px;';
  emptyTr.appendChild(emptyTd);
  emptyTr.hidden = true;
  tbody.appendChild(emptyTr);
  _hsRowsBuilt = true;
}

/** Reordena filas según ranking y actualiza contenidos. */
function _updateHighScoreRows() {
  const tbody = document.getElementById('prog-hs-tbody');

  // Colectar + ordenar puntuaciones
  const scores = [];
  for (const game of GAME_REGISTRY) {
    const stats = ProgressionManager.getGameStats(game.id);
    if (stats.plays > 0 && stats.bestScore > 0) {
      scores.push({
        id: game.id,
        title: t(game.title_i18n),
        bestScore: stats.bestScore,
        plays: stats.plays,
        totalTime: stats.totalTime,
      });
    }
  }
  scores.sort((a, b) => b.bestScore - a.bestScore);

  // Empty state
  const emptyRow = tbody.querySelector('#prog-hs-empty');
  if (scores.length === 0) {
    for (const row of tbody.children) {
      if (row.dataset?.gameId) row.hidden = true;
    }
    emptyRow.hidden = false;
    emptyRow.querySelector('td').textContent = `🎮 ${t('progression.hsEmpty')}`;
    return;
  }
  emptyRow.hidden = true;

  // Mapa de búsqueda rápida gameId → fila
  const rowMap = new Map();
  for (const row of tbody.children) {
    if (row.dataset?.gameId) rowMap.set(row.dataset.gameId, row);
  }

  // Reordenar filas en el DOM según ranking + actualizar contenidos
  const medalEmojis = ['🥇', '🥈', '🥉'];
  let prevSibling = null;
  const scoredIds = new Set();

  for (let rank = 0; rank < scores.length; rank++) {
    const s = scores[rank];
    const row = rowMap.get(s.id);
    if (!row) continue;

    scoredIds.add(s.id);

    // Mover fila a su posición correcta en el ranking
    const ref = prevSibling ? prevSibling.nextSibling : tbody.firstChild;
    tbody.insertBefore(row, ref);

    // Actualizar contenido
    const rankNum = rank + 1;
    const cols = row.children;
    const timeStr = s.totalTime < 60 ? `${Math.round(s.totalTime)}s` : `${Math.floor(s.totalTime / 60)}m ${Math.round(s.totalTime % 60)}s`;
    row.className = rankNum <= 3 ? 'prog-hs-row--top' : '';
    row.hidden = false;
    cols[0].textContent = rankNum <= 3 ? medalEmojis[rank] : `#${rankNum}`;
    cols[1].textContent = s.title;
    cols[2].textContent = s.bestScore.toLocaleString();
    cols[3].textContent = s.plays;
    cols[4].textContent = timeStr;

    prevSibling = row;
  }

  // Ocultar filas de juegos sin puntuación
  for (const row of tbody.children) {
    if (row.dataset?.gameId && !scoredIds.has(row.dataset.gameId)) {
      row.hidden = true;
    }
  }
}

function _renderHighScores() {
  if (!_hsRowsBuilt) _buildHighScoreRows();
  _updateHighScoreRows();
}

// ════════════════════════════════════════════════════════════════════════
//  HUB GAMEPAD NAVIGATION
// ════════════════════════════════════════════════════════════════════════

let _hubGpPollId = null;
let _hubGpFocusIdx = -1;
let _hubGpPrevButtons = new Set();

/**
 * Devuelve la lista de elementos enfocables según el contexto actual.
 */
function _getHubFocusables() {
  if (!settingsOverlay.hidden) {
    return Array.from(settingsOverlay.querySelectorAll(
      'button, input, select, [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null || el === settingsClose);
  }
  if (!progOverlay.hidden) {
    return Array.from(progOverlay.querySelectorAll(
      '.progression-tab, #progression-close, #prog-name-input, #prog-reset-btn, #prog-ach-game-select'
    )).filter(el => {
      // Solo los visibles (el panel activo)
      if (el.classList.contains('progression-tab')) return true;
      if (el.id === 'progression-close' || el.id === 'prog-name-input') return true;
      // Elementos del panel activo
      const panel = el.closest('.progression-panel');
      return !panel || panel.classList.contains('progression-panel--active');
    });
  }
  // Menú principal
  const cards = Array.from(gameGrid.querySelectorAll('.game-card:not([hidden])'));
  const els = [searchInput, profileBtn, settingsBtn, ...cards]
    .filter(el => el && !el.hidden && el.offsetParent !== null);
  return els;
}

function _hubGpSetFocus(idx) {
  const els = _getHubFocusables();
  if (els.length === 0) { _hubGpFocusIdx = -1; return; }
  _hubGpFocusIdx = Math.max(0, Math.min(idx, els.length - 1));
  // Quitar focus visual de todos
  document.querySelectorAll('.game-card--gp-focused').forEach(el => el.classList.remove('game-card--gp-focused'));
  // Poner focus visual en el elemento activo
  const target = els[_hubGpFocusIdx];
  if (target) {
    target.focus();
    target.classList.add('game-card--gp-focused');
  }
}

function _hubGpClearFocus() {
  document.querySelectorAll('.game-card--gp-focused').forEach(el => el.classList.remove('game-card--gp-focused'));
  _hubGpFocusIdx = -1;
}

function _hubGpActivate() {
  const els = _getHubFocusables();
  if (_hubGpFocusIdx < 0 || _hubGpFocusIdx >= els.length) return;
  const el = els[_hubGpFocusIdx];
  if (!el) return;
  if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
    el.focus();
    if (el.tagName === 'INPUT') el.select();
  } else {
    el.click();
  }
}

function _hubGpBack() {
  if (!settingsOverlay.hidden) {
    closeSettings();
  } else if (!progOverlay.hidden) {
    closeProgression();
  }
}

function _pollHubGamepad() {
  const gamepads = navigator.getGamepads?.();
  // Salir temprano si no hay gamepad conectado
  if (!gamepads || !Array.from(gamepads).some(g => g)) return;
  let gp = null;
  for (const g of gamepads) { if (g) { gp = g; break; } }
  if (!gp) return;

  const current = new Set();
  for (let i = 0; i < gp.buttons.length; i++) {
    if (gp.buttons[i].pressed) current.add(i);
  }

  const justPressed = new Set();
  for (const b of current) {
    if (!_hubGpPrevButtons.has(b)) justPressed.add(b);
  }
  _hubGpPrevButtons = current;

  if (justPressed.size === 0) return;

  const els = _getHubFocusables();
  if (els.length === 0) return;

  // Inicializar foco si no existe
  if (_hubGpFocusIdx < 0 || _hubGpFocusIdx >= els.length) {
    _hubGpSetFocus(0);
  }

  // Botón A (0) o Start (9): activar
  if (justPressed.has(0) || justPressed.has(9)) {
    _hubGpActivate();
    return;
  }

  // Botón B (1) o Select (8): volver/cerrar
  if (justPressed.has(1) || justPressed.has(8)) {
    _hubGpBack();
    return;
  }

  // D-pad navigation
  const cols = _getGridColumns();

  // Up (12) / Down (13) / Left (14) / Right (15)
  if (justPressed.has(12)) { // Up
    _hubGpSetFocus(_hubGpFocusIdx - (settingsOverlay.hidden && progOverlay.hidden ? cols : 1));
  } else if (justPressed.has(13)) { // Down
    _hubGpSetFocus(_hubGpFocusIdx + (settingsOverlay.hidden && progOverlay.hidden ? cols : 1));
  } else if (justPressed.has(14)) { // Left
    _hubGpSetFocus(_hubGpFocusIdx - 1);
  } else if (justPressed.has(15)) { // Right
    _hubGpSetFocus(_hubGpFocusIdx + 1);
  }
}

function _getGridColumns() {
  if (settingsOverlay.hidden && progOverlay.hidden) {
    const gridStyle = getComputedStyle(gameGrid);
    const tracks = gridStyle.gridTemplateColumns.split(' ');
    return Math.max(1, tracks.length);
  }
  return 1; // modales: navegación lineal
}

function _startHubGpPoll() {
  if (_hubGpPollId) return;
  _hubGpPollId = setInterval(_pollHubGamepad, 120);
}

function _stopHubGpPoll() {
  if (_hubGpPollId) {
    clearInterval(_hubGpPollId);
    _hubGpPollId = null;
  }
  _hubGpClearFocus();
  _hubGpPrevButtons.clear();
}

// Comprobar gamepad periódicamente y activar/desactivar polling según contexto
function _checkHubGpContext() {
  const menuVisible = !menu.hidden;
  if (menuVisible && (settingsOverlay.hidden || progOverlay.hidden)) {
    _startHubGpPoll();
  } else {
    _stopHubGpPoll();
  }
}

// Actualizar focus index cuando el usuario usa el ratón
function _onHubFocusIn(e) {
  if (!_hubGpPollId) return; // solo cuando el polling está activo
  const els = _getHubFocusables();
  const idx = els.indexOf(e.target);
  if (idx >= 0) _hubGpFocusIdx = idx;
}
document.addEventListener('focusin', _onHubFocusIn);

// Observar cambios de visibilidad del menú y modales
const _menuObserver = new MutationObserver(() => _checkHubGpContext());
_menuObserver.observe(menu, { attributes: true, attributeFilter: ['hidden'] });
_menuObserver.observe(settingsOverlay, { attributes: true, attributeFilter: ['hidden'] });
_menuObserver.observe(progOverlay, { attributes: true, attributeFilter: ['hidden'] });

// ─── Carga de traducciones de juegos al inicio ─────────────────────
//
// Como las claves registry.* y prog.* están ahora en cada game/i18n.js
// (no en el engine), cargamos todas las traducciones al inicio para
// que el menú principal muestre los nombres correctos.

let _gameTranslationsLoaded = false;

async function loadAllGameTranslations() {
  if (_gameTranslationsLoaded) return;
  // loadGameTranslations ya tiene try/catch interno — no necesita .catch() extra
  await Promise.all(GAME_REGISTRY.map(game => loadGameTranslations(game.id)));
  _gameTranslationsLoaded = true;
}

async function init() {
  await loadAllGameTranslations();
  _buildMenuCards();
}

applyCRT(SettingsManager.crtEffect);

init();
