import { GameBase } from '../../engine/GameBase.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { SeededRandom } from '../../engine/SeededRandom.js';

const COLS = 28;
const BASE_INTERVAL = 0.13;
const MIN_INTERVAL = 0.05;
const SPEED_INCREASE_PER_FOOD = 0.002; // cada comida acelera un poco

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * Snake en modo endless.
 * Sin niveles, sin obstáculos. Velocidad progresiva (más comida = más rápido).
 * La serpiente muere al chocar con bordes o consigo misma.
 */
export class Snake extends GameBase {
  init(engine) {
    super.init(engine, 'snake');
    this.highscore = this.storage.get('highscore', 0);

    this.cols = COLS;
    this.rows = Math.max(10, Math.floor((this.height / this.width) * COLS));

    this._restart();
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this.rows = Math.max(10, Math.floor((this.height / this.width) * this.cols));
  }

  _getSpeedLevel() {
    // 1-based speed level for display
    return 1 + Math.floor(this.score / 5);
  }

  _getMoveInterval() {
    const interval = BASE_INTERVAL - this.score * SPEED_INCREASE_PER_FOOD;
    return Math.max(MIN_INTERVAL, interval);
  }

  _restart() {
    this.rng = new SeededRandom();
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
    this._spawnFood();
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
      this.snake.some((s) => s.x === cell.x && s.y === cell.y)
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
    if (this.handleRestartInput()) return;

    this._handleDirectionInput();

    this.moveTimer += dt;
    if (this.moveTimer >= this._getMoveInterval()) {
      this.moveTimer -= this._getMoveInterval();
      this._step();
    }

    this.input.endFrame();
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

    this.snake.unshift(newHead);

    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      this.score += 1;
      AudioManager.sfx({ type: 'snake_eat', volume: 0.35 });
      HapticManager.vibrate('coin');
      this._spawnFood();
    } else {
      this.snake.pop();
    }
  }

  _endGame() {
    this.status = 'lost';
    AudioManager.sfx({ type: 'snake_die', volume: 0.5 });
    HapticManager.vibrate('explosion');
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
  }

  render(ctx) {
    const cellSize = this.width / this.cols;

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

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
    setupHUDContext(ctx);
    ctx.fillText(t('snake.score', { n: this.score }), 10, 10);
    ctx.fillText(t('snake.speed', { n: this._getSpeedLevel() }), 10, 28);
    ctx.fillText(t('snake.length', { n: this.snake.length }), 10, 46);

    ctx.fillText(t('game.record', { n: this.highscore }), this.width / 2 - 50, 10);

    if (this.status === 'lost') {
      renderOverlay(ctx, { width: this.width, height: this.height });
    }
  }

}
