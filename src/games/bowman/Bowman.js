/**
 * Bowman
 * Nivel 4 — Estrategia / Defensa
 *
 * Mecánica: dos arqueros en lados opuestos. El jugador apunta con el
 * ratón (ángulo y potencia) y dispara una flecha con física parabólica
 * afectada por viento. La IA enemiga apunta con margen de error variable
 * según dificultad. El viento cambia cada turno.
 */
import { GameBase } from '../../engine/GameBase.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { clamp } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { icon } from '../../engine/IconRenderer.js';
import { GRAVITY, WIND_MAX, ARROW_RADIUS, MAX_TURNS, COLORS } from './constants.js';

export class Bowman extends GameBase {
  _defaultBindings() {
    const parent = super._defaultBindings ? super._defaultBindings() : {};
    return {
      ...parent,
      moveUp: ['ArrowUp', 'GamepadUp', 'GamepadLStickUp'],
      moveDown: ['ArrowDown', 'GamepadDown', 'GamepadLStickDown'],
    };
  }

  init(engine) {
    super.init(engine, 'bowman');
    this.highscore = this.storage.get('highscore', 0);

    this._restart();
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this.player.y = this.height - 60 - (this.terrainType === 2 ? 40 : this.terrainType === 1 ? 20 : 0);
    this.enemy.x = this.width - 80;
    this.enemy.y = this.height - 60 - (this.terrainType === 2 ? 60 : this.terrainType === 1 ? 15 : 0);
  }

  _restart() {
    this.startTime = Date.now();
    this.rng = new SeededRandom();
    this.player1HP = 100;
    this.player2HP = 100;
    this.turn = 1; // 1 = player, 2 = enemy
    this.status = 'aiming'; // 'aiming' | 'flying' | 'hit' | 'won' | 'lost'
    this.wind = (this.rng.next() - 0.5) * 2 * WIND_MAX;
    this.trail = [];
    this.particles = new ParticleSystem(150);
    this.arrow = null;
    this.backgroundOffset = 0;
    this.lastHitText = '';
    this.lastHitTimer = 0;
    this.turnsPlayed = 0;
    this.score = 0;
    this.hasShield = false;
    this.hasMultiShot = false;
    this.terrainType = this.rng.nextInt(0, 2); // 0=plano, 1=colinas, 2=montañas
    this.showTutorial = true;
    this.tutorialTimer = 4;
    this.tutorialAlpha = 1;

    // Player position (left side)
    this.player = {
      x: 80,
      y: this.height - 60 - (this.terrainType === 2 ? 40 : this.terrainType === 1 ? 20 : 0),
      angle: -Math.PI / 4,
      power: 0.5,
      color: '#4a9eff',
      label: 'bowman.turnPlayer',
      facingRight: true,
    };

    // Enemy position (right side)
    const enemyY = this.height - 60 - (this.terrainType === 2 ? 60 : this.terrainType === 1 ? 15 : 0);
    this.enemy = {
      x: this.width - 80,
      y: enemyY,
      angle: Math.PI * 0.75,
      power: 0.5,
      color: '#e74c3c',
      label: 'bowman.turnBot',
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
    const dx = this.player.x - this.enemy.x;
    const dy = (this.player.y - 5) - this.enemy.y;

    // El enemigo está a la derecha, necesita ángulo que apunte a la izquierda y arriba
    // Rango correcto: entre -PI y -PI/2 (tercer cuadrante: izquierda y arriba)
    const bestPower = 0.35 + this.rng.next() * 0.45;
    const speed = bestPower * 500;

    // Calcular ángulo óptimo: apuntar hacia el jugador (a la izquierda y arriba)
    // atan2(dy, dx) donde dx < 0 y dy ≈ 0 da ~PI (180°), dy < 0 da ~PI - algo
    const optimalAngle = Math.atan2(dy, dx);
    // Ajustar con offset para que apunte más arriba (mejor trayectoria parabólica)
    const adjustedAngle = optimalAngle - 0.3;

    const diff = Math.min(1 + Math.floor(this.turnsPlayed / 4), 5);
    const inaccuracy = (6 - diff) * 0.05 + 0.03;
    const aiAngle = adjustedAngle + (this.rng.next() - 0.5) * inaccuracy;

    // El enemigo mira a la izquierda: necesita ángulos en [-PI*0.95, -PI*0.55]
    // que corresponden a ~170° a ~100° (apuntando a la izquierda y arriba)
    this.aimAngle = clamp(aiAngle, -Math.PI * 0.95, -Math.PI * 0.55);
    this.aimPower = bestPower;
    this.aiTimer = 0.5 + this.rng.next() * 0.3;
    this.status = 'ai-aiming';
  }

  update(dt) {
    if (this.handleRestartInput()) return;

    if (this.lastHitTimer > 0) this.lastHitTimer -= dt;
    this.particles.update(dt);

    // Tutorial timer (usamos dt real)
    if (this.showTutorial) {
      this.tutorialTimer -= dt;
      if (this.tutorialTimer <= 0) {
        this.tutorialAlpha = Math.max(0, this.tutorialAlpha - dt * 2);
        if (this.tutorialAlpha <= 0) this.showTutorial = false;
      }
    }

    if (this.status === 'ai-aiming') {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this._fire();
      }

      return;
    }

    if (this.status === 'hit') {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) {
        this._nextTurn();
      }

      return;
    }

