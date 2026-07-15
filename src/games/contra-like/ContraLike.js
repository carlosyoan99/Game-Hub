/**
 * Contra-like (Run & Gun)
 * Nivel 3 — Run & Gun avanzado
 *
 * Mecánica: scroll lateral automático con plataformas. El jugador
 * se mueve en 8 direcciones, salta y dispara. Power-ups de armas
 * caen de enemigos. Oleadas de enemigos con jefes intermedios.
 */
import { GameBase } from '../../engine/GameBase.js';
import { Tilemap } from '../../engine/Tilemap.js';
import { Camera } from '../../engine/Camera.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { aabbIntersects, clamp } from '../../engine/CollisionUtils.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

const TILE = 32;
const GRAVITY = 1200;
const MAX_FALL = 800;
const MOVE_SPEED = 180;
const JUMP_VEL = -400;

const WEAPONS = {
  DEFAULT: { name: 'DEFAULT', fireRate: 0.2, damage: 1, spread: 0, speed: 500, color: '#f0e6b3' },
  SPREAD:  { name: 'SPREAD',  fireRate: 0.25, damage: 1, spread: 3, speed: 450, color: '#ff6b4a' },
  MACHINE: { name: 'MACHINE', fireRate: 0.08, damage: 1, spread: 0, speed: 550, color: '#4a9eff' },
  LASER:   { name: 'LASER',   fireRate: 0.15, damage: 2, spread: 0, speed: 700, color: '#ff4d4d' },
  FIRE:    { name: 'FIRE',    fireRate: 0.3,  damage: 3, spread: 1, speed: 400, color: '#ffb454' },
};

const STAGE_LENGTH = 6400; // px de scroll total por nivel
const SCROLL_SPEED = 80;
const BOSS_SCROLL_X = 5600;

// ── Stage layouts (ASCII) ──────────────────────────────────────────────
// Each stage: ground (#), platforms (=), gaps (.), spawn markers
const STAGES = [
  // Stage 1: Jungle
  {
    scrollSpeed: SCROLL_SPEED,
    rows: [
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '.........=====.............=====..................',
      '..................................................',
      '.......................................=====......',
      '............=====..................................',
      '..................................................',
      '.....=====.............=====......................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '...............................................G.',
      '#################################################',
      '#################################################',
      '#################################################',
    ],
    enemies: [
      { type: 'soldier', atX: 600,  count: 3, interval: 0.8 },
      { type: 'soldier', atX: 1200, count: 4, interval: 0.6 },
      { type: 'turret',  atX: 1800, count: 1, interval: 0 },
      { type: 'soldier', atX: 2400, count: 5, interval: 0.5 },
      { type: 'runner',  atX: 3000, count: 3, interval: 0.4 },
      { type: 'turret',  atX: 3600, count: 2, interval: 0 },
      { type: 'soldier', atX: 4000, count: 6, interval: 0.4 },
      { type: 'runner',  atX: 4500, count: 4, interval: 0.3 },
    ],
    boss: { type: 'tank', hp: 15, pattern: 'spread' },
  },
  // Stage 2: Base
  {
    scrollSpeed: SCROLL_SPEED + 10,
    rows: [
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..........=====............=====..................',
      '..................................................',
      '..................................................',
      '.....=====.............=====......................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '....................=====..........................',
      '............=====..................................',
      '..................................................',
      '................................................G.',
      '###########.....###################.....##########',
      '###########.....###################.....##########',
      '###########.....###################.....##########',
    ],
    enemies: [
      { type: 'soldier', atX: 800,  count: 4, interval: 0.6 },
      { type: 'runner',  atX: 1400, count: 3, interval: 0.5 },
      { type: 'turret',  atX: 2000, count: 2, interval: 0 },
      { type: 'soldier', atX: 2600, count: 5, interval: 0.5 },
      { type: 'runner',  atX: 3200, count: 4, interval: 0.4 },
      { type: 'turret',  atX: 3800, count: 2, interval: 0 },
      { type: 'soldier', atX: 4200, count: 6, interval: 0.3 },
      { type: 'runner',  atX: 4800, count: 4, interval: 0.3 },
    ],
    boss: { type: 'helicopter', hp: 20, pattern: 'targeted' },
  },
  // Stage 3: Alien Lair
  {
    scrollSpeed: SCROLL_SPEED + 20,
    rows: [
      '..................................................',
      '..................................................',
      '..................................................',
      '.......=====.........................................',
      '..................................................',
      '..................................................',
      '...................=====...........................',
      '..................................................',
      '..................................................',
      '...........=====...................................',
      '..................................................',
      '..................................................',
      '..........................................=====...',
      '..................................................',
      '.............=====.................................',
      '..................................................',
      '................................................G.',
      '###....#######....#######....#######....#########',
      '###....#######....#######....#######....#########',
      '###....#######....#######....#######....#########',
    ],
    enemies: [
      { type: 'soldier', atX: 600,  count: 5, interval: 0.5 },
      { type: 'runner',  atX: 1200, count: 4, interval: 0.4 },
      { type: 'turret',  atX: 1800, count: 3, interval: 0 },
      { type: 'soldier', atX: 2400, count: 6, interval: 0.4 },
      { type: 'runner',  atX: 3000, count: 5, interval: 0.3 },
      { type: 'turret',  atX: 3600, count: 2, interval: 0 },
      { type: 'soldier', atX: 4000, count: 7, interval: 0.3 },
      { type: 'runner',  atX: 4600, count: 5, interval: 0.25 },
    ],
    boss: { type: 'alien', hp: 25, pattern: 'spiral' },
  },
];

