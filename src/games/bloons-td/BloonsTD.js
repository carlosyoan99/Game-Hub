/**
 * Bloons TD
 * Nivel 4 — Estrategia / Defensa
 *
 * Mecánica: los globos (Bloons) siguen un camino fijo (waypoints).
 * El jugador coloca torres que disparan automáticamente a los bloons
 * cercanos. Cada oleada trae más bloons y más resistentes.
 * Sistema de dinero y vidas.
 */
import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';

const COLORS = {
  bg: '#0b0f14',
  panel: '#11161d',
  ink: '#e7edf3',
  inkDim: '#7c8894',
  line: '#1e2731',
  marquee: '#ffb454',
};

// Path waypoints (the bloon road)
const WAYPOINTS = [
  { x: 0, y: 200 },
  { x: 150, y: 200 },
  { x: 150, y: 100 },
  { x: 350, y: 100 },
  { x: 350, y: 300 },
  { x: 550, y: 300 },
  { x: 550, y: 150 },
  { x: 700, y: 150 },
  { x: 700, y: 350 },
  { x: 900, y: 350 },
];

// Tower types
const TOWER_TYPES = {
  dart: {
    name: 'Dardo',
    cost: 50,
    range: 100,
    fireRate: 0.4,
    damage: 1,
    color: '#4a9eff',
    projectileColor: '#6ab0ff',
    projSpeed: 500,
  },
  cannon: {
    name: 'Cañón',
    cost: 100,
    range: 120,
    fireRate: 0.8,
    damage: 3,
    color: '#e74c3c',
    projectileColor: '#ff6b4a',
    projSpeed: 400,
    splash: 30,
  },
  sniper: {
    name: 'Francotirador',
    cost: 200,
    range: 400,
    fireRate: 1.4,
    damage: 5,
    color: '#2ecc71',
    projectileColor: '#5aee9a',
    projSpeed: 1000,
  },
};

const TOWER_KEYS = ['dart', 'cannon', 'sniper'];

// Bloon types (increasing difficulty)
const BLOON_TYPES = {
  red: { speed: 50, hp: 1, color: '#e74c3c', points: 1, radius: 10 },
  blue: { speed: 60, hp: 1, color: '#3498db', points: 2, radius: 10 },
  green: { speed: 70, hp: 2, color: '#2ecc71', points: 3, radius: 11 },
  yellow: { speed: 90, hp: 2, color: '#f1c40f', points: 4, radius: 11 },
  pink: { speed: 110, hp: 3, color: '#e91e63', points: 5, radius: 12 },
  black: { speed: 80, hp: 4, color: '#2c3e50', points: 8, radius: 13 },
  white: { speed: 100, hp: 5, color: '#ecf0f1', points: 10, radius: 13 },
  lead: { speed: 40, hp: 8, color: '#7f8c8d', points: 15, radius: 14 },
};

const BLOON_ORDER = ['red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead'];

export class BloonsTD {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('bloons-td');

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

