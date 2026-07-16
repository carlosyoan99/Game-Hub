import { GameBase } from '../../engine/GameBase.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { circleIntersectsAABB, clamp, pointInRect } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const PADDLE_MARGIN = 24;
const BALL_RADIUS = 7;
const WIN_SCORE = 5;

// Power-ups
const POWERUP_TYPES = ['widePaddle', 'slowBall', 'multiballPong'];
const POWERUP_COLORS = { widePaddle: '#5dade2', slowBall: '#58d68d', multiballPong: '#f5b041' };

const AI_STYLES = ['balanced', 'aggressive', 'defensive'];

/** Configuración por dificultad. */
const DIFFICULTIES = [
  { id: 'easy', aiSpeed: 260, ballSpeed: 320, aiPredict: false, deadZone: 8 },
  { id: 'normal', aiSpeed: 340, ballSpeed: 360, aiPredict: true, deadZone: 5 },
  { id: 'hard', aiSpeed: 430, ballSpeed: 410, aiPredict: true, deadZone: 2 },
];

/**
 * Pong expandido con power-ups, 3 estilos de IA, efectos visuales.
 */
export class Pong extends GameBase {
  init(engine) {
    super.init(engine, 'pong');
    this.highscore = this.storage.get('highscore', 0);

    this.phase = 'select-difficulty';
    this.selectedDifficulty = -1;
    this.selectedAiStyle = 0;
    this.currentStreak = 0;
    this.startTime = Date.now();
    this.bossBalls = [];
    this.bossPlayerScore = 0;
    this.bossAiScore = 0;
    this.bossOrigAiH = PADDLE_HEIGHT;
    this.powerups = [];
    this.hitParticles = [];
    this.scorePopups = [];
  }

  _defaultBindings() {
    return {
      up:    ['ArrowUp', 'KeyW', 'GamepadUp', 'GamepadLStickUp'],
      down:  ['ArrowDown', 'KeyS', 'GamepadDown', 'GamepadLStickDown'],
      left:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      right: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      restart: ['Space', 'GamepadStart', 'GamepadA'],
    };
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    if (this.player) {
      this.player.y = clamp(this.player.y, 0, this.height - this.player.height);
    }
    if (this.ai) {
      this.ai.y = clamp(this.ai.y, 0, this.height - this.ai.height);
    }
  }

  _getDifficulty() {
    if (this.selectedDifficulty < 0) return DIFFICULTIES[0];
    return DIFFICULTIES[this.selectedDifficulty];
  }

  _getAiStyle() {
    return AI_STYLES[this.selectedAiStyle % AI_STYLES.length];
  }

  _startGame(difficultyIndex) {
    this.selectedDifficulty = difficultyIndex;
    this.phase = 'playing';
    this.rng = new SeededRandom();
    this.player = {
      x: PADDLE_MARGIN,
      y: this.height / 2 - PADDLE_HEIGHT / 2,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
    };
    this.ai = {
      x: this.width - PADDLE_MARGIN - PADDLE_WIDTH,
      y: this.height / 2 - PADDLE_HEIGHT / 2,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
    };
    this.playerScore = 0;
    this.aiScore = 0;
    this.status = 'playing';
    this.bossBalls = [];
    this.bossPlayerScore = 0;
    this.bossAiScore = 0;
    this.powerups = [];
    this.hitParticles = [];
    this.scorePopups = [];
    this.powerupTimer = 3; // primer power-up a los 3s
    this._serve(1);
  }

  _serve(direction) {
    const angle = (this.rng.next() - 0.5) * (Math.PI / 6);
    const diff = this._getDifficulty();
    this.ball = {
      x: this.width / 2,
      y: this.height / 2,
      radius: BALL_RADIUS,
      vx: Math.cos(angle) * diff.ballSpeed * direction,
      vy: Math.sin(angle) * diff.ballSpeed,
    };
  }

  _spawnPowerup() {
    const type = POWERUP_TYPES[this.rng.nextInt(0, POWERUP_TYPES.length)];
    const x = this.width * 0.3 + this.rng.next() * this.width * 0.4;
    const y = this.height * 0.15 + this.rng.next() * this.height * 0.7;
    this.powerups.push({
      x, y,
      width: 18, height: 14,
      type,
      vy: 40 + this.rng.next() * 30,
      alive: true,
    });
  }

