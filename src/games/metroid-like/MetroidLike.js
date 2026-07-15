/**
 * Metroid-like (Exploración no lineal)
 * Nivel 5 — Juego de exploración y acción
 *
 * Versión expandida: 12 salas, 7 power-ups, 2 jefes, 5 tipos de enemigos.
 *
 * Mecánica: mapa de salas interconectadas, power-ups que desbloquean
 * nuevas áreas, minimapa, enemigos y jefe final.
 */
import { GameBase } from '../../engine/GameBase.js';
import { Tilemap } from '../../engine/Tilemap.js';
import { Camera } from '../../engine/Camera.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { aabbIntersects, clamp } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

const TILE = 32;
const COLS = 20;
const ROWS = 15;
const ROOM_W = COLS * TILE;  // 640
const ROOM_H = ROWS * TILE;  // 480
const GRAVITY = 1000;
const MAX_FALL = 700;
const WALK_SPEED = 150;
const RUN_SPEED = 280;
const JUMP_VEL = -460;
const HIGH_JUMP_VEL = -560;
const SPACE_JUMP_VEL = -380;
const COYOTE = 0.06;

// Power-up flags
const ABILITY = {
  MORPH_BALL:  1 << 0,
  MISSILES:    1 << 1,
  BOMBS:       1 << 2,
  SPEED_BOOST: 1 << 3,
  SPACE_JUMP:  1 << 4,
  SCREW_ATTACK: 1 << 5,
  HIGH_JUMP:   1 << 6,
};

// Tile types
const T = {
  EMPTY: 0, GROUND: 1, PLATFORM: 2, CRACKED: 3, SPEED_BLOCK: 4,
  SPIKES: 5, ICE: 6, MISSILE_DOOR: 7,
};
const SOLID = new Set([T.GROUND, T.PLATFORM, T.CRACKED, T.SPEED_BLOCK, T.ICE, T.MISSILE_DOOR]);
const HAZARD = new Set([T.SPIKES]);
const LEGEND = {
  '#': T.GROUND, '=': T.PLATFORM, 'X': T.CRACKED, 'S': T.SPEED_BLOCK,
  '^': T.SPIKES, '~': T.ICE, 'D': T.MISSILE_DOOR,
  'm': -1, 'M': -2, 'b': -3, 'p': -4, 'j': -5, 'h': -6, 'B': -7,
  'k': -8, 'r': -9, 's': -10, 'a': -11, 'e': -12, 'f': -13,
  'i': -14, 'E': -15,
};

// ─── Data de cada sala ────────────────────────────────────────────────
// Map grid is now 5 wide (0-4), 6 tall (0-5)
// Rooms: 0=Hub, 1=Factory, 2=UpperFactory, 3=Caverns, 4=BombTraining,
//        5=BossLair, 6=FarCaverns, 7=AerialTower, 8=FactoryDepths,
//        9=DeepCaverns, 10=UpperHub, 11=Summit

const ROOMS = [
  { // 0: Spawn — Central Hub
    name: 'metroid.room0',
    gridX: 2, gridY: 3,
    N: 10, S: 4, E: 1, W: 3,
    rows: [
      '....................',
      '....................',
      '...m..............m.',
      '...=..............=.',
      '....................',
      '..........h.........',
      '..........=.........',
      '....................',
      '....................',
      '...M..............p.',
      '...=..............=.',
      '....................',
      '....................',
      '####################',
      '####################',
    ],
  },
  { // 1: Right — Factory Hall
    name: 'metroid.room1',
    gridX: 3, gridY: 3,
    N: 2, S: 8, E: -1, W: 0,
    rows: [
      '....................',
      '....................',
      '..=..............=..',
      '....................',
      '..........X.........',
      '...........X........',
      '....................',
      '..m.............m...',
      '..=.............=...',
      '....................',
      '..........B.........',
      '..........=.........',
      '....................',
      '####################',
      '####################',
    ],
  },
  { // 2: Right Top — Missile door area
    name: 'metroid.room2',
    gridX: 3, gridY: 2,
    N: -1, S: 1, E: 7, W: -1,
    rows: [
      '....................',
      '....................',
      '....................',
      '........M...........',
      '........=...........',
      '....................',
      '....................',
      '..=..............=..',
      '....................',
      '....................',
      '..........m.........',
      '..........=.........',
      '....................',
      '########=....=######',
      '####################',
    ],
  },
  { // 3: Left — Caverns
    name: 'metroid.room3',
    gridX: 1, gridY: 3,
    N: -1, S: 9, E: 0, W: 6,
    rows: [
      '....................',
      '....................',
      '..........m.........',
      '..........=.........',
      '.............m......',
      '.............=......',
      '....................',
      '..=.............=...',
      '....................',
      '..m...........m.....',
      '..=...........=.....',
      '..........j.........',
      '..........=.........',
      '###=...########...###',
      '####################',
    ],
  },
  { // 4: Bottom — Bomb Training
    name: 'metroid.room4',
    gridX: 2, gridY: 4,
    N: 0, S: 5, E: -1, W: -1,
    rows: [
      '....................',
      '....................',
      '....................',
      '....................',
      '..=..............=..',
      '....................',
      '....................',
      '..X..............X..',
      '....................',
      '....................',
      '..b..............b..',
      '..=..............=..',
      '....................',
      '####################',
      '####################',
    ],
  },
  { // 5: Deep Bottom — Boss Lair (first boss: giant beetle)
    name: 'metroid.room5',
    gridX: 2, gridY: 5,
    N: 4, S: -1, E: -1, W: -1,
    rows: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '####################',
      '####################',
    ],
  },
  // ─── Expansión: 6 nuevas salas ──────────────────────────────────
  { // 6: Far Caverns — Speed Booster (requires Space Jump to reach high)
    name: 'metroid.room6',
    gridX: 0, gridY: 3,
    N: -1, S: -1, E: 3, W: -1,
    rows: [
      '....................',
      '....................',
      '....................',
      '..=..............=..',
      '....................',
      '.....s............s.',
      '.....=............=.',
      '....................',
      '....................',
      '..m..............m..',
      '..=..............=..',
      '..........r.........',
      '..........=.........',
      '####################',
      '####################',
    ],
  },
  { // 7: Aerial Tower — High Jump boots (reach via missile door)
    name: 'metroid.room7',
    gridX: 4, gridY: 2,
    N: -1, S: -1, E: -1, W: 2,
    rows: [
      '....................',
      '....................',
      '..........a.........',
      '..........=.........',
      '....................',
      '.....=..........=...',
      '....................',
      '....................',
      '..........D.........',
      '..........=.........',
      '....................',
      '...........e........',
      '...........=........',
      '########....########',
      '####################',
    ],
  },
  { // 8: Factory Depths — Mini-boss Kraid
    name: 'metroid.room8',
    gridX: 3, gridY: 4,
    N: 1, S: -1, E: -1, W: -1,
    rows: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '..........E.........',
      '..........=.........',
      '....................',
      '########...#########',
      '####################',
    ],
  },
  { // 9: Deep Caverns — Screw Attack (requires bombs)
    name: 'metroid.room9',
    gridX: 1, gridY: 4,
    N: 3, S: -1, E: -1, W: -1,
    rows: [
      '....................',
      '...X..............X.',
      '....................',
      '..=..............=..',
      '....................',
      '....................',
      '........^...........',
      '........^...........',
      '....................',
      '..m..............m..',
      '..=..............=..',
      '..........a.........',
      '..........=.........',
      '###=...######...#####',
      '####################',
    ],
  },
  { // 10: Upper Hub — Energy Tank + challenge
    name: 'metroid.room10',
    gridX: 2, gridY: 2,
    N: 11, S: 0, E: -1, W: -1,
    rows: [
      '....................',
      '.....~........~.....',
      '.....~........~.....',
      '..=..~........~..=..',
      '....................',
      '..........E.........',
      '..........=.........',
      '....................',
      '..m..............m..',
      '..=..............=..',
      '....................',
      '...........e........',
      '...........=........',
      '########...##########',
      '####################',
    ],
  },
  { // 11: Summit — Final Boss (Ridley)
    name: 'metroid.room11',
    gridX: 2, gridY: 1,
    N: -1, S: 10, E: -1, W: -1,
    rows: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '..........D.........',
      '..........=.........',
      '....................',
      '....................',
      '....................',
      '....................',
      '########...##########',
      '####################',
    ],
  },
];

