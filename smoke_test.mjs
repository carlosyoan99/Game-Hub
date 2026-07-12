import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.performance = dom.window.performance;

function makeMockCanvas(width = 900, height = 540) {
  const noop = () => {};
  const ctx = {
    fillRect: noop, clearRect: noop, strokeRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, fill: noop, stroke: noop, save: noop, restore: noop,
    translate: noop, rotate: noop, setLineDash: noop, fillText: noop, drawImage: noop,
    measureText: (text) => ({ width: text.length * 7 }), // aproximación monospace, suficiente para el smoke test
    createLinearGradient: () => ({ addColorStop: noop }),
    set fillStyle(v) {}, set strokeStyle(v) {}, set font(v) {}, set textAlign(v) {},
    set textBaseline(v) {}, set globalAlpha(v) {}, set lineWidth(v) {},
  };
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = () => ctx;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
  document.body.appendChild(canvas);
  return canvas;
}

function pressKey(code, duration = 0) {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code }));
  if (duration > 0) {
    setTimeout(() => window.dispatchEvent(new window.KeyboardEvent('keyup', { code })), duration);
  }
}

function clickAt(canvas, x, y) {
  canvas.dispatchEvent(new window.MouseEvent('mousemove', { clientX: x, clientY: y }));
  canvas.dispatchEvent(new window.MouseEvent('mousedown', { clientX: x, clientY: y }));
  window.dispatchEvent(new window.MouseEvent('mouseup', { clientX: x, clientY: y }));
}

function releaseKey(code) {
  window.dispatchEvent(new window.KeyboardEvent('keyup', { code }));
}

async function runGame(name, importPath, exportName, { frames = 300, dt = 1 / 60, keysCycle = [], clicks = [] } = {}) {
  const { GameEngine } = await import('./src/engine/GameEngine.js');
  const canvas = makeMockCanvas();
  const engine = new GameEngine(canvas);
  const mod = await import(importPath);
  const GameClass = mod[exportName];
  const instance = new GameClass();

  engine.currentGame = instance;
  instance.init(engine);

  for (let i = 0; i < frames; i++) {
    for (const { code, atFrame } of keysCycle) {
      if (i === atFrame) pressKey(code);
      if (i === atFrame + 20) releaseKey(code);
    }
    for (const { atFrame, x, y } of clicks) {
      if (i === atFrame) clickAt(canvas, x, y);
    }
    instance.update(dt);
    instance.render(engine.ctx);
    if (i % 250 === 249 && (instance.status === 'won' || instance.status === 'lost' || instance.status === 'level-complete')) {
      // fuerza reinicio o avance de nivel tras game over/victoria/nivel completado
      window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Space' }));
      instance.update(dt);
    }
  }

  instance.destroy();
  console.log(`OK: ${name} (${frames} frames sin excepciones, status final: ${instance.status})`);
}

const tests = [
  ['Breakout', './src/games/breakout/Breakout.js', 'Breakout', [
    { code: 'ArrowRight', atFrame: 10 },
  ]],
  ['Snake', './src/games/snake/Snake.js', 'Snake', [
    { code: 'ArrowDown', atFrame: 10 },
    { code: 'ArrowLeft', atFrame: 40 },
    { code: 'ArrowDown', atFrame: 120 },
    { code: 'ArrowRight', atFrame: 180 },
    { code: 'ArrowUp', atFrame: 220 },
  ]],
  ['Pong', './src/games/pong/Pong.js', 'Pong', [
    { code: 'ArrowUp', atFrame: 5 },
    { code: 'ArrowDown', atFrame: 100 },
  ]],
  ['FlappyBird', './src/games/flappy-bird/FlappyBird.js', 'FlappyBird', [
    { code: 'Space', atFrame: 5 },
    { code: 'Space', atFrame: 40 },
    { code: 'Space', atFrame: 80 },
    { code: 'Space', atFrame: 120 },
    { code: 'Space', atFrame: 160 },
    { code: 'Space', atFrame: 200 },
  ]],
  ['Asteroids', './src/games/asteroids/Asteroids.js', 'Asteroids', [{ code: 'ArrowUp', atFrame: 5 }, { code: 'Space', atFrame: 30 }]],
  ['Platformer', './src/games/platformer/Platformer.js', 'Platformer', [{ code: 'ArrowRight', atFrame: 5 }, { code: 'Space', atFrame: 60 }]],
  ['FancyPants', './src/games/fancy-pants/FancyPants.js', 'FancyPants', [
    { code: 'ArrowRight', atFrame: 5 },
    { code: 'Space', atFrame: 90 },
    { code: 'ArrowRight', atFrame: 150 },
    { code: 'Space', atFrame: 155 },
  ]],
  ['CoopPlatformer', './src/games/coop-platformer/CoopPlatformer.js', 'CoopPlatformer', [
    { code: 'KeyD', atFrame: 5 },
    { code: 'ArrowRight', atFrame: 5 },
    { code: 'KeyW', atFrame: 80 },
    { code: 'ArrowUp', atFrame: 80 },
  ]],
  ['TrickQuiz', './src/games/trick-quiz/TrickQuiz.js', 'TrickQuiz', [], [
    { atFrame: 30, x: 642, y: 282 }, // botón "4", respuesta correcta de la pregunta 1
  ]],
  ['PapaPizzeria', './src/games/papa-pizzeria/PapaPizzeria.js', 'PapaPizzeria', [], [
    { atFrame: 30, x: 100, y: 100 }, // click en área de cliente
    { atFrame: 60, x: 200, y: 300 }, // click en estación
  ]],
  ['StickRPG', './src/games/stick-rpg/StickRPG.js', 'StickRPG', [], [
    { atFrame: 30, x: 200, y: 300 }, // click en acción
    { atFrame: 100, x: 400, y: 500 }, // click en navegación
  ]],
  ['CrushTheCastle', './src/games/crush-the-castle/CrushTheCastle.js', 'CrushTheCastle', [
    { code: 'ArrowUp', atFrame: 5 },
    { code: 'Space', atFrame: 15 },
  ]],
  ['Bowman', './src/games/bowman/Bowman.js', 'Bowman', [
    { code: 'Space', atFrame: 5 },
    { code: 'Space', atFrame: 100 },
  ]],
  ['BloonsTD', './src/games/bloons-td/BloonsTD.js', 'BloonsTD', [
    { code: 'Space', atFrame: 5 },
    { code: 'Digit1', atFrame: 30 },
  ]],
  ['TerritoryWar', './src/games/territory-war/TerritoryWar.js', 'TerritoryWar', [
    { code: 'Space', atFrame: 10 },
    { code: 'Space', atFrame: 30 },
  ]],
  ['SwordsAndSouls', './src/games/swords-and-souls/SwordsAndSouls.js', 'SwordsAndSouls', [], [
    { atFrame: 20, x: 100, y: 100 }, // click en zona del hub
    { atFrame: 40, x: 200, y: 200 }, // otro click
    { atFrame: 60, x: 300, y: 300 }, // más clicks para ejercitar entrenamiento
    { atFrame: 80, x: 400, y: 400 },
  ]],
  ['HenryStickmin', './src/games/henry-stickmin/HenryStickmin.js', 'HenryStickmin', [
    { code: 'Space', atFrame: 10 }, // skip text intro
    { code: 'Space', atFrame: 30 }, // skip more text
    { code: 'Space', atFrame: 60 }, // another click to exercise various states
  ]],
];

for (const [name, path, exportName, keysCycle, clicks] of tests) {
  await runGame(name, path, exportName, { keysCycle, clicks });
}

console.log('\nTodas las pruebas de humo pasaron sin excepciones.');
