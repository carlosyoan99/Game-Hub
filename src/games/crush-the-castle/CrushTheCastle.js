/**
 * Crush the Castle
 * Nivel 4 — Estrategia / Defensa
 *
 * Mecánica: disparas un proyectil desde un catapulta. El proyectil sigue
 * una trayectoria parabólica (gravedad). Al colisionar con la estructura
 * enemiga, cada bloque tiene puntos de vida que se reducen con el impacto.
 * El objetivo es eliminar a los soldados enemigos dentro del castillo.
 */
import { GameBase } from '../../engine/GameBase.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { clamp } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { GRAVITY, BLOCK_SIZE, BLOCK_GAP, PROJECTILE_RADIUS, DEBRIS_OPTS, COLORS, BLOCK_TYPES } from './constants.js';export class CrushTheCastle extends GameBase {

  _defaultBindings() {
    return {
      aimUp:        ['ArrowUp', 'KeyW', 'GamepadLStickUp', 'GamepadUp'],
      aimDown:      ['ArrowDown', 'KeyS', 'GamepadLStickDown', 'GamepadDown'],
      aimPowerUp:   ['KeyE', 'GamepadR1'],
      aimPowerDown: ['KeyQ', 'GamepadL1'],
      action:       ['Space', 'GamepadA'],
    };
  }

  init(engine) {
    super.init(engine, 'crush-the-castle');
    this.highscore = this.storage.get('highscore', 0);

    this._restart();
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this.catapult.y = this.height - 60;
    if (this.status === 'aiming' || this.status === 'flying' || this.status === 'exploding') {
      this._buildCastle();
    }
  }

  _restart() {
    this.startTime = Date.now();
    this.rng = new SeededRandom();
    this.score = 0;
    this.wave = 1;
    this.status = 'aiming'; // 'aiming' | 'flying' | 'exploding' | 'won' | 'lost'
    this.ammo = 5;
    this.maxAmmo = 5;
    this.soldiers = [];
    this.blocks = [];
    this.bullets = [];
    this.particles = new ParticleSystem(200);

    this.catapult = {
      x: 70,
      y: this.height - 60,
      angle: -Math.PI / 4,
      power: 0.5,
    };

    this.powerTarget = 0.5;
    this._buildCastle();

    this.currentProjectile = null;
    this.aimAngle = -Math.PI / 4;
    this.aimPower = 0.5;
    this.trail = [];
  }

  _buildCastle() {
    const groundY = this.height - 50;
    const castleX = this.width * 0.55;

    this.blocks = [];
    this.soldiers = [];

    const castleWidth = 6 + Math.min(this.wave, 4);
    const castleHeight = 5 + Math.min(Math.floor(this.wave / 2), 3);
    const extraWidth = Math.min(this.wave - 1, 4);

    for (let col = 0; col < castleWidth + extraWidth; col++) {
      const baseMaterial = col < 3 ? 'stone' : 'wood';
      for (let row = 0; row < castleHeight; row++) {
        if (this.rng.next() < 0.08 && row > 1 && col > 2 && col < castleWidth + extraWidth - 2) continue;

        let blockType = row < 2 && col < 4 ? 'stone' : baseMaterial;
        if (this.wave >= 3 && row === 0 && this.rng.next() < 0.3) blockType = 'reinforced';
        if (this.wave >= 5 && this.rng.next() < 0.12) blockType = 'explosive';

        this.blocks.push({
          x: castleX + col * (BLOCK_SIZE + BLOCK_GAP),
          y: groundY - (row + 1) * (BLOCK_SIZE + BLOCK_GAP),
          width: BLOCK_SIZE,
          height: BLOCK_SIZE,
          hp: BLOCK_TYPES[blockType].hp,
          maxHp: BLOCK_TYPES[blockType].hp,
          color: BLOCK_TYPES[blockType].color,
          stroke: BLOCK_TYPES[blockType].stroke,
          type: blockType,
          wiggling: 0,
        });
      }
    }

    const soldierCount = Math.min(2 + Math.floor(this.wave / 2), 6);
    for (let i = 0; i < soldierCount; i++) {
      let sx, sy;
      if (this.blocks.length > 0) {
        const cols = {};
        for (const b of this.blocks) {
          const key = Math.round(b.x);
          if (!cols[key] || b.y < cols[key].y) cols[key] = b;
        }
        const colKeys = Object.values(cols);
        if (colKeys.length > 0) {
          const topBlock = colKeys[this.rng.nextInt(0, colKeys.length - 1)];
          sx = topBlock.x + topBlock.width / 2 + (this.rng.next() - 0.5) * 10;
          sy = topBlock.y - 8;
        } else {
          sx = castleX + 60 + this.rng.next() * 60;
          sy = groundY - 50 - this.rng.next() * 30;
        }
      } else {
        sx = castleX + 60 + this.rng.next() * 60;
        sy = groundY - 50 - this.rng.next() * 30;
      }
      this.soldiers.push({
        x: sx, y: sy,
        width: 8, height: 16,
        alive: true,
        hue: this.rng.next() * 20,
        panicTimer: 0,
      });
    }
  }

  update(dt) {
    if (this.handleRestartInput()) return;
    if (this.status === 'level-complete') {
      if (this.input.wasActionPressed('action') || this.input.mouse.clickedThisFrame) {
        this._nextWave();
      }

      return;
    }

    if (this.status === 'exploding') {
      this.particles.update(dt);
      if (this.particles.isEmpty) {
        this.status = 'aiming';
      }

      return;
    }

    if (this.status === 'aiming') {
      this.powerTarget += dt * 0.8;
      if (this.powerTarget > 1) this.powerTarget = 0;
      this.aimPower = Math.abs(Math.sin(this.powerTarget * Math.PI * 2));

      if (this.input.mouse.x >= 0) {
        const dx = this.input.mouse.x - this.catapult.x;
        const dy = this.input.mouse.y - this.catapult.y;
        if (dx > 0) {
          this.aimAngle = Math.atan2(dy, dx);
          this.aimAngle = clamp(this.aimAngle, -Math.PI * 0.45, -0.05);
        }
        const dist = Math.hypot(dx, dy);
        this.aimPower = clamp(dist / 400, 0.2, 1.0);
      }

      // Gamepad: D-pad + stick continuo (isDown), igual que las flechas del teclado
      if (this.input.isActionDown('aimUp')) this.aimAngle -= 1.5 * dt;
      if (this.input.isActionDown('aimDown')) this.aimAngle += 1.5 * dt;
      this.aimAngle = clamp(this.aimAngle, -Math.PI * 0.45, -0.05);
      if (this.input.isActionDown('aimPowerDown')) this.aimPower = clamp(this.aimPower - 0.5 * dt, 0.2, 1.0);
      if (this.input.isActionDown('aimPowerUp')) this.aimPower = clamp(this.aimPower + 0.5 * dt, 0.2, 1.0);

      if (this.input.mouse.clickedThisFrame || this.input.wasActionPressed('action')) {
        this._fire();
      }
    }

    if (this.status === 'flying') {
      this._updateProjectile(dt);
      this.particles.update(dt);
      // El proyectil pudo haberse desactivado dentro de _updateProjectile
      // sin que se cambiara el estado. Garantizar limpieza.
      if (this.currentProjectile && !this.currentProjectile.active && this.status === 'flying') {
        this._checkWaveEnd();
        if (this.status === 'aiming' || this.status === 'won') {
          this.trail = [];
        }
      }
    }

  }

  _fire() {
    if (this.ammo <= 0) return;
    this.ammo--;

    const power = this.aimPower * 500;
    this.currentProjectile = {
      x: this.catapult.x,
      y: this.catapult.y - 10,
      vx: Math.cos(this.aimAngle) * power,
      vy: Math.sin(this.aimAngle) * power,
      radius: PROJECTILE_RADIUS,
      active: true,
    };
    this.trail = [];
    this.status = 'flying';

    this.particles.burst(this.catapult.x, this.catapult.y - 10, '#ffb454', 12, 80, DEBRIS_OPTS);
    AudioManager.sfx({ type: 'castle_shoot', volume: 0.35 });
    HapticManager.vibrate('shoot');
  }

  _updateProjectile(dt) {
    if (!this.currentProjectile || !this.currentProjectile.active) return;

    const p = this.currentProjectile;
    this.trail.push({ x: p.x, y: p.y, life: 0.5 });

    p.vy += GRAVITY * dt;
    p.vx *= 0.999;
    p.vy *= 0.999;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.y > this.height - 50 || p.x > this.width + 20 || p.x < -20) {
      this.currentProjectile.active = false;
      this.status = 'aiming';
      this.trail = [];
      return;
    }

    for (const block of this.blocks) {
      if (block.hp <= 0) continue;
      const closestX = clamp(p.x, block.x, block.x + block.width);
      const closestY = clamp(p.y, block.y, block.y + block.height);
      const dx = p.x - closestX;
      const dy = p.y - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= p.radius * p.radius) {
        block.hp--;
        block.wiggling = 0.15;
        AudioManager.sfx({ type: 'castle_hit', volume: 0.3 });
        HapticManager.vibrate('hit');

        this.particles.burst(p.x, p.y, block.color, 8, 120, DEBRIS_OPTS);
        this.particles.burst(p.x, p.y, '#ffb454', 4, 60, DEBRIS_OPTS);
        this.score += 5;

        const speed = Math.hypot(p.vx, p.vy);
        if (speed > 30) {
          const normalX = (closestX - p.x) || 0;
          const normalY = (closestY - p.y) || 0;
          const normLen = Math.hypot(normalX, normalY);
          if (normLen > 0) {
            const dot = (p.vx * normalX + p.vy * normalY) / normLen;
            p.vx -= 2 * dot * (normalX / normLen) * 0.5;
            p.vy -= 2 * dot * (normalY / normLen) * 0.5;
            p.vx *= 0.6;
            p.vy *= 0.6;
          }
        } else {
          p.vx *= 0.2;
          p.vy *= 0.2;
        }

        if (block.hp <= 0) {
          if (block.type === 'explosive') {
            for (const other of this.blocks) {
              if (other === block || other.hp <= 0) continue;
              const dx = (other.x + other.width / 2) - (block.x + block.width / 2);
              const dy = (other.y + other.height / 2) - (block.y + block.height / 2);
              if (Math.abs(dx) < BLOCK_SIZE * 2 && Math.abs(dy) < BLOCK_SIZE * 2) {
                other.hp -= 3;
                if (other.hp <= 0) this.score += 10;
              }
            }
            this.particles.burst(block.x + block.width / 2, block.y + block.height / 2, '#ffb454', 30, 300, DEBRIS_OPTS);
            AudioManager.sfx({ type: 'castle_destroy', volume: 0.6 });
            HapticManager.vibrate('explosion');
          } else {
            this.particles.burst(block.x + block.width / 2, block.y + block.height / 2, block.color, 16, 200, DEBRIS_OPTS);
            AudioManager.sfx({ type: 'castle_destroy', volume: 0.35 });
          }
          this.score += 10;

          for (const soldier of this.soldiers) {
            if (!soldier.alive) continue;
            if (
              soldier.x > block.x - 5 &&
              soldier.x < block.x + block.width + 5 &&
              soldier.y > block.y - 20 &&
              soldier.y < block.y + block.height + 5
            ) {
              soldier.y += block.height + 2;
              let standing = false;
              for (const otherBlock of this.blocks) {
                if (otherBlock.hp <= 0) continue;
                if (
                  soldier.x + soldier.width > otherBlock.x &&
                  soldier.x < otherBlock.x + otherBlock.width &&
                  Math.abs(soldier.y + soldier.height - otherBlock.y) < 5
                ) {
                  standing = true;
                  break;
                }
              }
              if (!standing && soldier.y + soldier.height > this.height - 50) {
                soldier.y = this.height - 50 - soldier.height;
                standing = true;
              }
              if (!standing) {
                soldier.alive = false;
                AudioManager.sfx({ type: 'castle_hit', volume: 0.4 });
                this.particles.burst(soldier.x, soldier.y, '#c0392b', 6, 100, DEBRIS_OPTS);
                this.score += 25;
              }
            }
          }
        }
        break;
      }
    }

    for (const soldier of this.soldiers) {
      if (!soldier.alive) continue;
      const dx = p.x - soldier.x;
      const dy = p.y - soldier.y;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        soldier.alive = false;
        AudioManager.sfx({ type: 'castle_destroy', volume: 0.4 });
        HapticManager.vibrate('explosion');
        this.particles.burst(soldier.x, soldier.y, '#c0392b', 10, 150, DEBRIS_OPTS);
        this.score += 25;
        p.vx *= 0.3;
        p.vy *= 0.3;
        break;
      }
    }

    if (p.y + p.radius > this.height - 50) {
      p.y = this.height - 50 - p.radius;
      p.vy *= -0.3;
      p.vx *= 0.5;
      this.particles.burst(p.x, this.height - 50, '#5a5a6a', 6, 80, DEBRIS_OPTS);
      if (Math.abs(p.vy) < 20) {
        this.currentProjectile.active = false;
      }
    }

    for (const t of this.trail) { t.life -= dt; }
    this.trail = this.trail.filter((t) => t.life > 0);

    if (this.currentProjectile && Math.abs(p.vx) < 5 && Math.abs(p.vy) < 5) {
      this.currentProjectile.active = false;
    }

    if (!this.currentProjectile || !this.currentProjectile.active) {
      this._checkWaveEnd();
      if (this.status === 'aiming' || this.status === 'won') {
        this.trail = [];
      }
    }
  }

  _checkWaveEnd() {
    const aliveSoldiers = this.soldiers.filter((s) => s.alive);
    if (aliveSoldiers.length === 0) {
      this.status = 'won';
      this._recordProgressionPlay(true);
      AudioManager.sfx({ type: 'powerup', volume: 0.5 });
      HapticManager.vibrate('powerup');
      if (this.score > this.highscore) {
        this.highscore = this.score;
        this.storage.set('highscore', this.highscore);
      }
      return;
    }

    if (this.ammo <= 0) {
      this.status = 'lost';
      this._recordProgressionPlay(false);
      AudioManager.sfx({ type: 'castle_hit', volume: 0.5 });
      HapticManager.vibrate('hit');
      return;
    }

    for (const soldier of this.soldiers) {
      if (!soldier.alive) continue;
      let standing = false;
      for (const block of this.blocks) {
        if (block.hp <= 0) continue;
        if (
          soldier.x + soldier.width > block.x &&
          soldier.x < block.x + block.width &&
          Math.abs(soldier.y + soldier.height - block.y) < 8
        ) {
          standing = true;
          break;
        }
      }
      if (!standing && soldier.y + soldier.height < this.height - 50) {
        soldier.y += 40;
      }
    }
  }

  _nextWave() {
    if (this.status === 'won') {
      this.wave++;
      this.ammo = this.maxAmmo + Math.floor(this.wave / 2);
      this.maxAmmo = this.ammo;
      this.status = 'aiming';
      this._buildCastle();
      this.currentProjectile = null;
      this.trail = [];
    } else {
      this._restart();
    }
  }

  _recordProgressionPlay(won) {
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('crush-the-castle', this.score, won, duration);
    if (this.wave >= 1) ProgressionManager.checkAchievement('crush-the-castle', 'castle-first');
    if (this.wave >= 10) ProgressionManager.checkAchievement('crush-the-castle', 'castle-crusher');
    if (this.wave >= 20) ProgressionManager.checkAchievement('crush-the-castle', 'demolition-expert');
  }

  render(ctx) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    skyGrad.addColorStop(0, '#0a1628');
    skyGrad.addColorStop(0.6, '#0f1a2e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.height - 50);

    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, this.height - 50, this.width, 50);
    ctx.fillStyle = '#2a3a2a';
    ctx.fillRect(0, this.height - 50, this.width, 2);

    for (const t of this.trail) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 180, 84, ${t.life * 0.6})`;
      ctx.fill();
    }

    for (const block of this.blocks) {
      if (block.hp <= 0) continue;
      const wiggleOffset = block.wiggling > 0 ? Math.sin(block.wiggling * 60) * 2 : 0;
      if (block.wiggling > 0) block.wiggling -= 1 / 60;

      ctx.fillStyle = block.color;
      ctx.fillRect(block.x + wiggleOffset, block.y, block.width, block.height);

      const hpPercent = block.hp / block.maxHp;
      if (hpPercent < 1) {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(block.x + block.width * 0.3, block.y + 2);
        ctx.lineTo(block.x + block.width * 0.5, block.y + block.height * 0.5);
        ctx.lineTo(block.x + block.width * 0.7, block.y + block.height - 2);
        ctx.stroke();
      }
      if (hpPercent < 0.5) {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(block.x + block.width * 0.6, block.y + 4);
        ctx.lineTo(block.x + block.width * 0.3, block.y + block.height * 0.6);
        ctx.stroke();
      }

      ctx.strokeStyle = block.stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(block.x + wiggleOffset, block.y, block.width, block.height);
    }

    for (const soldier of this.soldiers) {
      if (!soldier.alive) continue;
      const sX = soldier.x;
      const sY = soldier.y;
      ctx.strokeStyle = COLORS.soldier;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sX, sY, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sX, sY + 4);
      ctx.lineTo(sX, sY + 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sX - 4, sY + 7);
      ctx.lineTo(sX, sY + 8);
      ctx.lineTo(sX + 4, sY + 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sX, sY + 12);
      ctx.lineTo(sX - 3, sY + 17);
      ctx.moveTo(sX, sY + 12);
      ctx.lineTo(sX + 3, sY + 17);
      ctx.stroke();
    }

    this._renderCatapult(ctx);

    if (this.currentProjectile && this.currentProjectile.active) {
      ctx.beginPath();
      ctx.arc(this.currentProjectile.x, this.currentProjectile.y, this.currentProjectile.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb454';
      ctx.fill();
      ctx.strokeStyle = '#8a5f2c';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.currentProjectile.x, this.currentProjectile.y, this.currentProjectile.radius * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 180, 84, 0.15)';
      ctx.fill();
    }

    if (this.status === 'aiming' && this.ammo > 0) {
      const power = this.aimPower * 500;
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = 'rgba(255, 180, 84, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.catapult.x, this.catapult.y - 10);
      const endX = this.catapult.x + Math.cos(this.aimAngle) * power * 0.15;
      const endY = this.catapult.y - 10 + Math.sin(this.aimAngle) * power * 0.15;
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();
    }

    this.particles.render(ctx);

    ctx.fillStyle = COLORS.inkDim;
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(t('crush.score', { n: this.score }), 10, 10);
    ctx.fillText(t('crush.ammo') + ` ${'●'.repeat(this.ammo)}${'○'.repeat(this.maxAmmo - this.ammo)}`, 10, 28);

    if (this.highscore > 0) {
      ctx.fillText(t('crush.record', { n: this.highscore }), this.width / 2 - 40, 10);
    }

    if (this.status === 'aiming' && this.ammo > 0) {
      const barX = 10;
      const barY = this.height - 40;
      const barW = 80;
      const barH = 10;
      ctx.strokeStyle = COLORS.line;
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.fillStyle = `hsl(${this.aimPower * 120}, 70%, 50%)`;
      ctx.fillRect(barX + 1, barY + 1, (barW - 2) * this.aimPower, barH - 2);
      ctx.fillStyle = COLORS.inkDim;
      ctx.font = '11px monospace';
      ctx.fillText(t('game.power'), barX, barY - 14);
    }

    if (this.status === 'won' || this.status === 'lost') {
      const colors = { bg: 'rgba(0, 0, 0, 0.6)', text: COLORS.ink };
      if (this.status === 'won') {
        renderOverlay(ctx, {
          width: this.width, height: this.height,
          title: t('crush.victory'),
          actionText: t('crush.nextWave'),
          score: this.score,
          colors,
        });
      } else {
        renderOverlay(ctx, {
          width: this.width, height: this.height,
          title: t('game.gameOver'),
          subtitle: t('crush.soldiersLeft', { n: this.soldiers.filter(s => s.alive).length }),
          actionText: t('game.restart'),
          colors,
        });
      }
    }
  }

  _renderCatapult(ctx) {
    const cx = this.catapult.x;
    const cy = this.catapult.y;

    ctx.fillStyle = '#4a3520';
    ctx.fillRect(cx - 18, cy - 5, 36, 10);

    ctx.beginPath();
    ctx.arc(cx - 12, cy + 8, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2510';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 12, cy + 8, 5, 0, Math.PI * 2);
    ctx.fill();

    const armAngle = this.status === 'aiming' ? this.aimAngle : -Math.PI / 4;
    ctx.save();
    ctx.translate(cx, cy - 5);
    ctx.rotate(armAngle + Math.PI / 2);

    ctx.fillStyle = '#5a4530';
    ctx.fillRect(-3, -30, 6, 30);

    ctx.fillStyle = '#6b4a2e';
    ctx.beginPath();
    ctx.arc(0, -32, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = '#3a2510';
    ctx.fillRect(cx - 3, cy - 12, 6, 12);

    ctx.beginPath();
    ctx.arc(cx + 25, cy + 3, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#5a5a6a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 25, cy - 5, 4, 0, Math.PI * 2);
    ctx.fill();
    if (this.ammo > 2) {
      ctx.beginPath();
      ctx.arc(cx + 25, cy + 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

}