const MAX_STAGE = STAGES.length;
const LEGEND = { '#': 1, '=': 2 };

export class ContraLike extends GameBase {
  init(engine) {
    super.init(engine, 'contra-like');
    this.highscore = this.storage.get('highscore', 0);
    this.currentStage = this.storage.get('savedStage', 1);
    this.startTime = Date.now();
    this._loadStage();
  }

  _defaultBindings() {
    return {
      moveLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      moveUp:    ['ArrowUp', 'KeyW', 'GamepadUp', 'GamepadLStickUp'],
      moveDown:  ['ArrowDown', 'KeyS', 'GamepadDown', 'GamepadLStickDown'],
      jump:      ['Space', 'KeyK', 'GamepadX'],
      fire:      ['KeyJ', 'MouseLeft', 'GamepadA'],
      switchWeapon: ['KeyL', 'GamepadY'],
      restart:   ['Space', 'GamepadStart', 'GamepadA'],
      next:      ['Space', 'GamepadA', 'GamepadStart'],
    };
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this.camera.resize(width, height);
  }

  _loadStage() {
    const idx = Math.min(this.currentStage - 1, STAGES.length - 1);
    const stage = STAGES[idx];
    const data = Tilemap.parseAscii(stage.rows, LEGEND);
    this.tilemap = new Tilemap({ data, tileSize: TILE, solidTiles: new Set([1]) });
    this.camera = new Camera(this.width, this.height);

    this.goalX = STAGE_LENGTH - TILE * 4;
    this.stageScroll = 0;
    this.scrollSpeed = stage.scrollSpeed;
    this.stageConfig = stage;

    this._restart();
  }

  _restart() {
    this.player = {
      x: 60, y: TILE * 14,
      width: 20, height: 28,
      vx: 0, vy: 0,
      onGround: false, facing: 1,
      lives: 3,
      weapon: 'DEFAULT',
      invincible: 0,
      dead: false,
      respawnTimer: 0,
    };
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.powerups = [];
    this.boss = null;
    this.bossBullets = [];
    this.enemySpawnTimer = {};
    this.spawnedZones = new Set();
    this.score = 0;
    this.status = 'playing';
    this.phase = 'playing';
    this.scrollX = 0;
    this.stageCleared = false;
    this.fireTimer = 0;
    this.enemyBullets = [];

    // Inicializar timers de spawn
    for (const zone of this.stageConfig.enemies) {
      this.enemySpawnTimer[zone.atX] = { count: 0, timer: 0, total: zone.count, interval: zone.interval };
    }
  }

