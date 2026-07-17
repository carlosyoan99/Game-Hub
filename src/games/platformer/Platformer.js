import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { GameBase } from '../../engine/GameBase.js';
import { Tilemap } from '../../engine/Tilemap.js';
import { Camera } from '../../engine/Camera.js';
import { aabbIntersects, clamp } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

const TILE_SIZE = 32;
const GRAVITY = 1400; // px/s^2
const MAX_FALL_SPEED = 900;
const MOVE_SPEED = 220; // px/s
const JUMP_VELOCITY = -520;
const COYOTE_TIME = 0.1; // segundos de gracia para saltar tras salir de una plataforma
const JUMP_CUT_MULTIPLIER = 0.5; // al soltar el botón mientras sube, corta el impulso (salto variable)

// 5 niveles: '#' = sólido, 'G' = meta, '.' = vacío.
// Saltos: max 5 tiles horizontal (160px), max 3 tiles vertical (96px).
const LEVEL_ROWS = [
  // Nivel 1: tutorial plano, gaps de 4 tiles
  [
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..........................G........................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '##########....#######....#######....##############',
    '##########....#######....#######....##############',
    '##########....#######....#######....##############',
  ],
  // Nivel 2: plataformas escalonadas (subir escalando)
  [
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..........................G........................',
    '..................................................',
    '.........................####......................',
    '..................................................',
    '...................####............................',
    '..................................................',
    '..............####................................',
    '..................................................',
    '.........####.....................................',
    '..................................................',
    '#####....####....####....####....####....#########',
    '#####....####....####....####....####....#########',
    '#####....####....####....####....####....#########',
  ],
  // Nivel 3: plataformas verticales
  [
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '......................G............................',
    '..................................................',
    '....................####...........................',
    '..................................................',
    '..................####.............................',
    '..................................................',
    '................####...............................',
    '..................................................',
    '..............####.................................',
    '..................................................',
    '##.........####.........####.........####....####',
    '##.........####.........####.........####....####',
    '##.........####.........####.........####....####',
  ],
  // Nivel 4: huecos estrechos
  [
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..........................G........................',
    '.........................####......................',
    '..................................................',
    '..................................................',
    '..........####.....................................',
    '..................................................',
    '..................................................',
    '..........................####......................',
    '..................................................',
    '...........####...................................',
    '..................................................',
    '####.......####.......####.......####.......######',
    '####.......####.......####.......####.......######',
    '####.......####.......####.......####.......######',
  ],
  // Nivel 5: combinación
  [
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '..............................G....................',
    '............................####..................',
    '..................................................',
    '...................####..............................',
    '..................................................',
    '..........................................####....',
    '..................................................',
    '..........####...................................',
    '..................................................',
    '..................................................',
    '..................................................',
    '###.......####.......####.......####.......#######',
    '###.......####.......####.......####.......#######',
    '###.......####.......####.......####.......#######',
  ],
];

const MAX_LEVEL = LEVEL_ROWS.length;
const LEGEND = { '#': 1 };

/**
 * Platformer — expandido con 5 niveles de dificultad progresiva.
 */
export class Platformer extends GameBase {
  init(engine) {
    super.init(engine, 'platformer');
    this.bestTime = this.storage.get('bestTime', null);
    this.currentLevel = this.storage.get('savedLevel', 1);
    this._loadLevel();
  }

  _defaultBindings() {
    return {
      moveLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      jump:      ['Space', 'ArrowUp', 'KeyW', 'GamepadA', 'GamepadUp', 'GamepadLStickUp'],
      next:      ['Space', 'GamepadA', 'GamepadStart'],
      restart:   ['Space'],
    };
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this.camera.resize(width, height);
  }

