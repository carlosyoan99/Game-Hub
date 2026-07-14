
import { GameBase } from '../../engine/GameBase.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { circleIntersectsAABB } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { SeededRandom } from '../../engine/SeededRandom.js';

const GRAVITY = 900;
const FLAP_IMPULSE = -320;
const BIRD_RADIUS = 12;
const BIRD_X_RATIO = 0.3;
const PIPE_WIDTH = 60;
const BASE_PIPE_SPEED = 180;
const BASE_PIPE_INTERVAL = 1.4;
const SPEED_INCREASE_PER_POINT = 6; // velocidad +6 por cada punto
const GAP_DECREASE_PER_POINT = 1.5; // gap -1.5px por cada punto
const MIN_GAP = 60;

/**
 * Flappy Bird en modo endless.
 * Sin niveles. Velocidad y dificultad progresan con cada punto.
 */
export class FlappyBird extends GameBase {
  init(engine) {
    super.init(engine, 'flappy-bird');
    this.highscore = this.storage.get('highscore', 0);
    this._computePipeMetrics();

    this._restart();
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this._computePipeMetrics();
  }

  _computePipeMetrics() {
    this.basePipeGap = Math.min(160, Math.max(80, this.height * 0.42));
    this.pipeMargin = Math.min(60, this.height * 0.15);
  }

  _getPipeSpeed() {
    return BASE_PIPE_SPEED + this.score * SPEED_INCREASE_PER_POINT;
  }

  _getPipeGap() {
    return Math.max(MIN_GAP, this.basePipeGap - this.score * GAP_DECREASE_PER_POINT);
  }

  _getPipeInterval() {
    return Math.max(0.8, BASE_PIPE_INTERVAL - this.score * 0.02);
  }

  _restart() {
    this.rng = new SeededRandom();
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

    if (this.status === 'lost') {
      if (flapPressed) this._restart();
      this.input.endFrame();
      return;
    }

    if (flapPressed) {
      this.bird.vy = FLAP_IMPULSE;
      AudioManager.sfx({ type: 'flappy_flap', volume: 0.3 });
    }

    this.bird.vy += GRAVITY * dt;
    this.bird.y += this.bird.vy * dt;

    this._updatePipes(dt);
    this._checkCollisions();

    this.input.endFrame();
  }

  _updatePipes(dt) {
    const speed = this._getPipeSpeed();

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this._getPipeInterval();
      this._spawnPipe();
    }

    for (const pipe of this.pipes) {
      pipe.x -= speed * dt;
      if (!pipe.passed && pipe.x + PIPE_WIDTH < this.bird.x) {
        pipe.passed = true;
        this.score += 1;
        AudioManager.sfx({ type: 'flappy_score', volume: 0.3 });
        HapticManager.vibrate('coin');

        // Actualizar highscore si se superó
        if (this.score > this.highscore) {
          this.highscore = this.score;
          this.storage.set('highscore', this.highscore);
        }
      }
    }

    this.pipes = this.pipes.filter((pipe) => pipe.x + PIPE_WIDTH > 0);
  }

  _spawnPipe() {
    const margin = this.pipeMargin;
    const gap = this._getPipeGap();
    const availableRange = Math.max(0, this.height - margin * 2 - gap);
    const gapCenter = margin + this.rng.next() * availableRange + gap / 2;
    this.pipes.push({ x: this.width, gapCenter, passed: false });
  }

  _checkCollisions() {
    if (this.bird.y - this.bird.radius < 0 || this.bird.y + this.bird.radius > this.height) {
      this._endGame();
      return;
    }

    const gap = this._getPipeGap();
    for (const pipe of this.pipes) {
      const topRect = { x: pipe.x, y: 0, width: PIPE_WIDTH, height: pipe.gapCenter - gap / 2 };
      const bottomY = pipe.gapCenter + gap / 2;
      const bottomRect = { x: pipe.x, y: bottomY, width: PIPE_WIDTH, height: this.height - bottomY };

      if (circleIntersectsAABB(this.bird, topRect) || circleIntersectsAABB(this.bird, bottomRect)) {
        this._endGame();
        return;
      }
    }
  }

  _endGame() {
    this.status = 'lost';
    AudioManager.sfx({ type: 'explosion', volume: 0.4 });
    HapticManager.vibrate('explosion');
    // Highscore ya se actualiza al pasar cada tubería en _updatePipes()
  }

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    // Tuberías
    const gap = this._getPipeGap();
    ctx.fillStyle = '#3a7d5c';
    for (const pipe of this.pipes) {
      const topHeight = pipe.gapCenter - gap / 2;
      const bottomY = pipe.gapCenter + gap / 2;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topHeight);
      ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, this.height - bottomY);

      ctx.fillStyle = '#2a5c4a';
      ctx.fillRect(pipe.x - 3, topHeight - 20, PIPE_WIDTH + 6, 20);
      ctx.fillRect(pipe.x - 3, bottomY, PIPE_WIDTH + 6, 20);
      ctx.fillStyle = '#3a7d5c';
    }

    // Pájaro (color varía con la puntuación para feedback visual)
    const hue = 200 + Math.min(this.score * 5, 160);
    ctx.save();
    ctx.translate(this.bird.x, this.bird.y);
    ctx.rotate(clampTiltAngle(this.bird.vy));
    ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
    ctx.beginPath();
    ctx.arc(0, 0, this.bird.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // HUD
    setupHUDContext(ctx);
    ctx.fillText(t('flappy.score', { n: this.score }), 10, 10);
    ctx.fillText(t('flappy.best', { n: this.highscore }), 10, 28);

    if (this.status === 'lost') {
      renderOverlay(ctx, { width: this.width, height: this.height, score: this.score });
    }
  }

}

function clampTiltAngle(vy) {
  const maxAngle = Math.PI / 4;
  return Math.max(-maxAngle, Math.min(maxAngle, vy / 500));
}
