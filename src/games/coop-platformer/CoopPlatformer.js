import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { GameBase } from '../../engine/GameBase.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { Tilemap } from '../../engine/Tilemap.js';
import { Camera } from '../../engine/Camera.js';
import { aabbIntersects, clamp } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

const TILE_SIZE = 32;
const GRAVITY = 1400;
const MAX_FALL_SPEED = 900;
const MOVE_SPEED = 200;
const JUMP_VELOCITY = -500;
const JUMP_CUT_MULTIPLIER = 0.5;
const COYOTE_TIME = 0.1;

// 5 niveles cooperativos
const LEVEL_ROWS = [
  // Nivel 1: tutorial
  [
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
  ],
  // Nivel 2: plataforma móvil más larga
  [
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '..........L........=...................F.W..',
    '#########.......#############################',
    '#########.......#############################',
  ],
  // Nivel 3: dos verjas
  [
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '..................=..............=...........',
    '..................=..............=...........',
    '..................=..............=...........',
    '..................=..............=...........',
    '........L..............=.........L......F.W.',
    '##########......############################',
    '##########......############################',
  ],
  // Nivel 4: plataformas estrechas
  [
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '.........L................=............F.W..',
    '####.......####.......######################',
    '####.......####.......######################',
  ],
  // Nivel 5: combinación completa
  [
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '...............=.............................',
    '...............=.............................',
    '...............=.............................',
    '...............=.............................',
    '.........L.......=....L................F.W..',
    '######..............########################',
    '######..............########################',
  ],
];

const MAX_LEVEL = LEVEL_ROWS.length;
const LEGEND = { '#': 1, '=': 2 };
const GATE_COL = 22;
const GATE_ROWS = [9, 10, 11, 12];

/**
 * CoopPlatformer — expandido con 5 niveles cooperativos.
 */
export class CoopPlatformer extends GameBase {
  init(engine) {
    super.init(engine, 'coop-platformer');
    this.bestTime = this.storage.get('bestTime', null);
    this.currentLevel = this.storage.get('savedLevel', 1);
    this._loadLevel();
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this.camera.resize(width, height);
  }

  _loadLevel() {
    const levelIndex = Math.min(this.currentLevel - 1, LEVEL_ROWS.length - 1);
    const rows = LEVEL_ROWS[levelIndex];
    const data = Tilemap.parseAscii(rows, LEGEND);
    this.tilemap = new Tilemap({ data, tileSize: TILE_SIZE, solidTiles: new Set([1, 2]) });
    this.camera = new Camera(this.width, this.height);

    this.leverRect = this._findMarker(rows, 'L');
    this.goal1Rect = this._findMarker(rows, 'F');
    this.goal2Rect = this._findMarker(rows, 'W');

    // Encontrar plataforma móvil (si existe)
    this.platform = null;
    for (let row = 0; row < rows.length; row++) {
      const col = rows[row].indexOf('P');
      if (col !== -1) {
        this.platform = {
          x: col * TILE_SIZE,
          y: row * TILE_SIZE,
          width: TILE_SIZE * 2,
          height: 12,
          minX: col * TILE_SIZE,
          maxX: (col + 5) * TILE_SIZE,
          time: 0,
          speed: 1.1,
          deltaX: 0,
        };
        break;
      }
    }

    // Spawn de jugadores
    this.spawn1 = { x: TILE_SIZE * 2, y: TILE_SIZE * 12 };
    this.spawn2 = { x: TILE_SIZE * 4, y: TILE_SIZE * 12 };

    this._restart();
  }

  _findMarker(rows, char) {
    for (let row = 0; row < rows.length; row++) {
      const col = rows[row].indexOf(char);
      if (col !== -1) return { x: col * TILE_SIZE, y: row * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE };
    }
    return { x: TILE_SIZE * 20, y: TILE_SIZE * 13, width: TILE_SIZE, height: TILE_SIZE };
  }

  _makeCharacter(spawn) {
    return { x: spawn.x, y: spawn.y, width: 20, height: 28, vx: 0, vy: 0, onGround: false, coyoteTimer: 0, ridingPlatform: false, jumpCut: false };
  }

  _restart() {
    this.startTime = Date.now();
    this.player1 = this._makeCharacter(this.spawn1);
    this.player2 = this._makeCharacter(this.spawn2);
    this.gateOpen = false;
    this._leverWasPressed = false;
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
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame || this.input.wasPressed('GamepadA') || this.input.wasPressed('GamepadStart')) this._nextLevel();

