import { GameBase } from '../../engine/GameBase.js';
import { circleIntersectsAABB, clamp, pointInRect } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { ScreenShake } from '../../engine/ScreenShake.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { icon } from '../../engine/IconRenderer.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

const PADDLE_WIDTH = 90;
const PADDLE_HEIGHT = 14;
const BALL_RADIUS = 7;
const BRICK_HEIGHT = 22;
const BRICK_GAP = 4;
const BRICK_TOP_OFFSET = 50;
const MAX_LEVEL = 8;

/** Configuración de cada nivel: filas, columnas, velocidad de la bola. */
const LEVELS = [
  { rows: 5, cols: 8, ballSpeed: 220, labelKey: 'level.easy' },
  { rows: 6, cols: 9, ballSpeed: 240, labelKey: 'level.medium' },
  { rows: 7, cols: 10, ballSpeed: 260, labelKey: 'level.hard' },
  { rows: 8, cols: 10, ballSpeed: 280, labelKey: 'level.expert' },
  { rows: 8, cols: 12, ballSpeed: 310, labelKey: 'level.impossible' },
  { rows: 9, cols: 12, ballSpeed: 330, labelKey: 'level.impossible' },
  { rows: 9, cols: 14, ballSpeed: 350, labelKey: 'level.impossible' },
  { rows: 10, cols: 14, ballSpeed: 370, labelKey: 'level.impossible' },
];

// Power-up types that can drop from bricks
const POWERUP_TYPES = ['wide', 'multiball', 'slow', 'life'];

/** Configuración de dificultad. */
const DIFFICULTIES = [
  { id: 'easy', lives: 5, speedMult: 0.8, bossHp: 5, extraHard: false },
  { id: 'normal', lives: 3, speedMult: 1.0, bossHp: 8, extraHard: false },
  { id: 'hard', lives: 2, speedMult: 1.2, bossHp: 12, extraHard: true },
];

/**
 * Breakout con sistema de 5 niveles + jefe final + selector de dificultad.
 */
export class Breakout extends GameBase {
  init(engine) {
    super.init(engine, 'breakout');

    this.score = 0;
    this.highscore = this.storage.get('highscore', 0);
    this.rng = new SeededRandom();
    this.currentLevel = this.storage.get('savedLevel', 1);
    this.selectedDifficulty = this.storage.get('difficulty', 1);
    this.phase = 'select-difficulty'; // 'select-difficulty' | 'playing' | 'won' | 'lost' | 'level-complete' | 'boss-fight'

    this.startTime = Date.now();
    this._livesLostThisLevel = 0;
    this.boss = null;
    this.bossBullets = [];
    this.bossFireTimer = 0;
  }

  _getDifficulty() {
    return DIFFICULTIES[this.selectedDifficulty] || DIFFICULTIES[1];
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    if (this.paddle) this.paddle.y = this.height - 30;
    if (this.phase === 'playing' || this.phase === 'level-complete') {
      this._buildBricks();
    }
  }

  _getLevelConfig() {
    return LEVELS[Math.min(this.currentLevel - 1, LEVELS.length - 1)];
  }

  _resetPaddleAndBall() {
    const diff = this._getDifficulty();
    this.paddle = {
      x: this.width / 2 - PADDLE_WIDTH / 2,
      y: this.height - 30,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
    };
    const cfg = this._getLevelConfig();
    const angle = (this.rng.next() - 0.5) * (Math.PI / 4);
    this.ball = {
      x: this.width / 2,
      y: this.height - 50,
      radius: BALL_RADIUS,
      vx: Math.cos(angle) * (cfg.ballSpeed * diff.speedMult),
      vy: -Math.abs(Math.sin(angle) * (cfg.ballSpeed * diff.speedMult)),
    };
  }

  _buildBricks() {
    const diff = this._getDifficulty();
    const cfg = this._getLevelConfig();
    const brickWidth = (this.width - BRICK_GAP * (cfg.cols + 1)) / cfg.cols;
    this.bricks = [];
    const extraHard = diff.extraHard;
    for (let row = 0; row < cfg.rows; row++) {
      for (let col = 0; col < cfg.cols; col++) {
        const isHard = (row === 0 && this.currentLevel >= 3) || (extraHard && row <= 1);
        this.bricks.push({
          x: BRICK_GAP + col * (brickWidth + BRICK_GAP),
          y: BRICK_TOP_OFFSET + row * (BRICK_HEIGHT + BRICK_GAP),
          width: brickWidth,
          height: BRICK_HEIGHT,
          alive: true,
          hue: 190 + row * (25 + this.currentLevel * 2),
          hard: isHard,
          hp: isHard ? 2 : 1,
        });
      }
    }
  }