// ─── Enemies ──────────────────────────────────────────────────────────

const ENEMY_TYPES = {
  zoomer: { hp: 3, damage: 1, speed: 40, color: '#c84848', w: 20, h: 16 },
  skree:  { hp: 2, damage: 1, speed: 0, dropSpeed: 120, color: '#6b5a9a', w: 22, h: 22 },
  rinka:  { hp: 4, damage: 1, speed: 35, color: '#ff6b4a', w: 18, h: 18 },
  reo:    { hp: 2, damage: 1, speed: 50, color: '#8e44ad', w: 20, h: 16 },
  zebbo:  { hp: 3, damage: 1, speed: 20, color: '#5a8a4a', w: 22, h: 20 },
};

// ─── Clase principal ─────────────────────────────────────────────────

export class MetroidLike extends GameBase {
  init(engine) {
    super.init(engine, 'metroid-like');
    this.highscore = this.storage.get('highscore', 0);
    this.startTime = Date.now();
    this.abilities = 0;
    this.hp = 50;
    this.maxHp = 50;
    this.missileCount = 0;
    this.maxMissiles = 0;
    this.bombCount = 0;
    this.bossDefeated = this.storage.get('bossDefeated', false);
    this.miniBossDefeated = this.storage.get('miniBossDefeated', false);

    this.particles = new ParticleSystem(100);

    // Explored rooms
    this.explored = {};
    this.explored[0] = true;

    this._loadRoom(0);
  }

  _defaultBindings() {
    return {
      moveLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      jump:      ['Space', 'ArrowUp', 'KeyW', 'GamepadA'],
      run:       ['ShiftLeft', 'ShiftRight', 'GamepadX'],
      shoot:     ['KeyJ', 'GamepadB'],
      bomb:      ['KeyK', 'GamepadY'],
      morph:     ['ArrowDown', 'KeyS', 'GamepadDown', 'GamepadLStickDown'],
      restart:   ['Space', 'GamepadStart', 'GamepadA'],
      map:       ['KeyM', 'GamepadBack'],
    };
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    if (this.camera) this.camera.resize(width, height);
  }

  // ─── Carga de salas ─────────────────────────────────────────────────