    if (this.status === 'flying') {
      this._updateArrow(dt);

      return;
    }

    if (this.status === 'aiming') {
      this.powerOsc += dt * 1.2;
      const rawPower = (Math.sin(this.powerOsc) + 1) / 2;
      this.aimPower = clamp(rawPower, 0.15, 1.0);

      if (this.turn === 1 && this.input.mouse.x >= 0) {
        const dx = this.input.mouse.x - this.player.x;
        const dy = this.input.mouse.y - this.player.y;
        this.aimAngle = clamp(Math.atan2(dy, dx), -Math.PI * 0.45, -0.05);
      }

      if (this.turn === 1) {
        if (this.input.wasActionPressed('moveUp') || this.input.isActionDown('moveUp')) this.aimAngle = clamp(this.aimAngle + 0.1, -Math.PI * 0.45, -0.05);
        if (this.input.wasActionPressed('moveDown') || this.input.isActionDown('moveDown')) this.aimAngle = clamp(this.aimAngle - 0.1, -Math.PI * 0.45, -0.05);
        if (this.input.mouse.clickedThisFrame || this.input.wasActionPressed('action')) {
          this._fire();
        }
      }
    }

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
    };

    AudioManager.sfx({ type: 'bowman_fire', volume: 0.25 });
    this.trail = [];
    this.status = 'flying';
  }

  _updateArrow(dt) {
    if (!this.arrow || !this.arrow.active) return;

    const a = this.arrow;
    this.trail.push({ x: a.x, y: a.y, life: 0.6 });
    if (this.trail.length > 40) this.trail.shift();

    a.vy += GRAVITY * dt;
    a.vx += this.wind * dt;
    a.angle = Math.atan2(a.vy, a.vx);
    a.x += a.vx * dt;
    a.y += a.vy * dt;

    for (const t of this.trail) { t.life -= dt; }
    this.trail = this.trail.filter((t) => t.life > 0);

    if (a.y + a.radius > this.height - 60) {
      a.y = this.height - 60 - a.radius;
      a.vx *= 0.3;
      a.vy *= -0.2;
      this.particles.burst(a.x, this.height - 60, '#5a5a6a', 6, 60);
      if (Math.abs(a.vy) < 10) { this._onArrowStop(); }
      return;
    }

    if (a.x < -20 || a.x > this.width + 20) { this._onArrowStop('Miss!'); return; }

    const target = this.targetArcher;
    const dx = a.x - target.x;
    const dy = a.y - (target.y - 10);
    const dist = Math.hypot(dx, dy);

    if (dist < 22) { this._onArrowHit(dist); return; }

    if (Math.abs(a.vx) < 3 && Math.abs(a.vy) < 3) { this._onArrowStop(); }
  }

  _onArrowHit(dist) {
    const a = this.arrow;
    a.active = false;

    const hitPower = 1 - dist / 22;
    const damage = Math.round(15 + hitPower * 35);

    if (this.turn === 1) {
      const actualDamage = this.hasShield ? Math.floor(damage / 2) : damage;
      this.player2HP -= actualDamage;
      this.lastHitText = this.hasShield ? `🛡️ ¡${actualDamage} de daño (escudo)!` : `¡${damage} de daño!`;
    } else {
      const actualDamage = this.hasShield ? Math.floor(damage / 2) : damage;
      this.player1HP -= actualDamage;
      this.lastHitText = this.hasShield ? `🛡️ ¡${actualDamage} de daño (escudo)!` : `¡${damage} de daño!`;
    }

    this.hasShield = false;
    this.lastHitTimer = 2;
    AudioManager.sfx({ type: 'bowman_hit', volume: 0.5 });
    HapticManager.vibrate('hit');
    this.particles.burst(this.targetArcher.x, this.targetArcher.y - 10, '#ffb454', 15, 150);
    this.particles.burst(this.targetArcher.x, this.targetArcher.y - 10, '#e74c3c', 8, 100);
    this.score = this.turn === 1 ? (this.score || 0) + damage : this.score || 0;

    if (this.player2HP <= 0) {
      this.player2HP = 0;
      this.status = 'won';
      this._recordProgressionPlay(true);
      AudioManager.sfx({ type: 'powerup', volume: 0.5 });
      HapticManager.vibrate('powerup');
      if ((this.score || 0) > this.highscore) {
        this.highscore = this.score || 0;
        this.storage.set('highscore', this.highscore);
      }
      return;
    }
    if (this.player1HP <= 0) {
      this.player1HP = 0;
      this.status = 'lost';
      this._recordProgressionPlay(false);
      AudioManager.sfx({ type: 'explosion', volume: 0.4 });
      HapticManager.vibrate('explosion');
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

  _getPowerUp() {
    const powerUps = [
      { id: 'shield', label: '🛡️ ¡Escudo! Absorbe 30 de daño' },
      { id: 'multishot', label: '🏹 ¡Multidisparo! Disparas 2 flechas' },
      { id: 'heal', label: '💚 ¡Curación! +25 HP' },
    ];
    return powerUps[this.rng.nextInt(0, powerUps.length - 1)];
  }

  _nextTurn() {
    this.arrow = null;

    if (this.turn === 1) {
      this.turn = 2;
    } else {
      this.turn = 1;
      if (this.turnsPlayed > 0 && this.turnsPlayed % 3 === 0) {
        const pu = this._getPowerUp();
        this.lastHitText = pu.label;
        this.lastHitTimer = 2;
        if (pu.id === 'heal') { this.player1HP = Math.min(100, this.player1HP + 25); }
        if (pu.id === 'shield') { this.hasShield = true; }
        if (pu.id === 'multishot') { this.hasMultiShot = true; }
      }
    }

    this.wind += (this.rng.next() - 0.5) * 40;
    this.wind = clamp(this.wind, -WIND_MAX, WIND_MAX);

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

  _recordProgressionPlay(won) {
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('bowman', this.score || 0, won, duration);
    if (this.score >= 1) ProgressionManager.checkAchievement('bowman', 'first-shot');
    if (this.score >= 5) ProgressionManager.checkAchievement('bowman', 'sharpshooter');
    if (this.score >= 50) ProgressionManager.checkAchievement('bowman', 'bowman-legend');
  }

  render(ctx) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    skyGrad.addColorStop(0, '#0d1b2a');
    skyGrad.addColorStop(0.4, '#1b2838');
    skyGrad.addColorStop(0.7, '#1e3a3a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const seed = 42;
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137.5 + seed) % this.width);
      const sy = ((i * 97.3 + seed) % (this.height * 0.5));
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, this.height - 60, this.width, 60);
    ctx.fillStyle = '#2a4a2a';
    ctx.fillRect(0, this.height - 60, this.width, 2);

    ctx.strokeStyle = '#3a5a3a';
    ctx.lineWidth = 1;
    for (let i = 0; i < this.width; i += 15) {
      const h = 4 + Math.sin(i * 0.3 + Date.now() * 0.0001) * 2;
      ctx.beginPath();
      ctx.moveTo(i, this.height - 60);
      ctx.lineTo(i + 1, this.height - 60 - h);
      ctx.stroke();
    }

    this._renderWindIndicator(ctx);

    for (const t of this.trail) {
      const alpha = t.life / 0.6;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.5})`;
      ctx.fill();
    }

    if (this.arrow && this.arrow.active) {
      this._renderArrow(ctx, this.arrow);
    }

    this._renderArcher(ctx, this.player, this.player1HP, this.turn === 1);
    this._renderArcher(ctx, this.enemy, this.player2HP, this.turn === 2);

    this.particles.render(ctx);

    // Tutorial (el timer se actualiza en update() con dt real)
    if (this.showTutorial && this.tutorialAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * this.tutorialAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = `rgba(255, 255, 255, ${this.tutorialAlpha})`;
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = [
        '═══ BOWMAN ═══',
        '',
        'Mueve el ratón para apuntar',
        'El poder oscila automáticamente',
        'Click o ESPACIO para disparar',
        'El viento afecta la trayectoria',
        '',
        '¡Elimina al arquero enemigo!'];
      const lineH = 22;
      const startY = this.height / 2 - (lines.length * lineH) / 2;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], this.width / 2, startY + i * lineH);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    setupHUDContext(ctx);
    ctx.fillText(t('bowman.turn', { n: this.turn === 1 ? t('bowman.turnPlayer') : t('bowman.turnBot') }), 10, 10);
    ctx.fillText(t('bowman.round', { n: (this.turnsPlayed || 0) + 1 }), this.width / 2 - 40, 10);


    if (this.highscore > 0) {
      ctx.fillText(t('bowman.record', { n: this.highscore }), this.width - 120, 10);
    }

    if (this.status === 'aiming' && this.turn === 1) {
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
      ctx.fillText(t('game.power'), barX, barY - 14);

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

    if (this.status === 'won' || this.status === 'lost') {
      const title = this.status === 'won' ? t('game.victory') : t('game.defeat');
      renderOverlay(ctx, { width: this.width, height: this.height, title });
    }
  }

  _renderWindIndicator(ctx) {
    const windX = this.width / 2;
    const windY = 55;

    ctx.fillStyle = '#7c8894';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t('game.wind'), windX, windY - 18);
    ctx.textAlign = 'left';

    const arrowLen = Math.abs(this.wind) / WIND_MAX * 40;
    const dir = this.wind >= 0 ? 1 : -1;

    ctx.strokeStyle = this.wind === 0 ? '#555' : '#ffb454';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(windX - arrowLen * dir, windY);
    ctx.lineTo(windX + arrowLen * dir, windY);
    ctx.stroke();

    if (this.wind !== 0) {
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

    if (isActive && this.status === 'aiming') {
      ctx.beginPath();
      ctx.arc(x, y - 10, 25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 180, 84, 0.08)';
      ctx.fill();
    }

    ctx.strokeStyle = archer.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x - 4 * dir, y + 12);
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 4 * dir, y + 12);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y - 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    const bowAngle = isActive ? -Math.PI / 4 : (facingRight ? -0.5 : -2.5);
    ctx.lineTo(x + Math.cos(bowAngle) * 12 * dir, y - 5 + Math.sin(bowAngle) * 12);
    ctx.stroke();

    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 2;
    const bx = x + 8 * dir;
    const by = y - 8;
    ctx.beginPath();
    ctx.arc(bx, by, 10, facingRight ? -Math.PI * 0.4 : Math.PI * 0.4, facingRight ? Math.PI * 0.4 : -Math.PI * 0.4);
    ctx.stroke();

    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const bowStartAngle = facingRight ? -Math.PI * 0.4 : Math.PI * 0.4;
    const bowEndAngle = facingRight ? Math.PI * 0.4 : -Math.PI * 0.4;
    ctx.moveTo(bx + Math.cos(bowStartAngle) * 10, by + Math.sin(bowStartAngle) * 10);
    ctx.lineTo(bx + Math.cos(bowEndAngle) * 10, by + Math.sin(bowEndAngle) * 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y - 13, 5, 0, Math.PI * 2);
    ctx.fillStyle = archer.color;
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 1.5 * dir, y - 13.5, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = archer.color;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 16);
    ctx.lineTo(x, y - 20);
    ctx.lineTo(x + 6, y - 16);
    ctx.closePath();
    ctx.fill();

    const barW = 36;
    const barH = 4;
    const barX = x - barW / 2;
    const barY = y + 16;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    const hpPercent = hp / 100;
    ctx.fillStyle = hpPercent > 0.5 ? '#3a9a5a' : hpPercent > 0.25 ? '#ffb454' : '#e74c3c';
    ctx.fillRect(barX + 1, barY + 1, (barW - 2) * hpPercent, barH - 2);

    ctx.fillStyle = '#9aa7b2';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${hp}`, x, barY + barH + 3);

    ctx.fillStyle = isActive ? '#ffb454' : '#7c8894';
    ctx.font = '11px monospace';      ctx.fillText(t(archer.label), x, barY + barH + 15);
    ctx.textAlign = 'left';
  }

  _renderArrow(ctx, arrow) {
    ctx.save();
    ctx.translate(arrow.x, arrow.y);
    ctx.rotate(arrow.angle);

    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();

    ctx.fillStyle = '#ccc';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(8, -3);
    ctx.lineTo(8, 3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-13, -3);
    ctx.lineTo(-13, 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

}
