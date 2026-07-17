import { GameBase } from '../../engine/GameBase.js';
import { aabbIntersects } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ── Constantes ──────────────────────────────────────────────────────────

const GRID_SIZE = 30;
const FROG_SIZE = 14;
const PLAYER_SPEED = 30;
const MOVE_COOLDOWN = 0.18;

const HOME_SLOTS = 5;
const HOME_Y = 32;
const HOME_SPACING = 80;
const HOME_START_X = 160;

const TIME_LIMIT = 30;

const COLORS = {
  bg: '#0b0f14',
  water: '#0a1a2e',
  road: '#1a1a1a',
  grass: '#0a1a0a',
  frog: '#45d66c',
  log: '#8B4513',
  turtle: '#2d7a4a',
  car: ['#e74c3c', '#ff6b4a', '#ffb454', '#9b59b6'],
  home: '#f0e6b3',
  homeFilled: '#45d66c',
  hud: '#9aa7b2',

};

const ROAD_LANES = [
  { y: 240, dir: 1, speed: 60, type: 'car', density: 0.02 },
  { y: 270, dir: -1, speed: 80, type: 'car', density: 0.025 },
  { y: 300, dir: 1, speed: 70, type: 'truck', density: 0.015 },
  { y: 330, dir: -1, speed: 90, type: 'car', density: 0.02 },
  { y: 360, dir: 1, speed: 65, type: 'car', density: 0.022 },
];

const RIVER_LANES = [
  { y: 100, dir: 1, speed: 40, density: 0.03 },
  { y: 130, dir: -1, speed: 50, density: 0.025 },
  { y: 160, dir: 1, speed: 45, density: 0.03 },
  { y: 190, dir: -1, speed: 55, density: 0.02 },
];

export class Frogger extends GameBase {
  _defaultBindings() {
    const parent = super._defaultBindings ? super._defaultBindings() : {};
    return {
      ...parent,
      moveUp: ['ArrowUp', 'KeyW', 'GamepadUp', 'GamepadLStickUp'],
      moveDown: ['ArrowDown', 'KeyS', 'GamepadDown', 'GamepadLStickDown'],
      moveLeft: ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
    };
  }

  init(engine) {
    super.init(engine, 'frogger');
    this.highscore = this.storage.get('highscore', 0);

    this.particles = new ParticleSystem(40);
    this.startTime = Date.now();

    this._restart();
  }

  _restart() {
    this.frog = {
      x: this.width / 2,
      y: this.height - 30,
      alive: true,
      onLog: null,
    };

    this.cars = [];
    this.logs = [];
    this.turtles = [];
    this.homeSlots = new Array(HOME_SLOTS).fill(false);
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.timeLeft = TIME_LIMIT;
    this.moveCooldown = 0;
    this.deathTimer = 0;
    this.status = 'playing';
    this.levelTransitionTimer = 0;

    this._initLanes();
  }

