/**
 * Bloons TD
 * Nivel 4 — Estrategia / Defensa
 *
 * Mecánica: los globos (Bloons) siguen un camino fijo (waypoints).
 * El jugador coloca torres que disparan automáticamente a los bloons
 * cercanos. Cada oleada trae más bloons y más resistentes.
 * Sistema de dinero y vidas.
 */
import { GameBase } from '../../engine/GameBase.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { icon } from '../../engine/IconRenderer.js';
import { COLORS, RELATIVE_WAYPOINTS, MAX_WAVE, TOWER_TYPES, TOWER_KEYS, BLOON_TYPES, BLOON_ORDER } from './constants.js';

export class BloonsTD extends GameBase {
  init(engine) {
    super.init(engine, 'bloons-td');
    this.highscore = this.storage.get('highscore', 0);

    this._restart();
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this._calculatePath();
  }

  _restart() {
    this.rng = new SeededRandom();
    this.lives = 20;
    this.money = 300;
    this.score = 0;
    this.wave = 0;
    this.towers = [];
    this.bloons = [];
    this.projectiles = [];
    this.particles = new ParticleSystem(100);
    this.selectedTowerType = 'dart';
    this.placingTower = false;
    this.placeX = 0;
    this.placeY = 0;
    this.waveInProgress = false;
    this.bloonsSpawned = 0;
    this.bloonsTotal = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 0.6;
    this.status = 'pre-wave'; // 'pre-wave' | 'wave' | 'won' | 'lost'
    this.lastWaveWon = false;
    this.speedMultiplier = 1; // 1x, 2x, 3x
    this.autoAdvanceTimer = 0; // cuenta regresiva 5s para auto-avance

    this._calculatePath();
  }