    this._calculatePath();
  }

  _calculatePath() {
    // Pre-calculate pixel positions along the path
    this.pathPoints = [];
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      const a = WAYPOINTS[i];
      const b = WAYPOINTS[i + 1];
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

    // Generate bloon wave
    const baseCount = 5 + this.wave * 2;
    this.bloonsTotal = baseCount;

    // Determine bloon types for this wave
    this.waveBloonTypes = [];
    const maxBloonIndex = Math.min(Math.floor(this.wave / 2), BLOON_ORDER.length - 1);
    for (let i = 0; i < this.bloonsTotal; i++) {
      // Mix of weaker and stronger bloons
      const index = Math.floor(Math.random() * (maxBloonIndex + 1));
      // Bias towards weaker bloons
      const biasedIndex = Math.floor(index * (0.5 + Math.random() * 0.5));
      this.waveBloonTypes.push(BLOON_ORDER[Math.min(biasedIndex, maxBloonIndex)]);
    }

    this.spawnTimer = 0;
    this.spawnInterval = Math.max(0.25, 0.6 - this.wave * 0.02);
  }

  _spawnBloon(typeKey) {
    const type = BLOON_TYPES[typeKey];
    this.bloons.push({
      x: WAYPOINTS[0].x,
      y: WAYPOINTS[0].y,
      pathIndex: 0,
      hp: type.hp,
      maxHp: type.hp,
      speed: type.speed,
      color: type.color,
      points: type.points,
      radius: type.radius,
      type: typeKey,
      alive: true,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  update(dt) {
    if (this.status === 'won' || this.status === 'lost') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }
      this.input.endFrame();
      return;
    }

    // Update particles
    this._updateParticles(dt);

    // Spawning bloons
    if (this.status === 'wave' && this.bloonsSpawned < this.bloonsTotal) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this._spawnBloon(this.waveBloonTypes[this.bloonsSpawned]);
        this.bloonsSpawned++;
        this.spawnTimer = this.spawnInterval;
      }
    }

    // Update bloons
    this._updateBloons(dt);

    // Update towers auto-attack
    this._updateTowers(dt);

    // Update projectiles
    this._updateProjectiles(dt);

    // Check wave completion
    if (
      this.status === 'wave' &&
      this.bloonsSpawned >= this.bloonsTotal &&
      this.bloons.filter((b) => b.alive).length === 0
    ) {
      this.waveInProgress = false;
      this.lastWaveWon = true;
      this.status = 'pre-wave';

      // Bonus money for completing wave
      this.money += 20 + this.wave * 5;
    }

    // Handle tower placement
    this._handlePlacement();

    // Keyboard shortcuts for tower selection
    if (this.input.wasPressed('Digit1')) this.selectedTowerType = 'dart';
    if (this.input.wasPressed('Digit2')) this.selectedTowerType = 'cannon';
    if (this.input.wasPressed('Digit3')) this.selectedTowerType = 'sniper';
    if (this.input.wasPressed('KeyP')) this.placingTower = !this.placingTower;

    // Start wave with Space
    if (this.status === 'pre-wave' && (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame)) {
      this._startWave();
    }

    this.input.endFrame();
  }

  _updateBloons(dt) {
    for (const bloon of this.bloons) {
      if (!bloon.alive) continue;

      // Move along path
      bloon.pathIndex += bloon.speed * dt / 5;
      bloon.wobble += dt * 2;

      if (bloon.pathIndex >= this.pathTotal - 1) {
        // Reached the end!
        bloon.alive = false;
        this.lives--;
        this._spawnParticles(bloon.x, bloon.y, '#e74c3c', 8, 80);
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

        // Fire projectile
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

    // Update tower firing visual
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

      // Move toward target
      const dx = proj.target.x - proj.x;
      const dy = proj.target.y - proj.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 8) {
        // Hit!
        proj.target.hp -= proj.damage;
        this._spawnParticles(proj.target.x, proj.target.y, proj.target.color, 6, 60);

        // Splash damage
        if (proj.splash > 0) {
          this._spawnParticles(proj.target.x, proj.target.y, '#ffb454', 12, 100);
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
          this._spawnParticles(proj.target.x, proj.target.y, proj.target.color, 12, 120);
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
    // Toggle placement mode on click on empty space
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

    // Check cost
    if (this.money < type.cost) return false;

    // Check not on path
    for (const pp of this.pathPoints) {
      const dx = pp.x - x;
      const dy = pp.y - y;
      if (Math.hypot(dx, dy) < 20) return false;
    }

    // Check not on other tower
    for (const tower of this.towers) {
      const dx = tower.x - x;
      const dy = tower.y - y;
      if (Math.hypot(dx, dy) < 25) return false;
    }

    // Place tower
    this.towers.push({
      x,
      y,
      type: this.selectedTowerType,
      cooldown: 0,
      angle: 0,
      firing: 0,
    });

    this.money -= type.cost;
    return true;
  }

  _spawnParticles(x, y, color, count, speed) {
    this.particles.emit(x, y, color, count, speed, { vyOffset: -30, lifeMin: 0.3, lifeMax: 0.5 });
  }

  _updateParticles(dt) {
    this.particles.update(dt);
  }

  render(ctx) {
    // Background
    ctx.fillStyle = '#0d1a12';
    ctx.fillRect(0, 0, this.width, this.height);

    // Grid pattern
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

    // Road
    ctx.fillStyle = '#2a3a2a';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2a3a2a';
    ctx.beginPath();
    ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
    for (let i = 1; i < WAYPOINTS.length; i++) {
      ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y);
    }
    ctx.stroke();

    // Road border
    ctx.strokeStyle = '#3a4a3a';
    ctx.lineWidth = 28;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
    for (let i = 1; i < WAYPOINTS.length; i++) {
      ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Start/end markers
    ctx.fillStyle = 'rgba(46, 204, 113, 0.3)';
    ctx.beginPath();
    ctx.arc(WAYPOINTS[0].x, WAYPOINTS[0].y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
    ctx.beginPath();
    ctx.arc(WAYPOINTS[WAYPOINTS.length - 1].x, WAYPOINTS[WAYPOINTS.length - 1].y, 14, 0, Math.PI * 2);
    ctx.fill();

    // Tower range preview (hovering)
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

    // Bloons
    for (const bloon of this.bloons) {
      if (!bloon.alive) continue;

      // Shadow
      ctx.beginPath();
      ctx.arc(bloon.x + 2, bloon.y + 2, bloon.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fill();

      // Body
      ctx.beginPath();
      ctx.arc(bloon.x, bloon.y, bloon.radius, 0, Math.PI * 2);
      ctx.fillStyle = bloon.color;
      ctx.fill();

      // Shine
      ctx.beginPath();
      ctx.arc(bloon.x - 3, bloon.y - 3, bloon.radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();

      // HP bar (only if has more than 1 hp)
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

    // Towers
    for (const tower of this.towers) {
      const type = TOWER_TYPES[tower.type];

      // Base
      ctx.fillStyle = type.color;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Tower body
      ctx.fillStyle = '#1e2731';
      ctx.fillRect(tower.x - 7, tower.y - 7, 14, 14);

      ctx.strokeStyle = type.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(tower.x - 7, tower.y - 7, 14, 14);

      // Turret
      ctx.save();
      ctx.translate(tower.x, tower.y);
      ctx.rotate(tower.angle || 0);

      ctx.fillStyle = type.color;
      ctx.fillRect(0, -2, 12, 4);

      // Muzzle
      ctx.fillStyle = '#e7edf3';
      ctx.fillRect(8, -1.5, 4, 3);

      ctx.restore();

      // Range (on hover)
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

      // Firing flash
      if (tower.firing > 0) {
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 180, 84, 0.2)';
        ctx.fill();
      }
    }

    // Projectiles
    for (const proj of this.projectiles) {
      if (!proj.alive) continue;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fillStyle = proj.color;
      ctx.fill();

      // Trail
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius * 2, 0, Math.PI * 2);
      ctx.fillStyle = proj.color + '30';
      ctx.fill();
    }

    this.particles.render(ctx);

    // HUD
    ctx.fillStyle = COLORS.inkDim;
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Vidas: ${'❤'.repeat(Math.max(0, this.lives))}`, 10, 10);
    ctx.fillText(`Dinero: $${this.money}`, 10, 30);
    ctx.fillText(`Oleada: ${this.wave}`, 10, 50);

    if (this.highscore > 0) {
      ctx.fillText(`Récord: ${this.highscore}`, this.width - 120, 10);
    }

    // Tower selection UI
    const towerBarY = this.height - 50;
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(0, towerBarY - 5, this.width, 55);

    ctx.fillStyle = COLORS.inkDim;
    ctx.font = '11px monospace';
    ctx.fillText('TORRES [1-3]:', 10, towerBarY + 2);

    for (let i = 0; i < TOWER_KEYS.length; i++) {
      const key = TOWER_KEYS[i];
      const type = TOWER_TYPES[key];
      const tx = 140 + i * 120;
      const isSelected = this.selectedTowerType === key;
      const canAfford = this.money >= type.cost;

      ctx.fillStyle = isSelected ? COLORS.marquee : (canAfford ? COLORS.ink : COLORS.inkDim);
      ctx.font = isSelected ? 'bold 12px monospace' : '12px monospace';

      const label = `${type.name} $${type.cost}`;
      ctx.fillText(label, tx, towerBarY + 2);

      ctx.fillStyle = type.color;
      ctx.fillRect(tx, towerBarY + 16, 10, 10);

      if (isSelected) {
        ctx.strokeStyle = COLORS.marquee;
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, towerBarY + 16, 10, 10);
      }
    }

    // Wave status / instructions
    if (this.status === 'pre-wave') {
      ctx.fillStyle = COLORS.ink;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      if (this.lastWaveWon) {
        ctx.fillText(`¡Oleada ${this.wave} completada! Click o Espacio para empezar la siguiente`, this.width / 2, 80);
      } else {
        ctx.fillText('Click o Espacio para empezar la oleada', this.width / 2, 80);
      }
      ctx.textAlign = 'left';
    }

    // Wave progress
    if (this.status === 'wave') {
      ctx.fillStyle = COLORS.inkDim;
      ctx.font = '12px monospace';
      ctx.fillText(`Globos: ${this.bloons.filter(b => b.alive).length} en pantalla`, 10, 72);
    }

    // Win/Lose overlay
    if (this.status === 'lost') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = COLORS.ink;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 30);
      ctx.font = '16px monospace';
      ctx.fillText(`Puntuación: ${this.score}`, this.width / 2, this.height / 2 + 10);
      ctx.fillText('Click o Espacio para reiniciar', this.width / 2, this.height / 2 + 40);
      ctx.textAlign = 'left';
    }
  }

  destroy() {
    this.input.detach();
  }
}