  _initLanes() {
    this.cars = [];
    this.logs = [];
    const levelMult = 1 + (this.level - 1) * 0.15;

    // Coches
    for (const lane of ROAD_LANES) {
      for (let i = 0; i < 3; i++) {
        const cx = Math.random() * this.width;
        this.cars.push({
          x: cx, y: lane.y,
          width: lane.type === 'truck' ? 60 : 36,
          height: 22,
          vx: lane.dir * lane.speed * levelMult,
          laneY: lane.y,
          type: lane.type,
          color: COLORS.car[Math.floor(Math.random() * COLORS.car.length)],
        });
      }
    }

    // Troncos y tortugas
    for (const lane of RIVER_LANES) {
      // Troncos grandes
      for (let i = 0; i < 2; i++) {
        const lx = Math.random() * this.width;
        this.logs.push({
          x: lx, y: lane.y,
          width: 80, height: 22,
          vx: lane.dir * lane.speed * levelMult,
          laneY: lane.y,
          type: 'log',
        });
      }
      // Tortugas
      for (let i = 0; i < 1; i++) {
        const tx = Math.random() * this.width;
        this.logs.push({
          x: tx, y: lane.y,
          width: 50, height: 20,
          vx: lane.dir * lane.speed * levelMult,
          laneY: lane.y,
          type: 'turtle',
          submerged: false,
          submergeTimer: Math.random() * 5,
        });
      }
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────

  update(dt) {
    if (this.status === 'level-transition') {
      this.levelTransitionTimer -= dt;
      if (this.levelTransitionTimer <= 0 || this.input.mouse.clickedThisFrame || this.input.wasActionPressed('action')) {
        this._startNextLevel();
      }

      return;
    }

    if (this.status === 'game-over') {
      if (this.input.wasActionPressed('action') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }

      return;
    }

    this.moveCooldown -= dt;
    this._updateFrog(dt);
    this._updateObstacles(dt);
    this._checkCollisions();
    this.particles.update(dt);

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this._frogDeath();
    }

    // Timer de respawn tras muerte
    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        if (this.lives <= 0) {
          this._endGame();
        } else {
          this.frog.x = this.width / 2;
          this.frog.y = this.height - 30;
          this.frog.alive = true;
          this.frog.onLog = null;
          this.timeLeft = TIME_LIMIT;
        }
      }
    }

