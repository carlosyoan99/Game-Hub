import { GameBase } from '../../engine/GameBase.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { circleIntersectsAABB, clamp } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { icon } from '../../engine/IconRenderer.js';

const PADDLE_WIDTH = 90;
const PADDLE_HEIGHT = 14;
const BALL_RADIUS = 7;
const BRICK_HEIGHT = 22;
const BRICK_GAP = 4;
const BRICK_TOP_OFFSET = 50;
const MAX_LEVEL = 5;

/** Configuración de cada nivel: filas, columnas, velocidad de la bola. */
const LEVELS = [
  { rows: 5, cols: 8, ballSpeed: 220, labelKey: 'level.easy' },
  { rows: 6, cols: 9, ballSpeed: 240, labelKey: 'level.medium' },
  { rows: 7, cols: 10, ballSpeed: 260, labelKey: 'level.hard' },
  { rows: 8, cols: 10, ballSpeed: 280, labelKey: 'level.expert' },
  { rows: 8, cols: 12, ballSpeed: 310, labelKey: 'level.impossible' },
];

/**
 * Breakout con sistema de 5 niveles.
 */
export class Breakout extends GameBase {
  init(engine) {
    super.init(engine, 'breakout');

    this.score = 0;
    this.lives = 3;
    this.highscore = this.storage.get('highscore', 0);
    this.rng = new SeededRandom();
    this.currentLevel = this.storage.get('savedLevel', 1);
    this.status = 'playing'; // 'playing' | 'won' | 'lost' | 'level-complete'

    this._resetPaddleAndBall();
    this._buildBricks();
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this.paddle.y = this.height - 30;
    if (this.status === 'playing' || this.status === 'level-complete') {
      this._buildBricks();
    }
  }

  _getLevelConfig() {
    return LEVELS[Math.min(this.currentLevel - 1, LEVELS.length - 1)];
  }

  _resetPaddleAndBall() {
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
      vx: Math.cos(angle) * cfg.ballSpeed,
      vy: -Math.abs(Math.sin(angle) * cfg.ballSpeed),
    };
  }

  _buildBricks() {
    const cfg = this._getLevelConfig();
    const brickWidth = (this.width - BRICK_GAP * (cfg.cols + 1)) / cfg.cols;
    this.bricks = [];
    // La fila 0 usa un color especial y es más resistente (2 hits) si level >= 3
    for (let row = 0; row < cfg.rows; row++) {
      for (let col = 0; col < cfg.cols; col++) {
        const isHard = row === 0 && this.currentLevel >= 3;
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

  update(dt) {
    if (this.status === 'level-complete') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame || this.input.wasPressed('GamepadA') || this.input.wasPressed('GamepadStart')) {
        this._nextLevel();
      }

      return;
    }

    if (this.handleRestartInput()) return;

    // Paleta
    if (this.input.isDown('ArrowLeft') || this.input.isDown('KeyA') || this.input.isDown('GamepadLeft') || this.input.isDown('GamepadLStickLeft')) {
      this.paddle.x -= 360 * dt;
    }
    if (this.input.isDown('ArrowRight') || this.input.isDown('KeyD') || this.input.isDown('GamepadRight') || this.input.isDown('GamepadLStickRight')) {
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
      const speed = cfg.ballSpeed;
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
        if (brick.hp <= 0) brick.alive = false;
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

    // Bola cae
    if (this.ball.y - this.ball.radius > this.height) {
      this.lives -= 1;
      AudioManager.sfx({ type: 'breakout_hit', volume: 0.4 });
      HapticManager.vibrate('hit');
      if (this.lives <= 0) {
        this._endGame('lost');
      } else {
        this._resetPaddleAndBall();
      }
    }

    // Nivel completado
    if (this.bricks.every((b) => !b.alive)) {
      AudioManager.sfx({ type: 'powerup', volume: 0.5 });
      HapticManager.vibrate('powerup');
      if (this.currentLevel >= MAX_LEVEL) {
        this._endGame('won');
      } else {
        this.status = 'level-complete';
      }
    }

    this.input.endFrame();
  }

  _nextLevel() {
    this.currentLevel++;
    this.storage.set('savedLevel', this.currentLevel);
    this.status = 'playing';
    this._resetPaddleAndBall();
    this._buildBricks();
  }

  _endGame(status) {
    this.status = status;
    if (status === 'lost') {
      AudioManager.sfx({ type: 'explosion', volume: 0.5 });
      HapticManager.vibrate('explosion');
    }
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
  }

  _restart() {
    this.rng = new SeededRandom();
    this.score = 0;
    this.lives = 3;
    this.currentLevel = this.storage.get('savedLevel', 1);
    this.status = 'playing';
    this._resetPaddleAndBall();
    this._buildBricks();
  }

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    const cfg = this._getLevelConfig();

    // Ladrillos
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      if (brick.hard) {
        // Ladrillo duro: borde brillante y dos tonos
        ctx.fillStyle = `hsl(${brick.hue}, 75%, 65%)`;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        ctx.fillStyle = `hsl(${brick.hue}, 80%, 85%)`;
        ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, brick.height / 2);
      } else {
        ctx.fillStyle = `hsl(${brick.hue}, 65%, 55%)`;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
      }
    }

    // Paleta
    ctx.fillStyle = '#e7edf3';
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);

    // Bola
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#e7edf3';
    ctx.fill();

    // HUD
    setupHUDContext(ctx);
    ctx.fillText(t('breakout.level', { n: this.currentLevel, max: MAX_LEVEL, label: t(cfg.labelKey) }), 10, 10);
    ctx.fillText(t('game.score', { n: this.score }), 10, 28);

    const heartBaseX = this.width - 100 + ctx.measureText(t('breakout.lives')).width + 6;
    const heartY = 17; // centrado vertical con texto de 14px usando textBaseline='top' en y=10
    icon(ctx, 'heart', heartBaseX, heartY, 14, '#e74c3c');
    if (this.lives > 1) icon(ctx, 'heart', heartBaseX + 16, heartY, 14, '#e74c3c');
    if (this.lives > 2) icon(ctx, 'heart', heartBaseX + 32, heartY, 14, '#e74c3c');
    ctx.fillText(t('game.record', { n: this.highscore }), this.width / 2 - 50, 10);

    if (this.status === 'level-complete') {
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

    if (this.status === 'won' || this.status === 'lost') {
      const title = this.status === 'won' ? t('breakout.gameComplete') : undefined;
      const subtitle = this.status === 'won' ? t('breakout.finalScore', { n: this.score }) : undefined;
      renderOverlay(ctx, { width: this.width, height: this.height, title, subtitle, actionText: t('game.restart') });
    }
  }

}
