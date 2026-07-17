/**
 * Smoke test — prueba de humo para todos los juegos del GameHub Engine.
 *
 * Simula un entorno DOM/Canvas con JSDOM e itera sobre GAME_REGISTRY
 * para ejecutar cada juego durante N frames con input sintético,
 * verificando que ningún juego lance excepciones.
 *
 * Cada juego puede definir su config de test (teclas, clicks, frames,
 * aserciones, fases esperadas) en el campo `test` de su entrada en
 * GAME_REGISTRY. Si no se define, se usan valores por defecto
 * (300 frames, sin input).
 *
 * Nuevas capacidades:
 *   - expectPhase — Verifica que la fase final sea una de las esperadas
 *   - assert mejorado — Recibe el estado completo del juego
 *   - i18nCheck — Verifica que las claves de traducción existen
 *   - memoryCheck — Detecta arrays que crecen sin límite
 *   - Mejor mock de Canvas (más métodos, funciómetro)
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

// ─── Contadores globales ─────────────────────────────────────────────

let totalPassed = 0;
let totalFailed = 0;
let totalWarnings = 0;
const failures = [];

// ─── Simuladores mejorados ────────────────────────────────────────────

function makeMockCanvas(width = 900, height = 540) {
  const noop = () => {};
  const callCounts = {};

  const track = (name) => {
    callCounts[name] = (callCounts[name] || 0) + 1;
  };

  const ctx = {
    // Propiedades de estado
    _globalAlpha: 1, _fillStyle: '#000', _strokeStyle: '#000',
    _lineWidth: 1, _textAlign: 'start', _textBaseline: 'alphabetic',
    _font: '10px monospace', _lineDash: [],
    _transformStack: [],

    // Getters/Setters
    get globalAlpha() { return this._globalAlpha; },
    set globalAlpha(v) { this._globalAlpha = v; },
    get fillStyle() { return this._fillStyle; },
    set fillStyle(v) { this._fillStyle = v; },
    get strokeStyle() { return this._strokeStyle; },
    set strokeStyle(v) { this._strokeStyle = v; },
    get lineWidth() { return this._lineWidth; },
    set lineWidth(v) { this._lineWidth = v; },
    get textAlign() { return this._textAlign; },
    set textAlign(v) { this._textAlign = v; },
    get textBaseline() { return this._textBaseline; },
    set textBaseline(v) { this._textBaseline = v; },
    get font() { return this._font; },
    set font(v) { this._font = v; },
    get lineDash() { return this._lineDash; },
    set lineDash(v) { this._lineDash = v; },

    // Métodos de dibujo
    fillRect: (x, y, w, h) => { track('fillRect'); },
    clearRect: (x, y, w, h) => { track('clearRect'); },
    strokeRect: (x, y, w, h) => { track('strokeRect'); },
    beginPath: () => { track('beginPath'); },
    closePath: () => { track('closePath'); },
    moveTo: (x, y) => { track('moveTo'); },
    lineTo: (x, y) => { track('lineTo'); },
    quadraticCurveTo: (cpx, cpy, x, y) => { track('quadraticCurveTo'); },
    arc: (x, y, r, sa, ea) => { track('arc'); },
    fill: () => { track('fill'); },
    stroke: () => { track('stroke'); },
    save: () => { track('save'); ctx._transformStack.push(ctx._globalAlpha); },
    restore: () => { track('restore'); ctx._globalAlpha = ctx._transformStack.pop() || 1; },
    translate: (x, y) => { track('translate'); },
    rotate: (a) => { track('rotate'); },
    scale: (x, y) => { track('scale'); },
    setLineDash: (segments) => { track('setLineDash'); ctx._lineDash = segments; },
    fillText: (text, x, y) => { track('fillText'); },
    strokeText: (text, x, y) => { track('strokeText'); },
    drawImage: (img, ...args) => { track('drawImage'); },
    createLinearGradient: (x1, y1, x2, y2) => ({
      addColorStop: (offset, color) => { track('addColorStop'); },
    }),
    createRadialGradient: (x1, y1, r1, x2, y2, r2) => ({
      addColorStop: (offset, color) => { track('addColorStop'); },
    }),
    measureText: (text) => {
      track('measureText');
      return {
        width: ((text || '').length * 7),
        actualBoundingBoxAscent: 8,
        actualBoundingBoxDescent: 2,
      };
    },
    getImageData: (x, y, w, h) => {
      track('getImageData');
      return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
    },
    putImageData: (data, x, y) => { track('putImageData'); },
    roundRect: (x, y, w, h, r) => { track('roundRect'); },
    clip: () => { track('clip'); },

    // Getter para transformaciones
    getLineDash: () => ctx._lineDash,

    // CanvasPattern stub
    createPattern: (img, repetition) => null,
  };

  // Proxy que maneja todas las propiedades del CanvasRenderingContext2D
  const handler = {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'callCounts') return { ...callCounts };
      if (typeof prop === 'string' && !prop.startsWith('__')) {
        return undefined;
      }
      return undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
    has(target, prop) {
      return true; // Todas las propiedades existen (compatibilidad)
    },
  };

  const proxiedCtx = new Proxy(ctx, handler);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = () => proxiedCtx;
  canvas.getBoundingClientRect = () => ({
    left: 0, top: 0, width, height, right: width, bottom: height,
  });
  document.body.appendChild(canvas);

  return { canvas, ctx: proxiedCtx, callCounts };
}

function pressKey(code) {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code, bubbles: true }));
}

function releaseKey(code) {
  window.dispatchEvent(new window.KeyboardEvent('keyup', { code, bubbles: true }));
}

function clickAt(canvas, x, y) {
  canvas.dispatchEvent(new window.MouseEvent('mousemove', {
    clientX: x, clientY: y, bubbles: true,
  }));
  canvas.dispatchEvent(new window.MouseEvent('mousedown', {
    clientX: x, clientY: y, bubbles: true,
  }));
  window.dispatchEvent(new window.MouseEvent('mouseup', {
    clientX: x, clientY: y, bubbles: true,
  }));
}

// ─── Verificación de i18n ────────────────────────────────────────────

async function verifyI18nKeys(gameId) {
  try {
    const i18nModule = await import(`./src/games/${gameId}/i18n.js`);
    const translations = i18nModule.default || {};
    const keyCount = Object.keys(translations).length;
    return { ok: true, keyCount };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── Verificación de arrays sin límite ───────────────────────────────

const SUSPICIOUS_ARRAYS = [
  'particles', 'bullets', 'enemies', 'powerups', 'bossBullets',
  'enemyBullets', 'stars', 'streakParticles', 'comboParticles',
  'extraBalls', 'obstacles',
];

function memoryCheck(instance) {
  const warnings = [];
  for (const key of SUSPICIOUS_ARRAYS) {
    const arr = instance[key];
    if (Array.isArray(arr) && arr.length > 500) {
      warnings.push(`⚠️  ${key}.length = ${arr.length} — posible leak`);
    }
  }
  return warnings;
}

// ─── Runner principal mejorado ────────────────────────────────────────

async function runGame({ entry, frames = 300, keys = [], clicks = [],
                          expectPhase, assert, i18nCheck = true }) {
  const { GameEngine } = await import('./src/engine/GameEngine.js');
  const { canvas: mockCanvas } = makeMockCanvas(800, 500);
  const canvas = document.querySelector('canvas');
  // Limpiar canvas mock, usar el real del engine
  mockCanvas.remove();

  // Verificar i18n
  if (i18nCheck) {
    const i18nResult = await verifyI18nKeys(entry.id);
    if (!i18nResult.ok) {
      console.warn(`⚠️  ${entry.id}: i18n no encontrado (${i18nResult.error})`);
      totalWarnings++;
    }
  }

  const engine = new GameEngine(canvas);
  const GameClass = await entry.load();
  const instance = new GameClass();

  engine.currentGame = instance;
  instance.init(engine);

  let caughtError = null;
  let statusHistory = [];
  let maxParticles = 0;
  let maxBullets = 0;

  // Reproducir click inicial para habilitar AudioContext
  try {
    clickAt(canvas, 0, 0);
  } catch { /* ignorar */ }

  try {
    for (let i = 0; i < frames; i++) {
      // Input sintético
      for (const { code, atFrame } of keys) {
        if (i === atFrame) pressKey(code);
        if (i === atFrame + Math.min(10, frames - atFrame - 1)) releaseKey(code);
      }
      for (const { x, y, atFrame } of clicks) {
        if (i === atFrame) clickAt(canvas, x, y);
      }

      // Test de resize a mitad de los frames
      if (i === Math.floor(frames / 2) && typeof instance.handleResize === 'function') {
        instance.handleResize(600, 400);
      }

      // Poll de gamepad
      if (engine.input && typeof engine.input.poll === 'function') {
        engine.input.poll();
      }

      instance.update(1 / 60);
      instance.render(engine.ctx);

      // Tracking de estado
      const status = instance.status || instance.phase || 'unknown';
      if (statusHistory.length === 0 || statusHistory[statusHistory.length - 1] !== status) {
        statusHistory.push(status);
      }

      // Memory leak tracking
      if (instance.particles) {
        const len = Array.isArray(instance.particles)
          ? instance.particles.length
          : (instance.particles._activeCount || 0);
        if (len > maxParticles) maxParticles = len;
      }
      if (instance.bullets && Array.isArray(instance.bullets)) {
        if (instance.bullets.length > maxBullets) maxBullets = instance.bullets.length;
      }

      // Auto-restart en estados terminales
      if (i % 100 === 99) {
        const phase = instance.status || instance.phase || '';
        if (['won', 'lost', 'end_screen', 'level-complete', 'game-over'].includes(phase)) {
          if (typeof instance.handleRestartInput === 'function') {
            pressKey('Space');
            instance.update(1 / 60);
            releaseKey('Space');
          } else {
            pressKey('Space');
            releaseKey('Space');
          }
        }
      }
    }
  } catch (e) {
    caughtError = e;
  }

  const finalPhase = instance.status || instance.phase || 'playing';

  instance.destroy();

  // ── Limpiar DOM ──
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach(c => c.remove());

  // ── Aserciones ──

  if (caughtError) {
    console.error(`❌ FAIL: ${entry.id} — Excepción: ${caughtError.message}`);
    console.error(`   Stack: ${caughtError.stack ? caughtError.stack.split('\n').slice(0, 3).join('\n   ') : 'N/A'}`);
    throw caughtError;
  }

  // Verificar fases esperadas
  if (expectPhase && expectPhase.length > 0) {
    const hasExpectedPhase = expectPhase.some(p => finalPhase === p || statusHistory.includes(p));
    if (!hasExpectedPhase) {
      const msg = `Fase final "${finalPhase}" no está entre las esperadas [${expectPhase.join(', ')}]. Historial: [${statusHistory.join(' → ')}]`;
      console.error(`❌ FAIL: ${entry.id} — ${msg}`);
      throw new Error(msg);
    }
  }

  // Aserción personalizada
  if (assert) {
    try {
      assert(instance);
    } catch (e) {
      console.error(`❌ FAIL: ${entry.id} — Aserción fallida: ${e.message}`);
      throw e;
    }
  }

  // Memory leak check
  const memWarnings = memoryCheck(instance);
  for (const w of memWarnings) {
    console.warn(`⚠️  ${entry.id}: ${w}`);
    totalWarnings++;
  }

  // Tracking de partículas
  if (maxParticles > 200) {
    console.warn(`⚠️  ${entry.id}: pico de ${maxParticles} partículas activas`);
    totalWarnings++;
  }
  if (maxBullets > 200) {
    console.warn(`⚠️  ${entry.id}: pico de ${maxBullets} balas activas`);
    totalWarnings++;
  }

  // Logo de fases
  const phaseStr = statusHistory.length > 1
    ? `fases: ${statusHistory.join(' → ')}`
    : `fase: ${statusHistory[0] || 'N/A'}`;

  const displayName = entry.id;
  console.log(`✅ OK: ${displayName} (${frames} frames, ${finalPhase}, ${phaseStr})`);
  return true;
}