  _collectPowerup(p) {
    AudioManager.sfx({ type: 'powerup', volume: 0.4 });
    HapticManager.vibrate('powerup');
    switch (p.type) {
      case 'widePaddle':
        this.player.width = Math.min(this.player.width * 1.4, this.width * 0.15);
        this._widePaddleTimer = 7;
        break;
      case 'slowBall':
        this.ball.vx *= 0.6;
        this.ball.vy *= 0.6;
        break;
      case 'multiballPong':
        for (let i = 0; i < 2; i++) {
          const angle = (this.rng.next() - 0.5) * (Math.PI / 4);
          const dir = this.rng.next() > 0.5 ? 1 : -1;
          this.bossBalls.push({
            x: this.width / 2,
            y: this.ball.y + (i - 0.5) * 30,
            radius: BALL_RADIUS,
            vx: Math.cos(angle) * 350 * dir,
            vy: Math.sin(angle) * 350,
          });
        }
        break;
    }
  }

  _spawnHitParticles(x, y) {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      this.hitParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        color: Math.random() > 0.5 ? '#e7edf3' : '#5dade2',
      });
    }
  }

  _spawnScorePopup(x, y, text, color) {
    this.scorePopups.push({ x, y, text, color, life: 1.2, vy: -50 });
  }

  update(dt) {
    if (this.phase === 'select-difficulty') {
      // Keyboard/gamepad selection for difficulty
      const left = this.input.wasActionPressed('left');
      const right = this.input.wasActionPressed('right');
      if (left || right) {
        this.selectedDifficulty = Math.max(0, Math.min(DIFFICULTIES.length - 1,
          this.selectedDifficulty + (right ? 1 : -1)));
      }
      // Switch AI style with up/down
      const up = this.input.wasActionPressed('up');
      const down = this.input.wasActionPressed('down');
      if (up || down) {
        this.selectedAiStyle = (this.selectedAiStyle + (up ? -1 : 1) + AI_STYLES.length) % AI_STYLES.length;
        AudioManager.sfx({ type: 'select', volume: 0.2 });
      }

      if (this.input.mouse.clickedThisFrame) {
        const buttons = this._getDifficultyButtons();
        for (let i = 0; i < buttons.length; i++) {
          if (pointInRect(this.input.mouse.x, this.input.mouse.y, buttons[i])) {
            AudioManager.sfx({ type: 'select', volume: 0.25 });
            this._startGame(i);
            break;
          }
        }
      }
      if (this.input.wasPressed('Enter') || this.input.wasActionPressed('restart')) {
        if (this.selectedDifficulty >= 0) {
          this._startGame(this.selectedDifficulty);
        } else {
          this._startGame(1); // default normal
        }
      }
      return;
    }

    if (this.handleRestartInput()) return;

    if (this.phase === 'boss-fight') {
      this._updateBossFight(dt);
      this.input.endFrame();
      return;
    }

    this._movePlayer(dt);
    this._moveAI(dt);
    this._moveBall(dt);
    this._checkScoring();

    // Power-up spawning
    this.powerupTimer -= dt;
    if (this.powerupTimer <= 0 && this.powerups.length < 2) {
      this.powerupTimer = 4 + this.rng.next() * 4;
      this._spawnPowerup();
    }

    // Power-up movement
    for (const p of this.powerups) {
      p.y += p.vy * dt;
      if (p.y < 10) { p.y = 10; p.vy = Math.abs(p.vy); }
      if (p.y + p.height > this.height - 10) { p.y = this.height - 10 - p.height; p.vy = -Math.abs(p.vy); }
      // Check collection by player
      if (p.x < this.player.x + this.player.width + 5 &&
          p.x + p.width > this.player.x &&
          p.y < this.player.y + this.player.height &&
          p.y + p.height > this.player.y) {
        p.alive = false;
        this._collectPowerup(p);
      }
    }
    this.powerups = this.powerups.filter(p => p.alive);

    // Wide paddle timer
    if (this._widePaddleTimer > 0) {
      this._widePaddleTimer -= dt;
      if (this._widePaddleTimer <= 0) {
        this.player.width = PADDLE_WIDTH;
      }
    }

    // Update particles
    for (const pt of this.hitParticles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    this.hitParticles = this.hitParticles.filter(pt => pt.life > 0);

    // Update score popups
    for (const pop of this.scorePopups) {
      pop.y += pop.vy * dt;
      pop.life -= dt;
    }
    this.scorePopups = this.scorePopups.filter(pop => pop.life > 0);

    this.input.endFrame();
  }

  _movePlayer(dt) {
    const speed = 380;
    if (this.input.isActionDown('up')) {
      this.player.y -= speed * dt;
    }
    if (this.input.isActionDown('down')) {
      this.player.y += speed * dt;
    }
    if (this.input.mouse.y >= 0) {
      this.player.y = this.input.mouse.y - this.player.height / 2;
    }
    this.player.y = clamp(this.player.y, 0, this.height - this.player.height);
  }

  _moveAI(dt) {
    const diff = this._getDifficulty();
    const style = this._getAiStyle();
    const paddleCenter = this.ai.y + this.ai.height / 2;

    // Calcular target según estilo
    let targetY = this.ball.y;
    if (diff.aiPredict && this.ball.vx > 0) {
      targetY = this._predictAim();
    }

    // Ajuste según estilo
    if (style === 'aggressive') {
      const speedMult = 1.2;
      const offset = (this.height / 2 - targetY) * 0.15; // tiende al centro
      targetY += offset;
      const dY = targetY - paddleCenter;
      const dead = Math.max(1, diff.deadZone * 0.5);
      if (Math.abs(dY) > dead) {
        this.ai.y += Math.sign(dY) * Math.min(diff.aiSpeed * speedMult * dt, Math.abs(dY));
      }
    } else if (style === 'defensive') {
      // Se queda más cerca de su lado, reacciona menos a bolas lejanas
      const distFactor = Math.max(0.4, 1 - Math.abs(this.ball.y - paddleCenter) / this.height);
      const dY = targetY - paddleCenter;
      const dead = Math.max(3, diff.deadZone * 1.3);
      if (Math.abs(dY) > dead) {
        this.ai.y += Math.sign(dY) * Math.min(diff.aiSpeed * distFactor * dt, Math.abs(dY));
      }
    } else {
      // Balanced (default)
      const dY = targetY - paddleCenter;
      if (Math.abs(dY) > diff.deadZone) {
        this.ai.y += Math.sign(dY) * Math.min(diff.aiSpeed * dt, Math.abs(dY));
      }
    }

    this.ai.y = clamp(this.ai.y, 0, this.height - this.ai.height);
  }

  _predictAim() {
    let y = this.ball.y;
    let vy = this.ball.vy;
    const steps = Math.floor(Math.abs(this.width - this.ball.x) / Math.abs(this.ball.vx));
    for (let i = 0; i < Math.min(steps, 60); i++) {
      y += vy * 0.016;
      if (y < BALL_RADIUS || y > this.height - BALL_RADIUS) vy *= -1;
    }
    return y;
  }

  _moveBall(dt) {
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.y - this.ball.radius < 0) {
      this.ball.y = this.ball.radius;
      this.ball.vy *= -1;
    } else if (this.ball.y + this.ball.radius > this.height) {
      this.ball.y = this.height - this.ball.radius;
      this.ball.vy *= -1;
    }

    if (this.ball.vx < 0 && circleIntersectsAABB(this.ball, this.player)) {
      this._bounce(this.player, 1);
      this._spawnHitParticles(this.ball.x, this.ball.y);
    } else if (this.ball.vx > 0 && circleIntersectsAABB(this.ball, this.ai)) {
      this._bounce(this.ai, -1);
      this._spawnHitParticles(this.ball.x, this.ball.y);
    }
  }

  _bounce(paddle, direction) {
    const hitPos = (this.ball.y - paddle.y) / paddle.height;
    const angle = (hitPos - 0.5) * (Math.PI / 3);
    const diff = this._getDifficulty();
    const speed = diff.ballSpeed * 1.02;
    this.ball.vx = Math.cos(angle) * speed * direction;
    this.ball.vy = Math.sin(angle) * speed;
    this.ball.x = direction === 1 ? paddle.x + paddle.width + this.ball.radius : paddle.x - this.ball.radius;
    AudioManager.sfx({ type: 'pong_hit', volume: 0.25 });
    HapticManager.vibrate('select');
  }

  _checkScoring() {
    if (this.ball.x + this.ball.radius < 0) {
      this.aiScore += 1;
      this._spawnScorePopup(this.width * 0.3, this.height * 0.25, 'AI +1', '#e74c3c');
      AudioManager.sfx({ type: 'pong_hit', volume: 0.5 });
      HapticManager.vibrate('hit');
      this._afterPoint();
    } else if (this.ball.x - this.ball.radius > this.width) {
      this.playerScore += 1;
      this._spawnScorePopup(this.width * 0.7, this.height * 0.25, '+1', '#45d66c');
      AudioManager.sfx({ type: 'pong_score', volume: 0.35 });
      HapticManager.vibrate('coin');
      this._afterPoint();
    }
  }

  // ── Boss Fight ──

  _startBossFight() {
    this.phase = 'boss-fight';
    this.bossPlayerScore = 0;
    this.bossAiScore = 0;
    this.bossBalls = [];
    this.bossOrigAiH = this.ai.height;
    this.ai.height = Math.round(this.ai.height * 1.6);
    this.ai.y = Math.max(0, this.ai.y - (this.ai.height - this.bossOrigAiH) / 2);
    this._serve(1);
    this._addBossBall();
    AudioManager.sfx({ type: 'powerup', volume: 0.4 });
    HapticManager.vibrate('powerup');
  }

  _addBossBall() {
    const diff = this._getDifficulty();
    const angle = (this.rng.next() - 0.5) * (Math.PI / 4);
    const dir = this.rng.next() > 0.5 ? 1 : -1;
    this.bossBalls.push({
      x: this.width / 2,
      y: this.rng.next() * this.height * 0.6 + this.height * 0.2,
      radius: BALL_RADIUS,
      vx: Math.cos(angle) * diff.ballSpeed * 1.1 * dir,
      vy: Math.sin(angle) * diff.ballSpeed * 1.1,
    });
  }

  _updateBossFight(dt) {
    this._movePlayer(dt);
    this._moveBossAI(dt);
    this._moveBall(dt);

    for (const b of this.bossBalls) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.y - b.radius < 0) { b.y = b.radius; b.vy *= -1; }
      else if (b.y + b.radius > this.height) { b.y = this.height - b.radius; b.vy *= -1; }

      if (b.vx < 0 && circleIntersectsAABB(b, this.player)) {
        this._bossBounce(b, this.player, 1);
      } else if (b.vx > 0 && circleIntersectsAABB(b, this.ai)) {
        this._bossBounce(b, this.ai, -1);
      }

      if (b.x + b.radius < 0) {
        this.bossAiScore++;
        b.x = this.width + 100;
        AudioManager.sfx({ type: 'pong_hit', volume: 0.5 });
      } else if (b.x - b.radius > this.width) {
        this.bossPlayerScore++;
        b.x = -100;
        AudioManager.sfx({ type: 'pong_score', volume: 0.35 });
        HapticManager.vibrate('coin');
      }
    }
    this.bossBalls = this.bossBalls.filter(b => b.x > -200 && b.x < this.width + 200);

    if (this.bossBalls.length < 1) {
      this._addBossBall();
    }

    this._checkBossScoring();
  }

  _moveBossAI(dt) {
    const diff = this._getDifficulty();
    const paddleCenter = this.ai.y + this.ai.height / 2;
    let targetY = this.ball.y;
    let minDist = Infinity;
    for (const b of [this.ball, ...this.bossBalls]) {
      if (b.vx > 0) {
        const dist = Math.abs(b.x - this.ai.x);
        if (dist < minDist) { minDist = dist; targetY = b.y; }
      }
    }
    const diffY = targetY - paddleCenter;
    if (Math.abs(diffY) > 3) {
      this.ai.y += Math.sign(diffY) * Math.min(diff.aiSpeed * 1.15 * dt, Math.abs(diffY));
    }
    this.ai.y = clamp(this.ai.y, 0, this.height - this.ai.height);
  }

  _bossBounce(b, paddle, direction) {
    const hitPos = (b.y - paddle.y) / paddle.height;
    const angle = (hitPos - 0.5) * (Math.PI / 3);
    const diff = this._getDifficulty();
    const speed = diff.ballSpeed * 1.05;
    b.vx = Math.cos(angle) * speed * direction;
    b.vy = Math.sin(angle) * speed;
    b.x = direction === 1 ? paddle.x + paddle.width + b.radius : paddle.x - b.radius;
    AudioManager.sfx({ type: 'pong_hit', volume: 0.25 });
  }

  _checkBossScoring() {
    const bossWinScore = 3;
    if (this.bossPlayerScore >= bossWinScore || this.bossAiScore >= bossWinScore) {
      this.ai.height = this.bossOrigAiH;
      if (this.bossPlayerScore >= bossWinScore) {
        this.status = 'won';
        AudioManager.sfx({ type: 'powerup', volume: 0.6 });
        HapticManager.vibrate('powerup');
        ProgressionManager.checkAchievement('pong', 'boss-victory');
      } else {
        this.status = 'lost';
        AudioManager.sfx({ type: 'pong_hit', volume: 0.6 });
        HapticManager.vibrate('hit');
        this.currentStreak = 0;
      }
      const duration = (Date.now() - this.startTime) / 1000;
      ProgressionManager.recordGamePlay('pong', this.playerScore, this.status === 'won', duration);
    }
  }

  _afterPoint() {
    if (this.playerScore >= WIN_SCORE || this.aiScore >= WIN_SCORE) {
      if (this.playerScore > this.aiScore) {
        this._startBossFight();
        this.currentStreak++;
        const best = this.storage.get('bestStreak', 0);
        if (this.currentStreak > best) this.storage.set('bestStreak', this.currentStreak);
        if (this.currentStreak >= 3) ProgressionManager.checkAchievement('pong', 'win-streak-3');
        if (this.selectedDifficulty === 2) ProgressionManager.checkAchievement('pong', 'unbeatable');
      } else {
        this.status = 'lost';
        AudioManager.sfx({ type: 'pong_hit', volume: 0.6 });
        HapticManager.vibrate('hit');
        this.currentStreak = 0;
        const duration = (Date.now() - this.startTime) / 1000;
        ProgressionManager.recordGamePlay('pong', this.playerScore, false, duration);
      }
    } else {
      ProgressionManager.checkAchievement('pong', 'first-point');
      this._serve(this.playerScore > this.aiScore ? 1 : -1);
    }
  }

  _restart() {
    this.phase = 'select-difficulty';
    this.selectedDifficulty = -1;
    this.currentStreak = 0;
    this.startTime = Date.now();
    this.bossBalls = [];
    this.bossPlayerScore = 0;
    this.bossAiScore = 0;
    this.powerups = [];
    this.hitParticles = [];
    this.scorePopups = [];
    this._widePaddleTimer = 0;
  }

  _getDifficultyButtons() {
    const count = DIFFICULTIES.length;
    const btnW = 160;
    const btnH = 50;
    const gap = 16;
    const totalW = count * btnW + (count - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const y = this.height / 2 + 10;
    return DIFFICULTIES.map((_, i) => ({
      x: startX + i * (btnW + gap),
      y,
      width: btnW,
      height: btnH,
    }));
  }

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.phase === 'select-difficulty') {
      this._renderDifficultySelect(ctx);
      return;
    }

    const diff = this._getDifficulty();

    // Extra balls del boss
    for (const b of this.bossBalls) {
      ctx.fillStyle = '#ff6b4a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 107, 74, 0.3)';
      ctx.beginPath();
      ctx.arc(b.x - b.vx * 0.02, b.y - b.vy * 0.02, b.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Power-ups
    for (const p of this.powerups) {
      const pulse = 0.8 + Math.sin(Date.now() * 0.005) * 0.2;
      ctx.save();
      ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = POWERUP_COLORS[p.type] || '#aaa';
      ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = p.type === 'widePaddle' ? 'W' : p.type === 'slowBall' ? 'S' : 'M';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // Hit particles
    for (const pt of this.hitParticles) {
      const alpha = pt.life / pt.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // Línea central
    ctx.strokeStyle = '#1e2731';
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(this.width / 2, 0);
    ctx.lineTo(this.width / 2, this.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paletas
    ctx.fillStyle = '#e7edf3';
    ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
    if (this._widePaddleTimer > 0) {
      ctx.strokeStyle = `rgba(93, 173, 226, ${0.3 + Math.sin(Date.now() * 0.01) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(this.player.x - 1, this.player.y - 1, this.player.width + 2, this.player.height + 2);
    }
    ctx.fillRect(this.ai.x, this.ai.y, this.ai.width, this.ai.height);

    // Bola
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#e7edf3';
    ctx.fill();

    // Score popups
    for (const pop of this.scorePopups) {
      const alpha = Math.max(0, pop.life / 1.2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pop.color;
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Marcador
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7c8894';
    if (this.phase === 'boss-fight') {
      ctx.fillText(String(this.bossPlayerScore), this.width / 2 - 60, 40);
      ctx.fillText(String(this.bossAiScore), this.width / 2 + 60, 40);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#ff6b4a';
      ctx.fillText(t('pong.bossRound'), this.width / 2, 10);
      const bossHp = 3 - this.bossPlayerScore;
      const barW = 80;
      const barH = 8;
      const barX = this.width / 2 + 60;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(barX, 52, barW, barH);
      ctx.fillStyle = '#ff6b4a';
      ctx.fillRect(barX, 52, barW * (bossHp / 3), barH);
      ctx.fillStyle = '#45d66c';
      ctx.fillRect(this.width / 2 - 60 - barW, 52, barW * (8 / 3), barH);
    } else {
      ctx.fillText(String(this.playerScore), this.width / 2 - 60, 40);
      ctx.fillText(String(this.aiScore), this.width / 2 + 60, 40);
    }

    ctx.font = '12px monospace';
    ctx.fillStyle = '#9aa7b2';
    ctx.fillText(t('pong.difficulty') + ': ' + t(diff.id === 'easy' ? 'level.easy' : diff.id === 'normal' ? 'level.medium' : 'level.hard'), this.width / 2, 10);
    if (this.phase !== 'boss-fight') {
      ctx.fillText(t('pong.target', { n: WIN_SCORE }), this.width / 2, 26);
      // Estilo de IA
      ctx.fillText('AI: ' + this._getAiStyle().toUpperCase(), this.width / 2, 60);
    }
    ctx.textAlign = 'left';

    if (this.status === 'won' || this.status === 'lost') {
      const title = this.status === 'won' ? t('pong.gameComplete') : t('pong.lost');
      renderOverlay(ctx, { width: this.width, height: this.height, title });
    }
  }

  _renderDifficultySelect(ctx) {
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('pong.selectDifficulty'), this.width / 2, this.height / 2 - 70);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#7c8894';
    ctx.fillText(t('pong.firstTo', { n: WIN_SCORE }), this.width / 2, this.height / 2 - 35);

    // AI style selector
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '12px monospace';
    ctx.fillText('← ' + t('pong.aiStyle') + ': ' + this._getAiStyle().toUpperCase() + ' →', this.width / 2, this.height / 2 + 5);

    const buttons = this._getDifficultyButtons();
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      ctx.fillStyle = '#11161d';
      ctx.strokeStyle = '#1e2731';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

      ctx.fillStyle = '#e7edf3';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = DIFFICULTIES[i].id === 'easy' ? t('level.easy') : DIFFICULTIES[i].id === 'normal' ? t('level.medium') : t('level.hard');
      ctx.fillText(label, btn.x + btn.width / 2, btn.y + btn.height / 2);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

}