  // ── Update ────────────────────────────────────────────────────────────

  update(dt) {
    if (this.phase === 'level-complete') {
      if (this.input.wasActionPressed('next') || this.input.mouse.clickedThisFrame) this._nextStage();
      return;
    }
    if (this.handleRestartInput()) return;

    // Auto-scroll
    this.scrollX += this.scrollSpeed * dt;
    this.scrollX = Math.min(this.scrollX, STAGE_LENGTH - this.width);

    // Respawn delay
    if (this.player.dead) {
      this.player.respawnTimer -= dt;
      if (this.player.respawnTimer <= 0) {
        if (this.player.lives > 0) {
          this.player.dead = false;
          this.player.x = this.scrollX + 40;
          this.player.y = TILE * 14;
          this.player.vx = 0; this.player.vy = 0;
          this.player.invincible = 2;
        }
      }
      return;
    }

    // Check boss zone
    if (this.scrollX >= BOSS_SCROLL_X && !this.boss && !this.stageCleared) {
      this._spawnBoss();
    }

    this._updatePlayer(dt);
    this._updateBullets(dt);
    this._updateFireTimer(dt);
    this._updateEnemies(dt);
    this._spawnEnemies();
    this._updateBoss(dt);
    this._updatePowerups(dt);
    this._updateParticles(dt);
    this.enemyBullets = (this.enemyBullets || []).filter(b => b.alive);
    this._checkCollisions();
  }

  _updatePlayer(dt) {
    if (this.player.invincible > 0) this.player.invincible -= dt;

    // 8-direction movement relative to camera
    const left = this.input.isActionDown('moveLeft');
    const right = this.input.isActionDown('moveRight');
    const up = this.input.isActionDown('moveUp');
    const down = this.input.isActionDown('moveDown');

    let mx = 0, my = 0;
    if (left && !right) { mx = -1; this.player.facing = -1; }
    else if (right && !left) { mx = 1; this.player.facing = 1; }
    if (up && !down) my = -0.7;
    else if (down && !up) my = 0.7;

    // If in air, only horizontal movement
    if (!this.player.onGround && my < 0) my = 0;

    this.player.vx = mx * MOVE_SPEED;
    this.player.vy += GRAVITY * dt;
    if (my > 0 && this.player.onGround) {
      // Crouch / go down through thin platforms
    }
    if (my < 0 && this.player.onGround) {
      // Can't jump upward with key, uses separate jump button
    }

    // Jump
    if (this.input.wasActionPressed('jump') && this.player.onGround) {
      this.player.vy = JUMP_VEL;
      this.player.onGround = false;
      AudioManager.sfx({ type: 'platformer_jump', volume: 0.25 });
    }

    this.player.vy = Math.min(this.player.vy, MAX_FALL);
    const result = this.tilemap.resolveAABB(this.player, this.player.vx, this.player.vy, dt);
    if (result.onGround || result.onCeiling) this.player.vy = 0;
    this.player.onGround = result.onGround;

    // Clamp to stage bounds (relative to scroll)
    const minX = this.scrollX;
    const maxX = minX + this.width - this.player.width;
    this.player.x = clamp(this.player.x, minX, STAGE_LENGTH - this.player.width);
    this.player.y = clamp(this.player.y, 0, this.tilemap.pixelHeight - this.player.height);

    // Fall death
    if (this.player.y > this.tilemap.pixelHeight + 50) {
      this._playerDeath();
    }

    // Fire weapon
    if (this.input.isActionDown('fire')) {
      this._fireBullet();
    }

    // Switch weapon
    if (this.input.wasActionPressed('switchWeapon')) {
      const weapons = ['DEFAULT', 'SPREAD', 'MACHINE', 'LASER', 'FIRE'];
      const idx = weapons.indexOf(this.player.weapon);
      this.player.weapon = weapons[(idx + 1) % weapons.length];
    }
  }