// ─── Ejecución ──────────────────────────────────────────────────────

console.log(`\n🚀 GameHub Engine — Smoke Test (${GAME_REGISTRY.length} juegos)\n`);

for (const entry of GAME_REGISTRY) {
  const testConfig = entry.test || {};
  const gameName = entry.id || entry.title || entry.title_i18n || 'unknown';
  try {
    await runGame({
      entry,
      frames: testConfig.frames ?? 300,
      keys: testConfig.keys || [],
      clicks: testConfig.clicks || [],
      expectPhase: testConfig.expectPhase,
      assert: testConfig.assert,
      i18nCheck: testConfig.i18nCheck !== false,
    });
    totalPassed++;
  } catch (e) {
    totalFailed++;
    failures.push({ name: gameName, error: e.message });
  }
}

// ─── Resumen ────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════`);
console.log(`Resultados: ${totalPassed} pasaron, ${totalFailed} fallaron de ${GAME_REGISTRY.length} tests`);
if (totalWarnings > 0) {
  console.log(`Advertencias: ${totalWarnings}`);
}
console.log(`═══════════════════════════════════════\n`);

if (totalFailed > 0) {
  console.log('Fallos:');
  for (const f of failures) {
    console.log(`  ❌ ${f.name}: ${f.error}`);
  }
  console.log();
  process.exit(1);
}

