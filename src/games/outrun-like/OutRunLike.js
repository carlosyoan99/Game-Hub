/**
 * OutRun-like (Carreras top-down)
 * Nivel 4 — Juego de carreras arcade
 *
 * Mecánica: vista cenital, aceleración/derrape, tráfico adverso,
 * checkpoints, múltiples escenarios, score por velocidad y adelantamientos.
 */
import { GameBase } from '../../engine/GameBase.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { clamp } from '../../engine/CollisionUtils.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ─── Constantes ───────────────────────────────────────────────────────

const LANE_COUNT = 4;
const LANE_WIDTH = 80;
const ROAD_LEFT = 60;
const ROAD_WIDTH = LANE_COUNT * LANE_WIDTH;
const ROAD_RIGHT = ROAD_LEFT + ROAD_WIDTH;

const ACCEL = 300;
const BRAKE = 400;
const FRICTION = 100;
const MAX_SPEED = 600;
const MIN_SPEED = 0;
const STEER_SPEED = 220;
const DRIFT_FACTOR = 0.85;

const CAR_W = 30;
const CAR_H = 50;

const TRAFFIC_MIN_INTERVAL = 0.6;
const TRAFFIC_MAX_INTERVAL = 2.0;
const TRAFFIC_SPEED_BASE = 120;
const TRAFFIC_SPEED_VAR = 60;

const CHECKPOINT_INTERVAL = 800; // px entre checkpoints
const STAGE_LENGTH = 4800; // px total por etapa
const MAX_STAGE_TIME = 90; // segundos por etapa

const STAGE_COUNT = 3;

// ─── Escenarios ───────────────────────────────────────────────────────

const STAGES = [
  { // Stage 1: Costa
    name: 'outrun.stage1.name',
    roadColor: '#3a3a4a', grassColor1: '#4a8a3a', grassColor2: '#5a9a4a',
    lineColor: '#e7edf3', shoulderColor: '#5a5a3a',
    trafficDensity: 1.0, curveIntensity: 0.3,
    timeBonus: MAX_STAGE_TIME,
    bgColors: ['#4a9eff', '#6ab4ff', '#87ceeb'],
  },
  { // Stage 2: Desierto
    name: 'outrun.stage2.name',
    roadColor: '#4a3a2a', grassColor1: '#c4a458', grassColor2: '#b49448',
    lineColor: '#ffd700', shoulderColor: '#6a5a3a',
    trafficDensity: 1.3, curveIntensity: 0.5,
    timeBonus: MAX_STAGE_TIME - 5,
    bgColors: ['#e8c898', '#f4d8a8', '#ffe0b0'],
  },
  { // Stage 3: Noche
    name: 'outrun.stage3.name',
    roadColor: '#2a2a3a', grassColor1: '#1a3a2a', grassColor2: '#1a2a1a',
    lineColor: '#ff6b4a', shoulderColor: '#3a2a3a',
    trafficDensity: 1.6, curveIntensity: 0.7,
    timeBonus: MAX_STAGE_TIME - 10,
    bgColors: ['#0a0a1a', '#1a0a2a', '#0a0a2a'],
  },
];

// ─── Marcas y colores de coches ───────────────────────────────────────

const TRAFFIC_COLORS = ['#e74c3c', '#4a9eff', '#ffb454', '#3a9a5a', '#9a5a9a', '#e7edf3', '#ff6b4a'];

export class OutRunLike extends GameBase {
  init(engine) {
    super.init(engine, 'outrun-like');
    this.highscore = this.storage.get('highscore', 0);
    this.currentStage = this.storage.get('savedStage', 1);
    this.startTime = Date.now();
    this._startStage();
  }

  _defaultBindings() {
    return {
      steerLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      steerRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      accelerate: ['ArrowUp', 'KeyW', 'GamepadR2'],
      brake:      ['ArrowDown', 'KeyS', 'GamepadL2', 'GamepadA'],
      restart:    ['Space', 'GamepadStart', 'GamepadA'],
      next:       ['Space', 'GamepadA', 'GamepadStart'],
    };
  }

