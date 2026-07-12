import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { circleIntersectsAABB } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { SeededRandom } from '../../engine/SeededRandom.js';

const GRAVITY = 900;
const FLAP_IMPULSE = -320;
const BIRD_RADIUS = 12;
const BIRD_X_RATIO = 0.3;
const PIPE_WIDTH = 60;
const MAX_LEVEL = 5;

/** Puntuación necesaria para avanzar de nivel. Aumenta con cada nivel. */
const SCORE_TO_ADVANCE = [5, 7, 9, 11, 15];

/** Configuración por nivel: velocidad de tuberías, gap, intervalo de spawn. */
const LEVELS = [
  { pipeSpeed: 180, pipeGapRatio: 1.0, pipeInterval: 1.4, labelKey: 'level.easy' },
  { pipeSpeed: 200, pipeGapRatio: 0.93, pipeInterval: 1.3, labelKey: 'level.medium' },
  { pipeSpeed: 220, pipeGapRatio: 0.86, pipeInterval: 1.2, labelKey: 'level.hard' },
  { pipeSpeed: 245, pipeGapRatio: 0.79, pipeInterval: 1.1, labelKey: 'level.expert' },
  { pipeSpeed: 270, pipeGapRatio: 0.72, pipeInterval: 1.0, labelKey: 'level.impossible' },
];