      return;
    }
    if (this.handleRestartInput()) return;
    if (this.status === 'level-complete') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame || this.input.wasPressed('GamepadA') || this.input.wasPressed('GamepadStart')) this._nextLevel();

      return;
    }

    this.elapsed += dt;
    this._updatePlatform(dt);
    // Cada jugador acepta un array de teclas por acción para soportar
    // teclado + gamepad (D-pad, stick izquierdo y botones de acción).
    this._updateCharacter(this.player1, {
      left: ['KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      right: ['KeyD', 'GamepadRight', 'GamepadLStickRight'],
      jump: ['KeyW', 'GamepadA', 'GamepadLStickUp'],
    }, dt);
    this._updateCharacter(this.player2, {
      left: ['ArrowLeft', 'GamepadLeft', 'GamepadLStickLeft'],
      right: ['ArrowRight', 'GamepadRight', 'GamepadLStickRight'],
      jump: ['ArrowUp', 'GamepadA', 'GamepadLStickUp'],
    }, dt);
    this._updateGate();
    this._checkWin();
  }

  _updatePlatform(dt) {
    if (!this.platform) return;
    const plat = this.platform;
    plat.time += dt;
    const t = (Math.sin(plat.time * plat.speed) + 1) / 2;
    const newX = plat.minX + (plat.maxX - plat.minX) * t;
    plat.deltaX = newX - plat.x;
    plat.x = newX;
  }

  _updateCharacter(player, keys, dt) {
    // Si iba montado en la plataforma el frame anterior, se mueve con ella
    // antes de aplicar cualquier otra física (ver comentario de clase).
    if (player.ridingPlatform && this.platform) {
      player.x += this.platform.deltaX;
    }

    // Soporta arrays de teclas (teclado + gamepad). Si es string, se
    // envuelve en array para mantener compatibilidad.
    const leftArr = Array.isArray(keys.left) ? keys.left : [keys.left];
    const rightArr = Array.isArray(keys.right) ? keys.right : [keys.right];
    const jumpArr = Array.isArray(keys.jump) ? keys.jump : [keys.jump];

    const left = leftArr.some(k => this.input.isDown(k));
    const right = rightArr.some(k => this.input.isDown(k));
    if (left && !right) player.vx = -MOVE_SPEED;
    else if (right && !left) player.vx = MOVE_SPEED;
    else player.vx = 0;

    player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL_SPEED);

    const jumpPressed = jumpArr.some(k => this.input.wasPressed(k));
    if (jumpPressed && (player.onGround || player.coyoteTimer > 0)) {
      player.vy = JUMP_VELOCITY;
      player.coyoteTimer = 0;
      player.jumpCut = false;
      AudioManager.sfx({ type: 'coop_jump', volume: 0.3 });
    }
    const jumpHeld = jumpArr.some(k => this.input.isDown(k));
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
    if (this.platform) {
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
    if (someoneOnLever && !this._leverWasPressed) {
      AudioManager.sfx({ type: 'coop_lever', volume: 0.3 });
      HapticManager.vibrate('select');
    }
    this._leverWasPressed = someoneOnLever;
    const tileValue = this.gateOpen ? 0 : 2;
    for (const row of GATE_ROWS) {
      this.tilemap.data[row][GATE_COL] = tileValue;
    }
  }

  _recordProgressionPlay(won) {
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('coop-platformer', Math.floor(this.elapsed), won, duration);
    if (this.currentLevel >= 1) ProgressionManager.checkAchievement('coop-platformer', 'coop-first');
    if (this.currentLevel >= 5) ProgressionManager.checkAchievement('coop-platformer', 'coop-pro');
    if (this.status === 'won' || won) ProgressionManager.checkAchievement('coop-platformer', 'fire-water');
  }

  _checkWin() {
    if (this.player1.fell || this.player2.fell) {
      AudioManager.sfx({ type: 'hit', volume: 0.3 });
      HapticManager.vibrate('hit');
      this._respawnBoth();
      return;
    }
    const p1Home = aabbIntersects(this.player1, this.goal1Rect);
    const p2Home = aabbIntersects(this.player2, this.goal2Rect);
    if (p1Home && p2Home) {
      if (this.currentLevel >= MAX_LEVEL) {
        this.status = 'won';
        this._recordProgressionPlay(true);
        AudioManager.sfx({ type: 'powerup', volume: 0.6 });
        HapticManager.vibrate('powerup');
      } else {
        this.status = 'level-complete';
        this._recordProgressionPlay(false);
        AudioManager.sfx({ type: 'powerup', volume: 0.5 });
        HapticManager.vibrate('powerup');
      }
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

    if (this.platform) {
      ctx.fillStyle = '#c9c3a3';
      ctx.fillRect(this.platform.x, this.platform.y, this.platform.width, this.platform.height);
    }

    ctx.fillStyle = '#e06c4b';
    ctx.fillRect(this.player1.x, this.player1.y, this.player1.width, this.player1.height);
    ctx.fillStyle = '#4b9ee0';
    ctx.fillRect(this.player2.x, this.player2.y, this.player2.width, this.player2.height);

    ctx.restore();

    setupHUDContext(ctx);
    ctx.fillText(t('coop.controls'), 10, 10);
    ctx.fillText(t('coop.time', { n: this.elapsed.toFixed(1) }), this.width - 130, 10);
    if (this.bestTime !== null) {
      ctx.fillText(t('coop.bestTime', { n: this.bestTime.toFixed(1) }), this.width / 2 - 50, 10);
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
      const title = this.status === 'won' ? t('coop.meta') : undefined;
      renderOverlay(ctx, { width: this.width, height: this.height, title });
    }
  }

}
