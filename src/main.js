import { GameEngine } from './engine/GameEngine.js';
import { GAME_REGISTRY } from './games/registry.js';
import { AudioManager } from './engine/AudioManager.js';
import { HapticManager } from './engine/HapticManager.js';
import { SettingsManager } from './engine/SettingsManager.js';
import { t, applyI18n, loadGameTranslations } from './engine/i18n.js';

const canvas = document.getElementById('game-canvas');
const canvasWrapper = document.getElementById('game-canvas-wrapper');
const loadingIndicator = document.getElementById('loading-indicator');
const menu = document.getElementById('menu');
const gameGrid = document.getElementById('game-grid');
const hud = document.getElementById('game-hud');
const backButton = document.getElementById('back-button');
const currentTitle = document.getElementById('current-title');

const engine = new GameEngine(canvas);

function fitCanvas() {
  const maxWidth = Math.min(window.innerWidth - 32, 900);
  const width = maxWidth;
  const height = Math.round(width * 0.6);
  engine.resize(width, height);
}

// Activar audio en el primer gesto del usuario (política de autoplay).
function initAudio() {
  AudioManager.resume();
}
// Un solo listener global que se auto-remueve tras el primer uso.
document.addEventListener('click', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });

function renderMenu() {
  gameGrid.innerHTML = '';
  for (const game of GAME_REGISTRY) {
    const card = document.createElement('button');
    card.className = 'game-card';
    // Guardamos title, tagline y level en data attributes para filtrar y estilizar sin re-render
    card.dataset.title = t(game.title_i18n).toLowerCase();
    card.dataset.tagline = t(game.tagline_i18n).toLowerCase();
    // Búsqueda bilingüe: id + título/tagline en ES y EN
    card.dataset.searchTokens = [
      game.id,
      t(game.title_i18n, {}, 'es'),
      t(game.title_i18n, {}, 'en'),
      t(game.tagline_i18n, {}, 'es'),
      t(game.tagline_i18n, {}, 'en'),
    ].join(' ').toLowerCase();
    card.innerHTML = `
      <span class="game-card__title">${t(game.title_i18n)}</span>
      <span class="game-card__tagline">${t(game.tagline_i18n)}</span>
    `;
    card.addEventListener('click', () => launchGame(game));
    gameGrid.appendChild(card);
  }
}

// ─── Búsqueda en vivo ──────────────────────────────────────────────────

const searchInput = document.getElementById('game-search');
const searchEmpty = document.getElementById('search-empty');

/** Aplica el filtro de búsqueda sobre las cards actuales del grid. */
function _applySearchFilter() {
  const query = searchInput.value.trim().toLowerCase();
  let visibleCount = 0;

  for (const card of gameGrid.children) {
    // Búsqueda sobre tokens bilingües (id + ES + EN)
    const match = !query || card.dataset.searchTokens.includes(query);
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
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) closeSettings();
});

// ─── Sincronizar controles con SettingsManager ───────────────────────

function _syncSettingsUI() {
  // Tema
  _syncToggle('settings-theme', SettingsManager.theme);
  // Idioma
  _syncToggle('settings-language', SettingsManager.language);
  // Animaciones
  _syncToggle('settings-motion', String(SettingsManager.reducedMotion));
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
  // onChange handler se encarga de renderMenu, applyI18n y _syncToggle
});

document.getElementById('settings-motion').addEventListener('click', () => {
  const next = !SettingsManager.reducedMotion;
  SettingsManager.reducedMotion = next;
  // onChange listener se encarga de _applyReducedMotion y _syncToggle
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
  renderMenu();
  applyI18n();
  _applySearchFilter();
  if (!settingsOverlay.hidden) _syncToggle('settings-language', value);
});

// ─── Inicializar estado visual ───────────────────────────────────────

_applyTheme(SettingsManager.theme);
_applyReducedMotion(SettingsManager.reducedMotion);
applyI18n();

// ─── Teclado ─────────────────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  // menu.hidden es true mientras se está jugando, así que Escape solo
  // debe actuar cuando el menú está oculto (hay una partida activa).
  if (e.code === 'Escape') {
    if (!settingsOverlay.hidden) {
      closeSettings();
      return;
    }
    if (menu.hidden) {
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

renderMenu();
