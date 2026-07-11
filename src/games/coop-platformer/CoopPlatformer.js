import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { Tilemap } from '../../engine/Tilemap.js';
import { Camera } from '../../engine/Camera.js';
import { aabbIntersects, clamp } from '../../engine/CollisionUtils.js';

const TILE_SIZE = 32;
const GRAVITY = 1400;
const MAX_FALL_SPEED = 900;
const MOVE_SPEED = 200;
const JUMP_VELOCITY = -500;
const JUMP_CUT_MULTIPLIER = 0.5;
const COYOTE_TIME = 0.1;

// '#' = sólido permanente, '=' = verja controlada por la palanca (empieza
// cerrada). 'L' = palanca, 'F'/'W' = metas de cada jugador — ninguno de
// estos tres últimos se traduce a baldosa sólida, se leen aparte del
// ASCII igual que la meta en Platformer.js.
const LEVEL_ROWS = [
  '............................................',
  '............................................',
  '............................................',
  '............................................',
  '............................................',
  '............................................',
  '............................................',
  '............................................',
  '............................................',
  '..............................=.............',
  '..............................=.............',
  '..............................=.............',
  '..............................=.............',
  '...........................L..=.........F.W.',
  '####################....####################',
  '####################....####################',
];

const LEGEND = { '#': 1, '=': 2 };
const GATE_COL = 30;
const GATE_ROWS = [9, 10, 11, 12];

/**
 * CoopPlatformer
 * Dos personajes en el mismo tilemap y teclado: Jugador 1 (fuego) usa
 * WASD, Jugador 2 (agua) usa las flechas. Ambos comparten exactamente la
 * misma función de física (_updateCharacter) — la cooperación es lo
 * nuevo, no el movimiento en sí.
 *
 * Dos mecánicas nuevas sobre Tilemap/Camera:
 *  - Plataforma móvil: no vive en el tilemap (no es una cuadrícula fija),
 *    es un AABB que se mueve con una onda senoidal y "carga" a quien esté
 *    de pie encima sumándole su desplazamiento del frame.
 *  - Palanca + verja: la verja es una baldosa normal (id 2) que se
 *    alterna entre sólida (2) y vacía (0) directamente en `tilemap.data`
 *    según si algún jugador pisa la zona de la palanca ese frame — es
 *    una palanca de "mientras la pisas", no un interruptor permanente,
 *    a propósito: fuerza a que un jugador se quede sujetando mientras el
 *    otro cruza.
 */
export class CoopPlatformer {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('coop-platformer');

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.bestTime = this.storage.get('bestTime', null);

    const data = Tilemap.parseAscii(LEVEL_ROWS, LEGEND);
    this.tilemap = new Tilemap({ data, tileSize: TILE_SIZE, solidTiles: new Set([1, 2]) });
    this.camera = new Camera(this.width, this.height);

    this.leverRect = this._findMarker(LEVEL_ROWS, 'L');
    this.goal1Rect = this._findMarker(LEVEL_ROWS, 'F');
    this.goal2Rect = this._findMarker(LEVEL_ROWS, 'W');

    this.platform = {
      x: 19 * TILE_SIZE,
      y: 13 * TILE_SIZE,
      width: TILE_SIZE * 2,
      height: 12,
      minX: 19 * TILE_SIZE,
      maxX: 24 * TILE_SIZE,
      time: 0,
      speed: 1.1,
      deltaX: 0,
    };

    this.spawn1 = { x: TILE_SIZE * 2, y: TILE_SIZE * 12 };
    this.spawn2 = { x: TILE_SIZE * 4, y: TILE_SIZE * 12 };