    this.input.endFrame();
  }

  _startNextLevel() {
    this.level += 1;
    this.homeSlots = new Array(HOME_SLOTS).fill(false);
    this._initLanes();
    this.status = 'playing';
    this.levelTransitionTimer = 0;
  }

  _updateFrog(dt) {
    if (!this.frog.alive) return;

    // Movimiento en cuadrícula con cooldown
    if (this.moveCooldown <= 0) {
      let moved = false;
      if (this.input.wasActionPressed('moveUp')) {
        this.frog.y = Math.max(HOME_Y + 20, this.frog.y - GRID_SIZE);
        this.frog.onLog = null;
        moved = true;
      }
      if (this.input.wasActionPressed('moveDown')) {
        this.frog.y = Math.min(this.height - 20, this.frog.y + GRID_SIZE);
        this.frog.onLog = null;
        moved = true;
      }
      if (this.input.wasActionPressed('moveLeft')) {
        this.frog.x = Math.max(20, this.frog.x - GRID_SIZE);
        moved = true;
      }
      if (this.input.wasActionPressed('moveRight')) {
        this.frog.x = Math.min(this.width - 20, this.frog.x + GRID_SIZE);
        moved = true;
      }
      if (moved) {
        this.moveCooldown = MOVE_COOLDOWN;
        AudioManager.sfx({ type: 'frogger_hop', volume: 0.15 });
      }
    }

    // Si está sobre un tronco/tortuga, se mueve con él
    if (this.frog.onLog) {
      this.frog.x += this.frog.onLog.vx * dt;

      // Si la tortuga se sumerge, la rana se cae al agua
      if (this.frog.onLog.type === 'turtle' && this.frog.onLog.submerged) {
        this._frogDrown();
        return;
      }
    }

    // Limitar a bordes
    this.frog.x = Math.max(15, Math.min(this.width - 15, this.frog.x));
  }

  _updateObstacles(dt) {
    // Coches
    for (const car of this.cars) {
      car.x += car.vx * dt;
      if (car.vx > 0 && car.x > this.width + car.width) car.x = -car.width;
      if (car.vx < 0 && car.x < -car.width) car.x = this.width + car.width;
    }

    // Troncos y tortugas
    for (const log of this.logs) {
      log.x += log.vx * dt;
      if (log.vx > 0 && log.x > this.width + log.width) log.x = -log.width;
      if (log.vx < 0 && log.x < -log.width) log.x = this.width + log.width;

      // Ciclo de sumersión de tortugas
      if (log.type === 'turtle') {
        log.submergeTimer -= dt;
        if (log.submergeTimer <= 0) {
          log.submerged = !log.submerged;
          log.submergeTimer = log.submerged ? 2.0 : 3.0;
        }
      }
    }
  }

  _checkCollisions() {
    if (!this.frog.alive) return;

    const f = this.frog;
    const fRect = { x: f.x - FROG_SIZE, y: f.y - FROG_SIZE, width: FROG_SIZE * 2, height: FROG_SIZE * 2 };

    // Colisión con coches
    for (const car of this.cars) {
      const cRect = { x: car.x, y: car.y - car.height / 2, width: car.width, height: car.height };
      if (aabbIntersects(fRect, cRect)) {
        this._frogDeath();
        return;
      }
    }

    // Cruce de río: comprobar si está sobre un tronco/tortuga
    const inRiver = f.y >= 80 && f.y <= 210;
    if (inRiver) {
      let onPlatform = false;
      for (const log of this.logs) {
        const lRect = { x: log.x, y: log.y - log.height / 2, width: log.width, height: log.height };
        if (aabbIntersects(fRect, lRect)) {
          if (log.type === 'turtle' && log.submerged) continue;
          this.frog.onLog = log;
          onPlatform = true;
          break;
        }
      }
      if (!onPlatform) {
        this._frogDrown();
        return;
      }
    } else {
      this.frog.onLog = null;
    }

    // Llegar a casa (slot de meta)
    if (f.y < HOME_Y + 30) {
      for (let i = 0; i < HOME_SLOTS; i++) {
        const slotX = HOME_START_X + i * HOME_SPACING;
        if (!this.homeSlots[i] && Math.abs(f.x - slotX) < 25) {
          this.homeSlots[i] = true;
          this.score += 10 + Math.floor(this.timeLeft);
          AudioManager.sfx({ type: 'coin', volume: 0.4 });
          this.particles.burst(f.x, f.y, COLORS.frog, 10, 60);

          // Reiniciar rana
          this.frog.x = this.width / 2;
          this.frog.y = this.height - 30;
          this.frog.onLog = null;
          this.timeLeft = TIME_LIMIT;

          // Comprobar si todos los slots están llenos
          if (this.homeSlots.every((s) => s)) {
            AudioManager.sfx({ type: 'powerup', volume: 0.5 });
            this.status = 'level-transition';
            this.levelTransitionTimer = 5; // auto-avance en 5 segundos
          }
          return;
        }
      }
    }
  }

  _frogDeath() {
    if (!this.frog.alive) return;
    this.frog.alive = false;
    this.lives -= 1;
    this.deathTimer = 0.8;
    AudioManager.sfx({ type: 'frogger_squish', volume: 0.4 });
    HapticManager.vibrate('hit');
    this.particles.burst(this.frog.x, this.frog.y, COLORS.frog, 12, 80);
  }

  _frogDrown() {
    if (!this.frog.alive) return;
    this.frog.alive = false;
    this.lives -= 1;
    this.deathTimer = 0.8;
    AudioManager.sfx({ type: 'frogger_squish', volume: 0.4 });
    HapticManager.vibrate('hit');
    this.particles.burst(this.frog.x, this.frog.y, '#2244aa', 8, 60);
  }

  _endGame() {
    this.status = 'game-over';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('frogger', this.score, false, duration);
    if (this.score > 0) ProgressionManager.checkAchievement('frogger', 'first-cross');
    if (this.level >= 5) ProgressionManager.checkAchievement('frogger', 'river-king');
    if (this.score >= 10000) ProgressionManager.checkAchievement('frogger', 'frog-legend');
  }

  // ── Render ─────────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    // Zona de meta (home)
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, this.width, 70);

    // Ríos
    for (const lane of RIVER_LANES) {
      ctx.fillStyle = COLORS.water;
      ctx.fillRect(0, lane.y - 14, this.width, 28);
    }

    // Carreteras
    for (const lane of ROAD_LANES) {
      ctx.fillStyle = COLORS.road;
      ctx.fillRect(0, lane.y - 14, this.width, 28);
      // Línea de carretera
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(0, lane.y);
      ctx.lineTo(this.width, lane.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Zona de inicio (hierba abajo)
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, this.height - 50, this.width, 50);

    this._renderHomeSlots(ctx);
    this._renderLogs(ctx);
    this._renderCars(ctx);
    this._renderFrog(ctx);
    this.particles.render(ctx);      this.renderHUD(ctx, { extraRight: [this.timeLeft < 10 ? `⏱ ${Math.ceil(this.timeLeft)}` : `⏱ ${Math.ceil(this.timeLeft)}`] });

    if (this.status === 'level-transition') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffb454';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('game.levelComplete'), this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#e7edf3';
      ctx.font = '14px monospace';
      ctx.fillText(t('game.continue') + ` (${Math.ceil(this.levelTransitionTimer)}s)`, this.width / 2, this.height / 2 + 15);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    if (this.status === 'game-over') {
      renderOverlay(ctx, { width: this.width, height: this.height, score: this.score });
    }
  }

  _renderHomeSlots(ctx) {
    for (let i = 0; i < HOME_SLOTS; i++) {
      const sx = HOME_START_X + i * HOME_SPACING;
      ctx.strokeStyle = this.homeSlots[i] ? COLORS.homeFilled : COLORS.home;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 15, HOME_Y - 10, 30, 20);
      if (this.homeSlots[i]) {
        ctx.fillStyle = COLORS.homeFilled;
        ctx.beginPath();
        ctx.arc(sx, HOME_Y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _renderLogs(ctx) {
    for (const log of this.logs) {
      if (log.type === 'turtle' && log.submerged) continue;
      const color = log.type === 'turtle' ? COLORS.turtle : COLORS.log;
      ctx.fillStyle = color;
      ctx.fillRect(log.x, log.y - log.height / 2, log.width, log.height);
      // Detalle de tronco
      if (log.type === 'log') {
        ctx.strokeStyle = '#5a2d0c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(log.x + 10, log.y - log.height / 2 + 4, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(log.x + log.width - 10, log.y - log.height / 2 + 4, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  _renderCars(ctx) {
    for (const car of this.cars) {
      ctx.fillStyle = car.color;
      ctx.fillRect(car.x, car.y - car.height / 2, car.width, car.height);
      // Ventanas
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(car.x + 4, car.y - car.height / 2 + 3, 8, car.height - 6);
      ctx.fillRect(car.x + car.width - 12, car.y - car.height / 2 + 3, 8, car.height - 6);
      if (car.type === 'truck') {
        ctx.fillStyle = '#555';
        ctx.fillRect(car.x + 4, car.y - car.height / 2 + 2, car.width - 8, car.height - 4);
      }
    }
  }

  _renderFrog(ctx) {
    if (!this.frog.alive) return;
    const fx = this.frog.x;
    const fy = this.frog.y;

    ctx.fillStyle = COLORS.frog;
    // Cuerpo
    ctx.beginPath();
    ctx.arc(fx, fy, FROG_SIZE, 0, Math.PI * 2);
    ctx.fill();
    // Ojos
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(fx - 4, fy - 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fx + 4, fy - 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(fx - 4, fy - 5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fx + 4, fy - 5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Patas
    ctx.strokeStyle = COLORS.frog;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx - 8, fy + 4);
    ctx.lineTo(fx - 14, fy + 10);
    ctx.moveTo(fx + 8, fy + 4);
    ctx.lineTo(fx + 14, fy + 10);
    ctx.moveTo(fx - 6, fy + 6);
    ctx.lineTo(fx - 12, fy + 2);
    ctx.moveTo(fx + 6, fy + 6);
    ctx.lineTo(fx + 12, fy + 2);
    ctx.stroke();
  }

  renderHUD(ctx) {
    const rightLines = [];
    if (this.timeLeft != null) {
      rightLines.push(`⏱ ${Math.ceil(this.timeLeft)}`);
    }
    super.renderHUD(ctx, { extraRight: rightLines });
  }

}


