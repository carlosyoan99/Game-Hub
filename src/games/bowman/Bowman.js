/**
 * Bowman
 * Nivel 4 — Estrategia / Defensa
 *
 * Mecánica: dos arqueros en lados opuestos. El jugador apunta con el
 * ratón (ángulo y potencia) y dispara una flecha con física parabólica
 * afectada por viento. La IA enemiga apunta con margen de error variable
 * según dificultad. El viento cambia cada turno.
 */
import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { clamp } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';

const GRAVITY = 350;
const WIND_MAX = 80;
const ARROW_RADIUS = 3;
const MAX_TURNS = 20;

const COLORS = {
  bg: '#0b0f14',
  panel: '#11161d',
  ink: '#e7edf3',
  inkDim: '#7c8894',
  line: '#1e2731',
  marquee: '#ffb454',
  ground: '#1a2a1a',
};

export class Bowman {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('bowman');

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
    this.player1HP = 100;
    this.player2HP = 100;
    this.turn = 1; // 1 = player, 2 = enemy
    this.status = 'aiming'; // 'aiming' | 'flying' | 'hit' | 'won' | 'lost'
    this.wind = (Math.random() - 0.5) * 2 * WIND_MAX;
    this.trail = [];
    this.particles = new ParticleSystem(150);
    this.arrow = null;
    this.backgroundOffset = 0;
    this.lastHitText = '';
    this.lastHitTimer = 0;
    this.difficultyLevel = 3; // 1-5
    this.turnsPlayed = 0;
    this.score = 0;

    // Player position (left side)
    this.player = {
      x: 80,
      y: this.height - 60,
      angle: -Math.PI / 4,
      power: 0.5,
      color: '#4a9eff',
      label: 'TÚ',
      facingRight: true,
    };

    // Enemy position (right side)
    this.enemy = {
      x: this.width - 80,
      y: this.height - 60,
      angle: Math.PI * 0.75,
      power: 0.5,
      color: '#e74c3c',
      label: 'BOT',
      facingRight: false,
    };

    // Power oscillation
    this.powerOsc = 0;

