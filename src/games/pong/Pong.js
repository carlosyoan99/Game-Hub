import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { circleIntersectsAABB, clamp } from '../../engine/CollisionUtils.js';

const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const PADDLE_MARGIN = 24;
const BALL_RADIUS = 7;
const BALL_SPEED = 320;
const AI_SPEED = 260; // ligeramente más lenta que la bola para que sea vencible
const WIN_SCORE = 5;

/**
 * Pong
 * Un jugador (derecha, IA) y otro humano (izquierda). El ángulo de rebote
 * en ambas palas depende del punto de impacto, igual que en Breakout —
 * es intencional: es la misma mecánica de "rebote con ángulo variable"
 * aplicada a dos palas en vez de una.
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

  _restart() {
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
    this._serve(Math.random() < 0.5 ? 1 : -1);
  }

  _serve(direction) {
    const angle = (Math.random() - 0.5) * (Math.PI / 6); // pequeño ángulo inicial
    this.ball = {
      x: this.width / 2,
      y: this.height / 2,
      radius: BALL_RADIUS,
      vx: Math.cos(angle) * BALL_SPEED * direction,
      vy: Math.sin(angle) * BALL_SPEED,
    };
  }

  update(dt) {
    if (this.status !== 'playing') {
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

  _movePlayer(dt) {
    if (this.input.isDown('ArrowUp') || this.input.isDown('KeyW')) {
      this.player.y -= 360 * dt;
    }
    if (this.input.isDown('ArrowDown') || this.input.isDown('KeyS')) {
      this.player.y += 360 * dt;
    }
    // El ratón también controla la pala, útil en touch/trackpad.
    if (this.input.mouse.y >= 0) {
      this.player.y = this.input.mouse.y - this.player.height / 2;
    }
    this.player.y = clamp(this.player.y, 0, this.height - this.player.height);
  }

  _moveAI(dt) {
    const paddleCenter = this.ai.y + this.ai.height / 2;
    const target = this.ball.y;
    const diff = target - paddleCenter;
    // Zona muerta pequeña para que no tiemble al estar ya alineada.
    if (Math.abs(diff) > 6) {
      this.ai.y += Math.sign(diff) * Math.min(AI_SPEED * dt, Math.abs(diff));
    }
    this.ai.y = clamp(this.ai.y, 0, this.height - this.ai.height);
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

  /** direction: 1 = rebota hacia la derecha, -1 = hacia la izquierda */
  _bounce(paddle, direction) {
    const hitPos = (this.ball.y - paddle.y) / paddle.height; // 0..1
    const angle = (hitPos - 0.5) * (Math.PI / 3); // hasta ±60°
    const speed = Math.hypot(this.ball.vx, this.ball.vy) * 1.03; // pequeña aceleración por rally
    this.ball.vx = Math.cos(angle) * speed * direction;
    this.ball.vy = Math.sin(angle) * speed;
    this.ball.x = direction === 1 ? paddle.x + paddle.width + this.ball.radius : paddle.x - this.ball.radius;
  }

  _checkScoring() {
    if (this.ball.x + this.ball.radius < 0) {
      this.aiScore += 1;
      this._afterPoint();
    } else if (this.ball.x - this.ball.radius > this.width) {
      this.playerScore += 1;
      this._afterPoint();
    }
  }

  _afterPoint() {
    if (this.playerScore >= WIN_SCORE || this.aiScore >= WIN_SCORE) {
      this.status = this.playerScore > this.aiScore ? 'won' : 'lost';
      if (this.status === 'won' && this.playerScore > this.bestStreak) {
        this.bestStreak = this.playerScore;
        this.storage.set('bestStreak', this.bestStreak);
      }
    } else {
      this._serve(this.playerScore > this.aiScore ? 1 : -1);
    }
  }

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    // Línea central discontinua
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

    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7c8894';
    ctx.fillText(String(this.playerScore), this.width / 2 - 60, 40);
    ctx.fillText(String(this.aiScore), this.width / 2 + 60, 40);

    ctx.font = '14px monospace';
    ctx.fillText(`Mejor racha: ${this.bestStreak}`, this.width / 2, this.height - 14);

    if (this.status !== 'playing') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 28px monospace';
      const message = this.status === 'won' ? '¡GANASTE!' : 'PERDISTE';
      ctx.fillText(message, this.width / 2, this.height / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillText('Click o Espacio para reiniciar', this.width / 2, this.height / 2 + 15);
    }
    ctx.textAlign = 'left';
  }

  destroy() {
    this.input.detach();
  }
}
