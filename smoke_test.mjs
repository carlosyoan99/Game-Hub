/**
 * Smoke test — prueba de humo para los 17 juegos del GameHub Engine.
 *
 * Simula un entorno DOM/Canvas con JSDOM y ejecuta cada juego durante
 * 300+ frames con input sintético (teclas y clicks), verificando que
 * ningún juego lance excepciones. Incluye aserciones básicas de estado
 * y prueba de resize.
 *
 * Uso: npm test
 *       node smoke_test.mjs
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.performance = dom.window.performance;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.MouseEvent = dom.window.MouseEvent;

// ─── Simuladores ──────────────────────────────────────────────────────

function makeMockCanvas(width = 900, height = 540) {
  const noop = () => {};
  const ctx = {
    fillRect: noop, clearRect: noop, strokeRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, fill: noop, stroke: noop, save: noop, restore: noop,
    translate: noop, rotate: noop, setLineDash: noop, fillText: noop, drawImage: noop,
    measureText: (text) => ({ width: (text || '').length * 7 }),
    createLinearGradient: () => ({ addColorStop: noop }),
  };
  // Proxy para setters de contexto — permite cualquier asignación
  const handler = {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Si es un setter de contexto (fillStyle, strokeStyle, font, etc),
      // devolvemos noop o el valor actual
      if (typeof prop === 'string' && !prop.startsWith('__')) {
        return target[prop] !== undefined ? target[prop] : undefined;
      }
      return undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
    has(target, prop) {
      return true; // cualquier propiedad existe
    },
  };
  const proxiedCtx = new Proxy(ctx, handler);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = () => proxiedCtx;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height });
  document.body.appendChild(canvas);
  return canvas;
}

function pressKey(code) {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code, bubbles: true }));
}

function releaseKey(code) {
  window.dispatchEvent(new window.KeyboardEvent('keyup', { code, bubbles: true }));
}

function clickAt(canvas, x, y) {
  canvas.dispatchEvent(new window.MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
  canvas.dispatchEvent(new window.MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));
  window.dispatchEvent(new window.MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true }));
}

// ─── Runner ──────────────────────────────────────────────────────────

/**
 * @param {Object} opts
 * @param {string} opts.name      Nombre para el log
 * @param {string} opts.path      Ruta al .js del juego (o al index.js)
 * @param {string} opts.exportName Nombre de la clase exportada
 * @param {number} [opts.frames=300]  Frames a ejecutar
 * @param {number} [opts.dt=1/60]     Delta time por frame
 * @param {Array<{code:string, atFrame:number}>} [opts.keys]  Teclas a pulsar
 * @param {Array<{x:number, y:number, atFrame:number}>} [opts.clicks]  Clicks
 * @param {Function} [opts.assert]   Aserción opcional sobre el estado final
 * @param {boolean} [opts.testResize=true]  Probar resize a mitad del test
 */
async function runGame({
  name,
  path,
  exportName,
  frames = 300,
  dt = 1 / 60,
  keys = [],
  clicks = [],
  assert,
  testResize = true,
} = {}) {
  const { GameEngine } = await import('./src/engine/GameEngine.js');
  const canvas = makeMockCanvas(800, 500);
  const engine = new GameEngine(canvas);
  const mod = await import(path);
  const GameClass = mod[exportName];
  const instance = new GameClass();

  engine.currentGame = instance;
  instance.init(engine);

  let caughtError = null;

  try {
    for (let i = 0; i < frames; i++) {
      // Procesar inputs programados
      for (const { code, atFrame } of keys) {
        if (i === atFrame) pressKey(code);
        if (i === atFrame + Math.min(10, frames - atFrame - 1)) releaseKey(code);
      }
      for (const { atFrame, x, y } of clicks) {
        if (i === atFrame) clickAt(canvas, x, y);
      }

      // Test resize a mitad del test
      if (testResize && i === Math.floor(frames / 2)) {
        instance.handleResize(600, 400);
      }

      instance.update(dt);
      instance.render(engine.ctx);

      // Si el juego terminó, pulsar Espacio para reiniciar (ejercita _restart)
      if (i % 100 === 99) {
        const status = instance.status;
        if (status === 'won' || status === 'lost' || status === 'end_screen' || status === 'level-complete') {
          pressKey('Space');
          instance.update(dt);
          releaseKey('Space');
        }
      }
    }
  } catch (e) {
    caughtError = e;
  }

  instance.destroy();

  if (caughtError) {
    console.error(`❌ FAIL: ${name} — Excepción: ${caughtError.message}`);
    throw caughtError;
  }

  // Aserción opcional
  if (assert) {
    try {
      assert(instance);
    } catch (e) {
      console.error(`❌ FAIL: ${name} — Aserción fallida: ${e.message}`);
      throw e;
    }
  }

  console.log(`✅ OK: ${name} (${frames} frames, status: ${instance.status})`);
}