    this._restart();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
    this.camera.resize(width, height);
  }

  _findMarker(rows, char) {
    for (let row = 0; row < rows.length; row++) {
      const col = rows[row].indexOf(char);
      if (col !== -1) return { x: col * TILE_SIZE, y: row * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE };
    }
    return { x: 0, y: 0, width: TILE_SIZE, height: TILE_SIZE };
  }

  _makeCharacter(spawn) {
    return { x: spawn.x, y: spawn.y, width: 20, height: 28, vx: 0, vy: 0, onGround: false, coyoteTimer: 0, ridingPlatform: false, jumpCut: false };
  }

  _restart() {
    this.player1 = this._makeCharacter(this.spawn1);
    this.player2 = this._makeCharacter(this.spawn2);
    this.gateOpen = false;
    this.elapsed = 0;
    this.status = 'playing';
  }

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) this._restart();
      this.input.endFrame();
      return;
    }

    this.elapsed += dt;
    this._updatePlatform(dt);
    this._updateCharacter(this.player1, { left: 'KeyA', right: 'KeyD', jump: 'KeyW' }, dt);
    this._updateCharacter(this.player2, { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp' }, dt);
    this._updateGate();
    this._checkWin();

    this.input.endFrame();
  }

  _updatePlatform(dt) {
    const plat = this.platform;
    plat.time += dt;
    const t = (Math.sin(plat.time * plat.speed) + 1) / 2; // 0..1
    const newX = plat.minX + (plat.maxX - plat.minX) * t;
    plat.deltaX = newX - plat.x;
    plat.x = newX;
  }

  _updateCharacter(player, keys, dt) {
    // Si iba montado en la plataforma el frame anterior, se mueve con ella
    // antes de aplicar cualquier otra física (ver comentario de clase).
    if (player.ridingPlatform) {
      player.x += this.platform.deltaX;
    }

    const left = this.input.isDown(keys.left);
    const right = this.input.isDown(keys.right);
    if (left && !right) player.vx = -MOVE_SPEED;
    else if (right && !left) player.vx = MOVE_SPEED;
    else player.vx = 0;

    player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL_SPEED);

    const jumpPressed = this.input.wasPressed(keys.jump);
    if (jumpPressed && (player.onGround || player.coyoteTimer > 0)) {
      player.vy = JUMP_VELOCITY;
      player.coyoteTimer = 0;
      player.jumpCut = false;
    }
    const jumpHeld = this.input.isDown(keys.jump);
    if (!jumpHeld && player.vy < 0 && !player.jumpCut) {
      player.vy *= JUMP_CUT_MULTIPLIER;
      player.jumpCut = true;
    }

    const result = this.tilemap.resolveAABB(player, player.vx, player.vy, dt);
    if (result.onGround || result.onCeiling) player.vy = 0;

    player.onGround = result.onGround;
    player.coyoteTimer = result.onGround ? COYOTE_TIME : Math.max(0, player.coyoteTimer - dt);

    // Aterrizaje sobre la plataforma móvil: no es parte del tilemap, así
    // que se comprueba aparte contra su AABB. Solo cuenta si el jugador
    // está cayendo (o quieto) y sus pies caen dentro del grosor de la
    // plataforma — evita "engancharse" si pasa por debajo.
    const feetY = player.y + player.height;
    const withinX = player.x + player.width > this.platform.x && player.x < this.platform.x + this.platform.width;
    const closeToTop = feetY >= this.platform.y && feetY <= this.platform.y + this.platform.height + 4;
    if (withinX && closeToTop && player.vy >= 0) {
      player.y = this.platform.y - player.height;
      player.vy = 0;
      player.onGround = true;
      player.coyoteTimer = COYOTE_TIME;
      player.ridingPlatform = true;
    } else {
      player.ridingPlatform = false;
    }

    player.x = clamp(player.x, 0, this.tilemap.pixelWidth - player.width);

    if (player.y > this.tilemap.pixelHeight) {
      player.fell = true;
    }
  }

  _updateGate() {
    const someoneOnLever = aabbIntersects(this.player1, this.leverRect) || aabbIntersects(this.player2, this.leverRect);
    this.gateOpen = someoneOnLever;
    const tileValue = this.gateOpen ? 0 : 2;
    for (const row of GATE_ROWS) {
      this.tilemap.data[row][GATE_COL] = tileValue;
    }
  }

  _checkWin() {
    if (this.player1.fell || this.player2.fell) {
      this._respawnBoth();
      return;
    }
    const p1Home = aabbIntersects(this.player1, this.goal1Rect);
    const p2Home = aabbIntersects(this.player2, this.goal2Rect);
    if (p1Home && p2Home) {
      this.status = 'won';
      if (this.bestTime === null || this.elapsed < this.bestTime) {
        this.bestTime = this.elapsed;
        this.storage.set('bestTime', this.bestTime);
      }
    }
  }

  _respawnBoth() {
    this.player1.x = this.spawn1.x;
    this.player1.y = this.spawn1.y;
    this.player1.vx = 0;
    this.player1.vy = 0;
    this.player1.fell = false;
    this.player2.x = this.spawn2.x;
    this.player2.y = this.spawn2.y;
    this.player2.vx = 0;
    this.player2.vy = 0;
    this.player2.fell = false;
  }

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    // Cámara centrada en el punto medio entre ambos jugadores, para que
    // ninguno se salga de pantalla mientras cooperan.
    const midpoint = {
      x: (this.player1.x + this.player2.x) / 2,
      y: (this.player1.y + this.player2.y) / 2,
      width: 0,
      height: 0,
    };
    this.camera.follow(midpoint, this.tilemap.pixelWidth, this.tilemap.pixelHeight);
    this.camera.apply(ctx);

    const viewport = { x: this.camera.x, y: this.camera.y, width: this.camera.width, height: this.camera.height };
    this.tilemap.render(ctx, viewport, { 1: '#3a4552', 2: '#8a5f2c' });

    ctx.fillStyle = this.gateOpen ? '#3a7d5c' : '#5c3a3a';
    ctx.fillRect(this.leverRect.x, this.leverRect.y + this.leverRect.height - 6, this.leverRect.width, 6);

    ctx.fillStyle = '#e06c4b';
    ctx.fillRect(this.goal1Rect.x, this.goal1Rect.y, this.goal1Rect.width, this.goal1Rect.height);
    ctx.fillStyle = '#4b9ee0';
    ctx.fillRect(this.goal2Rect.x, this.goal2Rect.y, this.goal2Rect.width, this.goal2Rect.height);

    ctx.fillStyle = '#c9c3a3';
    ctx.fillRect(this.platform.x, this.platform.y, this.platform.width, this.platform.height);

    ctx.fillStyle = '#e06c4b';
    ctx.fillRect(this.player1.x, this.player1.y, this.player1.width, this.player1.height);
    ctx.fillStyle = '#4b9ee0';
    ctx.fillRect(this.player2.x, this.player2.y, this.player2.width, this.player2.height);

    ctx.restore();

    ctx.fillStyle = '#9aa7b2';
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('J1 (WASD)  J2 (Flechas)', 10, 10);
    ctx.fillText(`Tiempo: ${this.elapsed.toFixed(1)}s`, this.width - 130, 10);
    if (this.bestTime !== null) {
      ctx.fillText(`Mejor: ${this.bestTime.toFixed(1)}s`, this.width / 2 - 50, 10);
    }

    if (this.status !== 'playing') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('¡META!', this.width / 2, this.height / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillText('Click o Espacio para reiniciar', this.width / 2, this.height / 2 + 15);
      ctx.textAlign = 'left';
    }
  }

  destroy() {
    this.input.detach();
  }
}
