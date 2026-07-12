/**
 * Smoke test — prueba de humo para todos los juegos del GameHub Engine.
 *
 * Simula un entorno DOM/Canvas con JSDOM e itera sobre GAME_REGISTRY
 * para ejecutar cada juego durante N frames con input sintético,
 * verificando que ningún juego lance excepciones.
 *
 * Cada juego puede definir su config de test (teclas, clicks, frames)
 * en el campo opcional `test` de su entrada en GAME_REGISTRY.
 * Si no se define, se usan valores por defecto (300 frames, sin input).
 *
 * Uso: npm test
 *       node smoke_test.mjs
 */
import { JSDOM } from 'jsdom';
import { GAME_REGISTRY } from './src/games/registry.js';

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
    moveTo: noop, lineTo: noop, quadraticCurveTo: noop, arc: noop, fill: noop, stroke: noop,
    save: noop, restore: noop, translate: noop, rotate: noop, setLineDash: noop,
    fillText: noop, drawImage: noop,
    measureText: (text) => ({ width: (text || '').length * 7 }),
    createLinearGradient: () => ({ addColorStop: noop }),
  };
  const handler = {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'string' && !prop.startsWith('__')) {
        return target[prop] !== undefined ? target[prop] : undefined;
      }
      return undefined;
    },
    set(target, prop, value) { target[prop] = value; return true; },
    has(target, prop) { return true; },
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

async function runGame({ entry, frames = 300, keys = [], clicks = [], assert }) {
  const { GameEngine } = await import('./src/engine/GameEngine.js');
  const canvas = makeMockCanvas(800, 500);
  const engine = new GameEngine(canvas);
  const GameClass = await entry.load();
  const instance = new GameClass();

  engine.currentGame = instance;
  instance.init(engine);

  let caughtError = null;

  try {
    for (let i = 0; i < frames; i++) {
      for (const { code, atFrame } of keys) {
        if (i === atFrame) pressKey(code);
        if (i === atFrame + Math.min(10, frames - atFrame - 1)) releaseKey(code);
      }
      for (const { x, y, atFrame } of clicks) {
        if (i === atFrame) clickAt(canvas, x, y);
      }

      if (i === Math.floor(frames / 2) && typeof instance.handleResize === 'function') {
        instance.handleResize(600, 400);
      }

      instance.update(1 / 60);
      instance.render(engine.ctx);

      if (i % 100 === 99) {
        const status = instance.status;
        if (status === 'won' || status === 'lost' || status === 'end_screen' || status === 'level-complete') {
          pressKey('Space');
          instance.update(1 / 60);
          releaseKey('Space');
        }
      }
    }
  } catch (e) {
    caughtError = e;
  }

  instance.destroy();

  if (caughtError) {
    console.error(`❌ FAIL: ${entry.title} — Excepción: ${caughtError.message}`);
    throw caughtError;
  }

  if (assert) {
    try {
      assert(instance);
    } catch (e) {
      console.error(`❌ FAIL: ${entry.title} — Aserción fallida: ${e.message}`);
      throw e;
    }
  }

  console.log(`✅ OK: ${entry.title} (${frames} frames, status: ${instance.status})`);
}

// ─── Ejecución ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

for (const entry of GAME_REGISTRY) {
  const testConfig = entry.test || {};
  const name = entry.title || entry.id;
  try {
    await runGame({
      entry,
      frames: testConfig.frames ?? 300,
      keys: testConfig.keys || [],
      clicks: testConfig.clicks || [],
      assert: entry.test?.assert,
    });
    passed++;
  } catch (e) {
    failed++;
  }
}

console.log(`\n═══════════════════════════════════════`);
console.log(`Resultados: ${passed} pasaron, ${failed} fallaron de ${GAME_REGISTRY.length} tests`);
console.log(`═══════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
