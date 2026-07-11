import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { circleIntersectsAABB } from '../../engine/CollisionUtils.js';

const GRAVITY = 900; // px/s^2
const FLAP_IMPULSE = -320; // px/s (negativo = hacia arriba)
const BIRD_RADIUS = 12;
const BIRD_X_RATIO = 0.3; // posición horizontal fija del pájaro, proporcional al ancho

const PIPE_WIDTH = 60;
const PIPE_GAP = 150;
const PIPE_SPEED = 180; // px/s
const PIPE_INTERVAL = 1.4; // segundos entre tuberías

/**
 * FlappyBird
 * A diferencia de Pong/Breakout (rebotes), aquí no hay colisión elástica:
 * la física es gravedad constante + un impulso instantáneo al pulsar. El
 * "scroll infinito" no mueve el mundo, mueve las tuberías hacia la
 * izquierda y las recicla cuando salen del canvas.
 */
export class FlappyBird {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('flappy-bird');

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.highscore = this.storage.get('highscore', 0);
    this._computePipeMetrics();

    this._restart();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
    this._computePipeMetrics();
  }

  /**
   * PIPE_GAP/margen fijos en píxeles asumían un canvas de escritorio; en
   * un móvil en vertical el hub puede darle a este juego un canvas de
   * ~220px de alto, donde margin*2 + PIPE_GAP ya no cabe y el hueco de
   * la tubería sale con altura negativa (colisión rota, no solo un bug
   * visual). Se escalan ambos valores a la altura real disponible.
   */
  _computePipeMetrics() {
    this.pipeGap = Math.min(PIPE_GAP, Math.max(70, this.height * 0.4));
    this.pipeMargin = Math.min(60, this.height * 0.15);
  }

  _restart() {
    this.bird = {
      x: this.width * BIRD_X_RATIO,
      y: this.height / 2,
      vy: 0,
      radius: BIRD_RADIUS,
    };
    this.pipes = [];
    this.spawnTimer = 0;
    this.score = 0;
    this.status = 'playing';
  }

  update(dt) {
    const flapPressed =
      this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame || this.input.wasPressed('ArrowUp');

    if (this.status !== 'playing') {
      if (flapPressed) this._restart();
      this.input.endFrame();
      return;
    }

    if (flapPressed) this.bird.vy = FLAP_IMPULSE;

    this.bird.vy += GRAVITY * dt;
    this.bird.y += this.bird.vy * dt;

    this._updatePipes(dt);
    this._checkCollisions();

    this.input.endFrame();
  }

  _updatePipes(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = PIPE_INTERVAL;
      this._spawnPipe();
    }

    for (const pipe of this.pipes) {
      pipe.x -= PIPE_SPEED * dt;
      if (!pipe.passed && pipe.x + PIPE_WIDTH < this.bird.x) {
        pipe.passed = true;
        this.score += 1;
      }
    }

    // Reciclado: cualquier tubería que salió por la izquierda se descarta.
    this.pipes = this.pipes.filter((pipe) => pipe.x + PIPE_WIDTH > 0);
  }

  _spawnPipe() {
    const margin = this.pipeMargin;
    const gap = this.pipeGap;
    const availableRange = Math.max(0, this.height - margin * 2 - gap);
    const gapCenter = margin + Math.random() * availableRange + gap / 2;
    this.pipes.push({ x: this.width, gapCenter, passed: false });
  }

  _checkCollisions() {
    if (this.bird.y - this.bird.radius < 0 || this.bird.y + this.bird.radius > this.height) {
      this._endGame();
      return;
    }

    for (const pipe of this.pipes) {
      const topRect = { x: pipe.x, y: 0, width: PIPE_WIDTH, height: pipe.gapCenter - this.pipeGap / 2 };
      const bottomY = pipe.gapCenter + this.pipeGap / 2;
      const bottomRect = { x: pipe.x, y: bottomY, width: PIPE_WIDTH, height: this.height - bottomY };

      if (circleIntersectsAABB(this.bird, topRect) || circleIntersectsAABB(this.bird, bottomRect)) {
        this._endGame();
        return;
      }
    }
  }

  _endGame() {
    this.status = 'lost';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
  }

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#3a7d5c';
    for (const pipe of this.pipes) {
      const topHeight = pipe.gapCenter - this.pipeGap / 2;
      const bottomY = pipe.gapCenter + this.pipeGap / 2;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topHeight);
      ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, this.height - bottomY);
    }

    ctx.save();
    ctx.translate(this.bird.x, this.bird.y);
    ctx.rotate(clampTiltAngle(this.bird.vy));
    ctx.fillStyle = '#ffb454';
    ctx.beginPath();
    ctx.arc(0, 0, this.bird.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#9aa7b2';
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Puntos: ${this.score}`, 10, 10);
    ctx.fillText(`Récord: ${this.highscore}`, this.width / 2 - 50, 10);

    if (this.status !== 'playing') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillText('Click o Espacio para reiniciar', this.width / 2, this.height / 2 + 15);
      ctx.textAlign = 'left';
    }
  }

  destroy() {
    this.input.detach();
  }
}

/** Inclina el pájaro según su velocidad vertical: puro efecto visual, no afecta la física. */
function clampTiltAngle(vy) {
  const maxAngle = Math.PI / 4;
  return Math.max(-maxAngle, Math.min(maxAngle, vy / 500));
}
