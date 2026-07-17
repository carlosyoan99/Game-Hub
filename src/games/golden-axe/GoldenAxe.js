/**
 * Golden Axe-like (Beat'em Up) — Refactorizado
 *
 * Versión modular: constants, entities, levels, ai, combat, render.
 * Este archivo orquesta el juego importando desde los submódulos.
 *
 * Mecánica: 5 personajes jugables, scroll lateral automático,
 * enemigos que aparecen de ambos lados, sistema de magia con
 * pociones, combos, y jefes al final de cada etapa.
 */
import { GameBase } from '../../engine/GameBase.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { clamp } from '../../engine/CollisionUtils.js';
import { t } from '../../engine/i18n.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';
import {
  CHAR_DEFS, ENEMY_TYPES, GRAVITY, MAX_FALL,
  ATTACK_DURATION, SPECIAL_DURATION, MAX_STAGES,
  BOSS_PATTERNS, BOSS_COLORS, BOSS_NAMES, BOSS_HEIGHTS, BOSS_WIDTHS,
} from './constants.js';
import { createPlayer, createEnemy, createPowerup } from './entities.js';
import { initStageConfig, generateEnemyWave, createBossMinions } from './levels.js';
import { doMagic, checkCollisions, handlePlayerDeath } from './combat.js';
import {
  updateBoss, updateBossBullets, updateEnemyAI, updateArcherBehavior,
  updateArrows, updateProjectiles,
} from './ai.js';
import {
  renderBackground, renderEnemies, renderPlayer, renderProjectiles,
  renderArrows, renderBossBullets, renderPowerups, renderParticles,
  renderBoss, renderHUD, renderSelect, renderLevelComplete,
  renderGameOver, renderBossWarning,
} from './render.js';

export class GoldenAxe extends GameBase {

