/**
 * Space Harrier-like (Pseudo-3D Shooter)
 *
 * Mecánica: scroll perpetuo hacia adelante con efecto pseudo-3D,
 * enemigos que se acercan desde el horizonte, disparo automático,
 * power-ups y jefes de etapa.
 *
 * Módulos:
 *   constants.js — Constantes de juego, niveles, tipos de enemigos
 *   enemies.js   — Lógica de enemigos, jefe, balas, partículas, colisiones
 *   render.js    — Renderizado pseudo-3D, escenario, HUD, overlays
 */
import { GameBase } from '../../engine/GameBase.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { clamp } from '../../engine/CollisionUtils.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

import { STAGES, STAGES_COUNT, Z_FAR, Z_NEAR, BULLET_INTERVAL, PLAYER_SPEED, PLAYER_MARGIN, HORIZON_Y, GROUND_OFFSET, PLAYER_Y } from './constants.js';
import { updateParticles } from '../../engine/ParticleSystem.js';

import {
  spawnEnemy, updateEnemies, fireBullet, fireChargeAttack,
  updateBullets, updateEnemyBullets, updatePowerups,
  createBoss, updateBoss, checkCollisions,
} from './enemies.js';
import { renderGame } from './render.js';

export class SpaceHarrier extends GameBase {
  init(engine) {
    super.init(engine, 'space-harrier');
    this.highscore = this.storage.get('highscore', 0);
    this.currentStage = this.storage.get('savedStage', 1);
    this.startTime = Date.now();
    this._startStage();
  }

  _defaultBindings() {
    return {
      moveLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      moveUp:    ['ArrowUp', 'KeyW', 'GamepadUp', 'GamepadLStickUp'],
      moveDown:  ['ArrowDown', 'KeyS', 'GamepadDown', 'GamepadLStickDown'],
      fire:      ['KeyJ', 'Space', 'GamepadA', 'MouseLeft'],
      restart:   ['Space', 'GamepadStart', 'GamepadA'],
      next:      ['Space', 'GamepadA', 'GamepadStart'],
    };
  }

  _startStage() {
    this.stageIdx = Math.min(this.currentStage - 1, STAGES_COUNT - 1);
    this.stageConfig = STAGES[this.stageIdx];

    this.player = {
      x: this.width / 2,
      y: PLAYER_Y,
      width: 24, height: 32,
      lives: 3,
      power: 0,
      maxPower: 5,
      invincible: 0,
      chargeTimer: 0,
      charged: false,
    };

    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.powerups = [];
    this.stageProgress = 0;
    this.scrollSpeed = 300;
    this.boss = null;
    this.bossBullets = [];
    this.bossZBob = 0;
    this.fireTimer = 0;
    this.score = 0;
    this.stageScore = 0;
    this.phase = 'intro';
    this.introTimer = 2;
    this.groundOffset = 0;
    this.enemyTimer = 0;
    this.bossDefeatedThisStage = false;

    this._spawnInitialEnemies();
  }

  _spawnInitialEnemies() {
    for (let i = 0; i < 5; i++) {
      const z = Z_FAR - (Z_FAR - Z_NEAR) * (i / 6);
      const enemy = spawnEnemy(this, z);
      if (enemy) this.enemies.push(enemy);
    }
  }

  update(dt) {
    if (this.phase === 'intro') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) this.phase = 'playing';
      return;
    }

    if (this.phase === 'stage_clear') {
      if (this.input.wasActionPressed('next') || this.input.mouse.clickedThisFrame) this._nextStage();
      return;
    }

    if (this.handleRestartInput()) return;

    this.stageProgress += dt / 50;
    this.stageProgress = Math.min(this.stageProgress, 1);

    this.groundOffset = (this.groundOffset + dt * this.scrollSpeed) % 64;

    const left = this.input.isActionDown('moveLeft');
    const right = this.input.isActionDown('moveRight');
    const up = this.input.isActionDown('moveUp');
    const down = this.input.isActionDown('moveDown');

    if (left && !right) this.player.x -= PLAYER_SPEED * dt;
    if (right && !left) this.player.x += PLAYER_SPEED * dt;
    if (up && !down) this.player.y -= PLAYER_SPEED * dt;
    if (down && !up) this.player.y += PLAYER_SPEED * dt;

    this.player.x = clamp(this.player.x, PLAYER_MARGIN, this.width - PLAYER_MARGIN - this.player.width);
    this.player.y = clamp(this.player.y, HORIZON_Y + 10, GROUND_OFFSET - this.player.height);

    if (this.player.invincible > 0) this.player.invincible -= dt;

    if (this.input.isActionDown('fire')) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        fireBullet(this, this.player, this.bullets);
        this.fireTimer = BULLET_INTERVAL / (1 + this.player.power * 0.3);
      }
      this.player.chargeTimer += dt;
      if (this.player.chargeTimer > 1.5) this.player.charged = true;
    } else {
      if (this.player.charged) {
        fireChargeAttack(this, this.player, this.enemies, this.particles);
      }
      this.player.chargeTimer = 0;
      this.player.charged = false;
    }

    updateEnemies(this.enemies, dt, this.enemyBullets);
    this.enemies = this.enemies.filter(e => e.alive);

    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0 && !this.boss && this.stageProgress < 0.85) {
      const z = Z_FAR - 50 - Math.random() * 100;
      const enemy = spawnEnemy(this, z);
      if (enemy) this.enemies.push(enemy);
      this.enemyTimer = this.stageConfig.enemyInterval * (0.5 + Math.random());
    }

    if (this.stageProgress >= 0.85 && !this.boss && !this.bossDefeatedThisStage) {
      this.boss = createBoss(this);
      this.bossBullets = [];
      this.enemyTimer = 999;
      AudioManager.sfx({ type: 'powerup', volume: 0.4 });
    }

    if (this.boss && this.boss.alive) {
      this.bossZBob = updateBoss(this.boss, dt, this.bossBullets);
    }
    this.bossBullets = (this.bossBullets || []).filter(b => b.alive);

    this.bullets = updateBullets(this.bullets, dt);
    this.enemyBullets = updateEnemyBullets(this.enemyBullets, dt);
    this.particles = updateParticles(this.particles, dt, 300);
    this.powerups = updatePowerups(this.powerups, dt);

    checkCollisions(this);

    if (this.stageProgress >= 1 && !this.boss && !this.bossDefeatedThisStage) {
      this._clearStage();
    }
  }

  _clearStage() {
    if (this.bossDefeatedThisStage) {
      if (this.currentStage >= STAGES_COUNT) {
        this._endGame(true);
        return;
      }
    }
    this.phase = 'stage_clear';
    this.score += Math.floor(this.stageProgress * 1000);
    AudioManager.sfx({ type: 'powerup', volume: 0.5 });
    HapticManager.vibrate('powerup');
    ProgressionManager.checkAchievement('space-harrier', 'first-clear');
  }

  _nextStage() {
    this.currentStage++;
    this.storage.set('savedStage', this.currentStage);
    this._startStage();
  }

  _endGame(won) {
    this.phase = won ? 'won' : 'lost';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('space-harrier', this.score, won, duration);
    if (won) ProgressionManager.checkAchievement('space-harrier', 'harrier-ace');
    if (this.stageIdx >= 2) ProgressionManager.checkAchievement('space-harrier', 'sky-warrior');
    if (this.player.lives >= 3) ProgressionManager.checkAchievement('space-harrier', 'perfect-run');
  }

  render(ctx) {
    renderGame(ctx, this);
  }
}
