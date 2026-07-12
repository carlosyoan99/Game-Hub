import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { Tilemap } from '../../engine/Tilemap.js';
import { Camera } from '../../engine/Camera.js';
import { aabbIntersects, clamp } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';

const TILE_SIZE = 32;
const GRAVITY = 1500;
const MAX_FALL_SPEED = 900;
const APEX_THRESHOLD = 90; // px/s; por debajo de esto se considera "cerca del ápice"
const APEX_GRAVITY_SCALE = 0.5; // gravedad reducida cerca del ápice = hang time, curva más suave

const MOVE_ACCEL = 1400; // px/s^2, a diferencia del Platformer (velocidad instantánea)
const MOVE_MAX_SPEED = 260;
const GROUND_FRICTION = 1600; // px/s^2 de frenado al soltar dirección

const JUMP_VELOCITY = -540;
const JUMP_CUT_MULTIPLIER = 0.5;
const COYOTE_TIME = 0.1;

const WALL_SLIDE_MAX_SPEED = 110; // px/s; la caída se limita a esto al deslizar por una pared
const WALL_JUMP_VX = 260;
const WALL_JUMP_VY = -500;
const WALL_JUMP_LOCK_TIME = 0.15; // tras un salto de pared, ignora input horizontal brevemente

// 5 niveles de dificultad creciente
const LEVEL_ROWS = [
  // Nivel 1: chimenea básica
  [
    '..........................................',
    '..........................................',
    '..................G.......................',
    '.................####.....................',
    '.................#..#.....................',
    '.................#..#.....................',
    '.................#..#.....................',
    '.................#..#.....................',
    '.................#..#.....................',
    '.................#..#.....................',
    '.................#..#.....................',
    '.................#..#.....................',
    '.................#..#.....................',
    '...............................####.......',
    '.................#..#.....................',
    '.................#..#.....................',
    '.................#..#.....................',
    '.................#..#.....................',
    '##########..############################',
    '##########..############################',
  ],
  // Nivel 2: dos chimeneas
  [
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '........G..................................',
    '.......####................................',
    '.......#..#................................',
    '.......#..#................................',
    '.......#..#.......####....................',
    '.......#..#.......#..#....................',
    '.......#..#.......#..#....................',
    '.......#..#.......#..#......####..........',
    '.......#..#.......#..#....................',
    '.......#..#.......#..#....................',
    '.......#..#.......#..#....................',
    '.......#..#.......#..#....................',
    '#####.###...#####.###...#####...#########',
    '#####.###...#####.###...#####...#########',
  ],
  // Nivel 3: plataformas estrechas
  [
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..................G.........................',
    '.................########..................',
    '..........................................',
    '..........................................',
    '..........................................',
    '...........####.....####..................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..#..#######..#####..############..#######',
    '..#..#######..#####..############..#######',
    '..#..#######..#####..############..#######',
  ],
  // Nivel 4: saltos precisos
  [
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '...................G.......................',
    '..................#####....................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........####..............................',
    '..........................................',
    '..........................................',
    '####....####....####....####....####..#####',
    '####....####....####....####....####..#####',
    '####....####....####....####....####..#####',
  ],
  // Nivel 5: combinado
  [
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........................................',
    '...........G.................................',
    '..........####...............................',
    '..........................................',
    '..........................................',
    '..........................................',
    '..........####..............................',
    '..........................................',
    '..........................................',
    '###..####..####..####..####..####..########',
    '###..####..####..####..####..####..########',
    '###..####..####..####..####..####..########',
  ],
];

const MAX_LEVEL = LEVEL_ROWS.length;
const LEGEND = { '#': 1 };

/**
 * FancyPants — expandido con 5 niveles de dificultad progresiva.
 */