  // ── Inicialización ──────────────────────────────────────────────────

  _startStage() {
    this.stageIdx = Math.min(this.currentStage - 1, STAGE_COUNT - 1);
    this.stageConfig = STAGES[this.stageIdx];

    this.player = {
      x: ROAD_LEFT + LANE_WIDTH * 1.5,
      y: 0, // se posiciona al final en render
      width: CAR_W, height: CAR_H,
      laneX: ROAD_LEFT + LANE_WIDTH * 1.5 - CAR_W / 2,
      speed: 0,
      steerInput: 0,
      drifting: false,
      driftDir: 0,
      driftPoints: 0,
      alive: true,
      lives: 3,
      invincible: 0,
    };

    this.traffic = [];
    this.trafficTimer = 0;
    this._scrollY = 0;
    this.stageDistance = 0;
    this.score = 0;
    this.stageScore = 0;
    this.stageTime = this.stageConfig.timeBonus;
    this.phase = 'intro'; // 'intro' | 'playing' | 'checkpoint' | 'stage_clear' | 'won' | 'lost'
    this.introTimer = 2;
    this.checkpointTimer = 0;
    this.nextCheckpoint = CHECKPOINT_INTERVAL;
    this.checkpointsPassed = 0;
    this.totalCheckpoints = Math.floor(STAGE_LENGTH / CHECKPOINT_INTERVAL);
    this.maxSpeedReached = 0;
    this.overtakes = 0;
    this.nearMisses = 0;
    this.roadOffset = 0; // for curve effect
    this.curveAngle = 0;
    this.bgOffset = 0;
    this.comboTimer = 0;
    this.comboCount = 0;
    this.driftAngle = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.driftParticles = [];
    this.roadElements = []; // decorations along road
    this._generateRoadElements();
    this._spawnInitialTraffic();
  }

  _generateRoadElements() {
    this.roadElements = [];
    for (let y = 0; y < STAGE_LENGTH; y += 60) {
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const type = Math.random() < 0.3 ? 'palm' : 'bush';
      const side = Math.random() < 0.5 ? -1 : 1;
      this.roadElements.push({
        y, lane, type, side,
        offset: (Math.random() - 0.5) * 20,
      });
    }
  }

  _spawnInitialTraffic() {
    for (let y = -200; y > -STAGE_LENGTH; y -= 200 + Math.random() * 300) {
      this._spawnTrafficCar(y);
    }
  }

  // ── Spawn de tráfico ────────────────────────────────────────────────

  _spawnTrafficCar(y) {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const carX = ROAD_LEFT + lane * LANE_WIDTH + (LANE_WIDTH - CAR_W) / 2;
    const speed = TRAFFIC_SPEED_BASE + (Math.random() - 0.5) * TRAFFIC_SPEED_VAR;
    this.traffic.push({
      x: carX,
      y,
      width: CAR_W, height: CAR_H,
      lane,
      speed: -speed, // moving toward player (down)
      color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
      alive: true,
      honked: false,
    });
  }

  // ── Update ──────────────────────────────────────────────────────────

