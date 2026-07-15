/**
 * Golden Axe-like (Beat'em Up)
 * Nivel 4 — Hack & Slash lateral con scroll automático
 *
 * Mecánica: 3 personajes jugables, scroll lateral automático,
 * enemigos que aparecen de ambos lados, sistema de magia con
 * pociones, combos, y jefes al final de cada etapa.
 */
import { GameBase } from '../../engine/GameBase.js';
import { Camera } from '../../engine/Camera.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { aabbIntersects, clamp } from '../../engine/CollisionUtils.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ─── Personajes ─────────────────────────────────────────────────────

const CHAR_DEFS = [
  {
    id: 'warrior', name: 'Gilius',
    color: '#6b3a8e', skinColor: '#d4a574',
    hp: 120, speed: 140, jumpVel: -380,
    attackDamage: 12, attackRange: 40,
    specialDamage: 20, specialRange: 50,
    magicBase: 30, magicCost: 8,
    desc: 'HP alto, daño fuerte',
  },
  {
    id: 'amazon', name: 'Tyris',
    color: '#c84848', skinColor: '#e8c898',
    hp: 90, speed: 180, jumpVel: -420,
    attackDamage: 8, attackRange: 35,
    specialDamage: 15, specialRange: 60,
    magicBase: 40, magicCost: 6,
    desc: 'Rápida, magia potente',
  },
  {
    id: 'dwarf', name: 'Ax',
    color: '#4a7a4a', skinColor: '#c48c5c',
    hp: 140, speed: 110, jumpVel: -350,
    attackDamage: 15, attackRange: 35,
    specialDamage: 25, specialRange: 45,
    magicBase: 20, magicCost: 10,
    desc: 'Tanque, daño brutal',
  },
  {
    id: 'wizard', name: 'Zyn',
    color: '#3a4a8e', skinColor: '#d4c8a0',
    hp: 70, speed: 130, jumpVel: -380,
    attackDamage: 6, attackRange: 30,
    specialDamage: 18, specialRange: 80,
    magicBase: 60, magicCost: 4,
    desc: 'Magia potente, proyectiles',
  },
  {
    id: 'barbarian', name: 'Krom',
    color: '#8e5a2a', skinColor: '#c8905c',
    hp: 130, speed: 155, jumpVel: -400,
    attackDamage: 18, attackRange: 32,
    specialDamage: 28, specialRange: 42,
    magicBase: 15, magicCost: 12,
    desc: 'Frenesí berserker a baja HP',
  },
];

const GRAVITY = 1200;
const MAX_FALL = 800;
const ATTACK_DURATION = 0.25;
const SPECIAL_DURATION = 0.4;
const HITSTUN_DURATION = 0.3;
const COMBO_WINDOW = 1.5;
const MAX_COMBO = 5;

const STAGE_LENGTHS = [3600, 4200, 4800, 5400, 6000];
const SCROLL_SPEEDS = [60, 70, 80, 90, 100];
const BOSS_SCROLL_X = [3000, 3600, 4000, 4500, 5000];

const ENEMY_TYPES = {
  skeleton: { hp: 15, speed: 60, damage: 6, score: 100, color: '#c8b89a', width: 24, height: 30 },
  knight:   { hp: 30, speed: 40, damage: 10, score: 200, color: '#7c6a8e', width: 28, height: 34 },
  golem:    { hp: 60, speed: 25, damage: 15, score: 400, color: '#6a5a4a', width: 34, height: 36 },
  archer:   { hp: 18, speed: 55, damage: 8, score: 250, color: '#4a7a3a', width: 24, height: 32, ranged: true },
  assassin: { hp: 12, speed: 120, damage: 14, score: 300, color: '#3a3a4a', width: 22, height: 30 },
};

const MAX_STAGES = STAGE_LENGTHS.length;

export class GoldenAxe extends GameBase {
  init(engine) {
    super.init(engine, 'golden-axe');
    this.highscore = this.storage.get('highscore', 0);
    this.startTime = Date.now();
    this.currentStage = this.storage.get('savedStage', 1);
    this.phase = 'select'; // 'select' | 'playing' | 'level-complete' | 'won' | 'lost'
    this.selectedChar = 0;
    this.stageScore = 0;
    this._startSelect();
  }

  _defaultBindings() {
    return {
      moveLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      moveUp:    ['ArrowUp', 'KeyW', 'GamepadUp', 'GamepadLStickUp'],
      moveDown:  ['ArrowDown', 'KeyS', 'GamepadDown', 'GamepadLStickDown'],
      attack:    ['KeyJ', 'GamepadX'],
      special:   ['KeyK', 'GamepadA'],
      magic:     ['KeyL', 'GamepadY'],
      jump:      ['Space', 'KeyU', 'GamepadB'],
      next:      ['Space', 'GamepadA', 'GamepadStart'],
      restart:   ['Space', 'GamepadStart', 'GamepadA'],
      select:    ['Space', 'Enter', 'GamepadA'],
      p1left:    ['KeyA', 'ArrowLeft', 'GamepadLeft'],
      p1right:   ['KeyD', 'ArrowRight', 'GamepadRight'],
      p1select:  ['Space', 'Enter', 'GamepadA'],
    };
  }

  handleResize(width, height) {
    super.handleResize(width, height);
  }

  _startSelect() {
    this.phase = 'select';
    this.selectedChar = 0;
    this.selectBlink = 0;
  }

  _startGame() {
    const def = CHAR_DEFS[this.selectedChar];
    this.player = {
      x: 40, y: this.height - 100,
      width: 24, height: 40,
      vx: 0, vy: 0,
      onGround: false, facing: 1,
      def,
      charIdx: this.selectedChar,
      hp: def.hp, maxHp: def.hp,
      magic: def.magicBase, maxMagic: 100,
      lives: 3,
      attacking: false,
      attackTimer: 0,
      specialing: false,
      specialTimer: 0,
      hitstunTimer: 0,
      invincible: 0,
      combo: 0,
      comboTimer: 0,
      berserkActive: false,
      items: { potions: 0 },
      dead: false,
      respawnTimer: 0,
    };
    this.enemies = [];
    this.particles = [];
    this.powerups = [];
    this.projectiles = [];
    this.arrows = [];
    this.boss = null;
    this.bossBullets = [];
    this.score = 0;
    this.status = 'playing';
    this.phase = 'playing';
    this.scrollX = 0;
    this.stageCleared = false;
    this.stageScore = 0;
    this.comboParticles = [];
    this._initStage();
  }

  _initStage() {
    const idx = this.currentStage - 1;
    this.scrollSpeed = SCROLL_SPEEDS[idx] || 60;
    this.stageLength = STAGE_LENGTHS[idx] || 3600;
    this.bossX = BOSS_SCROLL_X[idx] || 3000;
    this.enemyQueue = this._generateEnemyWave();
    this.enemyTimer = 0;
    this.spawnedCount = 0;
    this.maxEnemies = 10;
  }