export class FancyPants {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('fancy-pants');

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.bestTime = this.storage.get('bestTime', null);
    this.currentLevel = this.storage.get('savedLevel', 1);
    this._loadLevel();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
    this.camera.resize(width, height);
  }

  _loadLevel() {
    const levelIndex = Math.min(this.currentLevel - 1, LEVEL_ROWS.length - 1);
    const rows = LEVEL_ROWS[levelIndex];
    const data = Tilemap.parseAscii(rows, LEGEND);
    this.tilemap = new Tilemap({ data, tileSize: TILE_SIZE, solidTiles: new Set([1]) });
    this.camera = new Camera(this.width, this.height);
    this.goalRect = this._findGoal(rows);

    let spawnY = TILE_SIZE * 16;
    for (let row = 0; row < rows.length; row++) {
      if (rows[row][2] === '.') { spawnY = row * TILE_SIZE; break; }
    }
    this.spawnPoint = { x: TILE_SIZE * 2, y: spawnY };
    this._restart();
  }

  _findGoal(rows) {
    for (let row = 0; row < rows.length; row++) {
      const col = rows[row].indexOf('G');
      if (col !== -1) return { x: col * TILE_SIZE, y: row * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE };
    }
    return { x: TILE_SIZE * 20, y: TILE_SIZE * 10, width: TILE_SIZE, height: TILE_SIZE };
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
    this.wallJumpLock = 0;
    this.isWallSliding = false;
    this.lives = 3;
    this.elapsed = 0;
    this.status = 'playing';
  }

  _nextLevel() {
    this.currentLevel++;
    this.storage.set('savedLevel', this.currentLevel);
    this._loadLevel();
  }

  update(dt) {
    if (this.status === 'level-complete') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) this._nextLevel();
      this.input.endFrame();
      return;
    }
    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) this._restart();
      this.input.endFrame();
      return;
    }

    this.elapsed += dt;
    this._updatePlayer(dt);
    this.camera.follow(this.player, this.tilemap.pixelWidth, this.tilemap.pixelHeight);

    this.input.endFrame();
  }

  /** Comprueba si alguna baldosa sólida toca la columna dada, entre dos filas (inclusive). */
  _columnHasSolid(col, rowStart, rowEnd) {
    for (let row = rowStart; row <= rowEnd; row++) {
      if (this.tilemap.isSolidTile(this.tilemap.tileAt(col, row))) return true;
    }
    return false;
  }

  _updatePlayer(dt) {
    const left = this.input.isDown('ArrowLeft') || this.input.isDown('KeyA');
    const right = this.input.isDown('ArrowRight') || this.input.isDown('KeyD');

    if (this.wallJumpLock > 0) {
      this.wallJumpLock -= dt;
    } else {
      // Aceleración + fricción en vez de velocidad instantánea: así arrancar
      // y frenar tienen una curva, no un salto discreto de 0 a MOVE_MAX_SPEED.
      if (left && !right) {
        this.player.vx -= MOVE_ACCEL * dt;
        this.player.facing = -1;
      } else if (right && !left) {
        this.player.vx += MOVE_ACCEL * dt;
        this.player.facing = 1;
      } else if (this.player.vx !== 0) {
        const decel = GROUND_FRICTION * dt;
        this.player.vx = this.player.vx > 0 ? Math.max(0, this.player.vx - decel) : Math.min(0, this.player.vx + decel);
      }
      this.player.vx = clamp(this.player.vx, -MOVE_MAX_SPEED, MOVE_MAX_SPEED);
    }

    // Contacto con pared calculado ANTES de mover este frame (aproximación
    // de un frame de retraso, aceptable para el efecto de deslizamiento).
    const rowTop = Math.floor(this.player.y / TILE_SIZE);
    const rowBottom = Math.floor((this.player.y + this.player.height - 1) / TILE_SIZE);
    const leftCol = Math.floor((this.player.x - 1) / TILE_SIZE);
    const rightCol = Math.floor((this.player.x + this.player.width) / TILE_SIZE);
    const touchingLeftWall = this._columnHasSolid(leftCol, rowTop, rowBottom);
    const touchingRightWall = this._columnHasSolid(rightCol, rowTop, rowBottom);

    // Gravedad con hang time cerca del ápice del salto.
    const gravityScale = Math.abs(this.player.vy) < APEX_THRESHOLD ? APEX_GRAVITY_SCALE : 1;
    this.player.vy = Math.min(this.player.vy + GRAVITY * gravityScale * dt, MAX_FALL_SPEED);

    this.isWallSliding = false;
    if (!this.player.onGround && this.player.vy > 0) {
      if ((touchingLeftWall && left) || (touchingRightWall && right)) {
        this.isWallSliding = true;
        this.player.wallSide = touchingLeftWall ? 'left' : 'right';
        this.player.vy = Math.min(this.player.vy, WALL_SLIDE_MAX_SPEED);
      }
    }

    const jumpPressed = this.input.wasPressed('Space') || this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW');
    if (jumpPressed) {
      if (this.player.onGround || this.coyoteTimer > 0) {
        this.player.vy = JUMP_VELOCITY;
        this.coyoteTimer = 0;
        this.player.jumpCut = false;
        AudioManager.sfx({ type: 'jump', volume: 0.3 });
      } else if (this.isWallSliding) {
        this.player.vy = WALL_JUMP_VY;
        this.player.vx = this.player.wallSide === 'left' ? WALL_JUMP_VX : -WALL_JUMP_VX;
        this.player.facing = this.player.wallSide === 'left' ? 1 : -1;
        this.wallJumpLock = WALL_JUMP_LOCK_TIME;
        this.isWallSliding = false;
        this.player.jumpCut = false;
        AudioManager.sfx({ type: 'jump', volume: 0.4 });
        HapticManager.vibrate('jump');
      }
    }

    // Corte de salto una sola vez por salto (ver mismo fix en Platformer.js).
    const jumpHeld = this.input.isDown('Space') || this.input.isDown('ArrowUp') || this.input.isDown('KeyW');
    if (!jumpHeld && this.player.vy < 0 && !this.player.jumpCut) {
      this.player.vy *= JUMP_CUT_MULTIPLIER;
      this.player.jumpCut = true;
    }

    const result = this.tilemap.resolveAABB(this.player, this.player.vx, this.player.vy, dt);
    if (result.onGround || result.onCeiling) this.player.vy = 0;
    if (result.onWall) this.player.vx = 0;

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
    AudioManager.sfx({ type: 'hit', volume: 0.4 });
    HapticManager.vibrate('hit');
    if (this.lives <= 0) {
      this.status = 'lost';
      AudioManager.sfx({ type: 'explosion', volume: 0.4 });
    } else {
      this.player.x = this.spawnPoint.x;
      this.player.y = this.spawnPoint.y;
      this.player.vx = 0;
      this.player.vy = 0;
    }
  }

  _win() {
    if (this.currentLevel >= MAX_LEVEL) {
      this.status = 'won';
      AudioManager.sfx({ type: 'powerup', volume: 0.6 });
      HapticManager.vibrate('powerup');
    } else {
      this.status = 'level-complete';
      AudioManager.sfx({ type: 'powerup', volume: 0.5 });
      HapticManager.vibrate('powerup');
    }
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

    ctx.fillStyle = '#ffb454';
    ctx.fillRect(this.goalRect.x, this.goalRect.y, this.goalRect.width, this.goalRect.height);

    ctx.fillStyle = this.isWallSliding ? '#7fd1ff' : '#e7edf3';
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
      const overlayTitle = this.status === 'level-complete' ? '¡NIVEL COMPLETADO!' : this.status === 'won' ? '¡META!' : 'GAME OVER';
      ctx.fillText(overlayTitle, this.width / 2, this.height / 2 - 20);
      ctx.font = '16px monospace';
      const overlayAction = this.status === 'level-complete' ? 'Click o Espacio para continuar' : 'Click o Espacio para reiniciar';
      ctx.fillText(overlayAction, this.width / 2, this.height / 2 + 15);
      ctx.textAlign = 'left';
    }
  }

  destroy() {
    this.input.detach();
  }
}