  update(dt) {
    if (this.phase === 'intro') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) this.phase = 'playing';
      return;
    }

    if (this.phase === 'checkpoint') {
      this.checkpointTimer -= dt;
      if (this.checkpointTimer <= 0) this.phase = 'playing';
      return;
    }

    if (this.phase === 'stage_clear' || this.phase === 'won' || this.phase === 'lost') {
      if (this.phase === 'stage_clear') {
        if (this.input.wasActionPressed('next') || this.input.mouse.clickedThisFrame) this._nextStage();
      } else {
        this.handleRestartInput();
      }
      return;
    }

    if (this.handleRestartInput()) return;

    // ── Gameplay update ──────────────────────────────────────────────

    // Timer
    this.stageTime -= dt;
    if (this.stageTime <= 0) {
      this._endGame(false);
      return;
    }

    // Invincible
    if (this.player.invincible > 0) this.player.invincible -= dt;

    // Input
    const left = this.input.isActionDown('steerLeft');
    const right = this.input.isActionDown('steerRight');
    const accel = this.input.isActionDown('accelerate');
    const brake = this.input.isActionDown('brake');

    // Acceleration / braking
    if (accel) {
      this.player.speed = Math.min(this.player.speed + ACCEL * dt, MAX_SPEED);
    } else if (brake) {
      this.player.speed = Math.max(this.player.speed - BRAKE * dt, MIN_SPEED);
    } else {
      // Natural friction
      if (this.player.speed > 0) {
        this.player.speed = Math.max(this.player.speed - FRICTION * dt, 0);
      }
    }

    this.maxSpeedReached = Math.max(this.maxSpeedReached, this.player.speed);

    // Steering
    const steerSpeed = STEER_SPEED * (1 + this.player.speed / MAX_SPEED * 0.5);
    if (left && !right) {
      this.player.steerInput = -steerSpeed;
    } else if (right && !left) {
      this.player.steerInput = steerSpeed;
    } else {
      this.player.steerInput = 0;
    }

    // Drift detection
    if (this.player.speed > 200 && Math.abs(this.player.steerInput) > 100) {
      if (!this.player.drifting) {
        this.player.drifting = true;
        this.player.driftDir = this.player.steerInput > 0 ? 1 : -1;
        this.player.driftPoints = 0;
      }
      this.player.driftPoints += dt * (this.player.speed / MAX_SPEED) * 60;
    } else {
      if (this.player.drifting && this.player.driftPoints > 5) {
        const bonus = Math.floor(this.player.driftPoints);
        this.score += bonus;
        this.stageScore += bonus;
        this._spawnDriftParticles(this.player.laneX, bonus);
      }
      this.player.drifting = false;
      this.player.driftDir = 0;
    }

    // Move car horizontally
    this.player.laneX += this.player.steerInput * dt;

    // Apply drift offset
    let effectiveLaneX = this.player.laneX;
    if (this.player.drifting) {
      effectiveLaneX += this.player.driftDir * (1 - DRIFT_FACTOR) * this.player.speed * 0.05;
      // Visual drift angle
      this.driftAngle = this.player.driftDir * 0.15;
    } else {
      this.driftAngle = 0;
    }

    // Clamp to road bounds
    const minX = ROAD_LEFT + 10;
    const maxX = ROAD_RIGHT - CAR_W - 10;
    this.player.laneX = clamp(this.player.laneX, minX, maxX);
    this.player.x = this.player.laneX;

    // Scroll the world
    const scrollSpeed = this.player.speed * dt;
    this._scrollY += scrollSpeed;
    this.stageDistance += scrollSpeed;
    this.bgOffset = (this.bgOffset + scrollSpeed * 0.3) % 200;

    // Curve road offset (sinusoidal)
    this.curveAngle += dt * 0.5 + (this.stageDistance / STAGE_LENGTH) * 2;
    const curve = Math.sin(this.curveAngle) * this.stageConfig.curveIntensity * LANE_WIDTH * 0.3;
    this.roadOffset = curve;

    // Update traffic cars
    for (const car of this.traffic) {
      if (!car.alive) continue;
      car.y += car.speed * dt + scrollSpeed; // relative to player scroll
      // Wrap around when behind player
      if (car.y > this.height + 200) {
        car.alive = false;
      }
    }

    // Remove off-screen traffic and spawn new
    this.traffic = this.traffic.filter(c => c.alive);

    this.trafficTimer -= dt;
    if (this.trafficTimer <= 0) {
      const spawnY = -CAR_H - 50 - Math.random() * 100;
      this._spawnTrafficCar(spawnY);
      const interval = this.stageConfig.trafficDensity > 1.5
        ? TRAFFIC_MIN_INTERVAL + Math.random() * 0.3
        : TRAFFIC_MIN_INTERVAL + Math.random() * TRAFFIC_MAX_INTERVAL;
      this.trafficTimer = interval / this.stageConfig.trafficDensity;
    }

    // Collision detection
    this._checkCollisions();

    // Checkpoints
    if (this.stageDistance >= this.nextCheckpoint) {
      this.checkpointsPassed++;
      this.nextCheckpoint += CHECKPOINT_INTERVAL;
      this.score += 100 * this.checkpointsPassed; // bonus creciente
      this.stageScore += 100 * this.checkpointsPassed;
      if (this.checkpointsPassed >= this.totalCheckpoints) {
        this._clearStage();
      } else {
        this.phase = 'checkpoint';
        this.checkpointTimer = 0.5;
        AudioManager.sfx({ type: 'powerup', volume: 0.4 });
        HapticManager.vibrate('powerup');
      }
    }

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Score per distance
    const distScore = Math.floor(scrollSpeed * 0.05);
    if (distScore > 0) {
      this.score += distScore;
      this.stageScore += distScore;
    }

    this.input.endFrame();
  }

  // ── Colisiones ──────────────────────────────────────────────────────

  _checkCollisions() {
    if (this.player.invincible > 0 || !this.player.alive) return;

    const pBox = { x: this.player.laneX, y: this.height - CAR_H - 20, width: CAR_W, height: CAR_H };

    for (const car of this.traffic) {
      if (!car.alive) continue;

      // Only check cars that are visible on screen
      if (car.y + car.height < 0 || car.y > this.height) continue;

      const cBox = { x: car.x, y: car.y, width: car.width, height: car.height };

      // Check intersection
      if (pBox.x < cBox.x + cBox.width &&
          pBox.x + pBox.width > cBox.x &&
          pBox.y < cBox.y + cBox.height &&
          pBox.y + pBox.height > cBox.y) {

        // Crash!
        this._crash();
        return;
      }

      // Near miss detection (very close but not colliding)
      const margin = 15;
      const nearBox = {
        x: cBox.x - margin, y: cBox.y - margin,
        width: cBox.width + margin * 2, height: cBox.height + margin * 2,
      };
      if (pBox.x < nearBox.x + nearBox.width &&
          pBox.x + pBox.width > nearBox.x &&
          pBox.y < nearBox.y + nearBox.height &&
          pBox.y + pBox.height > nearBox.y &&
          !car.honked) {
        car.honked = true;
        this.nearMisses++;
        ProgressionManager.checkAchievement('outrun-like', 'near-miss-pro');
        this.comboCount++;
        this.comboTimer = 2;
        const comboBonus = this.comboCount * 50;
        this.score += comboBonus;
        this.stageScore += comboBonus;
        AudioManager.sfx({ type: 'select', volume: 0.15 });
        HapticManager.vibrate('hit');

        // Overtake tracking: check if we just passed this car
        const playerCarY = this.height - CAR_H - 20;
        if (car.y + car.height < playerCarY && !car.passed) {
          car.passed = true;
          this.overtakes++;
        }
      }
    }
  }

  _crash() {
    this.player.lives--;
    this.player.invincible = 2;
    this.player.speed = Math.max(0, this.player.speed * 0.3);
    this.comboCount = 0;
    AudioManager.sfx({ type: 'explosion', volume: 0.4 });
    HapticManager.vibrate('explosion');

    // Screen shake
    this.shakeTimer = 0.3;
    this.shakeIntensity = 8;

    if (this.player.lives <= 0) {
      this._endGame(false);
    }
  }

  // ── Progresión ──────────────────────────────────────────────────────

  _clearStage() {
    this.phase = 'stage_clear';
    this.score += Math.floor(this.stageTime * 10); // time bonus
    this.score += Math.floor(this.maxSpeedReached * 0.5); // speed bonus
    this.cumulativeNearMisses = (this.cumulativeNearMisses || 0) + this.nearMisses;
    this.score += this.overtakes * 200;
    AudioManager.sfx({ type: 'powerup', volume: 0.6 });
    HapticManager.vibrate('powerup');

    // Progression
    ProgressionManager.checkAchievement('outrun-like', 'first-race');
    if (this.currentStage >= STAGE_COUNT) {
      this._endGame(true);
    }
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
    ProgressionManager.recordGamePlay('outrun-like', this.score, won, duration);

    ProgressionManager.checkAchievement('outrun-like', won ? 'road-warrior' : 'first-race');
    if (this.stageIdx >= 2) ProgressionManager.checkAchievement('outrun-like', 'arcade-king');

    if (this.maxSpeedReached >= MAX_SPEED * 0.95) ProgressionManager.checkAchievement('outrun-like', 'speed-demon');
  }

  _spawnDriftParticles(x, points) {
    if (!this.driftParticles) this.driftParticles = [];
    for (let i = 0; i < 6; i++) {
      this.driftParticles.push({
        x: x + CAR_W / 2 + (Math.random() - 0.5) * 20,
        y: this.height - CAR_H / 2 + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 100,
        vy: Math.random() * 80 + 20,
        life: 0.4 + Math.random() * 0.3,
        color: '#ffd700',
      });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, this.width, this.height);

    // ── Background ──────────────────────────────────────────────────
    const bgColors = this.stageConfig.bgColors;
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, bgColors[0]);
    grad.addColorStop(0.5, bgColors[1]);
    grad.addColorStop(1, bgColors[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ROAD_LEFT, this.height);
    ctx.fillRect(ROAD_RIGHT, 0, this.width - ROAD_RIGHT, this.height);

    // ── Grass texture ───────────────────────────────────────────────
    ctx.fillStyle = this.stageConfig.grassColor1;
    const gs = 40;
    for (let y = -((this.bgOffset * 0.5) % (gs * 2)); y < this.height; y += gs * 2) {
      for (let x = 0; x < ROAD_LEFT; x += gs * 2) {
        ctx.fillRect(x, y, gs, gs);
      }
      for (let x = ROAD_RIGHT; x < this.width; x += gs * 2) {
        ctx.fillRect(x, y, gs, gs);
      }
    }
    ctx.fillStyle = this.stageConfig.grassColor2;
    for (let y = -((this.bgOffset * 0.5 + gs) % (gs * 2)); y < this.height; y += gs * 2) {
      for (let x = gs; x < ROAD_LEFT; x += gs * 2) {
        ctx.fillRect(x, y, gs, gs);
      }
      for (let x = ROAD_RIGHT + gs; x < this.width; x += gs * 2) {
        ctx.fillRect(x, y, gs, gs);
      }
    }

    // ── Road ────────────────────────────────────────────────────────
    const roadX = ROAD_LEFT + (this.roadOffset || 0);

    // Road surface
    ctx.fillStyle = this.stageConfig.roadColor;
    ctx.fillRect(roadX, 0, ROAD_WIDTH, this.height);

    // Shoulder
    ctx.fillStyle = this.stageConfig.shoulderColor;
    ctx.fillRect(roadX - 8, 0, 8, this.height);
    ctx.fillRect(roadX + ROAD_WIDTH, 0, 8, this.height);

    // Lane lines (dashed)
    ctx.strokeStyle = this.stageConfig.lineColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 15]);
    for (let i = 1; i < LANE_COUNT; i++) {
      const lx = roadX + i * LANE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, this.height);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Center line
    ctx.strokeStyle = this.stageConfig.lineColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([30, 20]);
    ctx.beginPath();
    ctx.moveTo(roadX + ROAD_WIDTH / 2, 0);
    ctx.lineTo(roadX + ROAD_WIDTH / 2, this.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Road decorations (trees, bushes) ────────────────────────────
    const scrollOffset = this._scrollY || 0;
    for (const el of this.roadElements) {
      const ey = el.y - scrollOffset;
      if (ey < -60 || ey > this.height + 60) continue;

      const ex = el.side === -1
        ? roadX - 25 + el.offset
        : roadX + ROAD_WIDTH + 5 + el.offset;

      if (el.type === 'palm') {
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(ex - 2, ey, 4, 20);
        ctx.fillStyle = '#3a8a2a';
        ctx.beginPath();
        ctx.arc(ex, ey, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a9a3a';
        ctx.beginPath();
        ctx.arc(ex - 5, ey - 3, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + 6, ey + 2, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#3a7a2a';
        ctx.beginPath();
        ctx.arc(ex, ey, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a8a3a';
        ctx.beginPath();
        ctx.arc(ex - 3, ey - 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Traffic cars ────────────────────────────────────────────────
    for (const car of this.traffic) {
      if (!car.alive) continue;
      if (car.y + car.height < 0 || car.y > this.height + 50) continue;

      // Car body
      ctx.fillStyle = car.color;
      const cx = car.x + roadX - ROAD_LEFT;
      ctx.fillRect(cx, car.y, car.width, car.height);

      // Car details (windows, lights)
      ctx.fillStyle = '#2a3a4a';
      ctx.fillRect(cx + 4, car.y + 8, car.width - 8, 6); // rear window
      ctx.fillRect(cx + 4, car.y + car.height - 18, car.width - 8, 6); // front window
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(cx + 2, car.y + car.height - 3, 8, 3); // left headlight
      ctx.fillRect(cx + car.width - 10, car.y + car.height - 3, 8, 3); // right headlight

      // Tail lights
      ctx.fillStyle = '#ff4d4d';
      ctx.fillRect(cx + 2, car.y + 2, 6, 3);
      ctx.fillRect(cx + car.width - 8, car.y + 2, 6, 3);
    }

    // ── Player car ──────────────────────────────────────────────────
    const px = this.player.laneX + roadX - ROAD_LEFT;
    const py = this.height - CAR_H - 20;

    // Invincible flash
    const shouldDraw = !(this.player.invincible > 0 && Math.floor(this.player.invincible * 10) % 2 === 0);
    if (shouldDraw && this.player.alive) {
      ctx.save();
      ctx.translate(px + CAR_W / 2, py + CAR_H / 2);
      ctx.rotate(this.driftAngle || 0);
      ctx.translate(-CAR_W / 2, -CAR_H / 2);

      // Car body
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(0, 0, CAR_W, CAR_H);

      // Windshield
      ctx.fillStyle = '#4a9eff';
      ctx.fillRect(4, 8, CAR_W - 8, 8);
      ctx.fillRect(4, CAR_H - 18, CAR_W - 8, 8);

      // Spoiler
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(CAR_W / 2 - 10, -4, 20, 6);

      // Racing stripe
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(CAR_W / 2 - 2, 4, 4, CAR_H - 8);

      // Headlights
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(2, 4, 6, 4);
      ctx.fillRect(CAR_W - 8, 4, 6, 4);

      // Tail lights
      ctx.fillStyle = '#ff4d4d';
      ctx.fillRect(2, CAR_H - 6, 6, 4);
      ctx.fillRect(CAR_W - 8, CAR_H - 6, 6, 4);

      // Wheels
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(-3, 6, 6, 10);
      ctx.fillRect(-3, CAR_H - 18, 6, 10);
      ctx.fillRect(CAR_W - 3, 6, 6, 10);
      ctx.fillRect(CAR_W - 3, CAR_H - 18, 6, 10);

      ctx.restore();
    }

    // ── Drift particles ─────────────────────────────────────────────
    if (this.driftParticles) {
      for (const p of this.driftParticles) {
        p.x += p.vx * (1/60);
        p.y += p.vy * (1/60);
        p.vy += 200 * (1/60);
        p.life -= 1/60;
        if (p.life > 0) {
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          const dx = roadX - ROAD_LEFT;
          ctx.fillRect(p.x + dx - 3, p.y - 3, 6, 6);
        }
      }
      this.driftParticles = this.driftParticles.filter(p => p.life > 0);
      ctx.globalAlpha = 1;
    }

    // ── Speed lines (high speed) ────────────────────────────────────
    if (this.player.speed > 350) {
      const intensity = (this.player.speed - 350) / (MAX_SPEED - 350);
      ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.15})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const sx = roadX + Math.random() * ROAD_WIDTH * 0.8;
        const sy = Math.random() * this.height;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - 50 - intensity * 100);
        ctx.stroke();
      }
    }

    // ── Shake ───────────────────────────────────────────────────────
    if (this.shakeTimer && this.shakeTimer > 0) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(shakeX, shakeY);
      this.shakeTimer -= 1/60;
    }

    // ── HUD ─────────────────────────────────────────────────────────
    setupHUDContext(ctx);

    // Score
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(t('outrun.score', { n: this.score }), 10, 20);

    // Speed
    ctx.fillStyle = this.player.speed > 400 ? '#ff6b4a' : '#4a9eff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(t('outrun.speed', { n: Math.floor(this.player.speed) }), 10, 46);

    // Stage
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '12px monospace';
    ctx.fillText(t('outrun.stage', { n: this.currentStage }), this.width / 2 - 30, 12);

    // Timer
    ctx.fillStyle = this.stageTime < 20 ? '#ff4d4d' : '#e7edf3';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(t('outrun.time', { n: Math.ceil(this.stageTime) }), this.width / 2 - 40, 30);

    // Lives
    ctx.fillStyle = '#e7edf3';
    ctx.font = '14px monospace';
    ctx.fillText(t('outrun.lives', { n: this.player.lives }), this.width - 80, 20);

    // Progress bar
    const progW = this.width * 0.6;
    const progX = (this.width - progW) / 2;
    const progY = this.height - 14;
    const progress = Math.min(1, this.stageDistance / STAGE_LENGTH);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(progX, progY, progW, 8);
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(progX + 1, progY + 1, (progW - 2) * progress, 6);

    // Checkpoint markers on progress bar
    for (let i = 1; i < this.totalCheckpoints; i++) {
      const cx = progX + (i / this.totalCheckpoints) * progW;
      ctx.fillStyle = i <= this.checkpointsPassed ? '#ffd700' : '#5a5a6a';
      ctx.fillRect(cx - 2, progY - 1, 4, 10);
    }

    // Drift indicator
    if (this.player.drifting) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t('outrun.drift') + ' +' + Math.floor(this.player.driftPoints), this.width / 2, this.height - 50);
      ctx.textAlign = 'left';
    }

    // Combo display
    if (this.comboCount > 0 && this.comboTimer > 0) {
      ctx.fillStyle = '#ff6b4a';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.comboCount}x COMBO!`, this.width / 2, 70);
      ctx.textAlign = 'left';
    }

    // Near miss count
    if (this.nearMisses > 0) {
      ctx.fillStyle = '#4a9eff';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Near misses: ${this.nearMisses}`, this.width - 10, 38);
      ctx.textAlign = 'left';
    }

    // ── Overlays ────────────────────────────────────────────────────

    // Intro
    if (this.phase === 'intro') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const stageName = this.stageIdx < STAGES.length ? t(STAGES[this.stageIdx].name) : '';
      ctx.fillText(`${t('outrun.stage', { n: this.currentStage })}: ${stageName}`, this.width / 2, this.height / 2 - 30);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 32px monospace';
      ctx.fillText(t('outrun.go'), this.width / 2, this.height / 2 + 30);
      ctx.textAlign = 'left';
    }

    // Checkpoint
    if (this.phase === 'checkpoint') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('outrun.checkpoint') + ` ${this.checkpointsPassed}/${this.totalCheckpoints}`, this.width / 2, this.height / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillText(`+${100 * this.checkpointsPassed}`, this.width / 2, this.height / 2 + 15);
      ctx.textAlign = 'left';
    }

    // Stage clear
    if (this.phase === 'stage_clear') {
      renderOverlay(ctx, {
        width: this.width, height: this.height,
        title: t('outrun.stageClear'),
        subtitle: `${t('outrun.score', { n: this.stageScore })} | ${t('outrun.speed', { n: Math.floor(this.maxSpeedReached) })}`,
        actionText: t('game.continue'),
      });
    }

    // Game over
    if (this.phase === 'won' || this.phase === 'lost') {
      renderOverlay(ctx, {
        width: this.width, height: this.height,
        title: this.phase === 'won' ? t('game.victory') : t('outrun.gameOver'),
        score: this.score,
        actionText: t('game.restart'),
      });
    }

    // Record
    if (this.highscore > 0) {
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.fillText(t('game.record', { n: this.highscore }), this.width / 2 - 30, this.height - 3);
    }
  }

}
