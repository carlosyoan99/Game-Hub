/**
 * Space Harrier-like (Pseudo-3D Shooter)
 * Nivel 4 — Shooter sobre raíles con profundidad simulada
 *
 * Mecánica: scroll perpetuo hacia adelante con efecto pseudo-3D,
 * enemigos que se acercan desde el horizonte, disparo automático,
 * power-ups y jefes de etapa.
 */
import { GameBase } from '../../engine/GameBase.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { clamp } from '../../engine/CollisionUtils.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ─── Constantes ───────────────────────────────────────────────────────

const GROUND_OFFSET = 420;  // Y donde empieza el suelo
const HORIZON_Y = 180;      // Línea del horizonte
const PLAYER_Y = GROUND_OFFSET - 30;
const PLAYER_MARGIN = 20;
const PLAYER_SPEED = 300;

const Z_FAR = 1000;   // Distancia máxima (horizonte)
const Z_NEAR = 40;    // Distancia mínima (justo frente al player)

const BULLET_SPEED = 600;
const BULLET_INTERVAL = 0.15;

const STAGE_LENGTH = 600;  // Unidades de avance por etapa (medida en Z)
const STAGES_COUNT = 3;

// ─── Temas de escenario ───────────────────────────────────────────────

const STAGES = [
  {
    name: 'harrier.stage1.name',
    groundColor1: '#3a6a2a', groundColor2: '#4a8a3a', skyTop: '#4a8aff', skyBottom: '#87ceeb',
    enemyInterval: 1.5, enemySpeed: 1.0, bossHp: 20,
  },
  {
    name: 'harrier.stage2.name',
    groundColor1: '#8a5a2a', groundColor2: '#a07030', skyTop: '#ff6b4a', skyBottom: '#ffb454',
    enemyInterval: 1.2, enemySpeed: 1.3, bossHp: 25,
  },
  {
    name: 'harrier.stage3.name',
    groundColor1: '#3a2a4a', groundColor2: '#4a3a5a', skyTop: '#1a0a2a', skyBottom: '#2a0a3a',
    enemyInterval: 0.9, enemySpeed: 1.5, bossHp: 30,
  },
];

// ─── Tipos de enemigos ────────────────────────────────────────────────

const ENEMY_TYPES = {
  soldier: { hp: 2, damage: 1, score: 100, color: '#c84848', w: 16, h: 20, speedZ: 120 },
  bomber:  { hp: 3, damage: 1, score: 200, color: '#8b3a8b', w: 20, h: 16, speedZ: 90 },
  turret:  { hp: 4, damage: 1, score: 300, color: '#5a7a3a', w: 18, h: 18, speedZ: 60 },
  runner:  { hp: 1, damage: 1, score: 50,  color: '#ff6b4a', w: 14, h: 14, speedZ: 200 },
};

// ─── Utilidad de proyección ──────────────────────────────────────────

/**
 * Convierte coordenadas Z (profundidad) en un factor de escala y
 * posición Y en la pantalla. Z = Z_FAR está en el horizonte,
 * Z = Z_NEAR está justo frente al jugador.
 */
function projectZ(z) {
  const t = clamp((z - Z_NEAR) / (Z_FAR - Z_NEAR), 0, 1);
  const scale = 0.15 + (1 - t) * 0.85;  // 1.0 (cerca) → 0.15 (lejos)
  const y = HORIZON_Y + (GROUND_OFFSET - HORIZON_Y) * (1 - t);
  return { scale, y, t };
}