  _calculatePath() {
    this.waypoints = RELATIVE_WAYPOINTS.map((wp) => ({
      x: wp.x * this.width,
      y: wp.y * this.height,
    }));

    this.pathPoints = [];
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[i + 1];
      const segments = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        this.pathPoints.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        });
      }
    }
    this.pathTotal = this.pathPoints.length;
  }

  _startWave() {
    this.wave++;
    this.waveInProgress = true;
    this.bloonsSpawned = 0;
    this.status = 'wave';
    AudioManager.sfx({ type: 'powerup', volume: 0.3, playbackRate: 0.8 });

    const baseCount = 5 + this.wave * 2 + Math.floor(this.wave / 3);
    this.bloonsTotal = baseCount;

    this.waveBloonTypes = [];
    const maxBloonIndex = Math.min(Math.floor(this.wave / 2), BLOON_ORDER.length - 1);
    for (let i = 0; i < this.bloonsTotal; i++) {
      const index = this.rng.nextInt(0, maxBloonIndex);
      const biasedIndex = Math.floor(index * (0.5 + this.rng.next() * 0.5));
      this.waveBloonTypes.push(BLOON_ORDER[Math.min(biasedIndex, maxBloonIndex)]);
    }

    this.spawnTimer = 0;
    this.spawnInterval = Math.max(0.2, 0.6 - this.wave * 0.025);
  }

  _spawnBloon(typeKey) {
    const type = BLOON_TYPES[typeKey];
    this.bloons.push({
      x: this.waypoints[0].x,
      y: this.waypoints[0].y,
      pathIndex: 0,
      hp: type.hp,
      maxHp: type.hp,
      speed: type.speed,
      color: type.color,
      points: type.points,
      radius: type.radius,
      type: typeKey,
      alive: true,
      wobble: this.rng.next() * Math.PI * 2,
    });
  }

  update(dt) {
    if (this.handleRestartInput()) return;

    // Aplicar multiplicador de velocidad
    const gameDt = dt * this.speedMultiplier;

    this.particles.update(gameDt);

    if (this.status === 'wave' && this.bloonsSpawned < this.bloonsTotal) {
      this.spawnTimer -= gameDt;
      if (this.spawnTimer <= 0) {
        this._spawnBloon(this.waveBloonTypes[this.bloonsSpawned]);
        this.bloonsSpawned++;
        this.spawnTimer = this.spawnInterval;
      }
    }

    this._updateBloons(gameDt);
    this._updateTowers(gameDt);
    this._updateProjectiles(gameDt);

    // Auto-advance timer usa dt real, no gameDt (5s reales)
    const realDt = dt;

    if (
      this.status === 'wave' &&
      this.bloonsSpawned >= this.bloonsTotal &&
      this.bloons.filter((b) => b.alive).length === 0
    ) {
      this.waveInProgress = false;
      this.lastWaveWon = true;

      if (this.wave >= MAX_WAVE) {
        this.status = 'won';
        if (this.score > this.highscore) {
          this.highscore = this.score;
          this.storage.set('highscore', this.highscore);
        }
        AudioManager.sfx({ type: 'powerup', volume: 0.6 });
        HapticManager.vibrate('powerup');
      } else {
        this.status = 'pre-wave';
        this.money += 20 + this.wave * 5;
        this.autoAdvanceTimer = 5; // auto-avance en 5 segundos
      }
    }

    this._handlePlacement();

    // Speed multiplier: 4=1x, 5=2x, 6=3x
    if (this.input.wasPressed('Digit1')) this.selectedTowerType = 'dart';
    if (this.input.wasPressed('Digit2')) this.selectedTowerType = 'cannon';
    if (this.input.wasPressed('Digit3')) this.selectedTowerType = 'sniper';
    if (this.input.wasPressed('Digit4')) this.speedMultiplier = 1;
    if (this.input.wasPressed('Digit5')) this.speedMultiplier = 2;
    if (this.input.wasPressed('Digit6')) this.speedMultiplier = 3;
    if (this.input.wasPressed('KeyP')) this.placingTower = !this.placingTower;

    if (this.status === 'pre-wave') {
      // Auto-advance timer: 5 segundos reales después de completar oleada
      if (this.lastWaveWon) {
        this.autoAdvanceTimer -= realDt;
        if (this.autoAdvanceTimer <= 0) {
          this.autoAdvanceTimer = 0;
          this._startWave();
        }
      }
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this.autoAdvanceTimer = 0;
        this._startWave();
      }
    }

  }

  _updateBloons(dt) {
    for (const bloon of this.bloons) {
      if (!bloon.alive) continue;
      bloon.pathIndex += bloon.speed * dt / 5;
      bloon.wobble += dt * 2;

      if (bloon.pathIndex >= this.pathTotal - 1) {
        bloon.alive = false;
        this.lives--;
        this.particles.burst(bloon.x, bloon.y, '#e74c3c', 8, 80);
        if (this.lives <= 0) {
          this.lives = 0;
          this.status = 'lost';
          if (this.score > this.highscore) {
            this.highscore = this.score;
            this.storage.set('highscore', this.highscore);
          }
        }
        continue;
      }

      const idx = Math.floor(bloon.pathIndex);
      const nextIdx = Math.min(idx + 1, this.pathTotal - 1);
      const t = bloon.pathIndex - idx;
      const p1 = this.pathPoints[idx];
      const p2 = this.pathPoints[nextIdx];

      if (p1 && p2) {
        bloon.x = p1.x + (p2.x - p1.x) * t;
        bloon.y = p1.y + (p2.y - p1.y) * t;
      }
    }
    this.bloons = this.bloons.filter((b) => b.alive || this.status === 'lost');
  }

  _updateTowers(dt) {
    for (const tower of this.towers) {
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;

      const type = TOWER_TYPES[tower.type];
      let closestBloon = null;
      let closestDist = type.range;

      for (const bloon of this.bloons) {
        if (!bloon.alive) continue;
        const dx = bloon.x - tower.x;
        const dy = bloon.y - tower.y;
        const dist = Math.hypot(dx, dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestBloon = bloon;
        }
      }

      if (closestBloon) {
        tower.cooldown = type.fireRate;
        tower.angle = Math.atan2(closestBloon.y - tower.y, closestBloon.x - tower.x);
        tower.firing = 0.1;

        this.projectiles.push({
          x: tower.x,
          y: tower.y,
          target: closestBloon,
          speed: type.projSpeed,
          damage: type.damage,
          radius: type === TOWER_TYPES.cannon ? 4 : 3,
          color: type.projectileColor,
          splash: type.splash || 0,
          alive: true,
          towerType: tower.type,
        });
      }
    }

    for (const tower of this.towers) {
      if (tower.firing > 0) tower.firing -= dt;
    }
  }

  _updateProjectiles(dt) {
    for (const proj of this.projectiles) {
      if (!proj.alive) continue;
      if (!proj.target || !proj.target.alive) {
        proj.alive = false;
        continue;
      }

      const dx = proj.target.x - proj.x;
      const dy = proj.target.y - proj.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 8) {
        proj.target.hp -= proj.damage;
        this.particles.burst(proj.target.x, proj.target.y, proj.target.color, 6, 60);

        if (proj.splash > 0) {
          this.particles.burst(proj.target.x, proj.target.y, '#ffb454', 12, 100);
          for (const other of this.bloons) {
            if (other === proj.target || !other.alive) continue;
            const dx2 = other.x - proj.target.x;
            const dy2 = other.y - proj.target.y;
            if (Math.hypot(dx2, dy2) < proj.splash) {
              other.hp -= Math.ceil(proj.damage / 2);
            }
          }
        }

        if (proj.target.hp <= 0) {
          proj.target.alive = false;
          this.money += proj.target.points * 2;
          this.score += proj.target.points;
          AudioManager.sfx({ type: 'bloons_pop', volume: 0.25 });
          HapticManager.vibrate('coin');
          this.particles.burst(proj.target.x, proj.target.y, proj.target.color, 12, 120);
        }

        proj.alive = false;
      } else {
        const moveSpeed = proj.speed * dt;
        proj.x += (dx / dist) * moveSpeed;
        proj.y += (dy / dist) * moveSpeed;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  _handlePlacement() {
    if (this.input.mouse.clickedThisFrame && !this.placingTower) {
      this.placeX = this.input.mouse.x;
      this.placeY = this.input.mouse.y;
      this._tryPlaceTower(this.placeX, this.placeY);
    }

    if (this.input.mouse.x >= 0) {
      this.placeX = this.input.mouse.x;
      this.placeY = this.input.mouse.y;
    }
  }

  _tryPlaceTower(x, y) {
    const type = TOWER_TYPES[this.selectedTowerType];
    if (this.money < type.cost) return false;

    for (const pp of this.pathPoints) {
      const dx = pp.x - x;
      const dy = pp.y - y;
      if (Math.hypot(dx, dy) < 20) return false;
    }

    for (const tower of this.towers) {
      const dx = tower.x - x;
      const dy = tower.y - y;
      if (Math.hypot(dx, dy) < 25) return false;
    }

    this.towers.push({
      x, y,
      type: this.selectedTowerType,
      cooldown: 0,
      angle: 0,
      firing: 0,
    });

    this.money -= type.cost;
    AudioManager.sfx({ type: 'bloons_place', volume: 0.25 });
    return true;
  }

  render(ctx) {
    ctx.fillStyle = '#0d1a12';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#2a3a2a';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2a3a2a';
    ctx.beginPath();
    ctx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
    for (let i = 1; i < this.waypoints.length; i++) {
      ctx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#3a4a3a';
    ctx.lineWidth = 28;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
    for (let i = 1; i < this.waypoints.length; i++) {
      ctx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(46, 204, 113, 0.3)';
    ctx.beginPath();
    ctx.arc(this.waypoints[0].x, this.waypoints[0].y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
    ctx.beginPath();
    ctx.arc(this.waypoints[this.waypoints.length - 1].x, this.waypoints[this.waypoints.length - 1].y, 14, 0, Math.PI * 2);
    ctx.fill();

    if (this.input.mouse.x >= 0) {
      const type = TOWER_TYPES[this.selectedTowerType];
      if (this.money >= type.cost) {
        ctx.beginPath();
        ctx.arc(this.placeX, this.placeY, type.range, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 180, 84, 0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 180, 84, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    for (const bloon of this.bloons) {
      if (!bloon.alive) continue;
      ctx.beginPath();
      ctx.arc(bloon.x + 2, bloon.y + 2, bloon.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bloon.x, bloon.y, bloon.radius, 0, Math.PI * 2);
      ctx.fillStyle = bloon.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bloon.x - 3, bloon.y - 3, bloon.radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();

      if (bloon.maxHp > 1) {
        const barW = bloon.radius * 2;
        const barH = 3;
        const barX = bloon.x - barW / 2;
        const barY = bloon.y - bloon.radius - 6;
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(barX + 1, barY + 1, (barW - 2) * (bloon.hp / bloon.maxHp), barH - 2);
      }
    }

    for (const tower of this.towers) {
      const type = TOWER_TYPES[tower.type];
      ctx.fillStyle = type.color;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#1e2731';
      ctx.fillRect(tower.x - 7, tower.y - 7, 14, 14);
      ctx.strokeStyle = type.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(tower.x - 7, tower.y - 7, 14, 14);

      ctx.save();
      ctx.translate(tower.x, tower.y);
      ctx.rotate(tower.angle || 0);
      ctx.fillStyle = type.color;
      ctx.fillRect(0, -2, 12, 4);
      ctx.fillStyle = '#e7edf3';
      ctx.fillRect(8, -1.5, 4, 3);
      ctx.restore();

      if (this.input.mouse.x >= 0) {
        const dx = this.input.mouse.x - tower.x;
        const dy = this.input.mouse.y - tower.y;
        if (Math.hypot(dx, dy) < 20) {
          ctx.beginPath();
          ctx.arc(tower.x, tower.y, type.range, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      if (tower.firing > 0) {
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 180, 84, 0.2)';
        ctx.fill();
      }
    }

    for (const proj of this.projectiles) {
      if (!proj.alive) continue;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fillStyle = proj.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius * 2, 0, Math.PI * 2);
      ctx.fillStyle = proj.color + '30';
      ctx.fill();
    }

    this.particles.render(ctx);

    ctx.fillStyle = COLORS.inkDim;
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(t('bloons.lives', { n: this.lives }), 10, 10);
    ctx.fillText(t('bloons.money', { n: this.money }), 10, 30);


    if (this.highscore > 0) {
      ctx.fillText(t('bloons.record', { n: this.highscore }), this.width - 120, 10);
    }

    const towerBarY = this.height - 50;
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(0, towerBarY - 5, this.width, 55);

    ctx.fillStyle = COLORS.inkDim;
    ctx.font = '11px monospace';
    ctx.fillText(t('bloons.towers'), 10, towerBarY + 2);

    for (let i = 0; i < TOWER_KEYS.length; i++) {
      const key = TOWER_KEYS[i];
      const type = TOWER_TYPES[key];
      const tx = 140 + i * 120;
      const isSelected = this.selectedTowerType === key;
      const canAfford = this.money >= type.cost;

      ctx.fillStyle = isSelected ? COLORS.marquee : (canAfford ? COLORS.ink : COLORS.inkDim);
      ctx.font = isSelected ? 'bold 12px monospace' : '12px monospace';
      const label = `${t(type.nameKey)} $${type.cost}`;
      ctx.fillText(label, tx, towerBarY + 2);

      ctx.fillStyle = type.color;
      ctx.fillRect(tx, towerBarY + 16, 10, 10);
      if (isSelected) {
        ctx.strokeStyle = COLORS.marquee;
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, towerBarY + 16, 10, 10);
      }
    }

    if (this.status === 'pre-wave') {
      ctx.fillStyle = COLORS.ink;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      if (this.lastWaveWon) {
        const autoMsg = this.autoAdvanceTimer > 0 ? ` (${Math.ceil(this.autoAdvanceTimer)}s)` : '';
        ctx.fillText(t('bloons.waveComplete', { n: this.wave }) + ' ' + t('bloons.nextWave') + autoMsg, this.width / 2, 80);
      } else {
        ctx.fillText(t('bloons.nextWave'), this.width / 2, 80);
      }
      ctx.textAlign = 'left';
    }

    // Indicador de velocidad con icono SVG de reloj
    ctx.textAlign = 'right';
    ctx.font = '12px monospace';
    ctx.fillStyle = COLORS.inkDim;
    const speedOpts = [
      { key: '4', mult: 1 },
      { key: '5', mult: 2 },
      { key: '6', mult: 3 },
    ];
    let speedX = this.width - 10;
    for (let i = speedOpts.length - 1; i >= 0; i--) {
      const s = speedOpts[i];
      const label = `${s.mult}x`;
      ctx.fillText(label, speedX, 10);
      speedX -= ctx.measureText(label).width;
      if (this.speedMultiplier === s.mult) {
        speedX -= 16;
        icon(ctx, 'clock', speedX + 8, 17, 12, '#9aa7b2');
      }
      ctx.fillText(`[${s.key}] `, speedX, 10);
      speedX -= ctx.measureText(`[${s.key}] `).width;
    }
    ctx.textAlign = 'left';

    if (this.status === 'wave') {
      ctx.fillStyle = COLORS.inkDim;
      ctx.font = '12px monospace';
      ctx.fillText(t('bloons.bloonsOnScreen', { n: this.bloons.filter(b => b.alive).length }), 10, 72);
    }

    if (this.status === 'won' || this.status === 'lost') {
      const title = this.status === 'won' ? t('game.victory') : t('bloons.gameOver');
      renderOverlay(ctx, { width: this.width, height: this.height, title, score: this.score });
    }
  }

}