// ─── Tests ──────────────────────────────────────────────────────────

const tests = [
  {
    name: 'Breakout',
    path: './src/games/breakout/index.js',
    exportName: 'Breakout',
    keys: [
      { code: 'ArrowRight', atFrame: 10 },
      { code: 'ArrowLeft', atFrame: 50 },
    ],
    assert: (g) => {
      if (g.score === undefined) throw new Error('Missing score');
    },
  },
  {
    name: 'Snake',
    path: './src/games/snake/index.js',
    exportName: 'Snake',
    keys: [
      { code: 'ArrowDown', atFrame: 10 },
      { code: 'ArrowLeft', atFrame: 40 },
      { code: 'ArrowDown', atFrame: 120 },
      { code: 'ArrowRight', atFrame: 180 },
      { code: 'ArrowUp', atFrame: 220 },
    ],
  },
  {
    name: 'Pong',
    path: './src/games/pong/index.js',
    exportName: 'Pong',
    keys: [
      { code: 'ArrowUp', atFrame: 5 },
      { code: 'ArrowDown', atFrame: 100 },
      { code: 'ArrowUp', atFrame: 150 },
      { code: 'ArrowDown', atFrame: 200 },
    ],
  },
  {
    name: 'FlappyBird',
    path: './src/games/flappy-bird/index.js',
    exportName: 'FlappyBird',
    keys: [
      { code: 'Space', atFrame: 5 },
      { code: 'Space', atFrame: 40 },
      { code: 'Space', atFrame: 80 },
      { code: 'Space', atFrame: 120 },
      { code: 'Space', atFrame: 160 },
      { code: 'Space', atFrame: 200 },
    ],
  },
  {
    name: 'Asteroids',
    path: './src/games/asteroids/index.js',
    exportName: 'Asteroids',
    frames: 400,
    keys: [
      { code: 'ArrowUp', atFrame: 5 },
      { code: 'Space', atFrame: 30 },
      { code: 'ArrowLeft', atFrame: 80 },
      { code: 'Space', atFrame: 100 },
      { code: 'ArrowRight', atFrame: 150 },
      { code: 'Space', atFrame: 180 },
      { code: 'ArrowUp', atFrame: 200 },
    ],
    assert: (g) => {
      if (g.ship === undefined) throw new Error('Missing ship');
      if (g.bullets === undefined) throw new Error('Missing bullets');
    },
  },
  {
    name: 'Platformer',
    path: './src/games/platformer/index.js',
    exportName: 'Platformer',
    frames: 350,
    keys: [
      { code: 'ArrowRight', atFrame: 5 },
      { code: 'Space', atFrame: 60 },
      { code: 'ArrowRight', atFrame: 100 },
      { code: 'Space', atFrame: 160 },
    ],
  },
  {
    name: 'FancyPants',
    path: './src/games/fancy-pants/index.js',
    exportName: 'FancyPants',
    frames: 350,
    keys: [
      { code: 'ArrowRight', atFrame: 5 },
      { code: 'Space', atFrame: 90 },
      { code: 'ArrowRight', atFrame: 150 },
      { code: 'Space', atFrame: 155 },
    ],
  },
  {
    name: 'CoopPlatformer',
    path: './src/games/coop-platformer/index.js',
    exportName: 'CoopPlatformer',
    frames: 350,
    keys: [
      { code: 'KeyD', atFrame: 5 },
      { code: 'ArrowRight', atFrame: 5 },
      { code: 'KeyW', atFrame: 80 },
      { code: 'ArrowUp', atFrame: 80 },
    ],
  },
  {
    name: 'TrickQuiz',
    path: './src/games/trick-quiz/index.js',
    exportName: 'TrickQuiz',
    frames: 350,
    clicks: [
      { atFrame: 30, x: 642, y: 282 },
      { atFrame: 100, x: 400, y: 300 },
    ],
  },
  {
    name: 'PapaPizzeria',
    path: './src/games/papa-pizzeria/index.js',
    exportName: 'PapaPizzeria',
    frames: 350,
    clicks: [
      { atFrame: 30, x: 100, y: 100 },
      { atFrame: 60, x: 200, y: 300 },
      { atFrame: 120, x: 350, y: 200 },
    ],
  },
  {
    name: 'StickRPG',
    path: './src/games/stick-rpg/index.js',
    exportName: 'StickRPG',
    frames: 350,
    clicks: [
      { atFrame: 30, x: 200, y: 300 },
      { atFrame: 100, x: 400, y: 500 },
      { atFrame: 180, x: 300, y: 350 },
    ],
  },
  {
    name: 'CrushTheCastle',
    path: './src/games/crush-the-castle/index.js',
    exportName: 'CrushTheCastle',
    frames: 350,
    keys: [
      { code: 'ArrowUp', atFrame: 5 },
      { code: 'Space', atFrame: 15 },
      { code: 'ArrowUp', atFrame: 100 },
      { code: 'Space', atFrame: 120 },
      { code: 'ArrowUp', atFrame: 200 },
      { code: 'Space', atFrame: 220 },
    ],
  },
  {
    name: 'Bowman',
    path: './src/games/bowman/index.js',
    exportName: 'Bowman',
    frames: 350,
    keys: [
      { code: 'Space', atFrame: 5 },
      { code: 'Space', atFrame: 100 },
      { code: 'Space', atFrame: 180 },
    ],
    assert: (g) => {
      if (g.player1HP === undefined) throw new Error('Missing player HP');
    },
  },
  {
    name: 'BloonsTD',
    path: './src/games/bloons-td/index.js',
    exportName: 'BloonsTD',
    frames: 400,
    keys: [
      { code: 'Space', atFrame: 5 },
      { code: 'Digit1', atFrame: 30 },
      { code: 'Space', atFrame: 100 },
      { code: 'Space', atFrame: 200 },
    ],
    clicks: [
      { atFrame: 150, x: 400, y: 270 },
      { atFrame: 300, x: 500, y: 200 },
    ],
    assert: (g) => {
      if (g.money === undefined) throw new Error('Missing money');
      if (g.lives === undefined) throw new Error('Missing lives');
    },
  },
  {
    name: 'TerritoryWar',
    path: './src/games/territory-war/index.js',
    exportName: 'TerritoryWar',
    frames: 400,
    keys: [
      { code: 'Space', atFrame: 10 },
      { code: 'Space', atFrame: 30 },
    ],
    clicks: [
      // Click en el grid para seleccionar unidad
      { atFrame: 50, x: 100, y: 200 },
      // Click en buy button
      { atFrame: 200, x: 50, y: 450 },
    ],
    assert: (g) => {
      if (g.units === undefined) throw new Error('Missing units');
      if (g.turnNumber === undefined) throw new Error('Missing turnNumber');
    },
  },
  {
    name: 'SwordsAndSouls',
    path: './src/games/swords-and-souls/index.js',
    exportName: 'SwordsAndSouls',
    frames: 400,
    clicks: [
      { atFrame: 20, x: 100, y: 100 },
      { atFrame: 60, x: 300, y: 200 },
      { atFrame: 100, x: 400, y: 300 },
      { atFrame: 150, x: 200, y: 400 },
      { atFrame: 250, x: 500, y: 350 },
    ],
    assert: (g) => {
      if (g.player === undefined) throw new Error('Missing player');
      if (g.currentScene === undefined) throw new Error('Missing currentScene');
    },
  },
  {
    name: 'HenryStickmin',
    path: './src/games/henry-stickmin/index.js',
    exportName: 'HenryStickmin',
    frames: 400,
    keys: [
      { code: 'Space', atFrame: 10 },
      { code: 'Space', atFrame: 40 },
      { code: 'Space', atFrame: 80 },
      { code: 'Space', atFrame: 150 },
      { code: 'Space', atFrame: 200 },
    ],
    assert: (g) => {
      if (g.sceneId === undefined) throw new Error('Missing sceneId');
      if (g.phase === undefined) throw new Error('Missing phase');
    },
  },
];

// ─── Ejecución ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

for (const opts of tests) {
  try {
    await runGame(opts);
    passed++;
  } catch (e) {
    failed++;
    // Error ya fue logueado por runGame
  }
}

console.log(`\n═══════════════════════════════════════`);
console.log(`Resultados: ${passed} pasaron, ${failed} fallaron de ${tests.length} tests`);
console.log(`═══════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