/**
 * Flappy Bird con sistema de 5 niveles: velocidad y gap de tuberías
 * progresivos, puntuación objetivo para avanzar al siguiente nivel.
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

  _computePipeMetrics() {
    this.basePipeGap = Math.min(150, Math.max(70, this.height * 0.4));
    this.pipeMargin = Math.min(60, this.height * 0.15);
  }

  _getLevelConfig() {
    return LEVELS[Math.min(this.currentLevel - 1, LEVELS.length - 1)];
  }

  _getTargetScore() {
    return SCORE_TO_ADVANCE[Math.min(this.currentLevel - 1, SCORE_TO_ADVANCE.length - 1)];
  }

  _restart() {
    this.rng = new SeededRandom();
    this.seedCode = SeededRandom.encode(this.rng.seed);
    this.currentLevel = 1;
    this.bird = {
      x: this.width * BIRD_X_RATIO,
      y: this.height / 2,
      vy: 0,
      radius: BIRD_RADIUS,
    };
    this.pipes = [];
    this.spawnTimer = 0;
    this.score = 0;
    this.totalScore = 0;
    this.status = 'playing'; // 'playing' | 'level-complete' | 'won' | 'lost'
  }

  update(dt) {
    const flapPressed =
      this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame || this.input.wasPressed('ArrowUp');

    if (this.status === 'level-complete') {
      if (flapPressed) this._nextLevel();
      this.input.endFrame();
      return;
    }

    if (this.status === 'won' || this.status === 'lost') {
      if (flapPressed) this._restart();
      this.input.endFrame();
      return;
    }

    if (flapPressed) {
      this.bird.vy = FLAP_IMPULSE;
      AudioManager.sfx({ type: 'jump', volume: 0.3 });
    }

    this.bird.vy += GRAVITY * dt;
    this.bird.y += this.bird.vy * dt;

    this._updatePipes(dt);
    this._checkCollisions();

    this.input.endFrame();
  }

  _nextLevel() {
    this.currentLevel++;
    this.bird.y = this.height / 2;
    this.bird.vy = 0;
    this.pipes = [];
    this.spawnTimer = 0;
    this.score = 0;
    this.status = 'playing';
  }

  _updatePipes(dt) {
    const cfg = this._getLevelConfig();

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = cfg.pipeInterval;
      this._spawnPipe();
    }

    for (const pipe of this.pipes) {
      pipe.x -= cfg.pipeSpeed * dt;
      if (!pipe.passed && pipe.x + PIPE_WIDTH < this.bird.x) {
        pipe.passed = true;
        this.score += 1;
        this.totalScore += 10;
        AudioManager.sfx({ type: 'coin', volume: 0.3 });
        HapticManager.vibrate('coin');

        // Comprobar si completa el nivel
        if (this.score >= this._getTargetScore()) {
          if (this.currentLevel >= MAX_LEVEL) {
            this.status = 'won';
            AudioManager.sfx({ type: 'powerup', volume: 0.5 });
            HapticManager.vibrate('powerup');
            if (this.totalScore > this.highscore) {
              this.highscore = this.totalScore;
              this.storage.set('highscore', this.highscore);
            }
          } else {
            this.status = 'level-complete';
            AudioManager.sfx({ type: 'powerup', volume: 0.5 });
            HapticManager.vibrate('powerup');
          }
        }
      }
    }

    this.pipes = this.pipes.filter((pipe) => pipe.x + PIPE_WIDTH > 0);
  }

  _spawnPipe() {
    const cfg = this._getLevelConfig();
    const margin = this.pipeMargin;
    const gap = this.basePipeGap * cfg.pipeGapRatio;
    const availableRange = Math.max(0, this.height - margin * 2 - gap);
    const gapCenter = margin + this.rng.nextFloat(0, availableRange) + gap / 2;
    this.pipes.push({ x: this.width, gapCenter, passed: false });
  }

  _checkCollisions() {
    if (this.bird.y - this.bird.radius < 0 || this.bird.y + this.bird.radius > this.height) {
      this._endGame();
      return;
    }

    for (const pipe of this.pipes) {
      const topRect = { x: pipe.x, y: 0, width: PIPE_WIDTH, height: pipe.gapCenter - this.basePipeGap * this._getLevelConfig().pipeGapRatio / 2 };
      const bottomY = pipe.gapCenter + this.basePipeGap * this._getLevelConfig().pipeGapRatio / 2;
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
    if (this.totalScore > this.highscore) {
      this.highscore = this.totalScore;
      this.storage.set('highscore', this.highscore);
    }
  }

  render(ctx) {
    const cfg = this._getLevelConfig();

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    // Tuberías
    ctx.fillStyle = '#3a7d5c';
    for (const pipe of this.pipes) {
      const gap = this.basePipeGap * cfg.pipeGapRatio;
      const topHeight = pipe.gapCenter - gap / 2;
      const bottomY = pipe.gapCenter + gap / 2;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topHeight);
      ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, this.height - bottomY);

      // Detalle de borde en tuberías
      ctx.fillStyle = '#2a5c4a';
      ctx.fillRect(pipe.x - 3, topHeight - 20, PIPE_WIDTH + 6, 20);
      ctx.fillRect(pipe.x - 3, bottomY, PIPE_WIDTH + 6, 20);
      ctx.fillStyle = '#3a7d5c';
    }

    // Pájaro (color variable según nivel)
    const hue = 40 + this.currentLevel * 20;
    ctx.save();
    ctx.translate(this.bird.x, this.bird.y);
    ctx.rotate(clampTiltAngle(this.bird.vy));
    ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
    ctx.beginPath();
    ctx.arc(0, 0, this.bird.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // HUD
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(t('flappy.level', { n: this.currentLevel, max: MAX_LEVEL, label: t(cfg.labelKey) }), 10, 10);
    ctx.fillText(t('flappy.score', { n: this.score, target: this._getTargetScore() }), 10, 28);
    ctx.fillText(t('flappy.total', { n: this.totalScore }), 10, 46);
    ctx.fillText(t('game.seed', { seed: this.seedCode }), 10, 64);
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
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      if (this.status === 'won') {
        ctx.fillText(t('flappy.gameComplete'), this.width / 2, this.height / 2 - 30);
        ctx.font = '16px monospace';
        ctx.fillText(t('flappy.finalScore', { n: this.totalScore }), this.width / 2, this.height / 2 + 5);
      } else {
        ctx.fillText(t('game.gameOver'), this.width / 2, this.height / 2 - 20);
      }
      ctx.font = '16px monospace';
      ctx.fillText(t('game.restart'), this.width / 2, this.height / 2 + 30);
      ctx.textAlign = 'left';
    }
  }

  destroy() {
    this.input.detach();
  }
}

function clampTiltAngle(vy) {
  const maxAngle = Math.PI / 4;
  return Math.max(-maxAngle, Math.min(maxAngle, vy / 500));
}
