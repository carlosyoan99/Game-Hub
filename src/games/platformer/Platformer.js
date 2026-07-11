import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { Tilemap } from '../../engine/Tilemap.js';
import { Camera } from '../../engine/Camera.js';
import { aabbIntersects, clamp } from '../../engine/CollisionUtils.js';

const TILE_SIZE = 32;
const GRAVITY = 1400; // px/s^2
const MAX_FALL_SPEED = 900;
const MOVE_SPEED = 220; // px/s
const JUMP_VELOCITY = -520;
const COYOTE_TIME = 0.1; // segundos de gracia para saltar tras salir de una plataforma
const JUMP_CUT_MULTIPLIER = 0.5; // al soltar el botón mientras sube, corta el impulso (salto variable)

// Nivel de referencia: '#' = sólido, 'G' = meta, '.' = vacío.
const LEVEL_ROWS = [
  '..................................................',
  '..................................................',
  '..................................................',
  '..................................................',
  '..................................................',
  '..........####....................................',
  '..................................................',
  '..................................................',
  '..................................................',
  '........................###...................G...',
  '.........................................####.....',
  '.....................###..........................',
  '..................................###.............',
  '.................####.............................',
  '..............................####................',
  '..................................................',
  '..................................................',
  '##############...###########..########...#########',
  '##############...###########..########...#########',
  '##############...###########..########...#########',
];

const LEGEND = { '#': 1 };

/**
 * Platformer
 * Primer juego que usa Tilemap + Camera. La colisión es la misma técnica
 * "resolver por eje separado" que ya tenía CollisionUtils, ahora aplicada
 * repetidamente por tile en vez de una sola vez contra un rectángulo —
 * de ahí que viviera en Tilemap.js del motor y no aquí: cualquier
 * plataformas futuro (Fancy Pants, Fireboy & Watergirl) la reutiliza tal
 * cual, solo cambia el nivel y los sprites.
 */
export class Platformer {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('platformer');

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.bestTime = this.storage.get('bestTime', null);

    const data = Tilemap.parseAscii(LEVEL_ROWS, LEGEND);
    this.tilemap = new Tilemap({ data, tileSize: TILE_SIZE, solidTiles: new Set([1]) });
    this.camera = new Camera(this.width, this.height);

    // La meta ('G') no es una baldosa sólida: se busca aparte en el ASCII
    // original y se guarda como un rectángulo normal de mundo.
    this.goalRect = this._findGoal(LEVEL_ROWS);

    this.spawnPoint = { x: TILE_SIZE * 2, y: TILE_SIZE * 10 };

    this._restart();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
    this.camera.resize(width, height);
  }

  _findGoal(rows) {
    for (let row = 0; row < rows.length; row++) {
      const col = rows[row].indexOf('G');
      if (col !== -1) {
        return { x: col * TILE_SIZE, y: row * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE };
      }
    }
    return { x: 0, y: 0, width: TILE_SIZE, height: TILE_SIZE };
  }

  _restart() {
    this.player = {
      x: this.spawnPoint.x,
      y: this.spawnPoint.y,
      width: 20,
      height: 28,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: 1,
      jumpCut: false,
    };
    this.coyoteTimer = 0;
    this.lives = 3;
    this.elapsed = 0;
    this.status = 'playing';
  }

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }
      this.input.endFrame();
      return;
    }

    this.elapsed += dt;
    this._updatePlayer(dt);
    this.camera.follow(this.player, this.tilemap.pixelWidth, this.tilemap.pixelHeight);

    this.input.endFrame();
  }

  _updatePlayer(dt) {
    const left = this.input.isDown('ArrowLeft') || this.input.isDown('KeyA');
    const right = this.input.isDown('ArrowRight') || this.input.isDown('KeyD');

    if (left && !right) {
      this.player.vx = -MOVE_SPEED;
      this.player.facing = -1;
    } else if (right && !left) {
      this.player.vx = MOVE_SPEED;
      this.player.facing = 1;
    } else {
      this.player.vx = 0;
    }

    this.player.vy = Math.min(this.player.vy + GRAVITY * dt, MAX_FALL_SPEED);

    const jumpPressed = this.input.wasPressed('Space') || this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW');
    if (jumpPressed && (this.player.onGround || this.coyoteTimer > 0)) {
      this.player.vy = JUMP_VELOCITY;
      this.coyoteTimer = 0;
      this.player.jumpCut = false;
    }

    // Salto variable: si sueltas el botón mientras aún subes, se corta el
    // impulso UNA sola vez (jumpCut evita que se repita cada frame — sin
    // ese flag, vy*=0.5 en cada frame decae tan rápido que el salto corto
    // prácticamente no despega, en vez de dar un salto bajo perceptible).
    const jumpHeld = this.input.isDown('Space') || this.input.isDown('ArrowUp') || this.input.isDown('KeyW');
    if (!jumpHeld && this.player.vy < 0 && !this.player.jumpCut) {
      this.player.vy *= JUMP_CUT_MULTIPLIER;
      this.player.jumpCut = true;
    }

    const result = this.tilemap.resolveAABB(this.player, this.player.vx, this.player.vy, dt);
    if (result.onGround || result.onCeiling) this.player.vy = 0;

    this.player.onGround = result.onGround;
    this.coyoteTimer = result.onGround ? COYOTE_TIME : Math.max(0, this.coyoteTimer - dt);

    this.player.x = clamp(this.player.x, 0, this.tilemap.pixelWidth - this.player.width);

    if (this.player.y > this.tilemap.pixelHeight) {
      this._loseLife();
      return;
    }

    if (aabbIntersects(this.player, this.goalRect)) {
      this._win();
    }
  }

  _loseLife() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.status = 'lost';
    } else {
      this.player.x = this.spawnPoint.x;
      this.player.y = this.spawnPoint.y;
      this.player.vx = 0;
      this.player.vy = 0;
    }
  }

  _win() {
    this.status = 'won';
    if (this.bestTime === null || this.elapsed < this.bestTime) {
      this.bestTime = this.elapsed;
      this.storage.set('bestTime', this.bestTime);
    }
  }

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    this.camera.apply(ctx);

    const viewport = { x: this.camera.x, y: this.camera.y, width: this.camera.width, height: this.camera.height };
    this.tilemap.render(ctx, viewport, { 1: '#3a4552' });

    // Meta
    ctx.fillStyle = '#ffb454';
    ctx.fillRect(this.goalRect.x, this.goalRect.y, this.goalRect.width, this.goalRect.height);

    // Jugador
    ctx.fillStyle = '#e7edf3';
    ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);

    ctx.restore();

    ctx.fillStyle = '#9aa7b2';
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Vidas: ${this.lives}`, 10, 10);
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
      const message = this.status === 'won' ? '¡META!' : 'GAME OVER';
      ctx.fillText(message, this.width / 2, this.height / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillText('Click o Espacio para reiniciar', this.width / 2, this.height / 2 + 15);
      ctx.textAlign = 'left';
    }
  }

  destroy() {
    this.input.detach();
  }
}
