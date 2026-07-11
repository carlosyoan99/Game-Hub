/**
 * Crush the Castle
 * Nivel 4 — Estrategia / Defensa
 *
 * Mecánica: disparas un proyectil desde un catapulta. El proyectil sigue
 * una trayectoria parabólica (gravedad). Al colisionar con la estructura
 * enemiga, cada bloque tiene puntos de vida que se reducen con el impacto.
 * El objetivo es eliminar a los soldados enemigos dentro del castillo.
 */
import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { clamp } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';

const GRAVITY = 400;
const BLOCK_SIZE = 28;
const BLOCK_GAP = 1;
const PROJECTILE_RADIUS = 6;

const COLORS = {
  bg: '#0b0f14',
  panel: '#11161d',
  ink: '#e7edf3',
  inkDim: '#7c8894',
  line: '#1e2731',
  marquee: '#ffb454',
  ground: '#1a2a1a',
  stone: '#5a5a6a',
  wood: '#6b4a2e',
  soldier: '#c0392b',
};

/**
 * Tipo de bloques con su resistencia (golpes necesarios para destruirlos).
 */
const BLOCK_TYPES = {
  wood: { hp: 2, color: '#6b4a2e', stroke: '#4a3520' },
  stone: { hp: 4, color: '#5a5a6a', stroke: '#3a3a4a' },
};

export class CrushTheCastle {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('crush-the-castle');

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.highscore = this.storage.get('highscore', 0);

