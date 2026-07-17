/**
 * Contra-like (Run & Gun)
 *
 * Mecánica: scroll lateral automático con plataformas. El jugador
 * se mueve en 8 direcciones, salta y dispara. Power-ups de armas
 * caen de enemigos. Oleadas de enemigos con jefes intermedios.
 *
 * Módulos:
 *   levels.js — Constantes de nivel, datos de stages, tiles
 *   weapons.js — Definiciones de armas, creación de balas
 *   enemies.js — Enemigos, jefes, power-ups y partículas
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

import { TILE, GRAVITY, STAGE_LENGTH, BOSS_SCROLL_X, STAGES, MAX_STAGE, LEGEND } from './levels.js';
import { MOVE_SPEED, JUMP_VEL, WEAPONS, WEAPON_LIST, createBullets } from './weapons.js';
import { spawnParticles, updateParticles } from '../../engine/ParticleSystem.js';

import {
  createEnemy, updateEnemy,
  createBoss, updateBoss, updateBossBullets,
  createPowerup, updatePowerups,
} from './enemies.js';

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
    this._updateBossLogic(dt);
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

    // Jump
    if (this.input.wasActionPressed('jump') && this.player.onGround) {
      this.player.vy = JUMP_VEL;
      this.player.onGround = false;
      AudioManager.sfx({ type: 'platformer_jump', volume: 0.25 });
    }

    this.player.vy = Math.min(this.player.vy, 800); // MAX_FALL
    const result = this.tilemap.resolveAABB(this.player, this.player.vx, this.player.vy, dt);
    if (result.onGround || result.onCeiling) this.player.vy = 0;
    this.player.onGround = result.onGround;

    // Clamp to stage bounds (relative to scroll)
    const minX = this.scrollX;
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
      const idx = WEAPON_LIST.indexOf(this.player.weapon);
      this.player.weapon = WEAPON_LIST[(idx + 1) % WEAPON_LIST.length];
    }
  }

  _fireBullet() {
    if (this.fireTimer > 0) return;
    const w = WEAPONS[this.player.weapon];
    this.fireTimer = w.fireRate;

    const newBullets = createBullets(this.player, this.player.weapon, this.player.facing);
    this.bullets.push(...newBullets);
    AudioManager.sfx({ type: 'shoot', volume: 0.15 });
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
      state.timer -= 1 / 60;
      if (state.timer <= 0 && state.count < state.total) {
        const enemy = createEnemy(zone.type, zone.atX, TILE * 14);
        if (enemy) this.enemies.push(enemy);
        state.count++;
        state.timer = state.interval;
      }
      if (state.count >= state.total) {
        this.spawnedZones.add(zone.atX);
      }
    }
  }

  _updateFireTimer(dt) {
    if (this.fireTimer > 0) this.fireTimer -= dt;
  }

  _updateEnemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const newBullets = updateEnemy(e, dt, this.player, this.tilemap, this.scrollX, this.width);
      this.enemyBullets.push(...newBullets);
    }
    this.enemies = this.enemies.filter(e => e.alive);
  }

  _updatePowerups(dt) {
    this.powerups = updatePowerups(this.powerups, dt, this.tilemap);
  }

  _updateParticles(dt) {
    this.particles = updateParticles(this.particles, dt);
  }

  // ── Boss ──────────────────────────────────────────────────────────────

  _spawnBoss() {
    const cfg = this.stageConfig.boss;
    this.boss = createBoss(cfg);
    this.bossBullets = [];
    this.scrollSpeed = 0; // Stop scrolling for boss fight
    AudioManager.sfx({ type: 'powerup', volume: 0.5 });
  }

  _updateBossLogic(dt) {
    if (!this.boss || !this.boss.alive) return;
    const newBullets = updateBoss(this.boss, dt, this.player);
    this.bossBullets.push(...newBullets);
    this.bossBullets = updateBossBullets(this.bossBullets, dt, this.tilemap, this.scrollX, this.width);
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
          spawnParticles(this.particles, e.x + e.width / 2, e.y + e.height / 2, '#ffb454', 4);
          if (e.hp <= 0) {
            e.alive = false;
            this.score += e.type === 'turret' ? 200 : 100;
            spawnParticles(this.particles, e.x + e.width / 2, e.y + e.height / 2, '#ff6b4a', 10);

            // Drop powerup (20% chance)
            if (Math.random() < 0.2) {
              this.powerups.push(createPowerup(e.x, e.y));
            }
          }
          break;
        }
      }

      // Player bullets vs boss
      if (this.boss && this.boss.alive && aabbIntersects(bBox, this.boss)) {
        b.alive = false;
        this.boss.hp -= b.damage;
        spawnParticles(this.particles, this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#ffb454', 6);
        if (this.boss.hp <= 0) {
          this.boss.alive = false;
          this.score += 1000;
          spawnParticles(this.particles, this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#ffd700', 30);
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
          spawnParticles(this.particles, pu.x + 8, pu.y + 8, '#ffd700', 8);
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
    spawnParticles(this.particles, this.player.x + 10, this.player.y + 14, '#ff4d4d', 6);
  }

  _playerDeath() {
    this.player.dead = true;
    this.player.lives--;
    this.player.respawnTimer = 2;
    AudioManager.sfx({ type: 'explosion', volume: 0.5 });
    HapticManager.vibrate('explosion');
    spawnParticles(this.particles, this.player.x + 10, this.player.y + 14, '#ff6b4a', 15);

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
}