    this._setupTurn();
  }

  _setupTurn() {
    if (this.turn === 1) {
      // Player's turn
      this.activeArcher = this.player;
      this.targetArcher = this.enemy;
      this.status = 'aiming';
      this.aimAngle = -Math.PI / 4;
      this.aimPower = 0.5;
      this.powerOsc = 0;
    } else {
      // Enemy's turn: AI calculates shot
      this.activeArcher = this.enemy;
      this.targetArcher = this.player;
      this.status = 'aiming';
      this._calculateAIShot();
    }
  }

  _calculateAIShot() {
    // AI aims at the player with some inaccuracy
    const dx = this.player.x - this.enemy.x;
    const dy = (this.player.y - 5) - this.enemy.y;

    // Calculate optimal angle and power
    // Using projectile motion: x = v*cos(θ)*t, y = v*sin(θ)*t - 0.5*g*t²
    // Solve for θ given v (power) or vice versa

    // Simple approach: try different power levels and pick the best angle
    const bestPower = 0.4 + Math.random() * 0.4; // 0.4-0.8 random power
    const speed = bestPower * 500;

    // Calculate angle to hit target (with inaccuracy based on difficulty)
    // The optimal angle for a given speed can be found:
    // tan(θ) = (v² ± sqrt(v⁴ - g(g*x² + 2*y*v²))) / (g*x)
    // For simplification, we use a heuristic

    const dist = Math.abs(dx);
    const optimalAngle = -Math.atan2(dy, dx) * 0.7;

    // Add inaccuracy based on difficulty (1=easy, 5=hard for player => easier enemy is more inaccurate)
    const inaccuracy = (6 - this.difficultyLevel) * 0.05 + 0.03;
    const aiAngle = optimalAngle + (Math.random() - 0.5) * inaccuracy;

    this.aimAngle = clamp(aiAngle, -Math.PI * 0.45, -0.05);
    this.aimPower = bestPower;

    // AI "aims" for a moment, then fires
    this.aiTimer = 0.5 + Math.random() * 0.3;
    this.status = 'ai-aiming';
  }

  update(dt) {
    if (this.status === 'won' || this.status === 'lost') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }
      this.input.endFrame();
      return;
    }

    // Update hit text timer
    if (this.lastHitTimer > 0) this.lastHitTimer -= dt;

    // Update particles
    this._updateParticles(dt);

    if (this.status === 'ai-aiming') {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this._fire();
      }
      this.input.endFrame();
      return;
    }

    if (this.status === 'hit') {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) {
        this._nextTurn();
      }
      this.input.endFrame();
      return;
    }

    if (this.status === 'flying') {
      this._updateArrow(dt);
      this.input.endFrame();
      return;
    }

    // Aiming phase
    if (this.status === 'aiming') {
      // Power bar oscillation
      this.powerOsc += dt * 1.2;
      const rawPower = (Math.sin(this.powerOsc) + 1) / 2;
      this.aimPower = clamp(rawPower, 0.15, 1.0);

      // Mouse aim for player
      if (this.turn === 1 && this.input.mouse.x >= 0) {
        const dx = this.input.mouse.x - this.player.x;
        const dy = this.input.mouse.y - this.player.y;
        this.aimAngle = clamp(Math.atan2(dy, dx), -Math.PI * 0.45, -0.05);
      }

      // Keyboard controls
      if (this.turn === 1) {
        if (this.input.wasPressed('ArrowUp')) this.aimAngle = clamp(this.aimAngle + 0.1, -Math.PI * 0.45, -0.05);
        if (this.input.wasPressed('ArrowDown')) this.aimAngle = clamp(this.aimAngle - 0.1, -Math.PI * 0.45, -0.05);

        if (this.input.mouse.clickedThisFrame || this.input.wasPressed('Space')) {
          this._fire();
        }
      }
    }

    this.input.endFrame();
  }

  _fire() {
    const archer = this.activeArcher;
    const speed = this.aimPower * 500;
    const angle = this.aimAngle;

    this.arrow = {
      x: archer.x + (archer.facingRight ? 15 : -15),
      y: archer.y - 15,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: ARROW_RADIUS,
      active: true,
      angle: angle,
      spin: 0,
    };

    this.trail = [];
    this.status = 'flying';
  }

  _updateArrow(dt) {
    if (!this.arrow || !this.arrow.active) return;

    const a = this.arrow;

    // Store trail
    this.trail.push({ x: a.x, y: a.y, life: 0.6 });
    if (this.trail.length > 40) this.trail.shift();

    // Gravity
    a.vy += GRAVITY * dt;

    // Wind
    a.vx += this.wind * dt;

    // Spin - arrow rotates based on velocity
    a.angle = Math.atan2(a.vy, a.vx);
    a.spin += dt * 3;

    a.x += a.vx * dt;
    a.y += a.vy * dt;

    // Trail fade
    for (const t of this.trail) {
      t.life -= dt;
    }
    this.trail = this.trail.filter((t) => t.life > 0);

    // Ground collision
    if (a.y + a.radius > this.height - 60) {
      a.y = this.height - 60 - a.radius;
      a.vx *= 0.3;
      a.vy *= -0.2;
      this._spawnParticles(a.x, this.height - 60, '#5a5a6a', 6, 60);
      if (Math.abs(a.vy) < 10) {
        this._onArrowStop();
      }
      return;
    }

    // Out of bounds
    if (a.x < -20 || a.x > this.width + 20) {
      this._onArrowStop('Miss!');
      return;
    }

    // Hit target?
    const target = this.targetArcher;
    const dx = a.x - target.x;
    const dy = a.y - (target.y - 10);
    const dist = Math.hypot(dx, dy);

    if (dist < 22) {
      // HIT!
      this._onArrowHit(dist);
      return;
    }

    // If arrow velocity is very low, stop
    if (Math.abs(a.vx) < 3 && Math.abs(a.vy) < 3) {
      this._onArrowStop();
    }
  }

  _onArrowHit(dist) {
    const a = this.arrow;
    a.active = false;

    // Damage based on distance (closer = more damage)
    const hitPower = 1 - dist / 22;
    const damage = Math.round(15 + hitPower * 35);

    if (this.turn === 1) {
      this.player2HP -= damage;
      this.lastHitText = `¡${damage} de daño!`;
    } else {
      this.player1HP -= damage;
      this.lastHitText = `¡${damage} de daño!`;
    }

    this.lastHitTimer = 2;
    this._spawnParticles(this.targetArcher.x, this.targetArcher.y - 10, '#ffb454', 15, 150);
    this._spawnParticles(this.targetArcher.x, this.targetArcher.y - 10, '#e74c3c', 8, 100);

    this.score = this.turn === 1 ? (this.score || 0) + damage : this.score || 0;

    // Check win/lose
    if (this.player2HP <= 0) {
      this.player2HP = 0;
      this.status = 'won';
      if ((this.score || 0) > this.highscore) {
        this.highscore = this.score || 0;
        this.storage.set('highscore', this.highscore);
      }
      return;
    }
    if (this.player1HP <= 0) {
      this.player1HP = 0;
      this.status = 'lost';
      return;
    }

    this.status = 'hit';
    this.hitTimer = 1.5;
  }

  _onArrowStop(message) {
    if (this.arrow) this.arrow.active = false;
    this.arrow = null;
    this.trail = [];
    if (message) {
      this.lastHitText = message;
      this.lastHitTimer = 1.5;
    }
    this.status = 'hit';
    this.hitTimer = 0.8;
  }

  _nextTurn() {
    this.arrow = null;

    // Check turn limit
    if (this.turn === 1) {
      this.turn = 2;
    } else {
      this.turn = 1;
    }

    // Change wind
    this.wind += (Math.random() - 0.5) * 40;
    this.wind = clamp(this.wind, -WIND_MAX, WIND_MAX);

    // Check max turns
    this.turnsPlayed += 1;
    if (this.turnsPlayed >= MAX_TURNS) {
      if (this.player1HP > this.player2HP) {
        this.status = 'won';
        if ((this.score || 0) > this.highscore) {
          this.highscore = this.score || 0;
          this.storage.set('highscore', this.highscore);
        }
      } else {
        this.status = 'lost';
      }
      return;
    }

    this._setupTurn();
  }

  _spawnParticles(x, y, color, count, speed) {
    this.particles.emit(x, y, color, count, speed);
  }

  _updateParticles(dt) {
    this.particles.update(dt);
  }

  render(ctx) {
    // Sky background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    skyGrad.addColorStop(0, '#0d1b2a');
    skyGrad.addColorStop(0.4, '#1b2838');
    skyGrad.addColorStop(0.7, '#1e3a3a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Stars (subtle)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const seed = 42;
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137.5 + seed) % this.width);
      const sy = ((i * 97.3 + seed) % (this.height * 0.5));
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Ground with grass
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, this.height - 60, this.width, 60);
    ctx.fillStyle = '#2a4a2a';
    ctx.fillRect(0, this.height - 60, this.width, 2);

    // Grass tufts
    ctx.strokeStyle = '#3a5a3a';
    ctx.lineWidth = 1;
    for (let i = 0; i < this.width; i += 15) {
      const h = 4 + Math.sin(i * 0.3 + Date.now() * 0.0001) * 2;
      ctx.beginPath();
      ctx.moveTo(i, this.height - 60);
      ctx.lineTo(i + 1, this.height - 60 - h);
      ctx.stroke();
    }

    // Wind indicator
    this._renderWindIndicator(ctx);

    // Trail
    for (const t of this.trail) {
      const alpha = t.life / 0.6;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.5})`;
      ctx.fill();
    }

    // Arrow
    if (this.arrow && this.arrow.active) {
      this._renderArrow(ctx, this.arrow);
    }

    // Player archer
    this._renderArcher(ctx, this.player, this.player1HP, this.turn === 1);

    // Enemy archer
    this._renderArcher(ctx, this.enemy, this.player2HP, this.turn === 2);

    this.particles.render(ctx);

    // HUD
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Turno: ${this.turn === 1 ? 'TÚ' : 'BOT'}`, 10, 10);
    ctx.fillText(`Ronda: ${(this.turnsPlayed || 0) + 1}`, this.width / 2 - 40, 10);

    if (this.highscore > 0) {
      ctx.fillText(`Récord: ${this.highscore}`, this.width - 120, 10);
    }

    // Aiming UI
    if (this.status === 'aiming' && this.turn === 1) {
      // Power bar
      const barX = this.width / 2 - 60;
      const barY = this.height - 30;
      const barW = 120;
      const barH = 10;
      ctx.strokeStyle = '#1e2731';
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.fillStyle = '#ffb454';
      ctx.fillRect(barX + 1, barY + 1, (barW - 2) * this.aimPower, barH - 2);
      ctx.fillStyle = '#7c8894';
      ctx.font = '11px monospace';
      ctx.fillText('POTENCIA', barX, barY - 14);

      // Angle indicator
      ctx.strokeStyle = 'rgba(255, 180, 84, 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y - 10);
      const aimX = this.player.x + Math.cos(this.aimAngle) * 50;
      const aimY = this.player.y - 10 + Math.sin(this.aimAngle) * 50;
      ctx.lineTo(aimX, aimY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Hit text
    if (this.lastHitTimer > 0 && this.lastHitText) {
      ctx.fillStyle = '#ffb454';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const alpha = Math.min(1, this.lastHitTimer);
      ctx.globalAlpha = alpha;
      ctx.fillText(this.lastHitText, this.width / 2, this.height / 2 - 40);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    // Win/Lose overlay
    if (this.status === 'won' || this.status === 'lost') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (this.status === 'won') {
        ctx.fillText('¡VICTORIA!', this.width / 2, this.height / 2 - 30);
      } else {
        ctx.fillText('DERROTA', this.width / 2, this.height / 2 - 30);
      }

      ctx.font = '16px monospace';
      ctx.fillText('Click o Espacio para reiniciar', this.width / 2, this.height / 2 + 20);

      ctx.textAlign = 'left';
    }
  }

  _renderWindIndicator(ctx) {
    const windX = this.width / 2;
    const windY = 55;

    ctx.fillStyle = '#7c8894';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VIENTO', windX, windY - 18);
    ctx.textAlign = 'left';

    // Arrow showing wind direction
    const arrowLen = Math.abs(this.wind) / WIND_MAX * 40;
    const dir = this.wind >= 0 ? 1 : -1;

    ctx.strokeStyle = this.wind === 0 ? '#555' : '#ffb454';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(windX - arrowLen * dir, windY);
    ctx.lineTo(windX + arrowLen * dir, windY);
    ctx.stroke();

    if (this.wind !== 0) {
      // Arrow head
      ctx.beginPath();
      ctx.moveTo(windX + arrowLen * dir, windY);
      ctx.lineTo(windX + (arrowLen - 8) * dir, windY - 4);
      ctx.lineTo(windX + (arrowLen - 8) * dir, windY + 4);
      ctx.closePath();
      ctx.fillStyle = '#ffb454';
      ctx.fill();
    } else {
      ctx.fillStyle = '#555';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('—', windX, windY + 4);
      ctx.textAlign = 'left';
    }
  }

  _renderArcher(ctx, archer, hp, isActive) {
    const x = archer.x;
    const y = archer.y;
    const facingRight = archer.facingRight;
    const dir = facingRight ? 1 : -1;

    // Body glow if active
    if (isActive && this.status === 'aiming') {
      ctx.beginPath();
      ctx.arc(x, y - 10, 25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 180, 84, 0.08)';
      ctx.fill();
    }

    // Legs
    ctx.strokeStyle = archer.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x - 4 * dir, y + 12);
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 4 * dir, y + 12);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y - 2);
    ctx.stroke();

    // Bow arm (angled)
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    const bowAngle = isActive ? -Math.PI / 4 : (facingRight ? -0.5 : -2.5);
    ctx.lineTo(x + Math.cos(bowAngle) * 12 * dir, y - 5 + Math.sin(bowAngle) * 12);
    ctx.stroke();

    // Bow
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 2;
    const bx = x + 8 * dir;
    const by = y - 8;
    ctx.beginPath();
    ctx.arc(bx, by, 10, facingRight ? -Math.PI * 0.4 : Math.PI * 0.4, facingRight ? Math.PI * 0.4 : -Math.PI * 0.4);
    ctx.stroke();

    // Bowstring
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const bowStartAngle = facingRight ? -Math.PI * 0.4 : Math.PI * 0.4;
    const bowEndAngle = facingRight ? Math.PI * 0.4 : -Math.PI * 0.4;
    ctx.moveTo(bx + Math.cos(bowStartAngle) * 10, by + Math.sin(bowStartAngle) * 10);
    ctx.lineTo(bx + Math.cos(bowEndAngle) * 10, by + Math.sin(bowEndAngle) * 10);
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(x, y - 13, 5, 0, Math.PI * 2);
    ctx.fillStyle = archer.color;
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 1.5 * dir, y - 13.5, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Hat/helmet
    ctx.fillStyle = archer.color;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 16);
    ctx.lineTo(x, y - 20);
    ctx.lineTo(x + 6, y - 16);
    ctx.closePath();
    ctx.fill();

    // Health bar
    const barW = 36;
    const barH = 4;
    const barX = x - barW / 2;
    const barY = y + 16;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    const hpPercent = hp / 100;
    ctx.fillStyle = hpPercent > 0.5 ? '#3a9a5a' : hpPercent > 0.25 ? '#ffb454' : '#e74c3c';
    ctx.fillRect(barX + 1, barY + 1, (barW - 2) * hpPercent, barH - 2);

    // HP text
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${hp}`, x, barY + barH + 3);

    // Label
    ctx.fillStyle = isActive ? '#ffb454' : '#7c8894';
    ctx.font = '11px monospace';
    ctx.fillText(archer.label, x, barY + barH + 15);
    ctx.textAlign = 'left';
  }

  _renderArrow(ctx, arrow) {
    ctx.save();
    ctx.translate(arrow.x, arrow.y);
    ctx.rotate(arrow.angle);

    // Arrow shaft
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = '#ccc';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(8, -3);
    ctx.lineTo(8, 3);
    ctx.closePath();
    ctx.fill();

    // Fletching
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-13, -3);
    ctx.lineTo(-13, 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  destroy() {
    this.input.detach();
  }
}