    this._restart();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
  }

  _restart() {
    this.score = 0;
    this.wave = 1;
    this.status = 'aiming'; // 'aiming' | 'flying' | 'exploding' | 'won' | 'lost'
    this.ammo = 5;
    this.maxAmmo = 5;
    this.soldiers = [];
    this.blocks = [];
    this.bullets = [];
    this.particles = new ParticleSystem(200);

    // Catapulta: posición izquierda
    this.catapult = {
      x: 70,
      y: this.height - 60,
      angle: -Math.PI / 4,
      power: 0.5,
    };

    // Power bar
    this.powerTarget = 0.5;

    this._buildCastle();

    this.currentProjectile = null;
    this.aimAngle = -Math.PI / 4;
    this.aimPower = 0.5;

    // Last shot trail
    this.trail = [];
  }

  _buildCastle() {
    const groundY = this.height - 50;
    const castleX = this.width * 0.55;

    // Clear existing
    this.blocks = [];
    this.soldiers = [];

    // Build a castle structure: wider for higher waves
    const castleWidth = 6 + Math.min(this.wave, 4);
    const castleHeight = 5 + Math.min(Math.floor(this.wave / 2), 3);
    const extraWidth = Math.min(this.wave - 1, 4);

    // Random choice of materials per column
    for (let col = 0; col < castleWidth + extraWidth; col++) {
      const baseMaterial = col < 3 ? 'stone' : 'wood';
      for (let row = 0; row < castleHeight; row++) {
        // Some random gaps for visual variety
        if (Math.random() < 0.08 && row > 1 && col > 2 && col < castleWidth + extraWidth - 2) continue;

        const blockType = row < 2 && col < 4 ? 'stone' : baseMaterial;
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

    // Place soldiers (enemy stick figures) inside/on top of the castle
    const soldierCount = Math.min(2 + Math.floor(this.wave / 2), 6);
    for (let i = 0; i < soldierCount; i++) {
      // Find a valid position on top of blocks
      let sx, sy;
      if (this.blocks.length > 0) {
        // Place on top of highest blocks
        const cols = {};
        for (const b of this.blocks) {
          const key = Math.round(b.x);
          if (!cols[key] || b.y < cols[key].y) cols[key] = b;
        }
        const colKeys = Object.values(cols);
        if (colKeys.length > 0) {
          const topBlock = colKeys[Math.floor(Math.random() * colKeys.length)];
          sx = topBlock.x + topBlock.width / 2 + (Math.random() - 0.5) * 10;
          sy = topBlock.y - 8;
        } else {
          sx = castleX + 60 + Math.random() * 60;
          sy = groundY - 50 - Math.random() * 30;
        }
      } else {
        sx = castleX + 60 + Math.random() * 60;
        sy = groundY - 50 - Math.random() * 30;
      }
      this.soldiers.push({
        x: sx,
        y: sy,
        width: 8,
        height: 16,
        alive: true,
        hue: 0 + Math.random() * 20,
        panicTimer: 0,
      });
    }
  }

  update(dt) {
    if (this.status === 'won' || this.status === 'lost') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this._nextWave();
      }
      this.input.endFrame();
      return;
    }

    if (this.status === 'exploding') {
      this._updateParticles(dt);
      if (this.particles.isEmpty) {
        this.status = 'aiming';
      }
      this.input.endFrame();
      return;
    }

    // Power bar oscillation during aiming
    if (this.status === 'aiming') {
      this.powerTarget += dt * 0.8;
      if (this.powerTarget > 1) this.powerTarget = 0;
      this.aimPower = Math.abs(Math.sin(this.powerTarget * Math.PI * 2));

      // Aim angle based on mouse vertical position
      if (this.input.mouse.x >= 0) {
        const dx = this.input.mouse.x - this.catapult.x;
        const dy = this.input.mouse.y - this.catapult.y;
        if (dx > 0) {
          this.aimAngle = Math.atan2(dy, dx);
          this.aimAngle = clamp(this.aimAngle, -Math.PI * 0.45, -0.05);
        }
        // Power via mouse distance
        const dist = Math.hypot(dx, dy);
        this.aimPower = clamp(dist / 400, 0.2, 1.0);
      }

      // Aim with keyboard
      if (this.input.isDown('ArrowUp')) this.aimAngle -= 1.5 * dt;
      if (this.input.isDown('ArrowDown')) this.aimAngle += 1.5 * dt;
      this.aimAngle = clamp(this.aimAngle, -Math.PI * 0.45, -0.05);
      if (this.input.isDown('ArrowLeft')) this.aimPower = clamp(this.aimPower - 0.5 * dt, 0.2, 1.0);
      if (this.input.isDown('ArrowRight')) this.aimPower = clamp(this.aimPower + 0.5 * dt, 0.2, 1.0);

      // Check for click to fire
      if (this.input.mouse.clickedThisFrame || this.input.wasPressed('Space')) {
        this._fire();
      }
    }

    if (this.status === 'flying') {
      this._updateProjectile(dt);
      this._updateParticles(dt);
    }

    this.input.endFrame();
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

    // Launch particles
    this._spawnParticles(this.catapult.x, this.catapult.y - 10, '#ffb454', 12, 80);
  }

  _updateProjectile(dt) {
    if (!this.currentProjectile || !this.currentProjectile.active) return;

    const p = this.currentProjectile;

    // Store trail
    this.trail.push({ x: p.x, y: p.y, life: 0.5 });

    // Gravity
    p.vy += GRAVITY * dt;

    // Air resistance (minor)
    p.vx *= 0.999;
    p.vy *= 0.999;

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Check bounds
    if (p.y > this.height - 50 || p.x > this.width + 20 || p.x < -20) {
      this.currentProjectile.active = false;
      this.status = 'aiming';
      this.trail = [];
      return;
    }

    // Collision with blocks
    for (const block of this.blocks) {
      if (block.hp <= 0) continue;

      // Circle vs rect check
      const closestX = clamp(p.x, block.x, block.x + block.width);
      const closestY = clamp(p.y, block.y, block.y + block.height);
      const dx = p.x - closestX;
      const dy = p.y - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= p.radius * p.radius) {
        // Damage the block
        block.hp--;
        block.wiggling = 0.15;

        // Spawn debris particles
        this._spawnParticles(p.x, p.y, block.color, 8, 120);
        this._spawnParticles(p.x, p.y, '#ffb454', 4, 60);
        this.score += 5;

        // Bounce/deflect the projectile
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > 30) {
          // Reflect and lose energy
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

        // Check if block destroyed
        if (block.hp <= 0) {
          this.score += 10;
          this._spawnParticles(block.x + block.width / 2, block.y + block.height / 2, block.color, 16, 200);
          // Check for soldiers on top of destroyed blocks
          for (const soldier of this.soldiers) {
            if (!soldier.alive) continue;
            if (
              soldier.x > block.x - 5 &&
              soldier.x < block.x + block.width + 5 &&
              soldier.y > block.y - 20 &&
              soldier.y < block.y + block.height + 5
            ) {
              soldier.y += block.height + 2;
              // Check if soldier falls to ground
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
                this._spawnParticles(soldier.x, soldier.y, '#c0392b', 6, 100);
                this.score += 25;
              }
            }
          }
        }

        break;
      }
    }

    // Collision with soldiers (direct hit)
    for (const soldier of this.soldiers) {
      if (!soldier.alive) continue;
      const dx = p.x - soldier.x;
      const dy = p.y - soldier.y;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        soldier.alive = false;
        this._spawnParticles(soldier.x, soldier.y, '#c0392b', 10, 150);
        this.score += 25;
        // Slow down projectile
        p.vx *= 0.3;
        p.vy *= 0.3;
        break;
      }
    }

    // Ground collision
    if (p.y + p.radius > this.height - 50) {
      p.y = this.height - 50 - p.radius;
      p.vy *= -0.3;
      p.vx *= 0.5;
      this._spawnParticles(p.x, this.height - 50, '#5a5a6a', 6, 80);
      if (Math.abs(p.vy) < 20) {
        this.currentProjectile.active = false;
      }
    }

    // Update trail
    for (const t of this.trail) {
      t.life -= dt;
    }
    this.trail = this.trail.filter((t) => t.life > 0);

    // If projectile stopped moving, deactivate
    if (this.currentProjectile && Math.abs(p.vx) < 5 && Math.abs(p.vy) < 5) {
      this.currentProjectile.active = false;
    }

    // Check win/lose conditions
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
      if (this.score > this.highscore) {
        this.highscore = this.score;
        this.storage.set('highscore', this.highscore);
      }
      return;
    }

    if (this.ammo <= 0) {
      this.status = 'lost';
      return;
    }

    // Recalculate soldier positions after blocks fall
    for (const soldier of this.soldiers) {
      if (!soldier.alive) continue;
      // Check if soldier is falling
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

  _spawnParticles(x, y, color, count, speed) {
    this.particles.emit(x, y, color, count, speed, {
      vyOffset: -50, lifeMin: 0.5, lifeMax: 0.8, radiusMin: 1, radiusMax: 3, speedMin: 0.3, speedMax: 0.7,
    });
  }

  _updateParticles(dt) {
    this.particles.update(dt);
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

  render(ctx) {
    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    skyGrad.addColorStop(0, '#0a1628');
    skyGrad.addColorStop(0.6, '#0f1a2e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.height - 50);

    // Ground
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, this.height - 50, this.width, 50);
    ctx.fillStyle = '#2a3a2a';
    ctx.fillRect(0, this.height - 50, this.width, 2);

    // Trail
    for (const t of this.trail) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 180, 84, ${t.life * 0.6})`;
      ctx.fill();
    }

    // Castle blocks
    for (const block of this.blocks) {
      if (block.hp <= 0) continue;

      // Wiggle animation when hit
      const wiggleOffset = block.wiggling > 0 ? Math.sin(block.wiggling * 60) * 2 : 0;
      if (block.wiggling > 0) block.wiggling -= 1 / 60;

      ctx.fillStyle = block.color;
      ctx.fillRect(block.x + wiggleOffset, block.y, block.width, block.height);

      // Damage cracks
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

    // Soldiers
    for (const soldier of this.soldiers) {
      if (!soldier.alive) continue;

      const sX = soldier.x;
      const sY = soldier.y;

      // Body
      ctx.strokeStyle = COLORS.soldier;
      ctx.lineWidth = 2;
      // Head
      ctx.beginPath();
      ctx.arc(sX, sY, 3, 0, Math.PI * 2);
      ctx.stroke();
      // Body line
      ctx.beginPath();
      ctx.moveTo(sX, sY + 4);
      ctx.lineTo(sX, sY + 12);
      ctx.stroke();
      // Arms
      ctx.beginPath();
      ctx.moveTo(sX - 4, sY + 7);
      ctx.lineTo(sX, sY + 8);
      ctx.lineTo(sX + 4, sY + 7);
      ctx.stroke();
      // Legs
      ctx.beginPath();
      ctx.moveTo(sX, sY + 12);
      ctx.lineTo(sX - 3, sY + 17);
      ctx.moveTo(sX, sY + 12);
      ctx.lineTo(sX + 3, sY + 17);
      ctx.stroke();
    }

    // Catapult
    this._renderCatapult(ctx);

    // Projectile
    if (this.currentProjectile && this.currentProjectile.active) {
      ctx.beginPath();
      ctx.arc(this.currentProjectile.x, this.currentProjectile.y, this.currentProjectile.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb454';
      ctx.fill();
      ctx.strokeStyle = '#8a5f2c';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Glow
      ctx.beginPath();
      ctx.arc(this.currentProjectile.x, this.currentProjectile.y, this.currentProjectile.radius * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 180, 84, 0.15)';
      ctx.fill();
    }

    // Aiming line
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

    // HUD
    ctx.fillStyle = COLORS.inkDim;
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Oleada: ${this.wave}`, 10, 10);
    ctx.fillText(`Puntuación: ${this.score}`, 10, 28);
    ctx.fillText(`Proyectiles: ${'●'.repeat(this.ammo)}${'○'.repeat(this.maxAmmo - this.ammo)}`, 10, 46);

    if (this.highscore > 0) {
      ctx.fillText(`Récord: ${this.highscore}`, this.width / 2 - 40, 10);
    }

    // Power indicator
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
      ctx.fillText('POTENCIA', barX, barY - 14);
    }

    // Win/Lose overlay
    if (this.status === 'won' || this.status === 'lost') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = COLORS.ink;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (this.status === 'won') {
        ctx.fillText('¡CASTILLO DESTRUIDO!', this.width / 2, this.height / 2 - 30);
        ctx.font = '16px monospace';
        ctx.fillText('Click o Espacio para siguiente oleada', this.width / 2, this.height / 2 + 20);
      } else {
        ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 30);
        ctx.font = '16px monospace';
        ctx.fillText(`Quedan ${this.soldiers.filter(s => s.alive).length} soldados en pie`, this.width / 2, this.height / 2 + 20);
        ctx.fillText('Click o Espacio para reiniciar', this.width / 2, this.height / 2 + 45);
      }
      ctx.textAlign = 'left';
    }
  }

  _renderCatapult(ctx) {
    const cx = this.catapult.x;
    const cy = this.catapult.y;

    // Base
    ctx.fillStyle = '#4a3520';
    ctx.fillRect(cx - 18, cy - 5, 36, 10);

    // Wheels
    ctx.beginPath();
    ctx.arc(cx - 12, cy + 8, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2510';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 12, cy + 8, 5, 0, Math.PI * 2);
    ctx.fill();

    // Arm (rotates based on aim angle if aiming)
    const armAngle = this.status === 'aiming' ? this.aimAngle : -Math.PI / 4;
    ctx.save();
    ctx.translate(cx, cy - 5);
    ctx.rotate(armAngle + Math.PI / 2);

    ctx.fillStyle = '#5a4530';
    ctx.fillRect(-3, -30, 6, 30);

    // Cup at end
    ctx.fillStyle = '#6b4a2e';
    ctx.beginPath();
    ctx.arc(0, -32, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Side structure
    ctx.fillStyle = '#3a2510';
    ctx.fillRect(cx - 3, cy - 12, 6, 12);

    // Stone ammo next to catapult
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

  destroy() {
    this.input.detach();
  }
}
