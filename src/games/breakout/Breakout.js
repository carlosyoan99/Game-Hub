import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { circleIntersectsAABB, clamp } from '../../engine/CollisionUtils.js';

const PADDLE_WIDTH = 90;
const PADDLE_HEIGHT = 14;
const BALL_RADIUS = 7;
const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_HEIGHT = 22;
const BRICK_GAP = 4;
const BRICK_TOP_OFFSET = 50;

/**
 * Breakout
 * Implementa la Game Interface: init, update, render, handleResize, destroy.
 * Sirve como referencia de cómo debe verse cualquier juego nuevo del hub.
 */
export class Breakout {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('breakout');

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this.score = 0;
    this.lives = 3;
    this.highscore = this.storage.get('highscore', 0);
    this.status = 'playing'; // 'playing' | 'won' | 'lost'

    this._resetPaddleAndBall();
    this._buildBricks();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
  }

  _resetPaddleAndBall() {
    this.paddle = {
      x: this.width / 2 - PADDLE_WIDTH / 2,
      y: this.height - 30,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
    };
    this.ball = {
      x: this.width / 2,
      y: this.height - 50,
      radius: BALL_RADIUS,
      vx: 220,
      vy: -220,
    };
  }

  _buildBricks() {
    const brickWidth = (this.width - BRICK_GAP * (BRICK_COLS + 1)) / BRICK_COLS;
    this.bricks = [];
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        this.bricks.push({
          x: BRICK_GAP + col * (brickWidth + BRICK_GAP),
          y: BRICK_TOP_OFFSET + row * (BRICK_HEIGHT + BRICK_GAP),
          width: brickWidth,
          height: BRICK_HEIGHT,
          alive: true,
          hue: 190 + row * 25,
        });
      }
    }
  }

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }
      this.input.endFrame();
      return;
    }

    // Paleta: teclado o ratón, lo que se haya movido.
    if (this.input.isDown('ArrowLeft') || this.input.isDown('KeyA')) {
      this.paddle.x -= 360 * dt;
    }
    if (this.input.isDown('ArrowRight') || this.input.isDown('KeyD')) {
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

    // Bola vs paleta: el ángulo de rebote depende de dónde golpea (como el original).
    if (circleIntersectsAABB(this.ball, this.paddle) && this.ball.vy > 0) {
      const hitPos = (this.ball.x - this.paddle.x) / this.paddle.width; // 0..1
      const angle = (hitPos - 0.5) * (Math.PI / 3); // hasta ±60°
      const speed = Math.hypot(this.ball.vx, this.ball.vy);
      this.ball.vx = speed * Math.sin(angle);
      this.ball.vy = -Math.abs(speed * Math.cos(angle));
      this.ball.y = this.paddle.y - this.ball.radius;
    }

    // Bola vs ladrillos
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      if (circleIntersectsAABB(this.ball, brick)) {
        brick.alive = false;
        this.score += 10;
        // Rebote simple: decide eje por solapamiento mínimo.
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

    // Bola cae fuera del canvas
    if (this.ball.y - this.ball.radius > this.height) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this._endGame('lost');
      } else {
        this._resetPaddleAndBall();
      }
    }

    if (this.bricks.every((b) => !b.alive)) {
      this._endGame('won');
    }

    this.input.endFrame();
  }

  _endGame(status) {
    this.status = status;
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
  }

  _restart() {
    this.score = 0;
    this.lives = 3;
    this.status = 'playing';
    this._resetPaddleAndBall();
    this._buildBricks();
  }

  render(ctx) {
    // Fondo
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    // Ladrillos
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      ctx.fillStyle = `hsl(${brick.hue}, 65%, 55%)`;
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
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
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Puntos: ${this.score}`, 10, 10);
    ctx.fillText(`Vidas: ${this.lives}`, this.width - 90, 10);
    ctx.fillText(`Récord: ${this.highscore}`, this.width / 2 - 50, 10);

    if (this.status !== 'playing') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      const message = this.status === 'won' ? '¡GANASTE!' : 'GAME OVER';
      ctx.fillText(message, this.width / 2, this.height / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillText('Click o Espacio para reiniciar', this.width / 2, this.height / 2 + 15);
      ctx.textAlign = 'left';
    }
  }

  destroy() {
    this.input.detach();
  }
}