// ─── Clase principal ─────────────────────────────────────────────────

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

  // ─── Inicialización ─────────────────────────────────────────────────

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
    this.stageProgress = 0; // 0..1
    this.scrollSpeed = 300;
    this.boss = null;
    this.bossBullets = [];
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
    // Spawn some enemies spread across the depth
    for (let i = 0; i < 5; i++) {
      const z = Z_FAR - (Z_FAR - Z_NEAR) * (i / 6);
      this._spawnEnemy(z);
    }
  }

  _spawnEnemy(z) {
    const types = Object.keys(ENEMY_TYPES);
    const typeKey = types[Math.floor(Math.random() * types.length)];
    const type = ENEMY_TYPES[typeKey];
    const x = PLAYER_MARGIN + Math.random() * (this.width - PLAYER_MARGIN * 2);
    const xMove = (Math.random() - 0.5) * 60;

    this.enemies.push({
      x, z,
      worldX: x, // x in world coords (horizontal position in 3D space)
      vx: xMove,
      vz: -type.speedZ, // moving toward player
      width: type.w, height: type.h,
      hp: type.hp, maxHp: type.hp,
      damage: type.damage,
      score: type.score,
      color: type.color,
      type: typeKey,
      alive: true,
      fireTimer: typeKey === 'turret' ? 2 + Math.random() : 0,
      scale: 1,
    });
  }

  // ─── Update ─────────────────────────────────────────────────────────

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

    // ── Gameplay ────────────────────────────────────────────────────

    // Advance stage progress (~50 seconds per stage)
    this.stageProgress += dt / 50;
    this.stageProgress = Math.min(this.stageProgress, 1);

    // Auto-scroll = ground moves toward player
    this.groundOffset = (this.groundOffset + dt * this.scrollSpeed) % 64;

    // Player input
    const left = this.input.isActionDown('moveLeft');
    const right = this.input.isActionDown('moveRight');
    const up = this.input.isActionDown('moveUp');
    const down = this.input.isActionDown('moveDown');

    if (left && !right) this.player.x -= PLAYER_SPEED * dt;
    if (right && !left) this.player.x += PLAYER_SPEED * dt;
    if (up && !down) this.player.y -= PLAYER_SPEED * dt;
    if (down && !up) this.player.y += PLAYER_SPEED * dt;

    // Clamp player to screen
    this.player.x = clamp(this.player.x, PLAYER_MARGIN, this.width - PLAYER_MARGIN - this.player.width);
    this.player.y = clamp(this.player.y, HORIZON_Y + 10, GROUND_OFFSET - this.player.height);

    // Invincibility
    if (this.player.invincible > 0) this.player.invincible -= dt;

    // Auto-fire
    if (this.input.isActionDown('fire')) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this._fireBullet();
        this.fireTimer = BULLET_INTERVAL / (1 + this.player.power * 0.3);
      }
      // Charge attack
      this.player.chargeTimer += dt;
      if (this.player.chargeTimer > 1.5) this.player.charged = true;
    } else {
      // Release charge
      if (this.player.charged) {
        this._fireChargeAttack();
      }
      this.player.chargeTimer = 0;
      this.player.charged = false;
    }

    // Update enemies
    this._updateEnemies(dt);

    // Spawn new enemies
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0 && !this.boss && this.stageProgress < 0.85) {
      const z = Z_FAR - 50 - Math.random() * 100;
      this._spawnEnemy(z);
      this.enemyTimer = this.stageConfig.enemyInterval * (0.5 + Math.random());
    }

    // Spawn boss at 85% progress
    if (this.stageProgress >= 0.85 && !this.boss && !this.bossDefeatedThisStage) {
      this._spawnBoss();
    }

    // Update boss
    if (this.boss && this.boss.alive) {
      this._updateBoss(dt);
    }

    // Update projectiles
    this._updateBullets(dt);
    this._updateEnemyBullets(dt);
    this._updateParticles(dt);
    this._updatePowerups(dt);

    // Collision
    this._checkCollisions();

    // Check stage clear
    if (this.stageProgress >= 1 && !this.boss && !this.bossDefeatedThisStage) {
      this._clearStage();
    }
  }

  _fireBullet() {
    const bx = this.player.x + this.player.width / 2;
    const by = this.player.y;
    AudioManager.sfx({ type: 'shoot', volume: 0.1 });

    // Power level determines number of shots
    const count = 1 + Math.floor(this.player.power / 2);
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.08;
      this.bullets.push({
        x: bx, y: by,
        vx: Math.sin(spread) * BULLET_SPEED * 0.3,
        vy: -BULLET_SPEED * Math.cos(spread),
        radius: 3,
        damage: 1 + Math.floor(this.player.power / 3),
        life: 2,
        color: this.player.power >= 4 ? '#ff6b4a' : this.player.power >= 2 ? '#4a9eff' : '#ffd700',
      });
    }
  }

  _fireChargeAttack() {
    AudioManager.sfx({ type: 'explosion', volume: 0.4 });
    this.player.charged = false;
    this.player.chargeTimer = 0;

    // Wide blast that hits all enemies in a column
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const proj = projectZ(e.z);
      const sx = e.worldX * proj.scale + (this.width / 2 - this.width / 2 * proj.scale);
      // Check if roughly in front of player
      if (Math.abs(sx - (this.player.x + this.player.width / 2)) < 80) {
        e.hp -= 5;
        this._spawnParticles(sx, proj.y, '#ffd700', 6);
        if (e.hp <= 0) {
          e.alive = false;
          this.score += e.score * 2;
          this.stageScore += e.score * 2;
          this._spawnParticles(sx, proj.y, '#ff6b4a', 10);
        }
      }
    }
  }

  _updateEnemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) continue;

      // Move toward player (decrease Z)
      e.z += e.vz * dt;
      e.worldX += e.vx * dt;

      // Clamp Z so we don't go past the player
      if (e.z < Z_NEAR) {
        e.alive = false;
        continue;
      }
      if (e.z > Z_FAR + 100) {
        e.alive = false;
        continue;
      }

      // Turret shooting
      if (e.type === 'turret' && e.z < Z_FAR * 0.5) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = 1.5 + Math.random();
          this.enemyBullets.push({
            x: e.worldX, z: e.z,
            vx: 0, vz: -200,
            radius: 4,
            alive: true,
          });
        }
      }
    }
    this.enemies = this.enemies.filter(e => e.alive);
  }

  _updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    this.bullets = this.bullets.filter(b => b.life > 0 && b.y > -20);
  }

  _updateEnemyBullets(dt) {
    for (const b of this.enemyBullets) {
      b.z += b.vz * dt;
    }
    this.enemyBullets = this.enemyBullets.filter(b => b.z >= Z_NEAR && b.z <= Z_FAR);
  }

  _updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  _updatePowerups(dt) {
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      pu.z += pu.vz * dt;
      pu.y += Math.sin(Date.now() * 0.006 + pu.x) * 20 * dt;
    }
    this.powerups = this.powerups.filter(p => p.active && p.z >= Z_NEAR);
  }

  // ─── Boss ───────────────────────────────────────────────────────────

  _spawnBoss() {
    this.boss = {
      z: Z_FAR * 0.6,
      worldX: this.width / 2,
      hp: this.stageConfig.bossHp,
      maxHp: this.stageConfig.bossHp,
      alive: true,
      dir: 1,
      speed: 60,
      fireTimer: 1.5,
      width: 64, height: 48,
    };
    this.bossBullets = [];
    // Stop spawning regular enemies
    this.enemyTimer = 999;
    AudioManager.sfx({ type: 'powerup', volume: 0.4 });
  }

  _updateBoss(dt) {
    if (!this.boss || !this.boss.alive) return;

    // Boss moves side to side
    this.boss.worldX += this.boss.speed * this.boss.dir * dt;
    if (this.boss.worldX < 60 || this.boss.worldX > this.width - 60) this.boss.dir *= -1;

    // Bob up and down
    this.bossZBob = Math.sin(Date.now() * 0.003) * 20;

    // Fire patterns
    this.boss.fireTimer -= dt;
    if (this.boss.fireTimer <= 0) {
      this.boss.fireTimer = this.boss.hp < this.boss.maxHp / 2 ? 0.8 : 1.2;

      const count = this.boss.hp < this.boss.maxHp / 2 ? 5 : 3;
      for (let i = 0; i < count; i++) {
        const angle = Math.PI - Math.PI * 0.3 + (i / (count - 1)) * Math.PI * 0.6;
        this.bossBullets.push({
          x: this.boss.worldX, z: this.boss.z,
          vx: Math.cos(angle) * 150,
          vz: Math.sin(angle) * -150,
          radius: 5,
          alive: true,
        });
      }
      AudioManager.sfx({ type: 'shoot', volume: 0.3 });
    }

    // Boss bullets
    for (const b of this.bossBullets) {
      b.z += b.vz * dt;
      b.x += b.vx * dt;
      if (b.z < Z_NEAR || b.z > Z_FAR || b.x < -50 || b.x > this.width + 50) b.alive = false;
    }
    this.bossBullets = this.bossBullets.filter(b => b.alive);
  }

  _renderBoss(ctx) {
    if (!this.boss || !this.boss.alive) return;

    const proj = projectZ(this.boss.z);
    const scale = proj.scale;
    const screenY = proj.y + (this.bossZBob || 0) * scale;
    const sw = this.boss.width * scale;
    const sh = this.boss.height * scale;
    const sx = this.boss.worldX - sw / 2;
    const hpPct = this.boss.hp / this.boss.maxHp;
    const isEnraged = hpPct < 0.3;

    // Body
    ctx.fillStyle = isEnraged ? '#ff4d4d' : '#8b3a8b';
    ctx.fillRect(sx, screenY - sh, sw, sh);

    // Eyes
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(sx + sw * 0.3, screenY - sh * 0.4, sw * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + sw * 0.7, screenY - sh * 0.4, sw * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(sx + sw * 0.3, screenY - sh * 0.4, sw * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + sw * 0.7, screenY - sh * 0.4, sw * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = '#6b2a6b';
    ctx.fillRect(sx - sw * 0.3, screenY - sh * 0.6, sw * 0.3, sh * 0.3);
    ctx.fillRect(sx + sw, screenY - sh * 0.6, sw * 0.3, sh * 0.3);

    // HP bar
    const barW = 60;
    const barH = 4;
    const barX = this.boss.worldX - barW / 2;
    const barY = screenY - sh - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : '#ff6b4a';
    ctx.fillRect(barX + 1, barY + 1, (barW - 2) * hpPct, barH - 2);

    // Boss bullets
    for (const b of this.bossBullets) {
      if (!b.alive) continue;
      const bp = projectZ(b.z);
      const bs = bp.scale * 8;
      const bsy = bp.y;
      const bsx = b.x;
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(bsx, bsy, bs, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ─── Collisions ─────────────────────────────────────────────────────

  _checkCollisions() {
    const pProj = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };

    // Player bullets vs enemies
    for (const b of this.bullets) {
      const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };

      for (const e of this.enemies) {
        if (!e.alive) continue;
        const proj = projectZ(e.z);
        const scale = proj.scale;
        const sw = e.width * scale;
        const sh = e.height * scale;
        const sx = e.worldX * scale + (this.width / 2 - this.width / 2 * scale) - sw / 2;
        const sy = proj.y - sh;
        const eBox = { x: sx, y: sy, width: sw, height: sh };

        if (bBox.x < eBox.x + eBox.width && bBox.x + bBox.width > eBox.x &&
            bBox.y < eBox.y + eBox.height && bBox.y + bBox.height > eBox.y) {
          b.life = 0;
          e.hp -= b.damage;
          this._spawnParticles(sx + sw / 2, sy + sh / 2, '#ffb454', 4);
          if (e.hp <= 0) {
            e.alive = false;
            this.score += e.score;
            this.stageScore += e.score;
            this._spawnParticles(sx + sw / 2, sy + sh / 2, '#ff6b4a', 8);
            // Drop powerup (15% chance)
            if (Math.random() < 0.15) {
              this.powerups.push({
                x: e.worldX, z: e.z,
                vz: -50,
                type: 'power',
                active: true,
                scale: 1,
              });
            }
          }
          break;
        }
      }

      // Player bullets vs boss
      if (this.boss && this.boss.alive) {
        const bp = projectZ(this.boss.z);
        const bsw = this.boss.width * bp.scale;
        const bsh = this.boss.height * bp.scale;
        const bsx = this.boss.worldX - bsw / 2;
        const bsy = bp.y - bsh;
        const bBox2 = { x: bsx, y: bsy, width: bsw, height: bsh };
        if (bBox.x < bBox2.x + bBox2.width && bBox.x + bBox.width > bBox2.x &&
            bBox.y < bBox2.y + bBox2.height && bBox.y + bBox.height > bBox2.y) {
          b.life = 0;
          this.boss.hp -= b.damage;
          this._spawnParticles(bsx + bsw / 2, bsy + bsh / 2, '#ffb454', 6);
          if (this.boss.hp <= 0) {
            this.boss.alive = false;
            this.bossDefeatedThisStage = true;
            this.score += 2000;
            this.stageScore += 2000;
            this._spawnParticles(bsx + bsw / 2, bsy + bsh / 2, '#ffd700', 30);
            AudioManager.sfx({ type: 'explosion', volume: 0.6 });
            HapticManager.vibrate('explosion');
            // Progress to next stage automatically
            if (this.currentStage >= STAGES_COUNT) {
              this._endGame(true);
            } else {
              this._clearStage();
            }
          }
        }
      }
    }

    // Enemy projectiles vs player (scaled from 3D → 2D)
    if (this.player.invincible <= 0) {
      // Enemy bullets (3D position) → check against player
      for (const b of this.enemyBullets) {
        const bp = projectZ(b.z);
        const bs = bp.scale * 10;
        const bsy = bp.y;
        const bx = b.x * bp.scale + (this.width / 2 - this.width / 2 * bp.scale);
        const bBox = { x: bx - bs, y: bsy - bs, width: bs * 2, height: bs * 2 };
        if (bBox.x < pProj.x + pProj.width && bBox.x + bBox.width > pProj.x &&
            bBox.y < pProj.y + pProj.height && bBox.y + bBox.height > pProj.y) {
          b.alive = false;
          this._playerHit();
          break;
        }
      }

      // Boss bullets vs player
      for (const b of this.bossBullets) {
        if (!b.alive) continue;
        const bp = projectZ(b.z);
        const bs = bp.scale * 10;
        const bsy = bp.y;
        const bx = b.x;
        const bBox = { x: bx - bs, y: bsy - bs, width: bs * 2, height: bs * 2 };
        if (bBox.x < pProj.x + pProj.width && bBox.x + bBox.width > pProj.x &&
            bBox.y < pProj.y + pProj.height && bBox.y + bBox.height > pProj.y) {
          b.alive = false;
          this._playerHit();
          break;
        }
      }

      // Enemies vs player (close enough to touch)
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.z < Z_NEAR + 60) {
          this._playerHit();
          e.alive = false;
          break;
        }
      }

      // Boss vs player
      if (this.boss && this.boss.alive && this.boss.z < Z_NEAR + 80) {
        this._playerHit();
      }
    }

    // Powerups
    if (this.player.invincible <= 0) {
      for (const pu of this.powerups) {
        if (!pu.active) continue;
        if (pu.z < Z_NEAR + 30) {
          pu.active = false;
          this.player.power = Math.min(this.player.power + 1, this.player.maxPower);
          this._spawnParticles(this.player.x + this.player.width / 2, this.player.y, '#4a9eff', 8);
          AudioManager.sfx({ type: 'powerup', volume: 0.4 });
          HapticManager.vibrate('powerup');
        }
      }
    }
  }

  _playerHit() {
    if (this.player.invincible > 0) return;
    this.player.lives--;
    this.player.invincible = 2;
    this.player.power = Math.max(0, this.player.power - 1);
    this._spawnParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, '#ff4d4d', 10);
    AudioManager.sfx({ type: 'hit', volume: 0.4 });
    HapticManager.vibrate('hit');
    if (this.player.lives <= 0) this._endGame(false);
  }

  // ─── Progression ───────────────────────────────────────────────────

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

  _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y, vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 200 - 50,
        life: 0.3 + Math.random() * 0.4, color,
      });
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────

  render(ctx) {
    // ── Sky gradient ─────────────────────────────────────────────────
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    skyGrad.addColorStop(0, this.stageConfig.skyTop);
    skyGrad.addColorStop(1, this.stageConfig.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, HORIZON_Y);

    // ── Clouds (decorative) ──────────────────────────────────────────
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let i = 0; i < 4; i++) {
      const cx = (this.width * 0.2 + i * this.width * 0.25 + this.groundOffset * 0.5) % (this.width + 80) - 40;
      const cy = 30 + i * 30 + Math.sin(this.groundOffset * 0.01 + i) * 10;
      ctx.beginPath();
      ctx.arc(cx, cy, 30 + i * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 25, cy - 5, 22 + i * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Ground (pseudo-3D perspective grid) ─────────────────────────
    const stripCount = 20;
    const stripHeight = (GROUND_OFFSET - HORIZON_Y) / stripCount;

    for (let i = 0; i < stripCount; i++) {
      const t = i / stripCount;
      const y1 = HORIZON_Y + i * stripHeight;
      const y2 = HORIZON_Y + (i + 1) * stripHeight;
      // Perspective: narrow at top, wide at bottom
      const x1 = (this.width / 2) * (1 - t);
      const x2 = 0;
      const w1 = this.width * t;
      const w2 = this.width;

      // Checker pattern
      const stripIdx = Math.floor(i + this.groundOffset / 4) % 2;
      ctx.fillStyle = stripIdx === 0 ? this.stageConfig.groundColor1 : this.stageConfig.groundColor2;
      ctx.fillRect(x1, y1, w1, stripHeight);

      // Horizontal grid line
      ctx.strokeStyle = stripIdx === 0 ? this.stageConfig.groundColor2 : this.stageConfig.groundColor1;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + w1, y1);
      ctx.stroke();
    }

    // Vertical perspective lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const tx = (i / 11) * 2 - 1; // -1 to 1
      const xTop = this.width / 2 + tx * 20;
      const xBot = this.width / 2 + tx * this.width * 0.5;
      ctx.beginPath();
      ctx.moveTo(xTop, HORIZON_Y);
      ctx.lineTo(xBot, GROUND_OFFSET);
      ctx.stroke();
    }

    // ── Enemies (sorted by Z for painter's algorithm) ────────────────
    const sorted = [...this.enemies].sort((a, b) => b.z - a.z);

    for (const e of sorted) {
      if (!e.alive) continue;
      const proj = projectZ(e.z);
      const scale = proj.scale;
      const sw = e.width * scale;
      const sh = e.height * scale;
      const sx = e.worldX * scale + (this.width / 2 - this.width / 2 * scale) - sw / 2;
      const sy = proj.y - sh;

      // Enemy body
      ctx.fillStyle = e.color;
      if (e.type === 'bomber') {
        ctx.beginPath();
        ctx.arc(sx + sw / 2, sy + sh / 2, Math.max(sw, sh) / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a2a5a';
        ctx.beginPath();
        ctx.arc(sx + sw / 2, sy + sh / 2, Math.max(sw, sh) / 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'turret') {
        ctx.fillRect(sx + 2, sy + sh * 0.3, sw - 4, sh * 0.5);
        ctx.fillRect(sx + sw * 0.2, sy, sw * 0.6, sh * 0.4);
        ctx.fillStyle = '#3a4a2a';
        ctx.fillRect(sx + sw * 0.3, sy + sh * 0.15, sw * 0.4, 3);
      } else {
        ctx.fillRect(sx, sy, sw, sh);
        // Eyes
        ctx.fillStyle = '#ffd700';
        const eyeSize = Math.max(2, 4 * scale);
        ctx.fillRect(sx + sw * 0.2, sy + sh * 0.2, eyeSize, eyeSize);
        ctx.fillRect(sx + sw * 0.6, sy + sh * 0.2, eyeSize, eyeSize);
      }
    }

    // ── Powerups ─────────────────────────────────────────────────────
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      const proj = projectZ(pu.z);
      const scale = proj.scale * 10;
      const sy = proj.y - scale;
      const sx = pu.x * scale + (this.width / 2 - this.width / 2 * scale);
      const pulse = Math.sin(Date.now() * 0.008 + pu.x) * 3;
      ctx.fillStyle = '#4a9eff';
      ctx.beginPath();
      ctx.arc(sx, sy + pulse, Math.max(scale, 6), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(8, Math.floor(10 * scale))}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', sx, sy + pulse + 1);
    }

    // ── Boss (rendered separately, in front of regular enemies) ──────
    this._renderBoss(ctx);

    // ── Enemy bullets (3D→2D projected) ─────────────────────────────
    for (const b of this.enemyBullets) {
      const bp = projectZ(b.z);
      const bs = Math.max(2, bp.scale * 8);
      const bsy = bp.y;
      const bx = b.x * bp.scale + (this.width / 2 - this.width / 2 * bp.scale);
      ctx.fillStyle = '#ff6b4a';
      ctx.beginPath();
      ctx.arc(bx, bsy, bs, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Bullets ──────────────────────────────────────────────────────
    for (const b of this.bullets) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      ctx.fillStyle = b.color + '60';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Player ───────────────────────────────────────────────────────
    const shouldDraw = !(this.player.invincible > 0 && Math.floor(this.player.invincible * 10) % 2 === 0);
    if (shouldDraw) {
      const px = this.player.x, py = this.player.y;
      // Charging aura
      if (this.player.charged) {
        ctx.fillStyle = `rgba(255, 215, 0, ${0.3 + Math.sin(Date.now() * 0.015) * 0.2})`;
        ctx.beginPath();
        ctx.arc(px + 12, py + 16, 24, 0, Math.PI * 2);
        ctx.fill();
      }

      // Body
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(px + 2, py + 2, 20, 22);
      // Head
      ctx.fillStyle = '#d4a574';
      ctx.beginPath();
      ctx.arc(px + 12, py + 6, 8, 0, Math.PI * 2);
      ctx.fill();
      // Jetpack
      ctx.fillStyle = '#4a9eff';
      ctx.fillRect(px + 6, py + 20, 12, 10);
      // Jet fire
      ctx.fillStyle = '#ff6b4a';
      ctx.fillRect(px + 8, py + 30, 8, 6 + Math.random() * 4);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(px + 10, py + 32, 4, 4 + Math.random() * 3);
      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(px + 8, py + 4, 3, 3);
      ctx.fillRect(px + 14, py + 4, 3, 3);
    }

    // ── Particles ────────────────────────────────────────────────────
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.7);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // ── HUD ──────────────────────────────────────────────────────────
    setupHUDContext(ctx);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(t('harrier.score', { n: this.score }), 10, 16);

    ctx.fillStyle = '#e7edf3';
    ctx.font = '12px monospace';
    ctx.fillText(t('harrier.lives', { n: this.player.lives }), 10, 34);
    ctx.fillText(t('harrier.power', { n: this.player.power }), 10, 50);

    ctx.fillStyle = '#9aa7b2';
    ctx.font = '12px monospace';
    ctx.fillText(t('harrier.stage', { n: this.currentStage }), this.width / 2 - 30, 12);

    // Power level indicator
    const pwrW = 80;
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(10, 56, pwrW, 5);
    ctx.fillStyle = this.player.power >= this.player.maxPower ? '#ffd700' : '#4a9eff';
    ctx.fillRect(11, 57, (pwrW - 2) * (this.player.power / this.player.maxPower), 3);

    // Charge meter
    if (this.player.chargeTimer > 0) {
      const chargePct = Math.min(1, this.player.chargeTimer / 1.5);
      ctx.fillStyle = this.player.charged ? '#ffd700' : '#ff6b4a';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        this.player.charged ? t('harrier.charge') + '! READY' : t('harrier.charge'),
        this.width / 2,
        this.height - 20
      );
      ctx.fillRect(this.width / 2 - 40, this.height - 16, 80, 4);
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(this.width / 2 - 39, this.height - 15, 78, 2);
      ctx.fillStyle = this.player.charged ? '#ffd700' : '#ff6b4a';
      ctx.fillRect(this.width / 2 - 39, this.height - 15, 78 * chargePct, 2);
      ctx.textAlign = 'left';
    }

    // Stage progress bar
    const progW = this.width * 0.4;
    const progX = (this.width - progW) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(progX, 58, progW, 5);
    ctx.fillStyle = this.stageProgress > 0.85 ? '#ff6b4a' : '#4a9eff';
    ctx.fillRect(progX + 1, 59, (progW - 2) * this.stageProgress, 3);

    // Boss warning
    if (this.boss && this.boss.alive) {
      ctx.fillStyle = '#ff4d4d';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t('harrier.boss'), this.width / 2, 74);
      ctx.textAlign = 'left';
    }

    // Highscore
    if (this.highscore > 0) {
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.fillText(t('game.record', { n: this.highscore }), this.width / 2 - 30, 74);
    }

    // ── Overlays ─────────────────────────────────────────────────────

    // Intro
    if (this.phase === 'intro') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('harrier.stage', { n: this.currentStage }), this.width / 2, this.height / 2 - 30);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 28px monospace';
      ctx.fillText(t('harrier.go'), this.width / 2, this.height / 2 + 20);
      ctx.textAlign = 'left';
    }

    // Stage clear
    if (this.phase === 'stage_clear') {
      renderOverlay(ctx, {
        width: this.width, height: this.height,
        title: t('harrier.stageClear'),
        subtitle: `${t('harrier.score', { n: this.stageScore })}`,
        actionText: t('game.continue'),
      });
    }

    // Game over
    if (this.phase === 'won' || this.phase === 'lost') {
      renderOverlay(ctx, {
        width: this.width, height: this.height,
        title: this.phase === 'won' ? t('game.victory') : t('harrier.gameOver'),
        score: this.score,
        actionText: t('game.restart'),
      });
    }
  }

}