  _loadLevel() {
    const levelIndex = Math.min(this.currentLevel - 1, LEVEL_ROWS.length - 1);
    const rows = LEVEL_ROWS[levelIndex];
    const data = Tilemap.parseAscii(rows, LEGEND);
    this.tilemap = new Tilemap({ data, tileSize: TILE_SIZE, solidTiles: new Set([1]) });
    this.camera = new Camera(this.width, this.height);
    this.goalRect = this._findGoal(rows);

    // Spawn en la primera columna despejada
    let spawnY = TILE_SIZE * 16;
    const spawnX = TILE_SIZE * 2;
    for (let row = 0; row < rows.length; row++) {
      if (rows[row][2] === '.') { spawnY = row * TILE_SIZE; break; }
    }
    this.spawnPoint = { x: spawnX, y: spawnY };

    this._restart();
  }

  _findGoal(rows) {
    for (let row = 0; row < rows.length; row++) {
      const col = rows[row].indexOf('G');
      if (col !== -1) {
        return { x: col * TILE_SIZE, y: row * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE };
      }
    }
    return { x: TILE_SIZE * 30, y: TILE_SIZE * 10, width: TILE_SIZE, height: TILE_SIZE };
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
    this.startTime = Date.now();
  }

  _nextLevel() {
    this.currentLevel++;
    this.storage.set('savedLevel', this.currentLevel);
    this._loadLevel();
  }

  update(dt) {
    if (this.status === 'level-complete') {
      if (this.input.wasActionPressed('next') || this.input.mouse.clickedThisFrame) this._nextLevel();
      return;
    }
    if (this.handleRestartInput()) return;

    this.elapsed += dt;
    this._updatePlayer(dt);
    this.camera.follow(this.player, this.tilemap.pixelWidth, this.tilemap.pixelHeight);
  }

  _updatePlayer(dt) {
    const left = this.input.isActionDown('moveLeft');
    const right = this.input.isActionDown('moveRight');

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

    const jumpPressed = this.input.wasActionPressed('jump');
    if (jumpPressed && (this.player.onGround || this.coyoteTimer > 0)) {
      this.player.vy = JUMP_VELOCITY;
      this.coyoteTimer = 0;
      this.player.jumpCut = false;
      AudioManager.sfx({ type: 'platformer_jump', volume: 0.3 });
    }

    // Salto variable: si sueltas el botón mientras aún subes, se corta el
    // impulso UNA sola vez (jumpCut evita que se repita cada frame — sin
    // ese flag, vy*=0.5 en cada frame decae tan rápido que el salto corto
    // prácticamente no despega, en vez de dar un salto bajo perceptible).
    const jumpHeld = this.input.isActionDown('jump');
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
    AudioManager.sfx({ type: 'hit', volume: 0.4 });
    HapticManager.vibrate('hit');
    if (this.lives <= 0) {
      this.status = 'lost';
      AudioManager.sfx({ type: 'explosion', volume: 0.4 });
      this._recordPlatformerPlay();
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
      this._recordPlatformerPlay(true);
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

  _recordPlatformerPlay(won = false) {
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('platformer', Math.floor(this.elapsed), won, duration);
    if (this.currentLevel >= 1) ProgressionManager.checkAchievement('platformer', 'first-level');
    if (this.currentLevel >= 5) ProgressionManager.checkAchievement('platformer', 'platform-pro');
    if (this.status === 'won' || won) ProgressionManager.checkAchievement('platformer', 'speed-runner');
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

    setupHUDContext(ctx);
    ctx.fillText(t('platformer.lives', { n: this.lives }), 10, 10);
    ctx.fillText(t('platformer.time', { n: this.elapsed.toFixed(1) }), this.width - 130, 10);
    if (this.bestTime !== null) {
      ctx.fillText(t('platformer.bestTime', { n: this.bestTime.toFixed(1) }), this.width / 2 - 50, 10);
    }

    if (this.status === 'level-complete') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t('game.levelComplete'), this.width / 2, this.height / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillText(t('game.continue'), this.width / 2, this.height / 2 + 15);
      ctx.textAlign = 'left';
    }

    if (this.status === 'won' || this.status === 'lost') {
      const title = this.status === 'won' ? t('platformer.meta') : undefined;
      renderOverlay(ctx, { width: this.width, height: this.height, title });
    }
  }

}