// ─── Test de motor (runs inline) ─────────────────────────────────────

console.log(`\n🧪 Engine Unit Tests\n`);

// Limpiar DOM del smoke test
document.querySelectorAll('canvas').forEach(c => c.remove());

let enginePassed = 0;
let engineFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    enginePassed++;
  } catch (e) {
    console.error(`  ❌ ${name}: ${e.message}`);
    engineFailed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${a} to equal ${b}`);
}

function assertClose(a, b, tolerance = 0.01) {
  if (Math.abs(a - b) > tolerance) {
    throw new Error(`Expected ${a} to be close to ${b} (±${tolerance})`);
  }
}

// ─── SeededRandom tests ──────────────────────────────────────────────

import { SeededRandom } from './src/engine/SeededRandom.js';

test('SeededRandom: determinismo', () => {
  const a = new SeededRandom(42);
  const b = new SeededRandom(42);
  for (let i = 0; i < 100; i++) {
    assertEqual(a.next(), b.next(), `Iteración ${i}`);
  }
});

test('SeededRandom: rango [0, 1)', () => {
  const rng = new SeededRandom(12345);
  for (let i = 0; i < 1000; i++) {
    const v = rng.next();
    assert(v >= 0 && v < 1, `Valor ${v} fuera de rango`);
  }
});

test('SeededRandom: nextInt rango correcto', () => {
  const rng = new SeededRandom(99);
  for (let i = 0; i < 500; i++) {
    const v = rng.nextInt(1, 6);
    assert(v >= 1 && v <= 6, `Valor ${v} fuera de [1,6]`);
  }
});

test('SeededRandom: encode/decode', () => {
  const seeds = [1, 42, 12345, 999999, 2147483647];
  for (const s of seeds) {
    const code = SeededRandom.encode(s);
    const decoded = SeededRandom.decode(code);
    assertEqual(decoded, s, `Seed ${s} → "${code}" → ${decoded}`);
  }
});

test('SeededRandom: fromLevel', () => {
  const a = SeededRandom.fromLevel(3, 2);
  const b = SeededRandom.fromLevel(3, 2);
  assertEqual(a.next(), b.next(), 'Mismo nivel+dificultad debe dar mismo primer valor');
});

test('SeededRandom: pick', () => {
  const rng = new SeededRandom(42);
  const arr = ['a', 'b', 'c'];
  const picked = rng.pick(arr);
  assert(arr.includes(picked), `pick devolvió ${picked}`);
});

test('SeededRandom: shuffle', () => {
  const rng = new SeededRandom(42);
  const arr = [1, 2, 3, 4, 5];
  const shuffled = rng.shuffle([...arr]);
  assertEqual(shuffled.length, arr.length, 'Longitud');
  assertEqual([...shuffled].sort((a, b) => a - b).join(','), '1,2,3,4,5', 'Mismos elementos');
});

test('SeededRandom: shuffle in-place', () => {
  const rng = new SeededRandom(42);
  const arr = [1, 2, 3, 4, 5];
  const result = rng.shuffle(arr);
  assert(result === arr, 'Debe devolver el mismo array');
});

// ─── CollisionUtils tests ────────────────────────────────────────────

import {
  aabbIntersects, circleIntersects, circleIntersectsAABB,
  pointInRect, clamp,
} from './src/engine/CollisionUtils.js';

test('aabbIntersects: solapamiento', () => {
  assert(aabbIntersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }));
});

test('aabbIntersects: sin solapamiento', () => {
  assert(!aabbIntersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 }));
});

test('circleIntersects: solapamiento', () => {
  assert(circleIntersects({ x: 0, y: 0, radius: 5 }, { x: 3, y: 4, radius: 5 }));
});

test('circleIntersects: sin solapamiento', () => {
  assert(!circleIntersects({ x: 0, y: 0, radius: 5 }, { x: 20, y: 0, radius: 5 }));
});

test('circleIntersectsAABB: círculo dentro del rect', () => {
  assert(circleIntersectsAABB({ x: 5, y: 5, radius: 2 }, { x: 0, y: 0, width: 10, height: 10 }));
});

test('circleIntersectsAABB: círculo fuera del rect', () => {
  assert(!circleIntersectsAABB({ x: 20, y: 20, radius: 2 }, { x: 0, y: 0, width: 10, height: 10 }));
});

test('pointInRect: dentro', () => {
  assert(pointInRect(5, 5, { x: 0, y: 0, width: 10, height: 10 }));
});

test('pointInRect: fuera', () => {
  assert(!pointInRect(15, 5, { x: 0, y: 0, width: 10, height: 10 }));
});

test('clamp: valores', () => {
  assertEqual(clamp(5, 0, 10), 5);
  assertEqual(clamp(-5, 0, 10), 0);
  assertEqual(clamp(15, 0, 10), 10);
});

// ─── Vector2 tests ───────────────────────────────────────────────────

import { Vector2 } from './src/engine/Vector2.js';

test('Vector2: add', () => {
  const v = new Vector2(1, 2).add(new Vector2(3, 4));
  assertEqual(v.x, 4);
  assertEqual(v.y, 6);
});

test('Vector2: sub', () => {
  const v = new Vector2(5, 7).sub(new Vector2(3, 2));
  assertEqual(v.x, 2);
  assertEqual(v.y, 5);
});

test('Vector2: scale', () => {
  const v = new Vector2(3, 4).scale(2);
  assertEqual(v.x, 6);
  assertEqual(v.y, 8);
});

test('Vector2: length', () => {
  const v = new Vector2(3, 4);
  assertEqual(v.length, 5);
});

test('Vector2: normalized', () => {
  const v = new Vector2(3, 0).normalized();
  assertEqual(v.x, 1);
  assertEqual(v.y, 0);
});

test('Vector2: zero vector normalization', () => {
  const v = new Vector2(0, 0).normalized();
  assertEqual(v.x, 0);
  assertEqual(v.y, 0);
});

test('Vector2: fromAngle', () => {
  const v = Vector2.fromAngle(0, 5);
  assertEqual(v.x, 5);
  assertClose(v.y, 0);
});

// ─── ScreenShake tests ───────────────────────────────────────────────

import { ScreenShake } from './src/engine/ScreenShake.js';

test('ScreenShake: no activo por defecto', () => {
  const s = new ScreenShake();
  assert(!s.isShaking);
});

test('ScreenShake: activo tras trigger', () => {
  const s = new ScreenShake();
  s.trigger(10, 0.5);
  assert(s.isShaking);
});

test('ScreenShake: decae con el tiempo', () => {
  const s = new ScreenShake();
  s.trigger(10, 0.3);
  s.update(0.3);
  assert(!s.isShaking);
});

test('ScreenShake: apply no modifica ctx si no activo', () => {
  const s = new ScreenShake();
  const mockCtx2 = { _x: 0, _y: 0, translate: (x, y) => { mockCtx2._x = x; mockCtx2._y = y; } };
  s.apply(mockCtx2);
  assertEqual(mockCtx2._x, 0);
  assertEqual(mockCtx2._y, 0);
});

// ─── ParticleSystem tests ───────────────────────────────────────────

import { ParticleSystem, spawnParticles, updateParticles } from './src/engine/ParticleSystem.js';

test('ParticleSystem: crear y vacío', () => {
  const ps = new ParticleSystem(150);
  assert(ps.isEmpty);
  assertEqual(ps.particles.length, 0);
});

test('ParticleSystem: emit crea partículas', () => {
  const ps = new ParticleSystem(150);
  ps.emit(100, 100, '#ff0000', 10, 80);
  assertEqual(ps.particles.length, 10);
});

test('ParticleSystem: burst crea partículas', () => {
  const ps = new ParticleSystem(150);
  ps.burst(100, 100, '#ff0000', 10, 80);
  assertEqual(ps.particles.length, 10);
});

test('ParticleSystem: update reduce vida', () => {
  const ps = new ParticleSystem(150);
  ps.emit(100, 100, '#ff0000', 10, 80);
  ps.update(1.0);
  assert(ps.particles.length < 10, `Esperaba <10, obtuve ${ps.particles.length}`);
});

test('ParticleSystem: clear vacía todo', () => {
  const ps = new ParticleSystem(150);
  ps.emit(100, 100, '#ff0000', 10, 80);
  ps.clear();
  assert(ps.isEmpty);
});

test('ParticleSystem: límite de partículas', () => {
  const ps = new ParticleSystem(150, 50);
  ps.emit(100, 100, '#ff0000', 200, 80);
  assertEqual(ps.particles.length, 50);
});

test('spawnParticles: funcional', () => {
  const particles = [];
  spawnParticles(particles, 100, 100, '#ff0000', 10);
  assertEqual(particles.length, 10);
  assert(particles[0].life > 0);
  assert(particles[0].color === '#ff0000');
});

test('updateParticles: funcional', () => {
  const particles = [];
  spawnParticles(particles, 100, 100, '#ff0000', 10);
  const alive = updateParticles(particles, 1.0);
  assert(alive.length < 10, `Esperaba <10, obtuve ${alive.length}`);
});

// ─── InputManager tests ──────────────────────────────────────────────

import { InputManager } from './src/engine/InputManager.js';

test('InputManager: constructor', () => {
  const input = new InputManager();
  assert(!input.isDown('Space'));
});

test('InputManager: key down/up', () => {
  const input = new InputManager();
  const c = document.createElement('canvas');
  c.width = 800; c.height = 500;
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500 });
  c.getContext = () => ({ fillRect: () => {} });
  input.attach(c);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  assert(input.isDown('Space'));
  assert(input.wasPressed('Space'));
  input.endFrame();
  assert(!input.wasPressed('Space'));
  window.dispatchEvent(new window.KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
  assert(!input.isDown('Space'));
  input.detach();
  c.remove();
});

test('InputManager: action mapping', () => {
  const input = new InputManager();
  const c = document.createElement('canvas');
  c.width = 800; c.height = 500;
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500 });
  c.getContext = () => ({ fillRect: () => {} });
  input.attach(c);
  input.bind('jump', 'Space', 'KeyW');
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  assert(input.isActionDown('jump'));
  assert(input.wasActionPressed('jump'));
  input.endFrame();
  assert(!input.wasActionPressed('jump'));
  input.detach();
  c.remove();
});

test('InputManager: getBoundKeys', () => {
  const input = new InputManager();
  input.bind('moveLeft', 'ArrowLeft', 'KeyA');
  const keys = input.getBoundKeys('moveLeft');
  assert(keys !== null);
  assert(keys.includes('ArrowLeft'));
  assert(keys.includes('KeyA'));
});

test('InputManager: clearActions', () => {
  const input = new InputManager();
  input.bind('jump', 'Space');
  input.clearActions();
  assert(input.getBoundKeys('jump') === null);
});

test('InputManager: resetKeys', () => {
  const input = new InputManager();
  const c = document.createElement('canvas');
  c.width = 800; c.height = 500;
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500 });
  c.getContext = () => ({ fillRect: () => {} });
  input.attach(c);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  assert(input.isDown('Space'));
  input.resetKeys();
  assert(!input.isDown('Space'));
  input.detach();
  c.remove();
});

test('InputManager: no repeat de keydown', () => {
  const input = new InputManager();
  const c = document.createElement('canvas');
  c.width = 800; c.height = 500;
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500 });
  c.getContext = () => ({ fillRect: () => {} });
  input.attach(c);
  const event = new window.KeyboardEvent('keydown', { code: 'Space', bubbles: true });
  Object.defineProperty(event, 'repeat', { value: true });
  window.dispatchEvent(event);
  assert(!input.wasPressed('Space'));
  input.detach();
  c.remove();
});

test('InputManager: unbind', () => {
  const input = new InputManager();
  input.bind('jump', 'Space', 'KeyW');
  assertEqual(input.getBoundKeys('jump').length, 2);
  input.unbind('jump', 'Space');
  assertEqual(input.getBoundKeys('jump').length, 1);
  assert(!input.getBoundKeys('jump').includes('Space'));
  assert(input.getBoundKeys('jump').includes('KeyW'));
});

test('InputManager: unbind removes action when empty', () => {
  const input = new InputManager();
  input.bind('jump', 'Space');
  input.unbind('jump', 'Space');
  assert(input.getBoundKeys('jump') === null);
});

// ─── Resultados engine tests ─────────────────────────────────────────

console.log(`\n📊 Engine Tests: ${enginePassed} pasaron, ${engineFailed} fallaron de ${enginePassed + engineFailed}`);
console.log(`\n═══════════════════════════════════════`);
console.log(`Total: ${totalPassed + enginePassed} pasaron, ${totalFailed + engineFailed} fallaron`);
if (totalWarnings > 0) console.log(`Advertencias: ${totalWarnings}`);
console.log(`═══════════════════════════════════════\n`);

if (engineFailed > 0) process.exit(1);
