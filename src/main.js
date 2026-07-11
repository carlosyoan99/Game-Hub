import { GameEngine } from './engine/GameEngine.js';
import { GAME_REGISTRY } from './games/registry.js';

const canvas = document.getElementById('game-canvas');
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

function renderMenu() {
  gameGrid.innerHTML = '';
  for (const game of GAME_REGISTRY) {
    const card = document.createElement('button');
    card.className = 'game-card';
    card.innerHTML = `
      <span class="game-card__level">Nivel ${game.level}</span>
      <span class="game-card__title">${game.title}</span>
      <span class="game-card__tagline">${game.tagline}</span>
    `;
    card.addEventListener('click', () => launchGame(game));
    gameGrid.appendChild(card);
  }
}

async function launchGame(gameMeta) {
  const GameClass = await gameMeta.load();
  fitCanvas();
  engine.loadGame(new GameClass());

  menu.hidden = true;
  hud.hidden = false;
  canvas.hidden = false;
  currentTitle.textContent = gameMeta.title;
}

function returnToMenu() {
  engine.unloadGame();
  canvas.hidden = true;
  hud.hidden = true;
  menu.hidden = false;
}

backButton.addEventListener('click', returnToMenu);
window.addEventListener('keydown', (e) => {
  // menu.hidden es true mientras se está jugando, así que Escape solo
  // debe actuar cuando el menú está oculto (hay una partida activa).
  if (e.code === 'Escape' && menu.hidden) {
    returnToMenu();
  }
});
window.addEventListener('resize', () => {
  if (!canvas.hidden) fitCanvas();
});

renderMenu();