  init(engine) {
    super.init(engine, 'golden-axe');
    this.highscore = this.storage.get('highscore', 0);
    this.startTime = Date.now();
    this.currentStage = this.storage.get('savedStage', 1);
    this.phase = 'select';
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

  // ── Setup ─────────────────────────────────────────────────────────

  _startSelect() {
    this.phase = 'select';
    this.selectedChar = 0;
    this.selectBlink = 0;
  }

  _startGame() {
    this.player = createPlayer(this.selectedChar, this.height);
    this.enemies = [];
    this.particles = [];
    this.powerups = [];
    this.projectiles = [];
    this.arrows = [];
    this.boss = null;
    this.bossBullets = [];
    this.score = 0;
    this.phase = 'playing';
    this.scrollX = 0;
    this.stageCleared = false;
    this.stageScore = 0;
    this.comboParticles = [];
    this._initStage();
  }

  _initStage() {
    const cfg = initStageConfig(this.currentStage);
    this.scrollSpeed = cfg.scrollSpeed;
    this.stageLength = cfg.stageLength;
    this.bossX = cfg.bossX;
    this.enemyQueue = generateEnemyWave(this.currentStage, this.rng);
    this.enemyTimer = 0;
    this.spawnedCount = 0;
    this.maxEnemies = cfg.maxEnemies;
  }

  // ── Update ────────────────────────────────────────────────────────

  update(dt) {
    if (this.phase === 'select') { this._updateSelect(dt); return; }
    if (this.phase === 'level-complete') {
      if (this.input.wasActionPressed('next') || this.input.mouse.clickedThisFrame) this._nextStage();
      return;
    }
    if (this.handleRestartInput()) return;

    this.scrollX += this.scrollSpeed * dt;
    this.scrollX = Math.min(this.scrollX, this.stageLength - 800);

    if (this.player.dead) {
      this._updateRespawn(dt);
      return;
    }

    if (this.scrollX >= this.bossX && !this.boss && !this.stageCleared) {
      this._spawnBoss();
    }

    this._updatePlayer(dt);
    this._spawnEnemies(dt);
    this._updateEnemies(dt);
    this._updateBossLogic(dt);
    this._updateProjectiles(dt);
    this._updatePowerups(dt);
    this._updateParticles(dt);
    this._resolveCombat();
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

  _updateRespawn(dt) {
    this.player.respawnTimer -= dt;
    if (this.player.respawnTimer <= 0 && this.player.lives > 0) {
      this.player.dead = false;
      this.player.x = this.scrollX + 40;
      this.player.y = this.height - 100;
      this.player.vx = 0; this.player.vy = 0;
      this.player.hp = Math.floor(this.player.maxHp * 0.5);
      this.player.invincible = 2;
      this.player.magic = Math.floor(this.player.def.magicBase * 0.5);
    }
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (p.invincible > 0) p.invincible -= dt;
    if (p.hitstunTimer > 0) { p.hitstunTimer -= dt; return; }

    if (p.attacking || p.specialing) {
      p.attackTimer -= dt;
      if (p.attackTimer <= 0) { p.attacking = false; p.specialing = false; }
    }

    const left = this.input.isActionDown('moveLeft');
    const right = this.input.isActionDown('moveRight');
    let mx = 0;
    if (left && !right) { mx = -1; p.facing = -1; }
    else if (right && !left) { mx = 1; p.facing = 1; }
    p.vx = mx * p.def.speed;

    if (this.input.wasActionPressed('jump') && p.onGround) {
      p.vy = p.def.jumpVel;
      p.onGround = false;
      AudioManager.sfx({ type: 'platformer_jump', volume: 0.2 });
    }

    const isWizard = p.def.id === 'wizard';
    if (isWizard && this.input.wasActionPressed('attack') && !p.attacking && !p.specialing) {
      p.attacking = true;
      p.attackTimer = ATTACK_DURATION * 0.6;
      this.projectiles.push({
        x: p.x + (p.facing > 0 ? p.width : -10), y: p.y + 12,
        vx: p.facing * 350, vy: 0,
        width: 12, height: 8, damage: p.def.attackDamage,
        alive: true, life: 1.5, color: '#ff6b4a',
      });
      AudioManager.sfx({ type: 'shoot', volume: 0.2 });
    } else if (!isWizard && this.input.wasActionPressed('attack') && !p.attacking && !p.specialing) {
      p.attacking = true;
      p.attackTimer = ATTACK_DURATION;
      AudioManager.sfx({ type: 'hit', volume: 0.25 });
    }

    if (this.input.wasActionPressed('special') && !p.specialing && !p.attacking && p.magic >= p.def.magicCost) {
      if (isWizard) {
        for (let i = 0; i < 3; i++) {
          this.projectiles.push({
            x: p.x + (p.facing > 0 ? p.width : -10), y: p.y + 8 + i * 8,
            vx: p.facing * (250 + i * 40), vy: (i - 1) * 30,
            width: 14, height: 10, damage: p.def.specialDamage,
            alive: true, life: 2, color: '#4a9eff',
          });
        }
        p.magic -= p.def.magicCost;
        p.specialing = true;
        p.attackTimer = SPECIAL_DURATION * 0.5;
        AudioManager.sfx({ type: 'shoot', volume: 0.35 });
      } else {
        p.specialing = true;
        p.attackTimer = SPECIAL_DURATION;
        p.magic -= p.def.magicCost;
        AudioManager.sfx({ type: 'powerup', volume: 0.3 });
        this._emitParticles(p.x + p.width / 2, p.y + 10, '#ffd700', 8);
      }
    }

    if (this.input.wasActionPressed('magic') && !p.attacking && !p.specialing && p.magic >= p.def.magicCost) {
      const result = doMagic(p, this.enemies, this.boss, this.particles);
      if (result.bossDefeated) { this._onBossDefeated(); }
    }

    const isBarbarian = p.def.id === 'barbarian';
    p.berserkActive = isBarbarian && p.hp < p.maxHp * 0.3 && p.hp > 0;

    if (isWizard && p.magic < p.maxMagic) {
      p.magic = Math.min(p.maxMagic, p.magic + 3 * dt);
    }

    if (!p.onGround) {
      p.vy += GRAVITY * dt;
      p.vy = Math.min(p.vy, MAX_FALL);
    }
    p.y += p.vy * dt;
    if (p.y >= this.height - 60) {
      p.y = this.height - 60; p.vy = 0; p.onGround = true;
    }
    p.x = clamp(p.x + p.vx * dt, this.scrollX, this.scrollX + this.width - p.width);

    if (p.y > this.height + 100) this._onPlayerDeath();
  }

  _spawnEnemies(dt) {
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0 && this.enemyQueue.length > 0 && this.spawnedCount < this.maxEnemies) {
      const entry = this.enemyQueue.shift();
      this.enemies.push(createEnemy(entry, ENEMY_TYPES[entry.type], this.scrollX, this.width, this.height));
      this.spawnedCount++;
      this.enemyTimer = Math.max(0.4, 1.0 - this.currentStage * 0.1 + this.rng.next() * 0.5);
    }
  }

  _updateEnemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.x < this.scrollX - 100 || e.x > this.scrollX + this.width + 100) { e.alive = false; continue; }
      updateEnemyAI(e, this.player, dt, this.height, this.rng);
      updateArcherBehavior(e, this.player, dt, this.arrows, this.rng);
    }
    this.enemies = this.enemies.filter(e => e.alive);
    this.arrows = updateArrows(this.arrows, dt);
  }

  _updateBossLogic(dt) {
    if (!this.boss || !this.boss.alive) return;
    const result = updateBoss(this.boss, this.player, dt, this.scrollX, this.width, this.height, this.bossX, this.rng);
    if (result.minions.length > 0) this.enemies.push(...result.minions);
    this.bossBullets.push(...result.bossBullets);
    this.bossBullets = updateBossBullets(this.bossBullets, this.player, dt, this.scrollX, this.width, this.height);
  }

  _updateProjectiles(dt) {
    if (!this.projectiles) return;
    const result = updateProjectiles(
      this.projectiles, this.enemies, this.boss, dt,
      {
        onProjectileHitEnemy: (e, p) => this._emitParticles(e.x + e.width / 2, e.y + e.height / 2, p.color, 6),
        onProjectileHitBoss: (p) => this._emitParticles(p.x, p.y, p.color, 8),
        onEnemyKilled: (e) => {
            this.score += e.score;
            this._emitParticles(e.x + e.width / 2, e.y + e.height / 2, '#ff6b4a', 12);
          if (this.rng.next() < 0.15) {
            const type = this.rng.next() < 0.6 ? 'potion' : 'hp';
              this.powerups.push(createPowerup(e.x, e.y, type));
            }
          },
      }
    );
    this.projectiles = result.projectiles;
    if (result.bossDefeated) this._onBossDefeated();
  }

  _updatePowerups(dt) {
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      pu.y += pu.vy * dt;
      pu.vy += 400 * dt;
      if (pu.y > this.height - 60) { pu.y = this.height - 60; pu.vy = 0; }
    }
    this.powerups = this.powerups.filter(p => p.active);
  }

  _updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 500 * dt; p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  _resolveCombat() {
    const result = checkCollisions(
      this.player, this.enemies, this.boss,
      this.arrows, this.bossBullets, this.powerups, this.particles, this.comboParticles,
      this.projectiles, this.rng,
    );
    if (result.scoreAdd) this.score += result.scoreAdd;
    if (result.bossDefeated) this._onBossDefeated();
  }

  _updateCombos(dt) {
    if (this.comboParticles) {
      for (const c of this.comboParticles) c.life -= dt;
      this.comboParticles = this.comboParticles.filter(c => c.life > 0);
    }
    if (this.player.comboTimer > 0) {
      this.player.comboTimer -= dt;
      if (this.player.comboTimer <= 0) this.player.combo = 0;
    }
  }

  // ── Game Events ──────────────────────────────────────────────────

  _onPlayerDeath() {
    const gameOver = handlePlayerDeath(this.player, this.particles);
    if (gameOver) this._endGame(false);
  }

  _spawnBoss() {
    const stage = this.currentStage;
    this.boss = {
      x: this.bossX + 100, y: this.height - 120,
      width: BOSS_WIDTHS[stage - 1] || 60,
      height: BOSS_HEIGHTS[stage - 1] || 50,
      hp: 30 + stage * 15, maxHp: 30 + stage * 15,
      alive: true, dir: -1, speed: 50 + stage * 5,
      fireTimer: 2, pattern: BOSS_PATTERNS[stage - 1] || 'spread',
      name: BOSS_NAMES[stage - 1] || 'Boss',
      color: BOSS_COLORS[stage - 1] || '#3a2a6b',
      enraged: false,
    };
    this.bossBullets = [];
    const minions = createBossMinions(stage, this.bossX, this.height);
    if (minions.length > 0) this.enemies.push(...minions);
    AudioManager.sfx({ type: 'powerup', volume: 0.5 });
  }

  _onBossDefeated() {
    this.score += 2000;
    this._emitParticles(this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#ffd700', 30);
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
    this.player.dead = false;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
    this.player.magic = Math.min(this.player.maxMagic, this.player.magic + 20);
    this.player.lives = Math.max(this.player.lives, 2);
    this.player.x = 40; this.player.y = this.height - 60;
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
  }

  _endGame(won) {
    this.phase = won ? 'won' : 'lost';
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

  _emitParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (this.rng.next() - 0.5) * 250,
        vy: -this.rng.next() * 200 - 50,
        life: 0.3 + this.rng.next() * 0.4,
        color,
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.phase === 'select') {
      renderSelect(ctx, this.width, this.height, this.selectedChar, this.selectBlink);
      return;
    }

    renderBackground(ctx, this.width, this.height, this.scrollX);

    ctx.save();
    ctx.translate(-this.scrollX, 0);

    renderEnemies(ctx, this.enemies, this.player.x);
    if (this.boss && this.boss.alive) renderBoss(ctx, this.boss);
    renderBossBullets(ctx, this.bossBullets);
    renderProjectiles(ctx, this.projectiles);
    renderArrows(ctx, this.arrows);
    renderPowerups(ctx, this.powerups);
    if (!this.player.dead) {
      const blink = this.player.invincible > 0 && Math.floor(this.player.invincible * 10) % 2 === 0;
      if (!blink) renderPlayer(ctx, this.player);
    }
    renderParticles(ctx, this.particles);

    ctx.restore();

    renderHUD(ctx, this.width, this.height, this.player, this.score, this.highscore,
      this.currentStage, this.boss, this.stageLength, this.scrollX, this.bossX, this.comboParticles);
    renderBossWarning(ctx, this.width, this.boss);

    if (this.phase === 'level-complete') renderLevelComplete(ctx, this.width, this.height);
    if (this.phase === 'won' || this.phase === 'lost') {
      renderGameOver(ctx, this.width, this.height, this.phase === 'won', this.score);
    }
  }
}