  _fireBullet() {
    const w = WEAPONS[this.player.weapon];
    if (this.fireTimer > 0) return;
    this.fireTimer = w.fireRate;

    const bx = this.player.x + (this.player.facing > 0 ? this.player.width : 0);
    const by = this.player.y + 12;
    AudioManager.sfx({ type: 'shoot', volume: 0.15 });

    if (w.spread > 0) {
      for (let i = 0; i <= w.spread; i++) {
        const angle = (i / w.spread - 0.5) * 0.4;
        this.bullets.push({
          x: bx, y: by,
          vx: Math.cos(angle) * w.speed * this.player.facing,
          vy: Math.sin(angle) * w.speed,
          damage: w.damage, radius: 3,
          color: w.color, life: 1.5, alive: true,
        });
      }
    } else {
      this.bullets.push({
        x: bx, y: by,
        vx: w.speed * this.player.facing,
        vy: 0,
        damage: w.damage, radius: 3,
        color: w.color, life: 1.5, alive: true,
      });
    }
  }

  _updateBullets(dt) {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < this.scrollX || b.x > this.scrollX + this.width + 20) b.alive = false;

      // Check tile collision
      const col = Math.floor(b.x / TILE);
      const row = Math.floor(b.y / TILE);
      if (this.tilemap.isSolidTile(this.tilemap.tileAt(col, row))) b.alive = false;
    }
    this.bullets = this.bullets.filter(b => b.alive);
  }

  _spawnEnemies() {
    const camCenter = this.scrollX + this.width / 2;
    for (const zone of this.stageConfig.enemies) {
      if (this.spawnedZones.has(zone.atX)) continue;
      if (camCenter < zone.atX - 100) continue;

      const state = this.enemySpawnTimer[zone.atX];
      if (!state) continue;
      state.timer -= 1/60;
      if (state.timer <= 0 && state.count < state.total) {
        this._spawnEnemy(zone.type, zone.atX);
        state.count++;
        state.timer = state.interval;
      }
      if (state.count >= state.total) {
        this.spawnedZones.add(zone.atX);
      }
    }
  }

  _spawnEnemy(type, atX) {
    const wy = TILE * 14; // ground level
    switch (type) {
      case 'soldier':
        this.enemies.push({
          x: atX, y: wy,
          width: 22, height: 26,
          vx: -60 - Math.random() * 30,
          vy: 0,
          hp: 2, maxHp: 2,
          alive: true, type: 'soldier',
          fireTimer: 1 + Math.random(),
          onGround: false,
          color: '#6b8e3a',
        });
        break;
      case 'runner':
        this.enemies.push({
          x: atX, y: wy,
          width: 20, height: 24,
          vx: -120 - Math.random() * 40,
          vy: 0,
          hp: 1, maxHp: 1,
          alive: true, type: 'runner',
          fireTimer: 0,
          onGround: false,
          color: '#c84848',
        });
        break;
      case 'turret':
        this.enemies.push({
          x: atX, y: wy - 24,
          width: 24, height: 24,
          vx: 0, vy: 0,
          hp: 4, maxHp: 4,
          alive: true, type: 'turret',
          fireTimer: 1.5,
          onGround: true,
          color: '#7c5c7c',
        });
        break;
    }
  }

  _updateFireTimer(dt) {
    if (this.fireTimer > 0) this.fireTimer -= dt;
  }

  _updateEnemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) continue;

      // Gravity
      e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);
      e.x += e.vx * dt;
      const result = this.tilemap.resolveAABB(e, e.vx, 0, dt);
      e.y += e.vy * dt;
      const yResult = this.tilemap.resolveAABB(e, 0, e.vy, dt);
      if (yResult.onGround || yResult.onCeiling) e.vy = 0;
      e.onGround = yResult.onGround;

      // Clamp to playable area
      if (e.x < this.scrollX - 60 || e.x > this.scrollX + this.width + 60) {
        e.alive = false;
        continue;
      }

      // Turret or soldier shooting
      if (e.type === 'turret' || e.type === 'soldier') {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = e.type === 'turret' ? 1.5 : 1 + Math.random() * 1.5;
          this.enemyBullets = this.enemyBullets || [];
          this.enemyBullets.push({
            x: e.x + e.width / 2,
            y: e.y + e.height / 2,
            vx: (this.player.x - e.x) / Math.abs(this.player.x - e.x || 1) * 150,
            vy: 80,
            radius: 3,
            alive: true,
            color: '#ff4d4d',
          });
        }
      }
    }
    this.enemies = this.enemies.filter(e => e.alive);
  }

  _updatePowerups(dt) {
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      pu.y += pu.vy * dt;
      pu.vy += 400 * dt;
      const col = Math.floor((pu.x + pu.width / 2) / TILE);
      const row = Math.floor((pu.y + pu.height) / TILE);
      if (this.tilemap.isSolidTile(this.tilemap.tileAt(col, row))) {
        pu.vy = 0;
      }
      if (pu.y > this.tilemap.pixelHeight) pu.active = false;
    }
    this.powerups = this.powerups.filter(p => p.active);
  }

  _updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  // ── Boss ──────────────────────────────────────────────────────────────

  _spawnBoss() {
    const cfg = this.stageConfig.boss;
    this.boss = {
      x: BOSS_SCROLL_X + 200, y: TILE * 10,
      width: 60, height: 48,
      hp: cfg.hp, maxHp: cfg.hp,
      alive: true,
      type: cfg.type,
      pattern: cfg.pattern,
      dir: -1,
      speed: 60,
      fireTimer: 1.5,
      phase: 1,
    };
    this.bossBullets = [];
    this.scrollSpeed = 0; // Stop scrolling for boss fight
    AudioManager.sfx({ type: 'powerup', volume: 0.5 });
  }

  _updateBoss(dt) {
    if (!this.boss || !this.boss.alive) return;

    // Movement pattern
    this.boss.x += this.boss.speed * this.boss.dir * dt;
    if (this.boss.x < BOSS_SCROLL_X + 100) { this.boss.dir = 1; }
    if (this.boss.x > BOSS_SCROLL_X + 400) { this.boss.dir = -1; }

    // Y movement
    this.boss.y += Math.sin(Date.now() * 0.003) * 30 * dt;

    // Boss attacks
    this.boss.fireTimer -= dt;
    if (this.boss.fireTimer <= 0) {
      this.boss.fireTimer = this.boss.hp < this.boss.maxHp / 2 ? 0.8 : 1.2;

      switch (this.boss.pattern) {
        case 'spread':
          for (let i = 0; i < 5; i++) {
            const angle = -Math.PI / 2 + (i - 2) * 0.35;
            this.bossBullets.push({
              x: this.boss.x + this.boss.width / 2,
              y: this.boss.y + this.boss.height,
              vx: Math.cos(angle) * 180,
              vy: Math.sin(angle) * 180,
              radius: 4, alive: true, color: '#ff4d4d',
            });
          }
          break;
        case 'targeted':
          for (let i = 0; i < 3; i++) {
            const dx = this.player.x - this.boss.x;
            const dy = this.player.y - this.boss.y;
            const dist = Math.hypot(dx, dy) || 1;
            this.bossBullets.push({
              x: this.boss.x + this.boss.width / 2 + (i - 1) * 10,
              y: this.boss.y + this.boss.height,
              vx: (dx / dist) * 200 + (i - 1) * 30,
              vy: (dy / dist) * 200,
              radius: 4, alive: true, color: '#ff6b4a',
            });
          }
          break;
        case 'spiral':
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + Date.now() * 0.005;
            this.bossBullets.push({
              x: this.boss.x + this.boss.width / 2,
              y: this.boss.y + this.boss.height / 2,
              vx: Math.cos(angle) * 150,
              vy: Math.sin(angle) * 150,
              radius: 4, alive: true, color: '#ffb454',
            });
          }
          break;
      }
      AudioManager.sfx({ type: 'shoot', volume: 0.3 });
    }

    // Update boss bullets
    for (const b of this.bossBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > this.tilemap.pixelHeight + 20 || b.x < this.scrollX - 20 || b.x > this.scrollX + this.width + 20) {
        b.alive = false;
      }
    }
    this.bossBullets = this.bossBullets.filter(b => b.alive);
  }

  _renderBoss(ctx) {
    if (!this.boss || !this.boss.alive) return;

    const b = this.boss;
    const hpPct = b.hp / b.maxHp;
    const isEnraged = hpPct < 0.5;

    // Body
    ctx.fillStyle = isEnraged ? '#ff4d4d' : '#6b3a8e';
    ctx.fillRect(b.x, b.y, b.width, b.height);

    // Details
    ctx.fillStyle = '#2a1a3a';
    ctx.fillRect(b.x + 10, b.y + 8, b.width - 20, 8);
    ctx.fillRect(b.x + 15, b.y + 20, 6, 6);
    ctx.fillRect(b.x + b.width - 21, b.y + 20, 6, 6);

    // Eyes
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(b.x + 18, b.y + 14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x + b.width - 18, b.y + 14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(b.x + 18, b.y + 14, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x + b.width - 18, b.y + 14, 2, 0, Math.PI * 2);
    ctx.fill();

    // HP bar
    const barW = b.width;
    const barH = 5;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(b.x, b.y - 10, barW, barH);
    ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : '#ff6b4a';
    ctx.fillRect(b.x, b.y - 10, barW * hpPct, barH);

    // Boss bullets
    for (const bl of this.bossBullets) {
      if (!bl.alive) continue;
      ctx.fillStyle = bl.color;
      ctx.beginPath();
      ctx.arc(bl.x, bl.y, bl.radius, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      ctx.fillStyle = bl.color + '40';
      ctx.beginPath();
      ctx.arc(bl.x, bl.y, bl.radius * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Collisions ────────────────────────────────────────────────────────

  _checkCollisions() {
    const pBox = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };

    // Player bullets vs enemies
    for (const b of this.bullets) {
      if (!b.alive) continue;
      const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };

      for (const e of this.enemies) {
        if (!e.alive) continue;
        const eBox = { x: e.x, y: e.y, width: e.width, height: e.height };
        if (aabbIntersects(bBox, eBox)) {
          b.alive = false;
          e.hp -= b.damage;
          this._spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#ffb454', 4);
          if (e.hp <= 0) {
            e.alive = false;
            this.score += e.type === 'turret' ? 200 : 100;
            this._spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#ff6b4a', 10);

            // Drop powerup (20% chance)
            if (Math.random() < 0.2) {
              const weapons = ['SPREAD', 'MACHINE', 'LASER', 'FIRE'];
              this.powerups.push({
                x: e.x, y: e.y,
                width: 16, height: 16,
                vy: -100,
                weapon: weapons[Math.floor(Math.random() * weapons.length)],
                active: true,
                color: '#ffd700',
              });
            }
          }
          break;
        }
      }

      // Player bullets vs boss
      if (this.boss && this.boss.alive && aabbIntersects(bBox, this.boss)) {
        b.alive = false;
        this.boss.hp -= b.damage;
        this._spawnParticles(this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#ffb454', 6);
        if (this.boss.hp <= 0) {
          this.boss.alive = false;
          this.score += 1000;
          this._spawnParticles(this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#ffd700', 30);
          AudioManager.sfx({ type: 'explosion', volume: 0.5 });
          HapticManager.vibrate('explosion');
          this._clearStage();
        }
      }
    }

    // Enemy bullets vs player
    if (!this.player.dead && this.player.invincible <= 0) {
      const enemyBullets = this.enemyBullets || [];
      for (const b of enemyBullets) {
        if (!b.alive) continue;
        const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
        if (aabbIntersects(pBox, bBox)) {
          b.alive = false;
          this._playerHit();
          break;
        }
      }

      // Enemies vs player
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const eBox = { x: e.x, y: e.y, width: e.width, height: e.height };
        if (aabbIntersects(pBox, eBox)) {
          this._playerHit();
          break;
        }
      }

      // Boss vs player
      if (this.boss && this.boss.alive) {
        if (aabbIntersects(pBox, this.boss)) {
          this._playerHit();
        }
        for (const b of this.bossBullets) {
          if (!b.alive) continue;
          const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
          if (aabbIntersects(pBox, bBox)) {
            b.alive = false;
            this._playerHit();
            break;
          }
        }
      }
    }

    // Player vs powerups
    if (!this.player.dead) {
      for (const pu of this.powerups) {
        if (!pu.active) continue;
        const puBox = { x: pu.x, y: pu.y, width: pu.width, height: pu.height };
        if (aabbIntersects(pBox, puBox)) {
          pu.active = false;
          this.player.weapon = pu.weapon;
          this._spawnParticles(pu.x + 8, pu.y + 8, '#ffd700', 8);
          AudioManager.sfx({ type: 'powerup', volume: 0.4 });
          HapticManager.vibrate('powerup');
        }
      }
    }

    // Check goal
    if (!this.boss && this.player.x >= this.goalX && !this.stageCleared) {
      this._clearStage();
    }
  }

  _playerHit() {
    if (this.player.invincible > 0 || this.player.dead) return;
    this.player.invincible = 1.5;
    this.score -= 50;
    AudioManager.sfx({ type: 'hit', volume: 0.4 });
    HapticManager.vibrate('hit');
    this._spawnParticles(this.player.x + 10, this.player.y + 14, '#ff4d4d', 6);
  }

  _playerDeath() {
    this.player.dead = true;
    this.player.lives--;
    this.player.respawnTimer = 2;
    AudioManager.sfx({ type: 'explosion', volume: 0.5 });
    HapticManager.vibrate('explosion');
    this._spawnParticles(this.player.x + 10, this.player.y + 14, '#ff6b4a', 15);

    if (this.player.lives <= 0) {
      this._endGame(false);
    }
  }

  _clearStage() {
    this.stageCleared = true;
    if (this.currentStage >= 1) ProgressionManager.checkAchievement('contra-like', 'first-stage');
    if (this.currentStage >= MAX_STAGE) {
      this._endGame(true);
    } else {
      this.phase = 'level-complete';
      AudioManager.sfx({ type: 'powerup', volume: 0.5 });
      HapticManager.vibrate('powerup');
    }
  }

  _nextStage() {
    this.currentStage++;
    this.storage.set('savedStage', this.currentStage);
    this._loadStage();
  }

  _endGame(won) {
    this.status = won ? 'won' : 'lost';
    this.phase = won ? 'won' : 'lost';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('contra-like', this.score, won, duration);
    ProgressionManager.checkAchievement('contra-like', won ? 'game-cleared' : 'first-stage');
    if (this.currentStage >= 3) ProgressionManager.checkAchievement('contra-like', 'contra-master');
  }

  _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 200,
        vy: -Math.random() * 200 - 50,
        life: 0.3 + Math.random() * 0.4,
        color,
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    this.camera.x = this.scrollX;
    this.camera.y = 0;
    this.camera.apply(ctx);

    const vp = { x: this.scrollX, y: 0, width: this.width, height: this.height };
    this.tilemap.render(ctx, vp, { 1: '#3a4552', 2: '#5a5a3a' });

    // Platforms (tile type 2)
    for (let row = 0; row < this.tilemap.rows; row++) {
      for (let col = 0; col < this.tilemap.cols; col++) {
        if (this.tilemap.tileAt(col, row) === 2) {
          ctx.fillStyle = '#5a5a3a';
          ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
          ctx.strokeStyle = '#4a4a2a';
          ctx.lineWidth = 1;
          ctx.strokeRect(col * TILE, row * TILE, TILE, TILE);
        }
      }
    }

    // Powerups
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      const pulse = Math.sin(Date.now() * 0.006) * 3;
      ctx.fillStyle = pu.color;
      ctx.beginPath();
      ctx.arc(pu.x + 8, pu.y + 8 + pulse, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pu.weapon[0], pu.x + 8, pu.y + 8 + pulse + 1);
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.type === 'turret') {
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x, e.y, e.width, e.height);
        ctx.fillStyle = '#3a2a3a';
        ctx.fillRect(e.x + 4, e.y + 4, e.width - 8, 4);
        ctx.fillRect(e.x + 4, e.y + e.height - 8, e.width - 8, 4);
        // Barrel
        ctx.fillStyle = '#4a3a4a';
        const aimDir = this.player.x < e.x ? -1 : 1;
        ctx.fillRect(e.x + e.width / 2 - 2 + (aimDir > 0 ? e.width / 2 : -e.width / 2), e.y + 8, aimDir > 0 ? 12 : -12, 4);
      } else if (e.type === 'runner') {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x + e.width / 2, e.y + e.height / 2, e.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(e.x + 6, e.y + 8, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x + e.width - 6, e.y + 8, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x, e.y, e.width, e.height);
        ctx.fillStyle = '#4a6a2a';
        ctx.fillRect(e.x + 2, e.y + 4, e.width - 4, 6);
        ctx.fillRect(e.x + 2, e.y + 16, e.width - 4, 6);
        ctx.fillStyle = '#fff';
        ctx.fillRect(e.x + 5, e.y + 6, 3, 3);
        ctx.fillRect(e.x + e.width - 8, e.y + 6, 3, 3);
      }

      // HP bar for turrets
      if (e.type === 'turret' && e.hp < e.maxHp) {
        const hpW = e.width;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x, e.y - 4, hpW, 3);
        ctx.fillStyle = e.hp > e.maxHp / 2 ? '#3a9a5a' : '#ff6b4a';
        ctx.fillRect(e.x + 1, e.y - 3, (hpW - 2) * (e.hp / e.maxHp), 2);
      }
    }

    // Enemy bullets
    const enemyBullets = this.enemyBullets || [];
    for (const b of enemyBullets) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boss
    this._renderBoss(ctx);

    // Player bullets
    for (const b of this.bullets) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.color + '60';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    if (!this.player.dead) {
      const shouldDraw = !(this.player.invincible > 0 && Math.floor(this.player.invincible * 10) % 2 === 0);
      if (shouldDraw) {
        const px = this.player.x, py = this.player.y;
        ctx.fillStyle = '#e7edf3';
        ctx.fillRect(px + 2, py + 2, 16, 8);
        ctx.fillRect(px + 4, py + 8, 12, 16);
        ctx.fillStyle = '#c84848';
        ctx.fillRect(px + 1, py - 2, 18, 6);

        // Gun
        const gunX = this.player.facing > 0 ? px + 18 : px - 6;
        ctx.fillStyle = '#7c8894';
        ctx.fillRect(gunX, py + 6, 6, 4);
      }
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // ── HUD (screen coords) ────────────────────────────────────────────
    setupHUDContext(ctx);
    ctx.fillText(t('contra.score', { n: this.score }), 10, 10);
    ctx.fillText(t('contra.lives', { n: this.player.lives }), 10, 28);
    ctx.fillText(t('contra.stage', { n: this.currentStage }), this.width / 2 - 50, 10);
    ctx.fillText(t('contra.weapon', { w: this.player.weapon }), this.width - 160, 10);

    // Stage progress bar
    const progW = this.width - 40;
    const progX = 20;
    const progY = this.height - 16;
    const progress = Math.min(1, this.scrollX / BOSS_SCROLL_X);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(progX, progY, progW, 6);
    ctx.fillStyle = progress >= 1 ? '#ffd700' : '#4a9eff';
    ctx.fillRect(progX + 1, progY + 1, (progW - 2) * progress, 4);

    // Boss warning
    if (this.boss && this.boss.alive) {
      ctx.fillStyle = '#ff4d4d';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(t('contra.boss'), this.width / 2, 46);
      ctx.textAlign = 'left';
    }

    if (this.highscore > 0) {
      ctx.fillText(t('game.record', { n: this.highscore }), this.width / 2 - 50, 28);
    }

    // ── Overlays ───────────────────────────────────────────────────────
    if (this.phase === 'level-complete') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('game.levelComplete'), this.width / 2, this.height / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillText(t('game.continue'), this.width / 2, this.height / 2 + 15);
      ctx.textAlign = 'left';
    }

    if (this.phase === 'won' || this.phase === 'lost') {
      const title = this.phase === 'won' ? t('contra.victory') : t('contra.gameOver');
      renderOverlay(ctx, { width: this.width, height: this.height, title, score: this.score });
    }
  }

}