  _loadRoom(roomId) {
    this.roomId = roomId;
    this.explored[roomId] = true;
    const room = ROOMS[roomId];
    const data = Tilemap.parseAscii(room.rows, LEGEND);
    this.tilemap = new Tilemap({ data, tileSize: TILE, solidTiles: SOLID });

    // Extraer enemigos, items, puertas del ASCII
    this.enemies = [];
    this.items = [];
    this.doors = { N: false, S: false, E: false, W: false };
    this.missileDoors = { N: false, S: false, E: false, W: false };
    this.bossPresent = false;
    this.miniBossPresent = false;
    this.boss2Present = false;

    for (let row = 0; row < room.rows.length; row++) {
      for (let col = 0; col < room.rows[row].length; col++) {
        const ch = room.rows[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (ch === 'm') this.enemies.push({ x, y, ...ENEMY_TYPES.zoomer, alive: true, type: 'zoomer', vx: 40 * (Math.random() > 0.5 ? 1 : -1), vy: 0, onGround: false, timer: 0 });
        else if (ch === 'r') this.enemies.push({ x, y, ...ENEMY_TYPES.rinka, alive: true, type: 'rinka', vx: 30, vy: 20, timer: 0, onGround: false });
        else if (ch === 'e') this.enemies.push({ x, y, ...ENEMY_TYPES.reo, alive: true, type: 'reo', vx: 0, vy: 0, timer: 0, onGround: false });
        else if (ch === 'f') this.enemies.push({ x, y, ...ENEMY_TYPES.zebbo, alive: true, type: 'zebbo', vx: 0, vy: 0, timer: 2, onGround: false });
        else if (ch === 'M') this.items.push({ x, y, type: 'missile', collected: false, icon: 'M', label: t('metroid.missile') });
        else if (ch === 'b') this.items.push({ x, y, type: 'bomb', collected: false, icon: 'B', label: t('metroid.bomb') });
        else if (ch === 'p') this.items.push({ x, y, type: 'morph', collected: false, icon: 'O', label: t('metroid.morphBall') });
        else if (ch === 'j') this.items.push({ x, y, type: 'spacejump', collected: false, icon: 'J', label: t('metroid.spaceJump') });
        else if (ch === 'h') this.items.push({ x, y, type: 'hp', collected: false, icon: '+', label: 'HP+10' });
        else if (ch === 's') this.items.push({ x, y, type: 'speedboost', collected: false, icon: 'S', label: t('metroid.speedBoost') });
        else if (ch === 'a') this.items.push({ x, y, type: 'screwattack', collected: false, icon: 'A', label: t('metroid.screwAttack') });
        else if (ch === 'i') this.items.push({ x, y, type: 'highjump', collected: false, icon: 'H', label: t('metroid.highJump') });
        else if (ch === 'E') this.items.push({ x, y, type: 'energytank', collected: false, icon: 'E', label: t('metroid.energyTank') });
        else if (ch === 'B') { this.bossPresent = true; this._spawnBoss(); }
        else if (ch === 'k') { this.miniBossPresent = true; this._spawnMiniBoss(); }
        else if (ch === 'F') { this.boss2Present = true; this._spawnBoss2(); }
      }
    }

    // Check for connecting doors
    if (room.N >= 0) this.doors.N = true;
    if (room.S >= 0) this.doors.S = true;
    if (room.E >= 0) this.doors.E = true;
    if (room.W >= 0) this.doors.W = true;

    // Check for missile doors in the tilemap
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.tilemap.tileAt(col, row) === T.MISSILE_DOOR) {
          // Mark nearby doors
          if (col === 0) this.missileDoors.W = true;
          if (col === COLS - 1) this.missileDoors.E = true;
          if (row === 0) this.missileDoors.N = true;
          if (row === ROWS - 1) this.missileDoors.S = true;
        }
      }
    }

    this.camera = new Camera(this.width, this.height);
    this._setupPlayer(room);
  }

  _setupPlayer(room) {
    this.player = {
      x: ROOM_W / 2 - 10,
      y: ROOM_H - TILE * 3 - 30,
      width: 18, height: 28,
      vx: 0, vy: 0,
      onGround: false, facing: 1,
      morphed: false,
      invincible: 0,
      alive: true,
      screwActive: false,
    };

    this.coyoteTimer = 0;
    this.bullets = [];
    this.bossBullets = [];
    this.abilityPopup = null;
    this.abilityPopupTimer = 0;
    this.itemPopup = null;
    this.itemPopupTimer = 0;
    this.showMap = false;
    this.speedTimer = 0;
    this.bombPlaced = null;
    this.bombTimer = 0;
    this.fadeTransition = 0;
    this.transitionTarget = null;
    this.enterDir = '';
    this.score = 0;
    this.status = 'playing';
    this.phase = 'playing';
    this.screwEffectTimer = 0;
  }

  // ─── Update ─────────────────────────────────────────────────────────

  update(dt) {
    if (this.phase === 'won' || this.phase === 'lost') {
      if (this.handleRestartInput()) return;
      return;
    }

    if (this.transitionTarget !== null) {
      this.fadeTransition += dt * 3;
      if (this.fadeTransition >= 1) {
        this._loadRoom(this.transitionTarget);
        this.transitionTarget = null;
        this.fadeTransition = 0;
        const room = ROOMS[this.roomId];
        if (this.enterDir === 'N') this.player.y = 20;
        else if (this.enterDir === 'S') this.player.y = ROOM_H - TILE * 2 - 30;
        else if (this.enterDir === 'E') this.player.x = ROOM_W - TILE * 2 - 20;
        else if (this.enterDir === 'W') this.player.x = 20;
      }
      return;
    }

    this._updatePlayer(dt);
    this._updateEnemies(dt);
    this._updateBullets(dt);
    this._updateBomb(dt);
    this._updatePopup(dt);
    this._checkCollisions();
    this._updateCamera();
    this._checkRoomTransition();

    // Update bosses
    if (this.bossPresent && this.boss && this.boss.alive) {
      this._updateBoss(dt);
    }
    if (this.miniBossPresent && this.miniBoss && this.miniBoss.alive) {
      this._updateMiniBoss(dt);
    }
    if (this.boss2Present && this.boss2 && this.boss2.alive) {
      this._updateBoss2(dt);
    }

    // Update particles
    this.particles.update(dt);

    // Screw attack visual effect timer
    if (this.screwEffectTimer > 0) this.screwEffectTimer -= dt;
  }

  _updatePlayer(dt) {
    if (this.player.invincible > 0) this.player.invincible -= dt;
    const left = this.input.isActionDown('moveLeft');
    const right = this.input.isActionDown('moveRight');
    const running = this.input.isActionDown('run');
    const hasSpeed = !!(this.abilities & ABILITY.SPEED_BOOST);
    const speed = (running && hasSpeed) ? RUN_SPEED : WALK_SPEED;

    // Morph ball
    const morphDown = this.input.isActionDown('morph');
    if (morphDown && this.player.onGround && (this.abilities & ABILITY.MORPH_BALL)) {
      this.player.morphed = true;
      this.player.height = 14;
    } else if (!morphDown) {
      this.player.morphed = false;
      this.player.height = 28;
    }

    // Movement
    if (left && !right) { this.player.vx = -speed; this.player.facing = -1; }
    else if (right && !left) { this.player.vx = speed; this.player.facing = 1; }
    else this.player.vx *= 0.8;

    if (this.player.morphed) this.player.vx *= 0.7;

    // Check for ice tiles (slippery)
    const feetCol = Math.floor((this.player.x + this.player.width / 2) / TILE);
    const feetRow = Math.floor((this.player.y + this.player.height + 2) / TILE);
    const onIce = this.tilemap.tileAt(feetCol, feetRow) === T.ICE;
    if (onIce && this.player.onGround) {
      // Reduce friction on ice
      if (!left && !right) this.player.vx *= 0.96;
    }

    // Check for spike tiles
    const spikeRow = Math.floor((this.player.y + this.player.height) / TILE);
    const spikeCol = Math.floor((this.player.x + this.player.width / 2) / TILE);
    const onSpikes = this.tilemap.tileAt(spikeCol, spikeRow) === T.SPIKES;
    if (onSpikes && this.player.onGround) {
      this._takeDamage(1);
    }

    this.player.vy = Math.min(this.player.vy + GRAVITY * dt, MAX_FALL);

    // Jump
    const canJump = this.player.onGround || this.coyoteTimer > 0;
    const canSpaceJump = (this.abilities & ABILITY.SPACE_JUMP) && !this.player.onGround && this.player.vy > 0;
    if (this.input.wasActionPressed('jump')) {
      const jumpVel = (this.abilities & ABILITY.HIGH_JUMP) ? HIGH_JUMP_VEL : JUMP_VEL;
      if (canJump) {
        this.player.vy = jumpVel;
        this.coyoteTimer = 0;
        AudioManager.sfx({ type: 'platformer_jump', volume: 0.2 });
      } else if (canSpaceJump) {
        this.player.vy = SPACE_JUMP_VEL;
        AudioManager.sfx({ type: 'platformer_jump', volume: 0.15 });
      }
    }

    // Shoot missiles
    if (this.input.wasActionPressed('shoot') && (this.abilities & ABILITY.MISSILES) && this.missileCount > 0) {
      this.bullets.push({
        x: this.player.x + (this.player.facing > 0 ? this.player.width : 0),
        y: this.player.y + 10,
        vx: this.player.facing * 350,
        vy: 0,
        radius: 4,
        damage: 10,
        life: 1.5,
        isMissile: true,
      });
      this.missileCount--;
      AudioManager.sfx({ type: 'shoot', volume: 0.3 });
    }

    // Place bomb
    if (this.input.wasActionPressed('bomb') && (this.abilities & ABILITY.BOMBS) && this.bombCount > 0 && !this.bombPlaced) {
      this.bombPlaced = {
        x: this.player.x + 4,
        y: this.player.y + (this.player.morphed ? 2 : this.player.height - 10),
        timer: 1.5,
      };
      this.bombCount--;
      AudioManager.sfx({ type: 'select', volume: 0.2 });
    }

    // Resolve collision with tilemap
    const result = this.tilemap.resolveAABB(this.player, this.player.vx, this.player.vy, dt);
    if (result.onGround || result.onCeiling) this.player.vy = 0;
    this.player.onGround = result.onGround;
    this.coyoteTimer = result.onGround ? COYOTE : Math.max(0, this.coyoteTimer - dt);

    this.player.x = clamp(this.player.x, 0, ROOM_W - this.player.width);
    this.player.y = clamp(this.player.y, 0, ROOM_H - this.player.height);

    // Fall death
    if (this.player.y > ROOM_H + 50) this._takeDamage(999);
  }

  _updateEnemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      switch (e.type) {
        case 'zoomer':
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          const yResult = this.tilemap.resolveAABB(e, 0, e.vy, dt);
          if (yResult.onGround || yResult.onCeiling) e.vy = 0;
          e.onGround = yResult.onGround;
          if (!e.onGround) e.vy += GRAVITY * dt;
          if (e.x < 0 || e.x > ROOM_W - e.width) e.vx *= -1;
          break;
        case 'rinka': {
          e.timer += dt;
          e.x += Math.cos(e.timer * 1.5) * e.vx * dt;
          e.y += Math.sin(e.timer * 2) * e.vy * dt;
          if (e.x < 20 || e.x > ROOM_W - 20) e.vx *= -1;
          if (e.y < 20 || e.y > ROOM_H - 20) e.vy *= -1;
          break;
        }
        case 'reo': {
          // Chases player
          const dx = this.player.x - e.x;
          const dy = this.player.y - e.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0) {
            const chaseSpeed = 60;
            e.x += (dx / dist) * chaseSpeed * dt;
            e.y += (dy / dist) * chaseSpeed * dt;
          }
          break;
        }
        case 'zebbo': {
          // Spits fireballs
          e.timer -= dt;
          if (e.timer <= 0) {
            e.timer = 3;
            // Spit fireball toward player
            this.bossBullets.push({
              x: e.x + e.width / 2,
              y: e.y + e.height,
              vx: (this.player.x - e.x) * 0.3,
              vy: 100,
              radius: 4,
              alive: true,
              damage: 1,
            });
          }
          break;
        }
      }
    }
    this.enemies = this.enemies.filter(e => e.alive);
  }

  _updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.life -= dt;
      const col = Math.floor((b.x + b.radius) / TILE);
      const row = Math.floor((b.y + b.radius) / TILE);
      const tile = this.tilemap.tileAt(col, row);
      if (this.tilemap.isSolidTile(tile)) {
        // Missile doors: destroy with missile hit
        if (tile === T.MISSILE_DOOR) {
          this.tilemap.data[row][col] = T.EMPTY;
          this.particles.emitBurst(col * TILE + TILE / 2, row * TILE + TILE / 2, '#6a4a8a', 12);
          AudioManager.sfx({ type: 'explosion', volume: 0.3 });
          b.life = 0;
          this.score += 10;
        } else {
          b.life = 0;
        }
      }
    }
    this.bullets = this.bullets.filter(b => b.life > 0 && b.x > -50 && b.x < ROOM_W + 50);

    // Boss bullets
    if (this.bossBullets) {
      for (const b of this.bossBullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y > ROOM_H + 20 || b.x < -50 || b.x > ROOM_W + 50) b.alive = false;
      }
      this.bossBullets = this.bossBullets.filter(b => b.alive);
    }
  }

  _updateBomb(dt) {
    if (!this.bombPlaced) return;
    this.bombPlaced.timer -= dt;
    if (this.bombPlaced.timer <= 0) {
      const bx = this.bombPlaced.x;
      const by = this.bombPlaced.y;
      this.particles.emitBurst(bx + 8, by + 8, '#ff6b4a', 20);
      AudioManager.sfx({ type: 'explosion', volume: 0.5 });
      HapticManager.vibrate('explosion');

      const radius = TILE * 2;
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (this.tilemap.tileAt(col, row) !== T.CRACKED) continue;
          const tx = col * TILE, ty = row * TILE;
          if (Math.abs(tx - bx) < radius && Math.abs(ty - by) < radius) {
            this.tilemap.data[row][col] = T.EMPTY;
            this.particles.emitBurst(tx + TILE / 2, ty + TILE / 2, '#7c5c3a', 8);
          }
        }
      }

      // Damage enemies in radius
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.abs(e.x + e.width / 2 - bx - 8) < radius && Math.abs(e.y + e.height / 2 - by - 8) < radius) {
          e.alive = false;
          this.particles.emitBurst(e.x + e.width / 2, e.y + e.height / 2, '#ff6b4a', 8);
        }
      }

      if (this.bossPresent && this.boss) this.boss.hp -= 15;
      if (this.miniBossPresent && this.miniBoss) this.miniBoss.hp -= 20;
      if (this.boss2Present && this.boss2) this.boss2.hp -= 10;

      this.bombPlaced = null;
    }
  }

  _updatePopup(dt) {
    if (this.abilityPopupTimer > 0) {
      this.abilityPopupTimer -= dt;
      if (this.abilityPopupTimer <= 0) this.abilityPopup = null;
    }
    if (this.itemPopupTimer > 0) {
      this.itemPopupTimer -= dt;
      if (this.itemPopupTimer <= 0) this.itemPopup = null;
    }
  }

  _updateCamera() {
    this.camera.x = clamp(this.player.x - this.width * 0.35, 0, Math.max(0, ROOM_W - this.width));
    this.camera.y = 0;
  }

  // ─── Room Transitions ───────────────────────────────────────────────

  _checkRoomTransition() {
    if (this.transitionTarget !== null) return;
    const margin = 8;
    const room = ROOMS[this.roomId];

    // Check missile doors — need missiles to pass
    const hasMissiles = !!(this.abilities & ABILITY.MISSILES);

    if (this.doors.N && this.player.y < -margin &&
        this.player.x > COLS * TILE * 0.2 && this.player.x < COLS * TILE * 0.8) {
      if (this.missileDoors.N && !hasMissiles) {
        // Blocked by missile door
        this.player.y = 5;
        this._showMessage('metroid.needMissiles');
        return;
      }
      if (room.N >= 0) { this.transitionTarget = room.N; this.enterDir = 'S'; return; }
    }
    if (this.doors.S && this.player.y > ROOM_H - margin) {
      if (this.missileDoors.S && !hasMissiles) {
        this.player.y = ROOM_H - 10;
        this._showMessage('metroid.needMissiles');
        return;
      }
      if (room.S >= 0) { this.transitionTarget = room.S; this.enterDir = 'N'; return; }
    }
    if (this.doors.E && this.player.x > ROOM_W - margin) {
      if (this.missileDoors.E && !hasMissiles) {
        this.player.x = ROOM_W - 10;
        this._showMessage('metroid.needMissiles');
        return;
      }
      if (room.E >= 0) { this.transitionTarget = room.E; this.enterDir = 'W'; return; }
    }
    if (this.doors.W && this.player.x < -margin) {
      if (this.missileDoors.W && !hasMissiles) {
        this.player.x = 5;
        this._showMessage('metroid.needMissiles');
        return;
      }
      if (room.W >= 0) { this.transitionTarget = room.W; this.enterDir = 'E'; return; }
    }
    this.player.x = clamp(this.player.x, 0, ROOM_W - this.player.width);
    this.player.y = clamp(this.player.y, 0, ROOM_H - this.player.height);
  }

  _showMessage(key) {
    this.abilityPopup = t(key);
    this.abilityPopupTimer = 1.5;
  }

  // ─── Collisions ─────────────────────────────────────────────────────

  _checkCollisions() {
    const pBox = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };
    const screwAttack = !!(this.abilities & ABILITY.SCREW_ATTACK);

    // Bullets vs enemies
    for (const b of this.bullets) {
      if (!b.isMissile) continue;
      const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const eBox = { x: e.x, y: e.y, width: e.width, height: e.height };
        if (aabbIntersects(bBox, eBox)) {
          b.life = 0;
          e.hp -= b.damage;
          this.particles.emitBurst(e.x + e.width / 2, e.y + e.height / 2, '#ffb454', 4);
          if (e.hp <= 0) {
            e.alive = false;
            this.particles.emitBurst(e.x + e.width / 2, e.y + e.height / 2, '#ff6b4a', 10);
            this.score += 50;
          }
          break;
        }
      }
    }

    // Enemies vs player
    if (this.player.invincible <= 0) {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const eBox = { x: e.x, y: e.y, width: e.width, height: e.height };
        if (!aabbIntersects(pBox, eBox)) continue;

        // Screw Attack: kill on contact
        if (screwAttack && this.player.vy < 0) {
          e.alive = false;
          this.player.vy = -300;
          this.particles.emitBurst(e.x + e.width / 2, e.y + e.height / 2, '#4a9eff', 8);
          this.score += 100;
          this.screwEffectTimer = 0.3;
          continue;
        }

        // Stomp (only zoomers)
        if (this.player.vy > 0 && this.player.y + this.player.height - e.y < 16 && (e.type === 'zoomer' || e.type === 'zebbo')) {
          e.alive = false;
          this.player.vy = -250;
          this.particles.emitBurst(e.x + e.width / 2, e.y + e.height / 2, '#ff6b4a', 6);
          this.score += 100;
        } else {
          this._takeDamage(e.damage || 1);
        }
        break;
      }
    }

    // Player vs items
    for (const item of this.items) {
      if (item.collected) continue;
      const iBox = { x: item.x, y: item.y, width: TILE, height: TILE };
      if (!aabbIntersects(pBox, iBox)) continue;
      item.collected = true;
      this._collectItem(item);
    }

    // Player vs bosses
    if (this.bossPresent && this.boss && this.boss.alive) {
      this._checkBossCollision(this.boss);
      // Bullets vs boss
      for (const b of this.bullets) {
        if (!b.isMissile) continue;
        const bBBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
        const bBox = { x: this.boss.x, y: this.boss.y, width: this.boss.width, height: this.boss.height };
        if (aabbIntersects(bBBox, bBox)) {
          b.life = 0;
          this._damageBoss(this.boss, b.damage);
        }
      }
    }
    if (this.miniBossPresent && this.miniBoss && this.miniBoss.alive) {
      this._checkBossCollision(this.miniBoss);
      for (const b of this.bullets) {
        if (!b.isMissile) continue;
        const bBBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
        const bBox = { x: this.miniBoss.x, y: this.miniBoss.y, width: this.miniBoss.width, height: this.miniBoss.height };
        if (aabbIntersects(bBBox, bBox)) {
          b.life = 0;
          this._damageBoss(this.miniBoss, b.damage);
        }
      }
    }
    if (this.boss2Present && this.boss2 && this.boss2.alive) {
      this._checkBossCollision(this.boss2);
      for (const b of this.bullets) {
        if (!b.isMissile) continue;
        const bBBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
        const bBox = { x: this.boss2.x, y: this.boss2.y, width: this.boss2.width, height: this.boss2.height };
        if (aabbIntersects(bBBox, bBox)) {
          b.life = 0;
          this._damageBoss(this.boss2, b.damage);
        }
      }
    }
  }

  _checkBossCollision(boss) {
    if (this.player.invincible > 0) return;
    const pBox = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };
    const bBox = { x: boss.x, y: boss.y, width: boss.width, height: boss.height };
    if (aabbIntersects(pBox, bBox)) {
      this._takeDamage(1);
    }
  }

  _damageBoss(boss, damage) {
    boss.hp -= damage;
    this.particles.emitBurst(boss.x + boss.width / 2, boss.y + boss.height / 2, '#ffb454', 6);
    if (boss.hp <= 0) {
      boss.alive = false;
      this.particles.emitBurst(boss.x + boss.width / 2, boss.y + boss.height / 2, '#ffd700', 30);
      AudioManager.sfx({ type: 'powerup', volume: 0.6 });
      HapticManager.vibrate('powerup');
      this.score += 2000;
      this._onBossDefeated(boss);
    }
  }

  _onBossDefeated(boss) {
    if (boss === this.boss) {
      this.bossDefeated = true;
      this.storage.set('bossDefeated', true);
      this._endGame(true);
    } else if (boss === this.miniBoss) {
      this.miniBossDefeated = true;
      this.storage.set('miniBossDefeated', true);
      this._showMessage('metroid.miniBossDefeated');
      this.score += 1000;
      // Drop items
      this.items.push({ x: boss.x + 20, y: boss.y + 30, type: 'energytank', collected: false, icon: 'E', label: t('metroid.energyTank') });
      this.items.push({ x: boss.x + 60, y: boss.y + 30, type: 'bomb', collected: false, icon: 'B', label: t('metroid.bomb') });
    } else if (boss === this.boss2) {
      this.bossDefeated = true;
      this.storage.set('bossDefeated', true);
      this._endGame(true);
    }
  }

  _collectItem(item) {
    AudioManager.sfx({ type: 'powerup', volume: 0.4 });
    HapticManager.vibrate('powerup');
    this.particles.emitBurst(item.x + TILE / 2, item.y + TILE / 2, '#ffd700', 8);

    switch (item.type) {
      case 'morph':
        this.abilities |= ABILITY.MORPH_BALL;
        this.abilityPopup = t('metroid.morphBall');
        this.abilityPopupTimer = 2;
        this.score += 500;
        break;
      case 'missile':
        this.abilities |= ABILITY.MISSILES;
        this.maxMissiles += 5;
        this.missileCount = Math.max(this.missileCount, this.maxMissiles);
        this.abilityPopup = t('metroid.missile');
        this.abilityPopupTimer = 2;
        this.score += 500;
        break;
      case 'bomb':
        this.abilities |= ABILITY.BOMBS;
        this.bombCount += 3;
        this.abilityPopup = t('metroid.bomb');
        this.abilityPopupTimer = 2;
        this.score += 500;
        break;
      case 'spacejump':
        this.abilities |= ABILITY.SPACE_JUMP;
        this.abilityPopup = t('metroid.spaceJump');
        this.abilityPopupTimer = 2;
        this.score += 500;
        break;
      case 'speedboost':
        this.abilities |= ABILITY.SPEED_BOOST;
        this.abilityPopup = t('metroid.speedBoost');
        this.abilityPopupTimer = 2;
        this.score += 500;
        break;
      case 'screwattack':
        this.abilities |= ABILITY.SCREW_ATTACK;
        this.abilityPopup = t('metroid.screwAttack');
        this.abilityPopupTimer = 2;
        this.score += 500;
        break;
      case 'highjump':
        this.abilities |= ABILITY.HIGH_JUMP;
        this.abilityPopup = t('metroid.highJump');
        this.abilityPopupTimer = 2;
        this.score += 500;
        break;
      case 'energytank':
        this.maxHp = Math.min(this.maxHp + 50, 200);
        this.hp = Math.min(this.hp + 50, this.maxHp);
        this.itemPopup = 'E-TANK: HP+50';
        this.itemPopupTimer = 2;
        this.score += 1000;
        break;
      case 'hp':
        this.hp = Math.min(this.hp + 10, this.maxHp);
        this.itemPopup = 'HP +10';
        this.itemPopupTimer = 1.5;
        this.score += 200;
        break;
    }
  }

  _takeDamage(amount) {
    if (this.player.invincible > 0) return;
    this.hp -= amount;
    this.player.invincible = 1.5;
    this.player.vx *= -3;
    this.player.vy = -200;
    this.particles.emitBurst(this.player.x + 9, this.player.y + 14, '#ff4d4d', 6);
    AudioManager.sfx({ type: 'hit', volume: 0.3 });
    HapticManager.vibrate('hit');
    if (this.hp <= 0) this._endGame(false);
  }

  // ─── Boss 1: Giant Beetle (original) ────────────────────────────────

  _spawnBoss() {
    this.boss = {
      x: ROOM_W / 2 - 40, y: 40,
      width: 80, height: 60,
      hp: 50, maxHp: 50,
      alive: true,
      dir: 1,
      speed: 80,
      fireTimer: 2,
      phase: 1,
    };
    this.bossBullets = [];
    this.score += 1000;
  }

  _updateBoss(dt) {
    if (!this.boss || !this.boss.alive) return;
    this.boss.x += this.boss.speed * this.boss.dir * dt;
    if (this.boss.x < 40 || this.boss.x > ROOM_W - 40 - this.boss.width) this.boss.dir *= -1;
    this.boss.y += Math.sin(Date.now() * 0.004) * 40 * dt;
    this.boss.fireTimer -= dt;
    if (this.boss.fireTimer <= 0) {
      this.boss.fireTimer = Math.max(0.5, 1.5 - this.boss.hp / this.boss.maxHp);
      for (let i = 0; i < 3; i++) {
        this.bossBullets.push({
          x: this.boss.x + this.boss.width / 2 + (i - 1) * 20,
          y: this.boss.y + this.boss.height,
          vx: (i - 1) * 60,
          vy: 120,
          radius: 5,
          alive: true,
          damage: 1,
        });
      }
    }
    // Boss bullets vs player
    for (const b of this.bossBullets) {
      if (!b.alive) continue;
      const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
      const pBox = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };
      if (aabbIntersects(bBox, pBox)) {
        b.alive = false;
        this._takeDamage(b.damage || 1);
      }
    }
  }

  // ─── Mini-Boss: Kraid ─────────────────────────────────────────────

  _spawnMiniBoss() {
    this.miniBoss = {
      x: ROOM_W / 2 - 50, y: 30,
      width: 100, height: 80,
      hp: 80, maxHp: 80,
      alive: true,
      dir: 1,
      fireTimer: 1.5,
      spikeTimer: 3,
      armRaised: false,
    };
    this.score += 500;
  }

  _updateMiniBoss(dt) {
    if (!this.miniBoss || !this.miniBoss.alive) return;
    // Kraid bobs up and down
    this.miniBoss.y = 30 + Math.sin(Date.now() * 0.003) * 20;

    // Fire nails (phase 1)
    this.miniBoss.fireTimer -= dt;
    if (this.miniBoss.fireTimer <= 0) {
      this.miniBoss.fireTimer = this.miniBoss.hp < this.miniBoss.maxHp * 0.4 ? 0.8 : 1.5;
      for (let i = 0; i < (this.miniBoss.hp < this.miniBoss.maxHp * 0.4 ? 5 : 3); i++) {
        this.bossBullets.push({
          x: this.miniBoss.x + 20 + i * 15,
          y: this.miniBoss.y + this.miniBoss.height,
          vx: (i - 2) * 40,
          vy: 150 + i * 20,
          radius: 4,
          alive: true,
          damage: 1,
        });
      }
    }

    // Floor spikes (phase 2)
    if (this.miniBoss.hp < this.miniBoss.maxHp * 0.6) {
      this.miniBoss.spikeTimer -= dt;
      if (this.miniBoss.spikeTimer <= 0) {
        this.miniBoss.spikeTimer = 2;
        for (let i = 0; i < 3; i++) {
          const sx = 100 + Math.random() * (ROOM_W - 200);
          this.bossBullets.push({
            x: sx,
            y: ROOM_H - 40,
            vx: 0,
            vy: -200,
            radius: 5,
            alive: true,
            damage: 1,
          });
        }
      }
    }

    // Bullets vs player
    for (const b of this.bossBullets) {
      if (!b.alive) continue;
      const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
      const pBox = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };
      if (aabbIntersects(bBox, pBox)) {
        b.alive = false;
        this._takeDamage(1);
      }
    }
  }

  // ─── Boss 2: Ridley (final boss) ──────────────────────────────────

  _spawnBoss2() {
    this.boss2 = {
      x: ROOM_W / 2 - 45, y: 30,
      width: 90, height: 70,
      hp: 120, maxHp: 120,
      alive: true,
      phase: 1,
      swoopTimer: 2,
      fireTimer: 1,
      swooping: false,
      swoopTarget: { x: 0, y: 0 },
      speed: 150,
    };
    this.bossBullets = [];
    this.score += 2000;
  }

  _updateBoss2(dt) {
    if (!this.boss2 || !this.boss2.alive) return;

    const hpPct = this.boss2.hp / this.boss2.maxHp;
    this.boss2.phase = hpPct < 0.3 ? 3 : hpPct < 0.6 ? 2 : 1;

    if (this.boss2.swooping) {
      // Swoop toward target
      const dx = this.boss2.swoopTarget.x - this.boss2.x;
      const dy = this.boss2.swoopTarget.y - this.boss2.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 30) {
        this.boss2.swooping = false;
        this.boss2.swoopTimer = 1 + Math.random() * 0.5;
      } else {
        const swoopSpeed = this.boss2.speed * (this.boss2.phase === 3 ? 2 : 1.5);
        this.boss2.x += (dx / dist) * swoopSpeed * dt;
        this.boss2.y += (dy / dist) * swoopSpeed * dt;
      }
    } else {
      // Hover
      this.boss2.y = 30 + Math.sin(Date.now() * 0.002) * 25;
      this.boss2.x += Math.sin(Date.now() * 0.003) * 30 * dt;

      // Swoop attack
      this.boss2.swoopTimer -= dt;
      if (this.boss2.swoopTimer <= 0) {
        this.boss2.swooping = true;
        this.boss2.swoopTarget = {
          x: this.player.x + this.player.width / 2,
          y: this.player.y + 20,
        };
      }

      // Fire breath
      this.boss2.fireTimer -= dt;
      if (this.boss2.fireTimer <= 0) {
        this.boss2.fireTimer = this.boss2.phase === 3 ? 0.3 : this.boss2.phase === 2 ? 0.6 : 1;
        const count = this.boss2.phase === 3 ? 5 : 3;
        for (let i = 0; i < count; i++) {
          const spread = (i - (count - 1) / 2) * 0.15;
          this.bossBullets.push({
            x: this.boss2.x + this.boss2.width / 2,
            y: this.boss2.y + this.boss2.height,
            vx: Math.sin(spread) * 180 + (this.player.x - this.boss2.x) * 0.15,
            vy: 100 + Math.cos(spread) * 80,
            radius: 5,
            alive: true,
            damage: 2,
          });
        }
      }

      // Boundary
      this.boss2.x = clamp(this.boss2.x, 30, ROOM_W - this.boss2.width - 30);
    }

    // Boss bullets vs player
    for (const b of this.bossBullets) {
      if (!b.alive) continue;
      const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
      const pBox = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };
      if (aabbIntersects(bBox, pBox)) {
        b.alive = false;
        this._takeDamage(b.damage || 1);
      }
    }
  }

  _endGame(won) {
    this.status = won ? 'won' : 'lost';
    this.phase = won ? 'won' : 'lost';
    const score = this.score + this.hp * 10 + this.missileCount * 5 + this.bombCount * 3;
    if (score > this.highscore) {
      this.highscore = score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('metroid-like', score, won, duration);
    if (won) ProgressionManager.checkAchievement('metroid-like', 'boss-slayer');
    if (this.abilities & ABILITY.SPACE_JUMP) ProgressionManager.checkAchievement('metroid-like', 'explorer');
    if (this.abilities & ABILITY.BOMBS) ProgressionManager.checkAchievement('metroid-like', 'demolition');
    if (this.abilities & ABILITY.SCREW_ATTACK) ProgressionManager.checkAchievement('metroid-like', 'screw-attack');
  }

  // ─── Render ─────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Fade transition
    if (this.transitionTarget !== null) {
      ctx.fillStyle = '#000';
      ctx.globalAlpha = this.fadeTransition;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
      return;
    }

    ctx.save();
    this.camera.apply(ctx);

    // Background
    let bgColors = ['#0a1a2a', '#0a2a1a', '#0a1a2a'];
    if (this.bossPresent) bgColors = ['#1a0a1a', '#2a0a2a', '#1a0a1a'];
    if (this.boss2Present) bgColors = ['#1a0a0a', '#2a0a0a', '#1a0a0a'];
    if (this.miniBossPresent) bgColors = ['#1a1a0a', '#2a2a0a', '#1a1a0a'];
    const grad = ctx.createLinearGradient ? ctx.createLinearGradient(0, 0, 0, ROOM_H) : null;
    if (grad) {
      grad.addColorStop(0, bgColors[0]);
      grad.addColorStop(0.5, bgColors[1]);
      grad.addColorStop(2, bgColors[2]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = bgColors[0];
    }
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);

    // Tilemap
    const vp = { x: this.camera.x, y: this.camera.y, width: this.camera.width, height: this.camera.height };
    this.tilemap.render(ctx, vp, {
      [T.GROUND]: '#3a4552', [T.PLATFORM]: '#5a5a3a',
      [T.CRACKED]: '#5a3a3a', [T.SPEED_BLOCK]: '#3a5a5a',
      [T.SPIKES]: '#8a2a2a', [T.ICE]: '#3a7a7a',
      [T.MISSILE_DOOR]: '#4a2a6a',
    });

    // Draw cracked block cracks
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tile = this.tilemap.tileAt(col, row);
        if (tile === T.CRACKED) {
          ctx.fillStyle = '#5a3a3a';
          ctx.fillRect(col * TILE + 4, row * TILE + 4, 4, 4);
          ctx.fillRect(col * TILE + 20, row * TILE + 20, 8, 4);
        } else if (tile === T.SPIKES) {
          // Draw spikes
          ctx.fillStyle = '#8a2a2a';
          for (let s = 0; s < 4; s++) {
            ctx.beginPath();
            ctx.moveTo(col * TILE + s * 8, row * TILE + TILE);
            ctx.lineTo(col * TILE + s * 8 + 4, row * TILE + TILE - 8);
            ctx.lineTo(col * TILE + s * 8 + 8, row * TILE + TILE);
            ctx.fill();
          }
        } else if (tile === T.ICE) {
          ctx.fillStyle = '#3a7a7a';
          ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
          ctx.fillStyle = '#5a9a9a';
          ctx.fillRect(col * TILE + 4, row * TILE + 4, TILE - 8, 2);
          ctx.fillRect(col * TILE + 8, row * TILE + 12, TILE - 16, 2);
        } else if (tile === T.MISSILE_DOOR) {
          ctx.fillStyle = '#4a2a6a';
          ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
          ctx.fillStyle = '#6a4a8a';
          ctx.fillRect(col * TILE + 4, row * TILE + 4, TILE - 8, TILE - 8);
          ctx.fillStyle = '#8a6aaa';
          ctx.fillRect(col * TILE + TILE / 2 - 3, row * TILE + TILE / 2 - 3, 6, 6);
        } else if (tile === T.SPEED_BLOCK) {
          ctx.fillStyle = Math.sin(Date.now() * 0.005 + col + row) > 0 ? '#3a5a5a' : '#2a4a4a';
          ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
          ctx.strokeStyle = '#4a7a7a';
          ctx.lineWidth = 1;
          ctx.strokeRect(col * TILE + 2, row * TILE + 2, TILE - 4, TILE - 4);
        }
      }
    }

    // Door indicators
    const doorColor = this.bossPresent || this.boss2Present ? '#ff4d4d' : '#4a9eff';
    ctx.fillStyle = doorColor;
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.doors.N) ctx.fillText('▲', this.camera.x + this.width / 2, this.camera.y + 14);
    if (this.doors.S) ctx.fillText('▼', this.camera.x + this.width / 2, this.camera.y + this.height - 14);
    if (this.doors.E) ctx.fillText('▶', this.camera.x + this.width - 14, this.camera.y + this.height / 2);
    if (this.doors.W) ctx.fillText('◀', this.camera.x + 14, this.camera.y + this.height / 2);

    // Missile door markers
    ctx.fillStyle = '#6a4a8a';
    ctx.font = '14px monospace';
    if (this.missileDoors.N && this.doors.N) ctx.fillText('◆', this.camera.x + this.width / 2, this.camera.y + 26);
    if (this.missileDoors.S && this.doors.S) ctx.fillText('◆', this.camera.x + this.width / 2, this.camera.y + this.height - 26);
    if (this.missileDoors.E && this.doors.E) ctx.fillText('◆', this.camera.x + this.width - 26, this.camera.y + this.height / 2);
    if (this.missileDoors.W && this.doors.W) ctx.fillText('◆', this.camera.x + 26, this.camera.y + this.height / 2);

    // Items
    for (const item of this.items) {
      if (item.collected) continue;
      const pulse = Math.sin(Date.now() * 0.006 + item.x) * 4;
      ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.005 + item.x) * 0.4;
      ctx.fillStyle = item.type === 'energytank' ? '#4a9eff' : '#ffd700';
      ctx.beginPath();
      ctx.arc(item.x + TILE / 2, item.y + TILE / 2 + pulse, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.icon, item.x + TILE / 2, item.y + TILE / 2 + pulse + 1);
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = e.color;
      if (e.type === 'zoomer') {
        ctx.beginPath();
        ctx.arc(e.x + e.width / 2, e.y + e.height / 2, e.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(e.x + 5, e.y + 5, 3, 3);
        ctx.fillRect(e.x + e.width - 8, e.y + 5, 3, 3);
      } else if (e.type === 'rinka') {
        ctx.beginPath();
        ctx.arc(e.x + e.width / 2, e.y + e.height / 2, e.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (e.type === 'reo') {
        ctx.beginPath();
        ctx.moveTo(e.x + e.width / 2, e.y + 4);
        ctx.lineTo(e.x + e.width, e.y + e.height / 2);
        ctx.lineTo(e.x + e.width / 2, e.y + e.height - 4);
        ctx.lineTo(e.x, e.y + e.height / 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ff4d4d';
        ctx.beginPath();
        ctx.arc(e.x + e.width / 2, e.y + e.height / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'zebbo') {
        ctx.fillRect(e.x, e.y, e.width, e.height);
        ctx.fillStyle = '#2a4a2a';
        ctx.fillRect(e.x + 2, e.y + 4, 4, 4);
        ctx.fillRect(e.x + e.width - 6, e.y + 4, 4, 4);
      }
    }

    // Bomb indicator
    if (this.bombPlaced) {
      ctx.fillStyle = `rgba(255, 100, 50, ${0.5 + Math.sin(this.bombPlaced.timer * 8) * 0.5})`;
      ctx.fillRect(this.bombPlaced.x, this.bombPlaced.y, 8, 8);
    }

    // Render bosses
    this._renderBoss(ctx);
    this._renderMiniBoss(ctx);
    this._renderBoss2(ctx);

    // Bullets
    for (const b of this.bullets) {
      ctx.fillStyle = b.isMissile ? '#ff4d4d' : '#ff6b4a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boss bullets
    if (this.bossBullets) {
      for (const b of this.bossBullets) {
        if (!b.alive) continue;
        ctx.fillStyle = '#ff6b4a';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffb454';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player
    if (this.player.invincible <= 0 || Math.floor(this.player.invincible * 10) % 2 === 0) {
      const px = this.player.x, py = this.player.y;
      if (this.player.morphed) {
        ctx.fillStyle = '#4a9eff';
        ctx.beginPath();
        ctx.arc(px + 9, py + 7, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a7aef';
        ctx.beginPath();
        ctx.arc(px + 9, py + 7, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Screw attack glow
        if (this.abilities & ABILITY.SCREW_ATTACK) {
          ctx.shadowColor = '#4a9eff';
          ctx.shadowBlur = this.screwEffectTimer > 0 ? 20 : 8;
        }
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(px + 2, py + 2, 14, 18);
        ctx.fillStyle = '#d4a574';
        ctx.beginPath();
        ctx.arc(px + 9, py + 4, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(px + 4, py + 20, 4, 8);
        ctx.fillRect(px + 10, py + 20, 4, 8);
        ctx.fillStyle = '#4a9eff';
        ctx.fillRect(px + (this.player.facing > 0 ? 16 : -4), py + 6, 6, 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(px + 5 + this.player.facing * 2, py + 3, 3, 3);
        ctx.fillRect(px + 9 + this.player.facing * 2, py + 3, 3, 3);
        ctx.fillStyle = '#000';
        ctx.fillRect(px + 6 + this.player.facing * 2, py + 4, 2, 2);
        ctx.fillRect(px + 10 + this.player.facing * 2, py + 4, 2, 2);
        ctx.shadowBlur = 0;
      }
    }

    // Particles
    for (const p of this.particles.particles) {
      if (!p.alive) continue;
      ctx.globalAlpha = Math.max(0, p.life / (p.maxLife || 0.7));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // ── HUD (screen coords) ─────────────────────────────────────────
    setupHUDContext(ctx);

    // HP bar
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(t('metroid.hp', { n: this.hp, m: this.maxHp }), 10, 14);
    const hpBarW = 100;
    ctx.fillStyle = '#2a1a1a';
    ctx.fillRect(10, 20, hpBarW, 6);
    ctx.fillStyle = this.hp > this.maxHp * 0.4 ? '#3a9a5a' : this.hp > this.maxHp * 0.2 ? '#ffb454' : '#ff4d4d';
    ctx.fillRect(11, 21, (hpBarW - 2) * Math.max(0, this.hp / this.maxHp), 4);

    ctx.fillStyle = '#4a9eff';
    ctx.font = '11px monospace';
    ctx.fillText(t('metroid.missiles', { n: this.missileCount }), 10, 34);

    ctx.fillStyle = '#ff6b4a';
    ctx.fillText(t('metroid.bombs', { n: this.bombCount }), 10, 48);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(t('game.score', { n: this.score }), this.width - 140, 14);

    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.fillText(t('metroid.area', { n: Math.floor(this.roomId / 3) + 1 }), this.width - 140, 30);

    // ── Minimap (top right) ─────────────────────────────────────────
    const mapGridW = 5;
    const mapGridH = 6;
    const mapW = 120;
    const mapH = 120;
    const mapX = this.width - mapW - 8;
    const mapY = 50;
    const cellW = mapW / mapGridW;
    const cellH = mapH / mapGridH;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeStyle = '#4a5a6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    for (let r = 0; r < ROOMS.length; r++) {
      const room = ROOMS[r];
      const cx = mapX + room.gridX * cellW + cellW / 2;
      const cy = mapY + room.gridY * cellH + cellH / 2;
      if (this.explored[r]) {
        ctx.fillStyle = r === this.roomId ? '#ffd700' : '#3a6a4a';
        ctx.fillRect(cx - cellW / 2 + 1, cy - cellH / 2 + 1, cellW - 2, cellH - 2);
        ctx.strokeStyle = '#5a7a6a';
        ctx.lineWidth = 1;
        if (room.N >= 0 && this.explored[room.N]) {
          ctx.beginPath(); ctx.moveTo(cx, cy - cellH / 2);
          ctx.lineTo(cx, cy - cellH / 2 - 3); ctx.stroke();
        }
        if (room.S >= 0 && this.explored[room.S]) {
          ctx.beginPath(); ctx.moveTo(cx, cy + cellH / 2);
          ctx.lineTo(cx, cy + cellH / 2 + 3); ctx.stroke();
        }
        if (room.E >= 0 && this.explored[room.E]) {
          ctx.beginPath(); ctx.moveTo(cx + cellW / 2, cy);
          ctx.lineTo(cx + cellW / 2 + 3, cy); ctx.stroke();
        }
        if (room.W >= 0 && this.explored[room.W]) {
          ctx.beginPath(); ctx.moveTo(cx - cellW / 2, cy);
          ctx.lineTo(cx - cellW / 2 - 3, cy); ctx.stroke();
        }
      }
    }

    const currentRoom = ROOMS[this.roomId];
    const pcx = mapX + currentRoom.gridX * cellW + cellW / 2;
    const pcy = mapY + currentRoom.gridY * cellH + cellH / 2;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(pcx, pcy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5a7a6a';
    ctx.font = '9px monospace';
    ctx.fillText(t('metroid.map'), mapX + 4, mapY - 2);

    // Abilities indicator
    if (this.abilities > 0) {
      ctx.fillStyle = '#4a6a5a';
      ctx.font = '9px monospace';
      let abils = '';
      if (this.abilities & ABILITY.MORPH_BALL) abils += 'O ';
      if (this.abilities & ABILITY.MISSILES) abils += 'M ';
      if (this.abilities & ABILITY.BOMBS) abils += 'B ';
      if (this.abilities & ABILITY.SPACE_JUMP) abils += 'J ';
      if (this.abilities & ABILITY.SPEED_BOOST) abils += 'S ';
      if (this.abilities & ABILITY.SCREW_ATTACK) abils += 'A ';
      if (this.abilities & ABILITY.HIGH_JUMP) abils += 'H ';
      ctx.fillText(abils.trim(), 10, 62);
    }

    // Ability popup
    if (this.abilityPopup && this.abilityPopupTimer > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(this.width / 2 - 130, 60, 260, 40);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('metroid.powerup') + ' ' + this.abilityPopup, this.width / 2, 80);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    if (this.itemPopup && this.itemPopupTimer > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(this.width / 2 - 90, 60, 180, 30);
      ctx.fillStyle = '#48a848';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('metroid.item') + ' ' + this.itemPopup, this.width / 2, 75);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Boss warning
    if (this.bossPresent) {
      ctx.fillStyle = '#ff4d4d';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(t('metroid.boss'), this.width / 2, 4);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    if (this.boss2Present) {
      ctx.fillStyle = '#ff4d4d';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(t('metroid.finalBoss'), this.width / 2, 20);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    if (this.miniBossPresent) {
      ctx.fillStyle = '#ffb454';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(t('metroid.miniBoss'), this.width / 2, 36);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    if (this.highscore > 0) {
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.fillText(t('game.record', { n: this.highscore }), 10, this.height - 10);
    }

    if (this.phase === 'won' || this.phase === 'lost') {
      renderOverlay(ctx, {
        width: this.width, height: this.height,
        title: this.phase === 'won' ? t('game.victory') : t('game.defeat'),
        score: this.score,
        actionText: t('game.restart'),
      });
    }
  }

  // ─── Boss renders ──────────────────────────────────────────────────

  _renderBoss(ctx) {
    if (!this.boss || !this.boss.alive) return;
    const hpPct = this.boss.hp / this.boss.maxHp;
    ctx.fillStyle = hpPct < 0.3 ? '#ff4d4d' : '#8b3a8b';
    ctx.fillRect(this.boss.x, this.boss.y, this.boss.width, this.boss.height);
    ctx.fillStyle = '#3a1a3a';
    ctx.fillRect(this.boss.x + 10, this.boss.y + 8, this.boss.width - 20, 10);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(this.boss.x + 18, this.boss.y + 18, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.arc(this.boss.x + this.boss.width - 18, this.boss.y + 18, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(this.boss.x + 18, this.boss.y + 18, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.arc(this.boss.x + this.boss.width - 18, this.boss.y + 18, 3, 0, Math.PI * 2);
    ctx.fill();
    const barW = this.boss.width;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.boss.x, this.boss.y - 8, barW, 4);
    ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : '#ff6b4a';
    ctx.fillRect(this.boss.x + 1, this.boss.y - 7, (barW - 2) * hpPct, 3);
  }

  _renderMiniBoss(ctx) {
    if (!this.miniBoss || !this.miniBoss.alive) return;
    const hpPct = this.miniBoss.hp / this.miniBoss.maxHp;
    // Body
    ctx.fillStyle = '#5a7a3a';
    ctx.fillRect(this.miniBoss.x, this.miniBoss.y + 20, this.miniBoss.width, this.miniBoss.height - 20);
    // Head
    ctx.fillStyle = '#4a6a2a';
    ctx.fillRect(this.miniBoss.x + 20, this.miniBoss.y, this.miniBoss.width - 40, 30);
    // Eyes
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(this.miniBoss.x + 25, this.miniBoss.y + 8, 8, 8);
    ctx.fillRect(this.miniBoss.x + this.miniBoss.width - 33, this.miniBoss.y + 8, 8, 8);
    ctx.fillStyle = '#000';
    ctx.fillRect(this.miniBoss.x + 28, this.miniBoss.y + 10, 4, 4);
    ctx.fillRect(this.miniBoss.x + this.miniBoss.width - 30, this.miniBoss.y + 10, 4, 4);
    // Mouth with teeth
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(this.miniBoss.x + 30, this.miniBoss.y + 22, this.miniBoss.width - 60, 8);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(this.miniBoss.x + 32 + i * 10, this.miniBoss.y + 22, 4, 4);
    }
    // HP bar
    const barW = this.miniBoss.width;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.miniBoss.x, this.miniBoss.y - 8, barW, 4);
    ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : '#ff6b4a';
    ctx.fillRect(this.miniBoss.x + 1, this.miniBoss.y - 7, (barW - 2) * hpPct, 3);
  }

  _renderBoss2(ctx) {
    if (!this.boss2 || !this.boss2.alive) return;
    const hpPct = this.boss2.hp / this.boss2.maxHp;
    // Body (with ellipse fallback for mock canvas)
    ctx.fillStyle = this.boss2.phase >= 3 ? '#8a2a2a' : this.boss2.phase === 2 ? '#6a3a3a' : '#4a3a3a';
    if (ctx.ellipse) {
      ctx.beginPath();
      ctx.ellipse(this.boss2.x + this.boss2.width / 2, this.boss2.y + this.boss2.height / 2,
        this.boss2.width / 2, this.boss2.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Fallback: rounded rect approximation
      const r = this.boss2.width / 2;
      ctx.fillRect(this.boss2.x, this.boss2.y, this.boss2.width, this.boss2.height);
    }
    // Wings
    ctx.fillStyle = this.boss2.phase >= 3 ? '#6a1a1a' : '#3a2a3a';
    ctx.beginPath();
    ctx.moveTo(this.boss2.x + 10, this.boss2.y + 10);
    ctx.lineTo(this.boss2.x - 15, this.boss2.y + 5);
    ctx.lineTo(this.boss2.x + 5, this.boss2.y + 25);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(this.boss2.x + this.boss2.width - 10, this.boss2.y + 10);
    ctx.lineTo(this.boss2.x + this.boss2.width + 15, this.boss2.y + 5);
    ctx.lineTo(this.boss2.x + this.boss2.width - 5, this.boss2.y + 25);
    ctx.closePath();
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(this.boss2.x + 20, this.boss2.y + 20, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.arc(this.boss2.x + this.boss2.width - 20, this.boss2.y + 20, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(this.boss2.x + 20, this.boss2.y + 20, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.arc(this.boss2.x + this.boss2.width - 20, this.boss2.y + 20, 3, 0, Math.PI * 2);
    ctx.fill();
    // Mouth (flame breath)
    ctx.fillStyle = this.boss2.swooping ? '#ff4d4d' : '#8a4a2a';
    ctx.beginPath();
    ctx.arc(this.boss2.x + this.boss2.width / 2 - 5, this.boss2.y + 45, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.boss2.x + this.boss2.width / 2 + 5, this.boss2.y + 45, 6, 0, Math.PI * 2);
    ctx.fill();
    // HP bar
    const barW = this.boss2.width;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.boss2.x, this.boss2.y - 12, barW, 4);
    ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : '#ff6b4a';
    ctx.fillRect(this.boss2.x + 1, this.boss2.y - 11, (barW - 2) * hpPct, 3);
  }

}
