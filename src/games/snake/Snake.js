import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { SeededRandom } from '../../engine/SeededRandom.js';

const COLS = 28;
const MAX_LEVEL = 5;
const SCORE_TO_ADVANCE = 30; // comida necesaria por nivel

/** Configuración por nivel: intervalo de movimiento y número de obstáculos. */
const LEVELS = [
  { moveInterval: 0.11, obstacles: 0, labelKey: 'level.easy' },
  { moveInterval: 0.10, obstacles: 4, labelKey: 'level.medium' },
  { moveInterval: 0.09, obstacles: 6, labelKey: 'level.hard' },
  { moveInterval: 0.08, obstacles: 8, labelKey: 'level.expert' },
  { moveInterval: 0.07, obstacles: 12, labelKey: 'level.impossible' },
];

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * Snake con sistema de 5 niveles: obstáculos, velocidad progresiva,
 * y puntuación objetivo para avanzar al siguiente nivel.
 */
export class Snake {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('snake');

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.highscore = this.storage.get('highscore', 0);

    this.cols = COLS;
    this.rows = Math.max(10, Math.floor((this.height / this.width) * COLS));

    this._restart();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
    this.rows = Math.max(10, Math.floor((this.height / this.width) * this.cols));
  }

  _getLevelConfig() {
    return LEVELS[Math.min(this.currentLevel - 1, LEVELS.length - 1)];
  }

  _restart() {
    this.rng = new SeededRandom();
    this.seedCode = SeededRandom.encode(this.rng.seed);
    const startX = Math.floor(this.cols / 2);
    const startY = Math.floor(this.rows / 2);
    this.currentLevel = 1;
    this.totalScore = 0;
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    this.direction = { ...DIRECTIONS.right };
    this.pendingDirection = { ...DIRECTIONS.right };
    this.score = 0;
    this.status = 'playing'; // 'playing' | 'level-complete' | 'won' | 'lost'
    this.moveTimer = 0;
    this.obstacles = [];
    this._buildObstacles();
    this._spawnFood();
  }

  _buildObstacles() {
    const cfg = this._getLevelConfig();
    this.obstacles = [];
    for (let i = 0; i < cfg.obstacles; i++) {
      let cell;
      let attempts = 0;
      do {
        cell = {
          x: 2 + this.rng.nextInt(0, this.cols - 4),
          y: 2 + this.rng.nextInt(0, this.rows - 4),
        };
        attempts++;
      } while (
        attempts < 50 &&
        (this.snake.some((s) => s.x === cell.x && s.y === cell.y) ||
          this.obstacles.some((o) => o.x === cell.x && o.y === cell.y) ||
          (Math.abs(cell.x - this.snake[0].x) < 3 && Math.abs(cell.y - this.snake[0].y) < 3))
      );
      this.obstacles.push(cell);
    }
  }

  _spawnFood() {
    let cell;
    let attempts = 0;
    do {
      cell = {
        x: this.rng.nextInt(0, this.cols),
        y: this.rng.nextInt(0, this.rows),
      };
      attempts++;
    } while (
      attempts < 100 &&
      (this.snake.some((s) => s.x === cell.x && s.y === cell.y) ||
        this.obstacles.some((o) => o.x === cell.x && o.y === cell.y))
    );
    this.food = cell;
  }

  _handleDirectionInput() {
    if ((this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) && this.direction.y === 0) {
      this.pendingDirection = { ...DIRECTIONS.up };
    } else if ((this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) && this.direction.y === 0) {
      this.pendingDirection = { ...DIRECTIONS.down };
    } else if ((this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) && this.direction.x === 0) {
      this.pendingDirection = { ...DIRECTIONS.left };
    } else if ((this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) && this.direction.x === 0) {
      this.pendingDirection = { ...DIRECTIONS.right };
    }
  }

  update(dt) {
    this._handleDirectionInput();

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

    this.moveTimer += dt;
    const cfg = this._getLevelConfig();
    if (this.moveTimer >= cfg.moveInterval) {
      this.moveTimer -= cfg.moveInterval;
      this._step();
    }

    this.input.endFrame();
  }

  _nextLevel() {
    this.currentLevel++;
    // Reset snake to starting position but keep total score
    const startX = Math.floor(this.cols / 2);
    const startY = Math.floor(this.rows / 2);
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    this.direction = { ...DIRECTIONS.right };
    this.pendingDirection = { ...DIRECTIONS.right };
    this.score = 0;
    this.status = 'playing';
    this.moveTimer = 0;
    this._buildObstacles();
    this._spawnFood();
  }

  _step() {
    this.direction = this.pendingDirection;
    const head = this.snake[0];
    const newHead = { x: head.x + this.direction.x, y: head.y + this.direction.y };

    // Colisión con bordes
    if (newHead.x < 0 || newHead.x >= this.cols || newHead.y < 0 || newHead.y >= this.rows) {
      this._endGame();
      return;
    }

    // Colisión con sí misma
    if (this.snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      this._endGame();
      return;
    }

    // Colisión con obstáculos
    if (this.obstacles.some((o) => o.x === newHead.x && o.y === newHead.y)) {
      this._endGame();
      return;
    }

    this.snake.unshift(newHead);

    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      this.score += 1;
      this.totalScore += 10;
      AudioManager.sfx({ type: 'coin', volume: 0.35 });
      HapticManager.vibrate('coin');
      if (this.score >= SCORE_TO_ADVANCE && this.currentLevel < MAX_LEVEL) {
        this.status = 'level-complete';
        AudioManager.sfx({ type: 'powerup', volume: 0.5 });
        HapticManager.vibrate('powerup');
      } else if (this.currentLevel >= MAX_LEVEL && this.score >= SCORE_TO_ADVANCE) {
        this._endGame('won');
      } else {
        this._spawnFood();
      }
    } else {
      this.snake.pop();
    }
  }

  _endGame(type) {
    this.status = type || 'lost';
    AudioManager.sfx({ type: 'explosion', volume: 0.5 });
    HapticManager.vibrate('explosion');
    if (this.totalScore > this.highscore) {
      this.highscore = this.totalScore;
      this.storage.set('highscore', this.highscore);
    }
  }

  render(ctx) {
    const cellSize = this.width / this.cols;
    const cfg = this._getLevelConfig();

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    // Obstáculos
    for (const obs of this.obstacles) {
      ctx.fillStyle = '#8a3a3a';
      ctx.fillRect(obs.x * cellSize, obs.y * cellSize, cellSize, cellSize);
      ctx.fillStyle = '#6a2a2a';
      ctx.fillRect(obs.x * cellSize + 1, obs.y * cellSize + 1, cellSize - 2, cellSize - 2);
    }

    // Comida
    ctx.fillStyle = '#ffb454';
    ctx.beginPath();
    ctx.arc(this.food.x * cellSize + cellSize / 2, this.food.y * cellSize + cellSize / 2, cellSize / 2 - 1, 0, Math.PI * 2);
    ctx.fill();

    // Serpiente
    this.snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#e7edf3' : '#9aa7b2';
      ctx.fillRect(seg.x * cellSize + 1, seg.y * cellSize + 1, cellSize - 2, cellSize - 2);
    });

    // HUD
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(t('snake.level', { n: this.currentLevel, max: MAX_LEVEL, label: t(cfg.labelKey) }), 10, 10);
    ctx.fillText(t('snake.food', { n: this.score, target: SCORE_TO_ADVANCE }), 10, 28);
    ctx.fillText(t('snake.total', { n: this.totalScore }), 10, 46);
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
        ctx.fillText(t('snake.gameComplete'), this.width / 2, this.height / 2 - 30);
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
