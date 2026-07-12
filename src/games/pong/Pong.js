import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { circleIntersectsAABB, clamp } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { SeededRandom } from '../../engine/SeededRandom.js';

const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const PADDLE_MARGIN = 24;
const BALL_RADIUS = 7;
const MAX_LEVEL = 5;

/** Configuración de cada nivel: velocidad de IA, velocidad base de bola, puntos para ganar. */
const LEVELS = [
  { aiSpeed: 260, ballSpeed: 320, winScore: 5, labelKey: 'level.easy' },
  { aiSpeed: 300, ballSpeed: 340, winScore: 5, labelKey: 'level.medium' },
  { aiSpeed: 340, ballSpeed: 360, winScore: 6, labelKey: 'level.hard' },
  { aiSpeed: 380, ballSpeed: 380, winScore: 6, labelKey: 'level.expert' },
  { aiSpeed: 430, ballSpeed: 410, winScore: 7, labelKey: 'level.impossible' },
];

/**
 * Pong con sistema de 5 niveles: IA progresa en velocidad,
 * la bola es más rápida, y necesitas más puntos para ganar.
 */
export class Pong {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('pong');

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.bestStreak = this.storage.get('bestStreak', 0);

    this._restart();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
    this.player.y = clamp(this.player.y, 0, this.height - this.player.height);
    this.ai.y = clamp(this.ai.y, 0, this.height - this.ai.height);
  }

  _getLevelConfig() {
    return LEVELS[Math.min(this.currentLevel - 1, LEVELS.length - 1)];
  }

  _restart() {
    this.rng = new SeededRandom();
    this.seedCode = SeededRandom.encode(this.rng.seed);
    this.currentLevel = 1;
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
    this.status = 'playing'; // 'playing' | 'level-complete' | 'won' | 'lost'
    this._serve(1);
  }

  _serve(direction) {
    const angle = (this.rng.nextFloat() - 0.5) * (Math.PI / 6);
    const cfg = this._getLevelConfig();
    this.ball = {
      x: this.width / 2,
      y: this.height / 2,
      radius: BALL_RADIUS,
      vx: Math.cos(angle) * cfg.ballSpeed * direction,
      vy: Math.sin(angle) * cfg.ballSpeed,
    };
  }

  update(dt) {
    if (this.status === 'level-complete') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this._nextLevel();
      }
      this.input.endFrame();
      return;
    }

    if (this.status === 'won' || this.status === 'lost') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }
      this.input.endFrame();
      return;
    }

    this._movePlayer(dt);
    this._moveAI(dt);
    this._moveBall(dt);
    this._checkScoring();

    this.input.endFrame();
  }

  _nextLevel() {
    this.currentLevel++;
    this.playerScore = 0;
    this.aiScore = 0;
    this.status = 'playing';
    this._serve(1);
  }

  _movePlayer(dt) {
    if (this.input.isDown('ArrowUp') || this.input.isDown('KeyW')) {
      this.player.y -= 360 * dt;
    }
    if (this.input.isDown('ArrowDown') || this.input.isDown('KeyS')) {
      this.player.y += 360 * dt;
    }
    if (this.input.mouse.y >= 0) {
      this.player.y = this.input.mouse.y - this.player.height / 2;
    }
    this.player.y = clamp(this.player.y, 0, this.height - this.player.height);
  }

  _moveAI(dt) {
    const cfg = this._getLevelConfig();
    const paddleCenter = this.ai.y + this.ai.height / 2;
    // La IA predice dónde estará la bola (más precisa en niveles altos)
    let targetY = this.ball.y;
    // En niveles altos, la IA anticipa mejor el rebote
    if (this.currentLevel >= 3 && this.ball.vx > 0) {
      targetY = this._predictAim();
    }
    const diff = targetY - paddleCenter;
    const deadZone = this.currentLevel >= 4 ? 3 : 6;
    if (Math.abs(diff) > deadZone) {
      this.ai.y += Math.sign(diff) * Math.min(cfg.aiSpeed * dt, Math.abs(diff));
    }
    this.ai.y = clamp(this.ai.y, 0, this.height - this.ai.height);
  }

  _predictAim() {
    // Predicción simple: simular cuántos rebotes hará la bola
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
    } else if (this.ball.vx > 0 && circleIntersectsAABB(this.ball, this.ai)) {
      this._bounce(this.ai, -1);
    }
  }

  _bounce(paddle, direction) {
    const hitPos = (this.ball.y - paddle.y) / paddle.height;
    const angle = (hitPos - 0.5) * (Math.PI / 3);
    const cfg = this._getLevelConfig();
    const speed = cfg.ballSpeed * 1.02;
    this.ball.vx = Math.cos(angle) * speed * direction;
    this.ball.vy = Math.sin(angle) * speed;
    this.ball.x = direction === 1 ? paddle.x + paddle.width + this.ball.radius : paddle.x - this.ball.radius;
    AudioManager.sfx({ type: 'select', volume: 0.25 });
    HapticManager.vibrate('select');
  }

  _checkScoring() {
    if (this.ball.x + this.ball.radius < 0) {
      this.aiScore += 1;
      AudioManager.sfx({ type: 'hit', volume: 0.5 });
      HapticManager.vibrate('hit');
      this._afterPoint();
    } else if (this.ball.x - this.ball.radius > this.width) {
      this.playerScore += 1;
      AudioManager.sfx({ type: 'coin', volume: 0.35 });
      HapticManager.vibrate('coin');
      this._afterPoint();
    }
  }

  _afterPoint() {
    const cfg = this._getLevelConfig();
    if (this.playerScore >= cfg.winScore || this.aiScore >= cfg.winScore) {
      if (this.playerScore > this.aiScore) {
        // Victoria del jugador en este nivel
        if (this.currentLevel >= MAX_LEVEL) {
          this.status = 'won';
          AudioManager.sfx({ type: 'powerup', volume: 0.5 });
          HapticManager.vibrate('powerup');
          if (this.currentLevel > this.bestStreak) {
            this.bestStreak = this.currentLevel;
            this.storage.set('bestStreak', this.bestStreak);
          }
        } else {
          this.status = 'level-complete';
          AudioManager.sfx({ type: 'powerup', volume: 0.5 });
          HapticManager.vibrate('powerup');
        }
      } else {
        this.status = 'lost';
        AudioManager.sfx({ type: 'hit', volume: 0.6 });
        HapticManager.vibrate('hit');
      }
    } else {
      this._serve(this.playerScore > this.aiScore ? 1 : -1);
    }
  }

  render(ctx) {
    const cfg = this._getLevelConfig();

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    // Línea central
    ctx.strokeStyle = '#1e2731';
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(this.width / 2, 0);
    ctx.lineTo(this.width / 2, this.height);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#e7edf3';
    ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
    ctx.fillRect(this.ai.x, this.ai.y, this.ai.width, this.ai.height);

    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Marcador
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7c8894';
    ctx.fillText(String(this.playerScore), this.width / 2 - 60, 40);
    ctx.fillText(String(this.aiScore), this.width / 2 + 60, 40);

    // Info de nivel
    ctx.font = '13px monospace';
    ctx.fillStyle = '#9aa7b2';
    ctx.fillText(t('pong.level', { n: this.currentLevel, max: MAX_LEVEL, label: t(cfg.labelKey) }), this.width / 2, 8);
    ctx.fillText(t('pong.target', { n: cfg.winScore }), this.width / 2, 24);

    ctx.fillStyle = '#7c8894';
    ctx.textAlign = 'left';
    ctx.font = '11px monospace';
    ctx.fillText(t('game.seed', { seed: this.seedCode }), 10, this.height - 14);
    ctx.textAlign = 'center';
    ctx.font = '14px monospace';
    ctx.fillText(t('pong.bestLevel', { n: this.bestStreak }), this.width / 2, this.height - 14);

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
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      if (this.status === 'won') {
        ctx.fillText(t('pong.gameComplete'), this.width / 2, this.height / 2 - 30);
      } else {
        ctx.fillText(t('pong.lost'), this.width / 2, this.height / 2 - 20);
      }
      ctx.font = '16px monospace';
      ctx.fillText(t('game.restart'), this.width / 2, this.height / 2 + 30);
    }
    ctx.textAlign = 'left';
  }

  destroy() {
    this.input.detach();
  }
}