  // ── Jefe final ────────────────────────────────────────────────────────

  _spawnBoss() {
    const diff = this._getDifficulty();
    this.boss = {
      x: this.width / 2 - 60,
      y: 25,
      width: 120,
      height: 30,
      hp: diff.bossHp,
      maxHp: diff.bossHp,
      dir: 1,
      speed: 120,
    };
    this.bossBullets = [];
    this.bossFireTimer = 1.5;
    this.phase = 'boss-fight';
    // Resetear paleta y bola para la pelea
    this._resetPaddleAndBall();
  }

  _updateBoss(dt) {
    if (!this.boss) return;

    // Movimiento horizontal
    this.boss.x += this.boss.speed * this.boss.dir * dt;
    if (this.boss.x < 10) { this.boss.x = 10; this.boss.dir = 1; }
    if (this.boss.x + this.boss.width > this.width - 10) { this.boss.x = this.width - 10 - this.boss.width; this.boss.dir = -1; }

    // Disparar cada cierto tiempo
    this.bossFireTimer -= dt;
    if (this.bossFireTimer <= 0) {
      this.bossFireTimer = 1.0 + Math.random() * 0.8;
      this.bossBullets.push({
        x: this.boss.x + this.boss.width / 2,
        y: this.boss.y + this.boss.height,
        width: 6,
        height: 12,
        vy: 200,
        alive: true,
      });
      AudioManager.sfx({ type: 'space_invaders_shoot', volume: 0.3 });
    }

    // Mover balas del jefe
    for (const bullet of this.bossBullets) {
      bullet.y += bullet.vy * dt;
      if (bullet.y > this.height + 20) bullet.alive = false;
    }
    this.bossBullets = this.bossBullets.filter(b => b.alive);

    // Bala del jefe vs paleta
    for (const bullet of this.bossBullets) {
      if (!bullet.alive) continue;
      if (circleIntersectsAABB(this.ball, bullet)) {
        bullet.alive = false;
        this._removeLife();
        return;
      }
    }

    // Bola golpea al jefe
    if (this.ball.vy < 0 && circleIntersectsAABB(this.ball, this.boss)) {
      this.boss.hp--;
      this.score += 30;
      this.ball.vy = Math.abs(this.ball.vy); // rebotar hacia abajo
      AudioManager.sfx({ type: 'centipede_hit', volume: 0.4 });
      HapticManager.vibrate('hit');

      if (this.boss.hp <= 0) {
        // ── Jefe derrotado ──
        this.score += 200;
        AudioManager.sfx({ type: 'powerup', volume: 0.6 });
        HapticManager.vibrate('powerup');
        ProgressionManager.checkAchievement('breakout', 'brick-breaker');
        const duration = (Date.now() - this.startTime) / 1000;
        ProgressionManager.recordGamePlay('breakout', this.score, true, duration);
        ProgressionManager.addXp(75, 'boss-defeated');
        this.phase = 'won';
      }
    }
  }