  _generateEnemyWave() {
    const stage = this.currentStage;
    const wave = [];
    const counts = {
      skeleton: 6 + stage * 2,
      knight: 2 + Math.floor(stage * 1.5),
      golem: stage >= 2 ? 1 + Math.floor(stage * 0.8) : 0,
      archer: stage >= 3 ? 2 + Math.floor((stage - 2) * 2) : 0,
      assassin: stage >= 4 ? 2 + (stage - 3) * 2 : 0,
    };
    for (let i = 0; i < counts.skeleton; i++) {
      wave.push({ type: 'skeleton', fromLeft: i % 3 === 0, delay: i * 0.7 });
    }
    for (let i = 0; i < counts.knight; i++) {
      wave.push({ type: 'knight', fromLeft: i % 2 === 0, delay: 4 + i * 1.2 });
    }
    for (let i = 0; i < counts.golem; i++) {
      wave.push({ type: 'golem', fromLeft: false, delay: 10 + i * 2 });
    }
    for (let i = 0; i < counts.archer; i++) {
      wave.push({ type: 'archer', fromLeft: i % 2 === 0, delay: 6 + i * 2 });
    }
    for (let i = 0; i < counts.assassin; i++) {
      wave.push({ type: 'assassin', fromLeft: i % 2 === 0, delay: 8 + i * 1.5 });
    }
    // Shuffle
    for (let i = wave.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wave[i], wave[j]] = [wave[j], wave[i]];
    }
    return wave;
  }

  // ── Update ────────────────────────────────────────────────────────

  update(dt) {
    if (this.phase === 'select') {
      this._updateSelect(dt);
      return;
    }
    if (this.phase === 'level-complete') {
      if (this.input.wasActionPressed('next') || this.input.mouse.clickedThisFrame) this._nextStage();
      return;
    }
    if (this.handleRestartInput()) return;

    // Auto-scroll
    this.scrollX += this.scrollSpeed * dt;
    this.scrollX = Math.min(this.scrollX, this.stageLength - 800);

    // Respawn delay
    if (this.player.dead) {
      this.player.respawnTimer -= dt;
      if (this.player.respawnTimer <= 0) {
        if (this.player.lives > 0) {
          this.player.dead = false;
          this.player.x = this.scrollX + 40;
          this.player.y = this.height - 100;
          this.player.vx = 0; this.player.vy = 0;
          this.player.hp = Math.floor(this.player.maxHp * 0.5);
          this.player.invincible = 2;
          this.player.magic = Math.floor(this.player.def.magicBase * 0.5);
        }
      }
      return;
    }

    // Boss zone
    if (this.scrollX >= this.bossX && !this.boss && !this.stageCleared) {
      this._spawnBoss();
    }

    this._updatePlayer(dt);
    this._spawnEnemies(dt);
    this._updateEnemies(dt);
    this._updateBoss(dt);
    this._updateProjectiles(dt);
    this._updatePowerups(dt);
    this._updateParticles(dt);
    this._checkCollisions();
    this._updateCombos(dt);
  }

  _updateSelect(dt) {
    this.selectBlink += dt;
    if (this.input.wasActionPressed('p1left')) {
      this.selectedChar = (this.selectedChar - 1 + CHAR_DEFS.length) % CHAR_DEFS.length;
      AudioManager.sfx({ type: 'select', volume: 0.2 });
    }
    if (this.input.wasActionPressed('p1right')) {
      this.selectedChar = (this.selectedChar + 1) % CHAR_DEFS.length;
      AudioManager.sfx({ type: 'select', volume: 0.2 });
    }
    if (this.input.wasActionPressed('p1select') || this.input.mouse.clickedThisFrame) {
      AudioManager.sfx({ type: 'powerup', volume: 0.3 });
      this._startGame();
    }
  }

  _updatePlayer(dt) {
    if (this.player.invincible > 0) this.player.invincible -= dt;
    if (this.player.hitstunTimer > 0) {
      this.player.hitstunTimer -= dt;
      return;
    }

    // Attack animation
    if (this.player.attacking || this.player.specialing) {
      this.player.attackTimer -= dt;
      if (this.player.attackTimer <= 0) {
        this.player.attacking = false;
        this.player.specialing = false;
      }
    }

    const left = this.input.isActionDown('moveLeft');
    const right = this.input.isActionDown('moveRight');
    const down = this.input.isActionDown('moveDown');
    const up = this.input.isActionDown('moveUp');

    // Movement
    let mx = 0;
    if (left && !right) { mx = -1; this.player.facing = -1; }
    else if (right && !left) { mx = 1; this.player.facing = 1; }

    this.player.vx = mx * this.player.def.speed;

    // Jump
    if (this.input.wasActionPressed('jump') && this.player.onGround) {
      this.player.vy = this.player.def.jumpVel;
      this.player.onGround = false;
      AudioManager.sfx({ type: 'platformer_jump', volume: 0.2 });
    }

    // Wizard: ranged attack (fireball projectile)
    const isWizard = this.player.def.id === 'wizard';
    if (isWizard && this.input.wasActionPressed('attack') && !this.player.attacking && !this.player.specialing) {
      this.player.attacking = true;
      this.player.attackTimer = ATTACK_DURATION * 0.6;
      // Spawn fireball
      if (!this.projectiles) this.projectiles = [];
      this.projectiles.push({
        x: this.player.x + (this.player.facing > 0 ? this.player.width : -10),
        y: this.player.y + 12,
        vx: this.player.facing * 350,
        vy: 0,
        width: 12, height: 8,
        damage: this.player.def.attackDamage,
        alive: true,
        life: 1.5,
        color: '#ff6b4a',
      });
      AudioManager.sfx({ type: 'shoot', volume: 0.2 });
    } else if (!isWizard && this.input.wasActionPressed('attack') && !this.player.attacking && !this.player.specialing) {
      // Normal melee attack
      this.player.attacking = true;
      this.player.attackTimer = ATTACK_DURATION;
      AudioManager.sfx({ type: 'hit', volume: 0.25 });
    }

    // Special attack
    if (this.input.wasActionPressed('special') && !this.player.specialing && !this.player.attacking && this.player.magic >= this.player.def.magicCost) {
      if (isWizard) {
        // Wizard special: homing fireball volley
        if (!this.projectiles) this.projectiles = [];
        for (let i = 0; i < 3; i++) {
          this.projectiles.push({
            x: this.player.x + (this.player.facing > 0 ? this.player.width : -10),
            y: this.player.y + 8 + i * 8,
            vx: this.player.facing * (250 + i * 40),
            vy: (i - 1) * 30,
            width: 14, height: 10,
            damage: this.player.def.specialDamage,
            alive: true,
            life: 2,
            color: '#4a9eff',
          });
        }
        this.player.magic -= this.player.def.magicCost;
        this.player.specialing = true;
        this.player.attackTimer = SPECIAL_DURATION * 0.5;
        AudioManager.sfx({ type: 'shoot', volume: 0.35 });
      } else {
        this.player.specialing = true;
        this.player.attackTimer = SPECIAL_DURATION;
        this.player.magic -= this.player.def.magicCost;
        AudioManager.sfx({ type: 'powerup', volume: 0.3 });
        this._spawnParticles(this.player.x + this.player.width / 2, this.player.y + 10, '#ffd700', 8);
      }
    }

    // Magic (area attack)
    if (this.input.wasActionPressed('magic') && !this.player.attacking && !this.player.specialing && this.player.magic >= this.player.def.magicCost) {
      this._doMagic();
    }

    // Barbarian: berserker mode when low HP
    const isBarbarian = this.player.def.id === 'barbarian';
    if (isBarbarian && this.player.hp < this.player.maxHp * 0.3 && this.player.hp > 0) {
      this.player.berserkActive = true;
    } else if (isBarbarian) {
      this.player.berserkActive = false;
    }

    // Wizard: magic regenerates slowly
    if (isWizard && this.player.magic < this.player.maxMagic) {
      this.player.magic = Math.min(this.player.maxMagic, this.player.magic + 3 * dt);
    }

    // Gravity
    if (!this.player.onGround) {
      this.player.vy += GRAVITY * dt;
      this.player.vy = Math.min(this.player.vy, MAX_FALL);
    }
    this.player.y += this.player.vy * dt;
    if (this.player.y >= this.height - 60) {
      this.player.y = this.height - 60;
      this.player.vy = 0;
      this.player.onGround = true;
    }

    // Horizontal movement with scroll clamping
    const minX = this.scrollX;
    const maxX = this.scrollX + this.width - this.player.width;
    this.player.x = clamp(this.player.x + this.player.vx * dt, minX, maxX);

    // Fall death
    if (this.player.y > this.height + 100) {
      this._playerDeath();
    }
  }

  _doMagic() {
    this.player.magic -= this.player.def.magicCost;
    const dmg = this.player.def.magicBase + Math.floor(this.player.magic * 0.5);
    this.player.magic = 0;

    // Area of effect around player
    const aoex = this.player.x - 60;
    const aoey = this.player.y - 30;
    const aoew = this.player.width + 120;
    const aoeh = this.player.height + 60;

    this._spawnParticles(this.player.x + this.player.width / 2, this.player.y + 10, '#4a9eff', 20);
    AudioManager.sfx({ type: 'explosion', volume: 0.5 });
    HapticManager.vibrate('explosion');

    // Damage all enemies in range
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const eBox = { x: e.x, y: e.y, width: e.width, height: e.height };
      const aoeBox = { x: aoex, y: aoey, width: aoew, height: aoeh };
      if (aabbIntersects(aoeBox, eBox)) {
        e.hp -= dmg;
        this._spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#4a9eff', 10);
        if (e.hp <= 0) {
          e.alive = false;
          this._enemyKilled(e);
        }
      }
    }
    if (this.boss && this.boss.alive) {
      const bBox = { x: this.boss.x, y: this.boss.y, width: this.boss.width, height: this.boss.height };
      const aoeBox = { x: aoex, y: aoey, width: aoew, height: aoeh };
      if (aabbIntersects(aoeBox, bBox)) {
        this.boss.hp -= Math.floor(dmg * 0.5);
        this._spawnParticles(this.boss.x + this.boss.width / 2, this.boss.y + 10, '#4a9eff', 15);
        if (this.boss.hp <= 0) {
          this.boss.alive = false;
          this._bossDefeated();
        }
      }
    }
  }

  _spawnEnemies(dt) {
    // Spawn from queue
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0 && this.enemyQueue.length > 0 && this.spawnedCount < this.maxEnemies) {
      const entry = this.enemyQueue.shift();
      const eType = ENEMY_TYPES[entry.type];
      const spawnX = entry.fromLeft ? this.scrollX - 30 : this.scrollX + this.width + 30;
      this.enemies.push({
        x: spawnX,
        y: this.height - 60 - eType.height,
        width: eType.width,
        height: eType.height,
        vx: entry.fromLeft ? eType.speed : -eType.speed,
        vy: 0,
        hp: eType.hp,
        maxHp: eType.hp,
        damage: eType.damage,
        score: eType.score,
        alive: true,
        type: entry.type,
        color: eType.color,
        onGround: true,
        attackCooldown: 0,
        aiTimer: 0,
      });
      this.spawnedCount++;
      this.enemyTimer = Math.max(0.4, 1.0 - this.currentStage * 0.1 + Math.random() * 0.5);
    }
  }

  _updateEnemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.x < this.scrollX - 100 || e.x > this.scrollX + this.width + 100) {
        e.alive = false;
        continue;
      }

      // AI: approach player
      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        e.aiTimer = 0.3 + Math.random() * 0.4;
        const dx = this.player.x - e.x;
        if (!this.player.dead) {
          e.vx = dx > 0 ? ENEMY_TYPES[e.type].speed : -ENEMY_TYPES[e.type].speed;
        }
      }

      // Gravity
      if (!e.onGround) {
        e.vy += GRAVITY * dt;
        e.vy = Math.min(e.vy, MAX_FALL);
      }
      e.x += e.vx * dt;
      e.y = this.height - 60 - e.height; // Keep on ground

      // Attack cooldown
      if (e.attackCooldown > 0) e.attackCooldown -= dt;

      // Archer: ranged attack + retreat when close
      if (e.type === 'archer' && !this.player.dead) {
        const dx = this.player.x + this.player.width / 2 - e.x;
        const dist = Math.abs(dx);
        // Back away when player is too close
        if (dist < 80) {
          e.vx = dx > 0 ? -ENEMY_TYPES.archer.speed * 0.7 : ENEMY_TYPES.archer.speed * 0.7;
        }
        // Fire arrow at ideal range
        if (e.attackCooldown <= 0 && dist > 50 && dist < 350) {
          const dy = (this.player.y + 16) - (e.y + 8);
          const norm = Math.sqrt(dx * dx + dy * dy);
          this.arrows.push({
            x: e.x + (dx > 0 ? e.width : 0),
            y: e.y + 8,
            vx: (dx / norm) * 200,
            vy: (dy / norm) * 200,
            damage: 6,
            alive: true,
            life: 3,
          });
          e.attackCooldown = 1.2 + Math.random() * 0.5;
          AudioManager.sfx({ type: 'shoot', volume: 0.15 });
        }
      }
    }
    this.enemies = this.enemies.filter(e => e.alive);

    // Update arrows
    for (const a of this.arrows) {
      if (!a.alive) continue;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.life -= dt;
      if (a.life <= 0) a.alive = false;
    }
    this.arrows = this.arrows.filter(a => a.alive);
  }

  _updateProjectiles(dt) {
    if (!this.projectiles) return;
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) p.alive = false;
      // Hit enemies
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const eBox = { x: e.x, y: e.y, width: e.width, height: e.height };
        const pBox = { x: p.x, y: p.y, width: p.width, height: p.height };
        if (aabbIntersects(pBox, eBox)) {
          p.alive = false;
          e.hp -= p.damage;
          this._spawnParticles(e.x + e.width / 2, e.y + e.height / 2, p.color, 6);
          if (e.hp <= 0) {
            e.alive = false;
            this._enemyKilled(e);
          }
          break;
        }
      }
      // Hit boss
      if (this.boss && this.boss.alive) {
        const bBox = { x: this.boss.x, y: this.boss.y, width: this.boss.width, height: this.boss.height };
        const pBox = { x: p.x, y: p.y, width: p.width, height: p.height };
        if (aabbIntersects(pBox, bBox)) {
          p.alive = false;
          this.boss.hp -= Math.floor(p.damage * 0.7);
          this._spawnParticles(p.x, p.y, p.color, 8);
          if (this.boss.hp <= 0) {
            this.boss.alive = false;
            this._bossDefeated();
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);
  }

  _updateBoss(dt) {
    if (!this.boss || !this.boss.alive) return;

    const pattern = this.boss.pattern;
    const hpPct = this.boss.hp / this.boss.maxHp;
    this.boss.enraged = hpPct < 0.35;

    // Movement
    if (pattern === 'inferno') {
      // Dragon: hovers and moves slower
      this.boss.x += this.boss.speed * this.boss.dir * dt * 0.6;
      this.boss.y = this.height - 140 + Math.sin(Date.now() * 0.003) * 30;
    } else if (pattern === 'necromancy') {
      // Necromancer: teleports occasionally
      this.boss.x += this.boss.speed * this.boss.dir * dt * 0.8;
    } else {
      this.boss.x += this.boss.speed * this.boss.dir * dt;
      this.boss.y += Math.sin(Date.now() * 0.004) * 40 * dt;
    }
    if (this.boss.x < this.bossX - 50) this.boss.dir = 1;
    if (this.boss.x > this.bossX + 200) this.boss.dir = -1;

    // Attack patterns
    this.boss.fireTimer -= dt;
    if (this.boss.fireTimer <= 0) {
      const speedMult = this.boss.enraged ? 0.7 : 1.0;
      this.boss.fireTimer = Math.max(0.5, (1.5 - hpPct) * speedMult);

      if (pattern === 'charge') {
        this.boss.vx = this.boss.dir * this.boss.speed * 3;
      } else if (pattern === 'spiral') {
        for (let i = 0; i < 5; i++) {
          const angle = Math.PI / 2 + (i - 2) * 0.35;
          this.bossBullets.push({
            x: this.boss.x + this.boss.width / 2,
            y: this.boss.y + this.boss.height,
            vx: Math.cos(angle) * (100 + this.boss.enraged * 40),
            vy: Math.sin(angle) * (100 + this.boss.enraged * 40),
            radius: 5, alive: true,
            color: this.boss.enraged ? '#ff4d4d' : '#ffb454',
          });
        }
      } else if (pattern === 'necromancy') {
        // Necromancer: summon skeletons + homing skulls
        for (let i = 0; i < 2; i++) {
          const angle = Math.PI / 2 + (i - 0.5) * 0.8;
          this.bossBullets.push({
            x: this.boss.x + this.boss.width / 2,
            y: this.boss.y + this.boss.height,
            vx: Math.cos(angle) * 100,
            vy: Math.sin(angle) * 100,
            radius: 6, alive: true,
            color: '#4a9eff',
            homing: true,
          });
        }
        if (this.boss.enraged && Math.random() < 0.4) {
          // Summon a skeleton minion
          this.enemies.push({
            x: this.bossX + Math.random() * 100,
            y: this.height - 90, width: 20, height: 28,
            vx: 30, vy: 0, hp: 8, maxHp: 8,
            damage: 5, score: 50, alive: true,
            type: 'skeleton', color: '#8a7a6a',
            onGround: true, attackCooldown: 0, aiTimer: 0,
          });
        }
      } else if (pattern === 'inferno') {
        // Dragon: fire breath + fireballs
        const spread = this.boss.enraged ? 5 : 3;
        for (let i = 0; i < spread; i++) {
          const angle = Math.PI / 2 + (i - (spread - 1) / 2) * 0.25;
          this.bossBullets.push({
            x: this.boss.x + this.boss.width / 2,
            y: this.boss.y + this.boss.height,
            vx: Math.cos(angle) * (140 + this.boss.enraged * 50),
            vy: Math.sin(angle) * (140 + this.boss.enraged * 50),
            radius: 7, alive: true,
            color: '#ff6b4a',
          });
        }
        // Ground fire pools on enrage
        if (this.boss.enraged) {
          for (let i = 0; i < 3; i++) {
            this.bossBullets.push({
              x: this.boss.x + Math.random() * this.boss.width,
              y: this.height - 55,
              vx: (Math.random() - 0.5) * 80,
              vy: -30, radius: 6, alive: true,
              color: '#ff4d4d',
            });
          }
        }
      } else {
        // Default spread pattern
        for (let i = 0; i < 3; i++) {
          const angle = Math.PI / 2 + (i - 1) * 0.4;
          this.bossBullets.push({
            x: this.boss.x + this.boss.width / 2,
            y: this.boss.y + this.boss.height,
            vx: Math.cos(angle) * 120,
            vy: Math.sin(angle) * 120,
            radius: 5, alive: true, color: '#ff4d4d',
          });
        }
      }
      AudioManager.sfx({ type: 'shoot', volume: 0.3 });
    }

    // Move boss bullets
    for (const b of this.bossBullets) {
      if (!b.alive) continue;
      // Homing bullets (necromancer)
      if (b.homing && !this.player.dead) {
        const dx = this.player.x + this.player.width / 2 - b.x;
        const dy = this.player.y + 20 - b.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          b.vx += (dx / len) * 60 * dt;
          b.vy += (dy / len) * 60 * dt;
          const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          if (spd > 150) { b.vx = (b.vx / spd) * 150; b.vy = (b.vy / spd) * 150; }
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > this.height + 20 || b.x < this.scrollX - 20 || b.x > this.scrollX + this.width + 20) {
        b.alive = false;
      }
    }
    this.bossBullets = this.bossBullets.filter(b => b.alive);
  }

  _updatePowerups(dt) {
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      pu.y += pu.vy * dt;
      pu.vy += 400 * dt;
      if (pu.y > this.height - 60) {
        pu.y = this.height - 60;
        pu.vy = 0;
      }
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

  _updateCombos(dt) {
    if (this.comboParticles) {
      for (const c of this.comboParticles) {
        c.life -= dt;
      }
      this.comboParticles = this.comboParticles.filter(c => c.life > 0);
    }
    if (this.player.comboTimer > 0) {
      this.player.comboTimer -= dt;
      if (this.player.comboTimer <= 0) {
        this.player.combo = 0;
      }
    }
  }

  // ── Collisions ────────────────────────────────────────────────────

  _checkCollisions() {
    if (this.player.dead || this.player.invincible > 0) return;
    const pBox = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };

    // Player attack vs enemies
    if (this.player.attacking || this.player.specialing) {
      const atkRange = this.player.specialing ? this.player.def.specialRange : this.player.def.attackRange;
      let atkDmg = this.player.specialing ? this.player.def.specialDamage : this.player.def.attackDamage;
      // Barbarian berserker bonus
      if (this.player.berserkActive) atkDmg = Math.floor(atkDmg * 1.5);
      const atkBox = {
        x: this.player.facing > 0 ? this.player.x + this.player.width : this.player.x - atkRange,
        y: this.player.y,
        width: atkRange,
        height: this.player.height,
      };

      for (const e of this.enemies) {
        if (!e.alive) continue;
        const eBox = { x: e.x, y: e.y, width: e.width, height: e.height };
        if (aabbIntersects(atkBox, eBox)) {
          e.hp -= atkDmg;
          e.vx = this.player.facing * 200; // knockback
          this._spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#ffb454', 6);
          HapticManager.vibrate('hit');

          // Combo
          this.player.comboTimer = COMBO_WINDOW;
          this.player.combo = Math.min(this.player.combo + 1, MAX_COMBO);
          if (this.player.combo >= 2) {
            this.comboParticles.push({
              x: this.player.x, y: this.player.y - 20,
              text: `${this.player.combo}x!`,
              life: 0.8,
              color: '#ffd700',
            });
          }

          if (e.hp <= 0) {
            e.alive = false;
            this._enemyKilled(e);
          }
          break; // Only hit one enemy per swing
        }
      }

      // Player attack vs boss
      if (this.boss && this.boss.alive && aabbIntersects(atkBox, this.boss)) {
        this.boss.hp -= atkDmg;
        this._spawnParticles(this.boss.x + this.boss.width / 2, this.boss.y + 10, '#ffb454', 8);
        HapticManager.vibrate('hit');
        if (this.boss.hp <= 0) {
          this.boss.alive = false;
          this._bossDefeated();
        }
      }
    }

    // Enemies vs player
    if (this.player.hitstunTimer > 0) return;
    for (const e of this.enemies) {
      if (!e.alive || e.attackCooldown > 0) continue;
      const eBox = { x: e.x, y: e.y, width: e.width, height: e.height };
      if (aabbIntersects(pBox, eBox)) {
        this._playerHit(e.damage);
        e.attackCooldown = 1.0;
        break;
      }
    }

    // Boss vs player
    if (this.boss && this.boss.alive && aabbIntersects(pBox, this.boss)) {
      this._playerHit(12);
    }

    // Arrows vs player
    for (const a of this.arrows) {
      if (!a.alive) continue;
      const aBox = { x: a.x - 3, y: a.y - 3, width: 6, height: 6 };
      if (aabbIntersects(pBox, aBox)) {
        a.alive = false;
        this._playerHit(a.damage);
        break;
      }
    }

    // Boss bullets vs player
    for (const b of this.bossBullets) {
      if (!b.alive) continue;
      const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
      if (aabbIntersects(pBox, bBox)) {
        b.alive = false;
        this._playerHit(8);
        break;
      }
    }

    // Player vs powerups (potions)
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      const puBox = { x: pu.x, y: pu.y, width: pu.width, height: pu.height };
      if (aabbIntersects(pBox, puBox)) {
        pu.active = false;
        if (pu.type === 'potion') {
          this.player.magic = Math.min(this.player.maxMagic, this.player.magic + 20);
          AudioManager.sfx({ type: 'powerup', volume: 0.3 });
          this._spawnParticles(pu.x + 8, pu.y + 8, '#4a9eff', 8);
        } else if (pu.type === 'hp') {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
          AudioManager.sfx({ type: 'powerup', volume: 0.3 });
          this._spawnParticles(pu.x + 8, pu.y + 8, '#3a9a5a', 8);
        }
      }
    }
  }

  _enemyKilled(e) {
    this.score += e.score;
    this._spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#ff6b4a', 12);

    // Drop potion (15% chance)
    if (Math.random() < 0.15) {
      const type = Math.random() < 0.6 ? 'potion' : 'hp';
      this.powerups.push({
        x: e.x, y: e.y,
        width: 16, height: 16,
        vy: -100,
        type,
        active: true,
        color: type === 'potion' ? '#4a9eff' : '#3a9a5a',
      });
    }
  }

  _playerHit(damage) {
    if (this.player.invincible > 0 || this.player.dead) return;
    this.player.hp -= damage;
    this.player.hitstunTimer = HITSTUN_DURATION;
    this.player.invincible = 1.0;
    this.player.combo = 0;
    AudioManager.sfx({ type: 'hit', volume: 0.3 });
    HapticManager.vibrate('hit');
    this._spawnParticles(this.player.x + this.player.width / 2, this.player.y + 10, '#ff4d4d', 6);

    if (this.player.hp <= 0) {
      this._playerDeath();
    }
  }

  _playerDeath() {
    this.player.dead = true;
    this.player.lives--;
    this.player.respawnTimer = 2;
    AudioManager.sfx({ type: 'explosion', volume: 0.4 });
    HapticManager.vibrate('explosion');
    this._spawnParticles(this.player.x + this.player.width / 2, this.player.y + 10, '#ff6b4a', 15);

    if (this.player.lives <= 0) {
      this._endGame(false);
    }
  }

  _spawnBoss() {
    const stage = this.currentStage;
    const bossHP = 30 + stage * 15;
    const patterns = ['spread', 'charge', 'spiral', 'necromancy', 'inferno'];
    const colors = ['#3a2a6b', '#6b2a4a', '#4a6b2a', '#2a4a6b', '#6b2a2a'];
    const names = ['Demon Knight', 'Dark Knight', 'Forest Giant', 'Necromancer', 'Fire Dragon'];
    const heights = [50, 50, 50, 55, 65];
    const widths = [60, 60, 60, 55, 80];
    this.boss = {
      x: this.bossX + 100,
      y: this.height - 120,
      width: widths[stage - 1] || 60,
      height: heights[stage - 1] || 50,
      hp: bossHP, maxHp: bossHP,
      alive: true, dir: -1, speed: 50 + stage * 5,
      fireTimer: 2, pattern: patterns[stage - 1] || 'spread',
      name: names[stage - 1] || 'Boss',
      color: colors[stage - 1] || '#3a2a6b',
      enraged: false,
    };
    this.bossBullets = [];
    // Add minions for necromancer stage
    if (stage === 4) {
      for (let i = 0; i < 3; i++) {
        this.enemies.push({
          x: this.bossX + 50 + i * 40, y: this.height - 90,
          width: 20, height: 28,
          vx: 0, vy: 0, hp: 8, maxHp: 8,
          damage: 5, score: 50, alive: true,
          type: 'skeleton', color: '#8a7a6a',
          onGround: true, attackCooldown: 0, aiTimer: 0,
        });
      }
    }
    AudioManager.sfx({ type: 'powerup', volume: 0.5 });
  }

  _bossDefeated() {
    this.score += 2000;
    this._spawnParticles(this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#ffd700', 30);
    AudioManager.sfx({ type: 'explosion', volume: 0.6 });
    HapticManager.vibrate('explosion');
    this.stageCleared = true;

    if (this.currentStage >= MAX_STAGES) {
      this._endGame(true);
    } else {
      this.phase = 'level-complete';
    }
  }

  _nextStage() {
    this.currentStage++;
    this.storage.set('savedStage', this.currentStage);
    this.spawnedCount = 0;
    this.enemyQueue = [];
    this._initStage();
    // Restore player
    this.player.dead = false;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
    this.player.magic = Math.min(this.player.maxMagic, this.player.magic + 20);
    this.player.lives = Math.max(this.player.lives, 2);
    this.player.x = 40;
    this.player.y = this.height - 60;
    this.player.vx = 0; this.player.vy = 0;
    this.player.invincible = 1;
    this.scrollX = 0;
  }

  _restart() {
    this._startSelect();
    this.currentStage = 1;
    this.selectedChar = 0;
    this.score = 0;
    this.stageScore = 0;
    this.status = 'playing';
  }

  _endGame(won) {
    this.phase = won ? 'won' : 'lost';
    this.status = won ? 'won' : 'lost';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('golden-axe', this.score, won, duration);
    if (won) ProgressionManager.checkAchievement('golden-axe', 'game-cleared');
    if (this.currentStage >= 2) ProgressionManager.checkAchievement('golden-axe', 'stage-master');
    ProgressionManager.checkAchievement('golden-axe', 'first-blood');
    if (won && this.player.lives >= 2) ProgressionManager.checkAchievement('golden-axe', 'no-continue');
  }

  _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 250,
        vy: -Math.random() * 200 - 50,
        life: 0.3 + Math.random() * 0.4,
        color,
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.phase === 'select') {
      this._renderSelect(ctx);
      return;
    }

    // Background layers (parallax)
    const bgOffset = this.scrollX * 0.2;
    ctx.fillStyle = '#2a1a3a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Mountains (far)
    ctx.fillStyle = '#3a2a4a';
    for (let i = 0; i < 6; i++) {
      const mx = i * 160 - (bgOffset % 160);
      ctx.beginPath();
      ctx.moveTo(mx, this.height - 100);
      ctx.lineTo(mx + 80, this.height - 200);
      ctx.lineTo(mx + 160, this.height - 100);
      ctx.fill();
    }

    // Hills (mid) — use arc (bezier curve) instead of ellipse for mock canvas compat
    ctx.fillStyle = '#4a3a2a';
    const midOffset = this.scrollX * 0.4;
    for (let i = 0; i < 5; i++) {
      const hx = i * 200 - (midOffset % 200);
      ctx.beginPath();
      ctx.moveTo(hx, this.height - 60);
      ctx.quadraticCurveTo(hx + 100, this.height - 140, hx + 200, this.height - 60);
      ctx.fill();
    }

    // Ground
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(0, this.height - 60, this.width, 60);
    ctx.strokeStyle = '#6a5a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.height - 60);
    ctx.lineTo(this.width, this.height - 60);
    ctx.stroke();

    // Ground detail
    ctx.fillStyle = '#4a3a2a';
    const gOffset = this.scrollX % 32;
    for (let x = -gOffset; x < this.width; x += 32) {
      ctx.fillRect(x, this.height - 4, 16, 4);
    }

    ctx.save();
    ctx.translate(-this.scrollX, 0);

    // Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      // Body
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x, e.y, e.width, e.height);

      // Details
      ctx.fillStyle = this._darkenColor(e.color, 0.7);
      ctx.fillRect(e.x + 2, e.y + 4, e.width - 4, 6);
      ctx.fillRect(e.x + 2, e.y + e.height - 8, e.width - 4, 4);

      // Eyes
      ctx.fillStyle = this.player.x < e.x ? '#ff6b4a' : '#4a9eff';
      ctx.fillRect(e.x + 4, e.y + 8, 4, 4);
      ctx.fillRect(e.x + e.width - 8, e.y + 8, 4, 4);

      // Shield (knights)
      if (e.type === 'knight') {
        ctx.fillStyle = '#4a3a5a';
        const shieldX = this.player.x < e.x ? e.x : e.x + e.width - 10;
        ctx.fillRect(shieldX, e.y + 8, 10, 16);
      }

      // HP bar
      if (e.hp < e.maxHp) {
        const hpW = e.width;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x, e.y - 4, hpW, 3);
        ctx.fillStyle = '#ff6b4a';
        ctx.fillRect(e.x + 1, e.y - 3, (hpW - 2) * (e.hp / e.maxHp), 2);
      }
    }

    // Boss
    if (this.boss && this.boss.alive) {
      this._renderBoss(ctx);
    }

    // Boss bullets
    for (const b of this.bossBullets) {
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

    // Projectiles (wizard fireballs)
    this._renderProjectiles(ctx);

    // Enemy arrows
    for (const a of this.arrows) {
      if (!a.alive) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      const angle = Math.atan2(a.vy, a.vx);
      if (ctx.rotate) ctx.rotate(angle);
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(-6, -1, 12, 2);
      ctx.fillStyle = '#3a2a1a';
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(2, -3);
      ctx.lineTo(2, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Powerups
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      const pulse = Math.sin(Date.now() * 0.006) * 3;
      ctx.fillStyle = pu.color;
      ctx.beginPath();
      ctx.arc(pu.x + 8, pu.y + 8 + pulse, 8, 0, Math.PI * 2);
      ctx.fill();
      // Icon
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pu.type === 'potion' ? 'M' : '♥', pu.x + 8, pu.y + 8 + pulse + 1);
    }

    // Player
    if (!this.player.dead) {
      const blink = this.player.invincible > 0 && Math.floor(this.player.invincible * 10) % 2 === 0;
      if (!blink) {
        this._renderPlayer(ctx);
      }
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.4);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // ── HUD (screen coords) ────────────────────────────────────────
    this._renderHUD(ctx);

    // Boss warning
    if (this.boss && this.boss.alive) {
      ctx.fillStyle = '#ff4d4d';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const bossLabel = this.boss.name ? `⚔ ${this.boss.name} ⚔` : t('goldenaxe.boss');
      ctx.fillText(bossLabel, this.width / 2, 60);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Stage complete
    if (this.phase === 'level-complete') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('game.levelComplete'), this.width / 2, this.height / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillText(t('goldenaxe.continue'), this.width / 2, this.height / 2 + 20);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Game over / victory
    if (this.phase === 'won' || this.phase === 'lost') {
      renderOverlay(ctx, {
        width: this.width, height: this.height,
        title: this.phase === 'won' ? t('goldenaxe.victory') : t('goldenaxe.gameOver'),
        score: this.score,
      });
    }
  }

  _renderSelect(ctx) {
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('goldenaxe.select'), this.width / 2, 24);

    const cardW = 146;
    const cardH = 220;
    const gap = 12;
    const totalW = CHAR_DEFS.length * cardW + (CHAR_DEFS.length - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const startY = 55;

    for (let i = 0; i < CHAR_DEFS.length; i++) {
      const ch = CHAR_DEFS[i];
      const x = startX + i * (cardW + gap);
      const y = startY;
      const isSelected = i === this.selectedChar;

      ctx.fillStyle = isSelected ? '#1a1a2a' : '#11161d';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = isSelected ? '#ffd700' : '#2a3a4a';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(x, y, cardW, cardH);

      // Character portrait
      ctx.fillStyle = ch.skinColor;
      ctx.beginPath();
      ctx.arc(x + cardW / 2, y + 50, 18, 0, Math.PI * 2);
      ctx.fill();

      // Torso
      ctx.fillStyle = ch.color;
      ctx.fillRect(x + cardW / 2 - 16, y + 68, 32, 40);

      // Legs
      ctx.fillStyle = '#3a2a2a';
      ctx.fillRect(x + cardW / 2 - 14, y + 108, 12, 28);
      ctx.fillRect(x + cardW / 2 + 2, y + 108, 12, 28);

      // Weapon / items
      if (ch.id === 'warrior') {
        ctx.fillStyle = '#7c8894';
        ctx.fillRect(x + cardW / 2 + 14, y + 68, 18, 5);
        ctx.fillRect(x + cardW / 2 + 28, y + 62, 4, 12);
      } else if (ch.id === 'amazon') {
        ctx.fillStyle = '#7c8894';
        ctx.fillRect(x + cardW / 2 - 22, y + 72, 24, 4);
        ctx.fillRect(x + cardW / 2 - 26, y + 66, 4, 12);
      } else if (ch.id === 'dwarf') {
        ctx.fillStyle = '#7c8894';
        ctx.fillRect(x + cardW / 2 - 18, y + 64, 36, 8);
        ctx.fillRect(x + cardW / 2 - 3, y + 56, 6, 16);
      } else if (ch.id === 'wizard') {
        // Staff
        ctx.fillStyle = '#8a6a3a';
        ctx.fillRect(x + cardW / 2 + 12, y + 55, 4, 50);
        ctx.fillStyle = '#4a9eff';
        ctx.beginPath();
        ctx.arc(x + cardW / 2 + 14, y + 56, 6, 0, Math.PI * 2);
        ctx.fill();
        // Cape
        ctx.fillStyle = '#2a2a5a';
        ctx.fillRect(x + cardW / 2 - 18, y + 68, 36, 35);
        ctx.fillStyle = ch.color;
        ctx.fillRect(x + cardW / 2 - 14, y + 68, 28, 30);
      } else if (ch.id === 'barbarian') {
        // Large axe
        ctx.fillStyle = '#7c8894';
        ctx.fillRect(x + cardW / 2 + 10, y + 60, 22, 6);
        ctx.fillRect(x + cardW / 2 + 28, y + 52, 6, 20);
        // Fur shoulder
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(x + cardW / 2 - 20, y + 66, 40, 8);
      }

      // Name
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ch.name, x + cardW / 2, y + 156);

      // Stats
      ctx.fillStyle = '#9aa7b2';
      ctx.font = '10px monospace';
      ctx.fillText(`HP:${ch.hp} DMG:${ch.attackDamage} SPD:${ch.speed}`, x + cardW / 2, y + 175);
      ctx.fillText(ch.desc, x + cardW / 2, y + 192);

      // Magic bar preview
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(x + cardW / 2 - 30, y + 200, 60, 5);
      ctx.fillStyle = '#4a9eff';
      ctx.fillRect(x + cardW / 2 - 29, y + 201, 58 * (ch.magicBase / 100), 3);

      ctx.textAlign = 'left';
    }

    if (Math.floor(this.selectBlink * 4) % 2 === 0) {
      const selX = startX + this.selectedChar * (cardW + gap);
      ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
      ctx.fillRect(selX, startY, cardW, cardH);
    }

    ctx.fillStyle = '#9aa7b2';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A/D o ← → para elegir  |  Espacio/Enter para empezar', this.width / 2, this.height - 30);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderPlayer(ctx) {
    const p = this.player;
    const def = p.def;
    const cx = p.x + p.width / 2;
    const isWizard = def.id === 'wizard';
    const isBarbarian = def.id === 'barbarian';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse ? ctx.ellipse(cx, p.y + p.height, 14, 4, 0, 0, Math.PI * 2) : ctx.arc(cx, p.y + p.height, 14, 0, Math.PI * 2);
    ctx.fill();

    if (isWizard) {
      // ── Wizard ──
      // Cape/robe
      ctx.fillStyle = '#2a2a5a';
      ctx.beginPath();
      ctx.moveTo(cx - 12, p.y + 12);
      ctx.lineTo(cx - 16, p.y + 38);
      ctx.lineTo(cx + 16, p.y + 38);
      ctx.lineTo(cx + 12, p.y + 12);
      ctx.fill();

      // Torso
      ctx.fillStyle = def.color;
      ctx.fillRect(cx - 8, p.y + 10, 16, 22);

      // Head
      ctx.fillStyle = def.skinColor;
      ctx.beginPath();
      ctx.arc(cx, p.y + 8, 9, 0, Math.PI * 2);
      ctx.fill();

      // Pointed hat
      ctx.fillStyle = '#2a2a5a';
      ctx.beginPath();
      ctx.moveTo(cx - 8, p.y + 2);
      ctx.lineTo(cx, p.y - 8);
      ctx.lineTo(cx + 8, p.y + 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#4a9eff';
      ctx.fillRect(cx + p.facing * 2, p.y + 6, 3, 3);

      // Legs
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(cx - 7, p.y + 32, 6, 10);
      ctx.fillRect(cx + 1, p.y + 32, 6, 10);

      // Staff (held with arm)
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(cx + p.facing * 10, p.y + 8, 4, 30);
      // Staff gem
      ctx.fillStyle = p.magic >= 50 ? '#ffd700' : '#4a9eff';
      ctx.beginPath();
      ctx.arc(cx + p.facing * 12, p.y + 6, 4, 0, Math.PI * 2);
      ctx.fill();
      // Staff glow
      if (p.magic >= 30) {
        ctx.strokeStyle = `rgba(74, 158, 255, ${0.2 + Math.sin(Date.now() * 0.006) * 0.15})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx + p.facing * 12, p.y + 6, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (isBarbarian) {
      // ── Barbarian ──
      const berserk = p.berserkActive;

      // Larger torso
      ctx.fillStyle = def.color;
      ctx.fillRect(cx - 10, p.y + 10, 20, 22);

      // Fur shoulder
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(cx - 13, p.y + 10, 26, 5);

      // Head
      ctx.fillStyle = def.skinColor;
      ctx.beginPath();
      ctx.arc(cx, p.y + 8, 11, 0, Math.PI * 2);
      ctx.fill();

      // Wild hair
      ctx.fillStyle = '#6a3a1a';
      ctx.fillRect(cx - 10, p.y, 20, 4);
      ctx.fillRect(cx - 6, p.y - 3, 12, 3);

      // Eyes (red when berserk)
      ctx.fillStyle = berserk ? '#ff4d4d' : '#000';
      ctx.fillRect(cx + p.facing * 2, p.y + 6, 4, 4);
      if (berserk) {
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(cx + p.facing * 2, p.y + 6, 2, 2);
      }

      // Legs
      ctx.fillStyle = '#3a2a2a';
      ctx.fillRect(cx - 9, p.y + 32, 8, 10);
      ctx.fillRect(cx + 1, p.y + 32, 8, 10);

      // Arms
      ctx.fillStyle = def.skinColor;
      if (p.attacking || p.specialing) {
        // Axe swing
        ctx.fillRect(cx + p.facing * 10, p.y + 12, p.facing * 18, 6);
        ctx.fillStyle = '#7c8894';
        ctx.fillRect(cx + p.facing * 24, p.y + 8, p.facing * 6 + 4, 14);
      } else {
        ctx.fillRect(cx + p.facing * 3, p.y + 12, 7, 14);
        ctx.fillRect(cx - p.facing * 10, p.y + 12, 7, 14);
        // Axe in right hand
        ctx.fillStyle = '#7c8894';
        ctx.fillRect(cx + p.facing * 10, p.y + 10, p.facing * 6, 4);
        ctx.fillRect(cx + p.facing * 14, p.y + 6, p.facing * 2, 12);
      }

      // Berserk aura
      if (berserk) {
        ctx.strokeStyle = `rgba(255, 77, 77, ${0.2 + Math.sin(Date.now() * 0.01) * 0.15})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, p.y + 20, 24, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // ── Original characters ──
      ctx.fillStyle = def.color;
      ctx.fillRect(cx - 8, p.y + 10, 16, 20);

      ctx.fillStyle = def.skinColor;
      ctx.beginPath();
      ctx.arc(cx, p.y + 8, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = def.color;
      ctx.fillRect(cx - 8, p.y + 2, 16, 5);

      ctx.fillStyle = '#000';
      ctx.fillRect(cx + p.facing * 2, p.y + 6, 3, 3);

      ctx.fillStyle = '#3a2a2a';
      const legSpread = p.attacking ? 6 : 0;
      ctx.fillRect(cx - 7, p.y + 30, 6, 12);
      ctx.fillRect(cx + 1 + legSpread, p.y + 30, 6, 12);

      ctx.fillStyle = def.skinColor;
      if (p.attacking || p.specialing) {
        ctx.fillRect(cx + p.facing * 8, p.y + 12, p.facing * 20, 6);
        ctx.fillStyle = '#7c8894';
        ctx.fillRect(cx + p.facing * 24, p.y + 10, p.facing * 12 + 4, 3);
      } else {
        ctx.fillRect(cx + p.facing * 2, p.y + 12, 6, 14);
        ctx.fillRect(cx - p.facing * 8, p.y + 12, 6, 14);
      }
    }

    // Magic aura for all when high
    if (p.magic >= 50 && !isWizard) {
      ctx.strokeStyle = `rgba(74, 158, 255, ${0.15 + Math.sin(Date.now() * 0.005) * 0.1})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, p.y + 20, 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _renderProjectiles(ctx) {
    if (!this.projectiles) return;
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      // Fireball glow
      ctx.fillStyle = 'rgba(255, 100, 50, 0.2)';
      ctx.beginPath();
      ctx.arc(p.x + p.width / 2, p.y + p.height / 2, 12, 0, Math.PI * 2);
      ctx.fill();
      // Fireball body
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.width, p.height);
      // Bright core
      ctx.fillStyle = '#fff8a0';
      ctx.fillRect(p.x + 2, p.y + 2, 4, p.height - 4);
    }
  }

  _renderBoss(ctx) {
    const b = this.boss;
    if (!b || !b.alive) return;

    const hpPct = b.hp / b.maxHp;
    const isEnraged = hpPct < 0.4;

    if (b.pattern === 'necromancy') {
      // ── Necromancer (Stage 4) ──
      // Dark aura
      ctx.fillStyle = `rgba(74, 130, 255, ${0.1 + Math.sin(Date.now() * 0.004) * 0.05})`;
      ctx.fillRect(b.x - 10, b.y - 10, b.width + 20, b.height + 20);

      // Floating cloak
      const cloakWave = Math.sin(Date.now() * 0.005) * 5;
      ctx.fillStyle = '#1a1a3a';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.width, b.y);
      ctx.lineTo(b.x + b.width + cloakWave, b.y + b.height);
      ctx.lineTo(b.x - cloakWave, b.y + b.height);
      ctx.closePath();
      ctx.fill();

      // Body (torso)
      ctx.fillStyle = isEnraged ? '#3a1a1a' : '#2a2a4a';
      ctx.fillRect(b.x + 8, b.y + 18, b.width - 16, b.height - 18);

      // Skull head
      ctx.fillStyle = '#e8e0d0';
      ctx.beginPath();
      ctx.arc(b.x + b.width / 2, b.y + 14, 12, 0, Math.PI * 2);
      ctx.fill();

      // Skull eyes (glowing)
      ctx.fillStyle = isEnraged ? '#ff4d4d' : '#4a9eff';
      const eyeGlow = 8 + Math.sin(Date.now() * 0.006) * 3;
      ctx.beginPath();
      ctx.arc(b.x + b.width / 2 - 5, b.y + 12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x + b.width / 2 + 5, b.y + 12, 4, 0, Math.PI * 2);
      ctx.fill();
      // Eye glow aura
      ctx.strokeStyle = isEnraged ? '#ff4d4d60' : '#4a9eff60';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x + b.width / 2 - 5, b.y + 12, eyeGlow, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x + b.width / 2 + 5, b.y + 12, eyeGlow, 0, Math.PI * 2);
      ctx.stroke();

      // Mouth (teeth)
      ctx.fillStyle = '#3a2a2a';
      ctx.fillRect(b.x + b.width / 2 - 6, b.y + 20, 12, 5);
      ctx.fillStyle = '#e8e0d0';
      for (let t = 0; t < 4; t++) {
        ctx.fillRect(b.x + b.width / 2 - 5 + t * 3, b.y + 20, 2, 3);
      }

      // Floating orbs
      const orbAngle = Date.now() * 0.003;
      for (let i = 0; i < 3; i++) {
        const oa = orbAngle + i * Math.PI * 2 / 3;
        const ox = b.x + b.width / 2 + Math.cos(oa) * 28;
        const oy = b.y + b.height / 2 + Math.sin(oa) * 15;
        ctx.fillStyle = isEnraged ? '#ff6b4a' : '#4a9eff';
        ctx.beginPath();
        ctx.arc(ox, oy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isEnraged ? '#ff4d4d40' : '#4a9eff40';
        ctx.beginPath();
        ctx.arc(ox, oy, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.pattern === 'inferno') {
      // ── Fire Dragon (Stage 5) ──
      // Heat aura
      ctx.fillStyle = `rgba(255, 80, 20, ${0.15 + Math.sin(Date.now() * 0.005) * 0.08})`;
      ctx.fillRect(b.x - 15, b.y - 10, b.width + 30, b.height + 20);

      // Body
      ctx.fillStyle = isEnraged ? '#8b1a1a' : '#6b2a1a';
      ctx.fillRect(b.x, b.y + 16, b.width, b.height - 16);

      // Chest plates (scales)
      ctx.fillStyle = isEnraged ? '#5a1a0a' : '#4a2a1a';
      for (let s = 0; s < 6; s++) {
        ctx.fillRect(b.x + 6 + s * 12, b.y + 22 + (s % 2) * 6, 10, 8);
      }

      // Wings
      const wingFlap = Math.sin(Date.now() * 0.004) * 12;
      ctx.fillStyle = isEnraged ? '#5a1a1a' : '#3a2a1a';
      ctx.beginPath();
      ctx.moveTo(b.x + 5, b.y + 20);
      ctx.lineTo(b.x - 25 + wingFlap, b.y + 10);
      ctx.lineTo(b.x - 15, b.y + 35);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(b.x + b.width - 5, b.y + 20);
      ctx.lineTo(b.x + b.width + 25 - wingFlap, b.y + 10);
      ctx.lineTo(b.x + b.width + 15, b.y + 35);
      ctx.closePath();
      ctx.fill();

      // Dragon head
      ctx.fillStyle = isEnraged ? '#9a2a1a' : '#7a3a1a';
      ctx.beginPath();
      ctx.arc(b.x + b.width / 2, b.y + 14, 16, 0, Math.PI * 2);
      ctx.fill();

      // Snout
      ctx.fillRect(b.x + b.width / 2 - 8, b.y + 18, 16, 10);

      // Eyes (slitted)
      ctx.fillStyle = isEnraged ? '#ff4d4d' : '#ffd700';
      ctx.fillRect(b.x + b.width / 2 - 8, b.y + 10, 6, 3);
      ctx.fillRect(b.x + b.width / 2 + 2, b.y + 10, 6, 3);
      ctx.fillStyle = '#000';
      ctx.fillRect(b.x + b.width / 2 - 6, b.y + 10, 2, 3);
      ctx.fillRect(b.x + b.width / 2 + 4, b.y + 10, 2, 3);

      // Fire nostrils
      const fireGlow = Math.sin(Date.now() * 0.01) * 3;
      ctx.fillStyle = '#ff6b4a';
      ctx.beginPath();
      ctx.arc(b.x + b.width / 2 - 3, b.y + 24, 2 + fireGlow, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x + b.width / 2 + 3, b.y + 24, 2 + fireGlow, 0, Math.PI * 2);
      ctx.fill();

      // Fire mane (enraged)
      if (isEnraged) {
        const maneFlame = Math.sin(Date.now() * 0.008) * 5;
        ctx.fillStyle = '#ff4d4d';
        ctx.beginPath();
        ctx.moveTo(b.x + b.width / 2 - 16, b.y + 8);
        ctx.lineTo(b.x + b.width / 2 - 12 + maneFlame, b.y - 8);
        ctx.lineTo(b.x + b.width / 2 - 3, b.y + 2);
        ctx.lineTo(b.x + b.width / 2 + 3, b.y + 2);
        ctx.lineTo(b.x + b.width / 2 + 12 - maneFlame, b.y - 8);
        ctx.lineTo(b.x + b.width / 2 + 16, b.y + 8);
        ctx.fill();
      }
    } else {
      // ── Generic boss (Stages 1-3) ──
      // Body
      ctx.fillStyle = isEnraged ? '#8b2a2a' : '#3a2a6b';
      ctx.fillRect(b.x, b.y, b.width, b.height);

      // Armor plates
      ctx.fillStyle = '#2a1a4a';
      ctx.fillRect(b.x + 8, b.y + 6, b.width - 16, 8);
      ctx.fillRect(b.x + 5, b.y + b.height - 12, b.width - 10, 6);

      // Eyes
      ctx.fillStyle = isEnraged ? '#ff4d4d' : '#ffd700';
      ctx.beginPath();
      ctx.arc(b.x + 16, b.y + 14, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x + b.width - 16, b.y + 14, 7, 0, Math.PI * 2);
      ctx.fill();
      // Pupils
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(b.x + 16, b.y + 14, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x + b.width - 16, b.y + 14, 3, 0, Math.PI * 2);
      ctx.fill();

      // Mouth / teeth
      if (isEnraged) {
        ctx.fillStyle = '#ff4d4d';
        ctx.fillRect(b.x + 16, b.y + 30, 28, 8);
        ctx.fillStyle = '#fff';
        for (let t = 0; t < 4; t++) {
          ctx.fillRect(b.x + 18 + t * 7, b.y + 30, 4, 4);
        }
      }

      // Arms
      ctx.fillStyle = '#4a3a7b';
      const armSwing = Math.sin(Date.now() * 0.005) * 10;
      ctx.fillRect(b.x - 10 + armSwing, b.y + 18, 12, 22);
      ctx.fillRect(b.x + b.width - 2 - armSwing, b.y + 18, 12, 22);
    }

    // HP bar (shared across all bosses)
    const barW = b.width;
    const barH = 6;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(b.x, b.y - 12, barW, barH);
    ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : hpPct > 0.25 ? '#ffb454' : '#ff4d4d';
    ctx.fillRect(b.x + 1, b.y - 11, (barW - 2) * hpPct, barH - 2);

    // Name label
    ctx.fillStyle = '#e7edf3';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(b.name, b.x + b.width / 2, b.y - 14);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderHUD(ctx) {
    setupHUDContext(ctx);

    // Score
    ctx.fillText(t('goldenaxe.score', { n: this.score }), 10, 10);

    // HP bar
    const hpPct = this.player.hp / this.player.maxHp;
    const hpBarW = 150;
    const hpBarH = 10;
    const hpY = 30;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(10, hpY, hpBarW, hpBarH);
    ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : hpPct > 0.25 ? '#ffb454' : '#e74c3c';
    ctx.fillRect(11, hpY + 1, (hpBarW - 2) * hpPct, hpBarH - 2);
    ctx.fillStyle = '#e7edf3';
    ctx.font = '10px monospace';
    ctx.fillText(`${this.player.hp}/${this.player.maxHp}`, 14, hpY + 1);
    ctx.font = '14px monospace';

    // MP bar (magic)
    const mpPct = this.player.magic / this.player.maxMagic;
    const mpBarW = 100;
    const mpBarH = 8;
    const mpY = 44;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(10, mpY, mpBarW, mpBarH);
    ctx.fillStyle = mpPct > 0 ? '#4a9eff' : '#2a2a3a';
    ctx.fillRect(11, mpY + 1, (mpBarW - 2) * mpPct, mpBarH - 2);
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '9px monospace';
    ctx.fillText(`MP:${this.player.magic}`, 12, mpY + 1);
    ctx.font = '14px monospace';

    // Character name
    ctx.fillText(CHAR_DEFS[this.player.charIdx].name, 10, 56);

    // Lives
    ctx.textAlign = 'right';
    ctx.fillText(t('goldenaxe.lives', { n: this.player.lives }), this.width - 10, 10);

    // Stage
    ctx.textAlign = 'center';
    ctx.fillText(t('goldenaxe.stage', { n: this.currentStage }), this.width / 2, 10);

    // Stage progress bar
    const progW = this.width - 40;
    const progX = 20;
    const progY = this.height - 14;
    const progress = Math.min(1, this.scrollX / this.bossX);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(progX, progY, progW, 4);
    ctx.fillStyle = progress >= 1 ? '#ffd700' : '#4a9eff';
    ctx.fillRect(progX + 1, progY + 1, (progW - 2) * progress, 2);

    // Combo display
    if (this.player.combo >= 2) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.player.combo}x COMBO!`, this.width / 2, this.height - 45);
      ctx.font = '14px monospace';
    }

    // Controls hint
    if (this.boss && this.boss.alive) {
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('J:ATK  K:SPECIAL  L:MAGIC  SPACE:JUMP', this.width - 10, this.height - 30);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _darkenColor(hex, factor) {
    // Simple hex darken
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
  }
}