  _renderBoss(ctx) {
    if (!this.boss) return;

    // Cuerpo del jefe (rectángulo grande con brillo)
    const hpRatio = this.boss.hp / this.boss.maxHp;
    const hue = 0 + hpRatio * 120; // rojo → verde según HP
    ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
    ctx.fillRect(this.boss.x, this.boss.y, this.boss.width, this.boss.height);

    // Borde brillante
    ctx.strokeStyle = `hsl(${hue}, 90%, 70%)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.boss.x, this.boss.y, this.boss.width, this.boss.height);

    // Ojos amenazantes
    ctx.fillStyle = '#fff';
    ctx.fillRect(this.boss.x + 20, this.boss.y + 6, 10, 8);
    ctx.fillRect(this.boss.x + this.boss.width - 30, this.boss.y + 6, 10, 8);
    ctx.fillStyle = '#000';
    ctx.fillRect(this.boss.x + 23, this.boss.y + 7, 5, 6);
    ctx.fillRect(this.boss.x + this.boss.width - 27, this.boss.y + 7, 5, 6);

    // Barra de HP debajo del jefe
    const barWidth = this.boss.width;
    const barHeight = 5;
    const barX = this.boss.x;
    const barY = this.boss.y + this.boss.height + 4;
    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    // Balas del jefe
    ctx.fillStyle = '#ff6b4a';
    for (const bullet of this.bossBullets) {
      if (!bullet.alive) continue;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Update ────────────────────────────────────────────────────────────

  update(dt) {
    if (this.phase === 'select-difficulty') {
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
      return;
    }

    if (this.phase === 'boss-fight') {
      this._updateBoss(dt);
      if (this.phase !== 'boss-fight') return; // si murió el jefe

      // Movimiento de paleta
      if (this.input.isActionDown('moveLeft')) {
        this.paddle.x -= 360 * dt;
      }
      if (this.input.isActionDown('moveRight')) {
        this.paddle.x += 360 * dt;
      }
      if (this.input.mouse.x >= 0) {
        this.paddle.x = this.input.mouse.x - this.paddle.width / 2;
      }
      this.paddle.x = clamp(this.paddle.x, 0, this.width - this.paddle.width);

      // Movimiento de bola
      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;

      if (this.ball.x - this.ball.radius < 0) {
        this.ball.x = this.ball.radius;
        this.ball.vx *= -1;
      } else if (this.ball.x + this.ball.radius > this.width) {
        this.ball.x = this.width - this.ball.radius;
        this.ball.vx *= -1;
      }
      if (this.ball.y - this.ball.radius < 0) {
        this.ball.y = this.ball.radius;
        this.ball.vy *= -1;
      }

      // Bola vs paleta
      if (circleIntersectsAABB(this.ball, this.paddle) && this.ball.vy > 0) {
        const hitPos = (this.ball.x - this.paddle.x) / this.paddle.width;
        const angle = (hitPos - 0.5) * (Math.PI / 3);
        const cfg = this._getLevelConfig();
        const diff = this._getDifficulty();
        const speed = cfg.ballSpeed * diff.speedMult;
        this.ball.vx = speed * Math.sin(angle);
        this.ball.vy = -Math.abs(speed * Math.cos(angle));
        this.ball.y = this.paddle.y - this.ball.radius;
        AudioManager.sfx({ type: 'breakout_hit', volume: 0.3 });
      }

      // Bola cae
      if (this.ball.y - this.ball.radius > this.height) {
        this._removeLife();
      }

      this.input.endFrame();
      return;
    }

    if (this.phase === 'level-complete') {
      if (this.input.wasActionPressed('action') || this.input.mouse.clickedThisFrame) {
        this._nextLevel();
      }
      return;
    }

    if (this.phase === 'won' || this.phase === 'lost') {
      if (this.handleRestartInput()) return;
      return;
    }

    // Paleta
    if (this.input.isActionDown('moveLeft')) {
      this.paddle.x -= 360 * dt;
    }
    if (this.input.isActionDown('moveRight')) {
      this.paddle.x += 360 * dt;
    }
    if (this.input.mouse.x >= 0) {
      this.paddle.x = this.input.mouse.x - this.paddle.width / 2;
    }
    this.paddle.x = clamp(this.paddle.x, 0, this.width - this.paddle.width);

    // Bola
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.x - this.ball.radius < 0) {
      this.ball.x = this.ball.radius;
      this.ball.vx *= -1;
    } else if (this.ball.x + this.ball.radius > this.width) {
      this.ball.x = this.width - this.ball.radius;
      this.ball.vx *= -1;
    }
    if (this.ball.y - this.ball.radius < 0) {
      this.ball.y = this.ball.radius;
      this.ball.vy *= -1;
    }

    // Bola vs paleta
    if (circleIntersectsAABB(this.ball, this.paddle) && this.ball.vy > 0) {
      const hitPos = (this.ball.x - this.paddle.x) / this.paddle.width;
      const angle = (hitPos - 0.5) * (Math.PI / 3);
      const cfg = this._getLevelConfig();
      const diff = this._getDifficulty();
      const speed = cfg.ballSpeed * diff.speedMult;
      this.ball.vx = speed * Math.sin(angle);
      this.ball.vy = -Math.abs(speed * Math.cos(angle));
      this.ball.y = this.paddle.y - this.ball.radius;
      AudioManager.sfx({ type: 'breakout_hit', volume: 0.3 });
    }

    // Bola vs ladrillos
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      if (circleIntersectsAABB(this.ball, brick)) {
        brick.hp--;
        if (brick.hp <= 0) {
          brick.alive = false;
          this._maybeDropPowerup(brick);
        }
        this.score += brick.hard ? 20 : 10;
        AudioManager.sfx({ type: 'breakout_brick', volume: 0.25 });
        HapticManager.vibrate('coin');
        const overlapX = Math.min(
          this.ball.x + this.ball.radius - brick.x,
          brick.x + brick.width - (this.ball.x - this.ball.radius)
        );
        const overlapY = Math.min(
          this.ball.y + this.ball.radius - brick.y,
          brick.y + brick.height - (this.ball.y - this.ball.radius)
        );
        if (overlapX < overlapY) this.ball.vx *= -1;
        else this.ball.vy *= -1;
        break;
      }
    }

    // Update powerups and extra balls
    this._updatePowerups(dt);
    this._updateExtraBalls(dt);

    // Moving obstacles in levels 6+
    if (this.currentLevel >= 6 && this.obstacles) {
      for (const obs of this.obstacles) {
        obs.x += obs.vx * dt;
        if (obs.x < 0 || obs.x + obs.width > this.width) obs.vx *= -1;
        if (circleIntersectsAABB(this.ball, obs)) {
          this.ball.vx *= -1;
          this.ball.vy *= -1;
        }
      }
    }

    // Bola cae
    if (this.ball.y - this.ball.radius > this.height) {
      this._removeLife();
    }

    // Nivel completado
    if (this.bricks.every((b) => !b.alive)) {
      this.shake.trigger(6, 4);
      AudioManager.sfx({ type: 'powerup', volume: 0.5 });
      HapticManager.vibrate('powerup');

      // ── Logros ──
      if (this.currentLevel === 1) ProgressionManager.checkAchievement('breakout', 'first-step');
      if (this.currentLevel === MAX_LEVEL) ProgressionManager.checkAchievement('breakout', 'impossible');
      if (this._livesLostThisLevel === 0) ProgressionManager.checkAchievement('breakout', 'flawless');
      this._livesLostThisLevel = 0;

      if (this.currentLevel >= MAX_LEVEL) {
        // En nivel 5, aparece el jefe en lugar de ganar directamente
        this._spawnBoss();
      } else {
        this.phase = 'level-complete';
      }
    }

    this.input.endFrame();
  }

  _removeLife() {
    this.lives -= 1;
    this._livesLostThisLevel++;
    AudioManager.sfx({ type: 'breakout_hit', volume: 0.4 });
    HapticManager.vibrate('hit');
    if (this.lives <= 0) {
      this._endGame('lost');
    } else {
      this._resetPaddleAndBall();
    }
  }

  _startGame(difficultyIndex) {
    this.selectedDifficulty = difficultyIndex;
    this.storage.set('difficulty', difficultyIndex);
    this.phase = 'playing';
    this.score = 0;
    const diff = DIFFICULTIES[difficultyIndex];
    this.lives = diff.lives;
    this.currentLevel = this.storage.get('savedLevel', 1);
    this.startTime = Date.now();
    this._livesLostThisLevel = 0;
    this.boss = null;
    this.bossBullets = [];
    this.powerups = [];
    this.extraBalls = [];
    this.obstacles = null;
    this._wideTimer = 0;
    this.shake = new ScreenShake();
    this._generateObstacles();
    this._resetPaddleAndBall();
    this._buildBricks();
  }

  _updatePowerups(dt) {
    if (!this.powerups) this.powerups = [];
    for (const p of this.powerups) {
      if (!p.alive) continue;
      p.y += p.vy * dt;
      // Check paddle collision
      if (
        p.x < this.paddle.x + this.paddle.width &&
        p.x + p.width > this.paddle.x &&
        p.y < this.paddle.y + this.paddle.height &&
        p.y + p.height > this.paddle.y
      ) {
        p.alive = false;
        AudioManager.sfx({ type: 'powerup', volume: 0.4 });
        HapticManager.vibrate('powerup');
        switch (p.type) {
          case 'wide':
            this.paddle.width = Math.min(this.paddle.width * 1.35, this.width * 0.6);
            this._wideTimer = 8;
            break;
          case 'multiball':
            for (let i = 0; i < 2; i++) {
              const angle = (this.rng.next() - 0.5) * (Math.PI / 3);
              const diff = this._getDifficulty();
              const cfg = this._getLevelConfig();
              const speed = cfg.ballSpeed * diff.speedMult * 1.1;
              this.extraBalls.push({
                x: this.ball.x,
                y: this.ball.y,
                radius: BALL_RADIUS,
                vx: Math.cos(angle + i * Math.PI) * speed,
                vy: -Math.abs(Math.sin(angle + i * Math.PI) * speed),
              });
            }
            break;
          case 'slow':
            this.ball.vx *= 0.65;
            this.ball.vy *= 0.65;
            break;
          case 'life':
            this.lives = Math.min(this.lives + 1, 9);
            break;
        }
      }
    }
    this.powerups = this.powerups.filter(p => p.alive && p.y < this.height + 20);
    // Reset paddle width after timer
    if (this._wideTimer > 0) {
      this._wideTimer -= dt;
      if (this._wideTimer <= 0) {
        this.paddle.width = PADDLE_WIDTH;
      }
    }
  }

  _updateExtraBalls(dt) {
    if (!this.extraBalls) this.extraBalls = [];
    for (const b of this.extraBalls) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // Wall bounces
      if (b.x - b.radius < 0) { b.x = b.radius; b.vx *= -1; }
      if (b.x + b.radius > this.width) { b.x = this.width - b.radius; b.vx *= -1; }
      if (b.y - b.radius < 0) { b.y = b.radius; b.vy *= -1; }
      // Brick collisions
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        if (circleIntersectsAABB(b, brick)) {
          brick.hp--;
          if (brick.hp <= 0) {
            brick.alive = false;
            this._maybeDropPowerup(brick);
          }
          this.score += brick.hard ? 20 : 10;
          b.vy *= -1;
          break;
        }
      }
      // Paddle collision
      if (b.vy > 0 && circleIntersectsAABB(b, this.paddle)) {
        const hitPos = (b.x - this.paddle.x) / this.paddle.width;
        const angle = (hitPos - 0.5) * (Math.PI / 3);
        const diff = this._getDifficulty();
        const cfg = this._getLevelConfig();
        const speed = cfg.ballSpeed * diff.speedMult;
        b.vx = speed * Math.sin(angle);
        b.vy = -Math.abs(speed * Math.cos(angle));
      }
    }
    this.extraBalls = this.extraBalls.filter(b => b.y - b.radius < this.height + 20);
  }

  _maybeDropPowerup(brick) {
    if (this.rng.next() < 0.22) {
      const type = POWERUP_TYPES[Math.floor(this.rng.next() * POWERUP_TYPES.length)];
      this.powerups.push({
        x: brick.x + brick.width / 2 - 8,
        y: brick.y,
        width: 16,
        height: 12,
        vy: 120,
        type,
        alive: true,
      });
    }
  }

  _nextLevel() {
    this.currentLevel++;
    this.storage.set('savedLevel', this.currentLevel);
    this.phase = 'playing';
    this.powerups = [];
    this.extraBalls = [];
    this._wideTimer = 0;
    this.paddle.width = PADDLE_WIDTH;
    this._generateObstacles();
    this._resetPaddleAndBall();
    this._buildBricks();
  }

  _endGame(status) {
    this.phase = status;
    // ── SFX / Haptics ──
    if (status === 'lost') {
      AudioManager.sfx({ type: 'explosion', volume: 0.5 });
      HapticManager.vibrate('explosion');
    }
    // ── Highscore ──
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    // ── Progression ──
    const won = status === 'won';
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('breakout', this.score, won, duration);
  }

  _restart() {
    this.rng = new SeededRandom();
    this.score = 0;
    this.selectedDifficulty = this.storage.get('difficulty', 1);
    this.phase = 'select-difficulty';
    this.startTime = Date.now();
    this._livesLostThisLevel = 0;
    this.boss = null;
    this.bossBullets = [];
    this.powerups = [];
    this.extraBalls = [];
  }

  _generateObstacles() {
    if (this.currentLevel >= 6) {
      this.obstacles = [];
      for (let i = 0; i < this.currentLevel - 4; i++) {
        this.obstacles.push({
          x: this.width * (0.1 + (i * 0.2)),
          y: this.height * (0.35 + (i % 3) * 0.1),
          width: 28 + i * 4,
          height: 12,
          vx: (this.rng.next() > 0.5 ? 1 : -1) * (50 + this.currentLevel * 10),
        });
      }
    } else {
      this.obstacles = null;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx) {
    if (this.phase === 'select-difficulty') {
      this._renderDifficultySelect(ctx);
      return;
    }

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.phase === 'boss-fight') {
      this._renderBoss(ctx);
    } else {
      const cfg = this._getLevelConfig();

      // Ladrillos
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        if (brick.hard) {
          ctx.fillStyle = `hsl(${brick.hue}, 75%, 65%)`;
          ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
          ctx.fillStyle = `hsl(${brick.hue}, 80%, 85%)`;
          ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, brick.height / 2);
        } else {
          ctx.fillStyle = `hsl(${brick.hue}, 65%, 55%)`;
          ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        }
      }

      // Obstáculos en niveles 6+
      if (this.obstacles) {
        ctx.fillStyle = '#e74c3c';
        for (const obs of this.obstacles) {
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.fillStyle = '#c0392b';
          ctx.fillRect(obs.x + 2, obs.y + 2, obs.width - 4, obs.height - 4);
          ctx.fillStyle = '#e74c3c';
        }
      }
    }

    // Power-ups (powerups cayendo)
    const powerupColors = { wide: '#5dade2', multiball: '#f5b041', slow: '#58d68d', life: '#e74c3c' };
    const powerupLabels = { wide: 'W', multiball: 'M', slow: 'S', life: 'L' };
    if (this.powerups) {
      for (const p of this.powerups) {
        if (!p.alive) continue;
        ctx.fillStyle = powerupColors[p.type] || '#aaa';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerupLabels[p.type] || '?', p.x + p.width / 2, p.y + p.height / 2);
      }
    }

    // Extra balls
    if (this.extraBalls) {
      for (const b of this.extraBalls) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f5b041';
        ctx.fill();
      }
    }

    // Paleta
    ctx.fillStyle = '#e7edf3';
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    // Wide paddle glow
    if (this._wideTimer > 0) {
      ctx.strokeStyle = `rgba(93, 173, 226, ${0.3 + Math.sin(Date.now() * 0.01) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(this.paddle.x - 1, this.paddle.y - 1, this.paddle.width + 2, this.paddle.height + 2);
    }

    // Bola
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#e7edf3';
    ctx.fill();

    // HUD
    const diff = this._getDifficulty();
    setupHUDContext(ctx);
    ctx.fillText(t('breakout.level', { n: this.currentLevel, max: MAX_LEVEL, label: t(this.phase === 'boss-fight' ? 'breakout.boss' : `level.${diff.id}`) }), 10, 10);
    ctx.fillText(t('game.score', { n: this.score }), 10, 28);

    const heartBaseX = this.width - 100 + ctx.measureText(t('breakout.lives')).width + 6;
    const heartY = 17;
    icon(ctx, 'heart', heartBaseX, heartY, 14, '#e74c3c');
    if (this.lives > 1) icon(ctx, 'heart', heartBaseX + 16, heartY, 14, '#e74c3c');
    if (this.lives > 2) icon(ctx, 'heart', heartBaseX + 32, heartY, 14, '#e74c3c');
    ctx.fillText(t('game.record', { n: this.highscore }), this.width / 2 - 50, 10);

    if (this.phase === 'level-complete') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffb454';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t('game.levelComplete'), this.width / 2, this.height / 2 - 30);
      ctx.fillStyle = '#e7edf3';
      ctx.font = '16px monospace';
      ctx.fillText(t('game.continue'), this.width / 2, this.height / 2 + 10);
      ctx.textAlign = 'left';
    }

    if (this.phase === 'won' || this.phase === 'lost') {
      const title = this.phase === 'won' ? t('breakout.gameComplete') : undefined;
      const subtitle = this.phase === 'won' ? t('breakout.finalScore', { n: this.score }) : undefined;
      renderOverlay(ctx, { width: this.width, height: this.height, title, subtitle, actionText: t('game.restart') });
    }
  }

  _renderDifficultySelect(ctx) {
    const diffLabels = [t('level.easy'), t('level.medium'), t('level.hard')];
    const diffDescs = [
      t('breakout.diffEasyDesc'),
      t('breakout.diffNormalDesc'),
      t('breakout.diffHardDesc'),
    ];

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('breakout.selectDifficulty'), this.width / 2, this.height / 2 - 80);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#7c8894';
    ctx.fillText(t('breakout.levelsToBeat', { n: MAX_LEVEL }), this.width / 2, this.height / 2 - 45);

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
      ctx.fillText(diffLabels[i], btn.x + btn.width / 2, btn.y + 22);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#7c8894';
      ctx.fillText(diffDescs[i], btn.x + btn.width / 2, btn.y + 44);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _getDifficultyButtons() {
    const count = DIFFICULTIES.length;
    const btnW = 170;
    const btnH = 60;
    const gap = 16;
    const totalW = count * btnW + (count - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const y = this.height / 2 + 5;
    return DIFFICULTIES.map((_, i) => ({
      x: startX + i * (btnW + gap),
      y,
      width: btnW,
      height: btnH,
    }));
  }

}
