import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';

const COLS = 28;
const MOVE_INTERVAL = 0.11; // segundos entre pasos de la cuadrícula; menor = más rápido

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * Snake
 * A diferencia de Breakout (movimiento continuo), aquí el estado avanza
 * en "pasos" discretos sobre una cuadrícula: dt se acumula en moveTimer
 * y solo se ejecuta un _step() cuando se supera MOVE_INTERVAL. El render
 * sigue corriendo a la tasa del engine para que no se sienta entrecortado.
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

    // cols/rows se fijan una vez al iniciar; si el canvas cambia de tamaño
    // (ver handleResize) solo se reescala el pixel por celda, no la
    // cuadrícula lógica, para no invalidar la partida en curso.
    this.cols = COLS;
    this.rows = Math.max(10, Math.floor((this.height / this.width) * COLS));

    this._restart();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
    // Intencionalmente no se toca cols/rows/snake aquí: ver comentario en init().
  }

  _restart() {
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
    do {
      cell = {
        x: Math.floor(Math.random() * this.cols),
        y: Math.floor(Math.random() * this.rows),
      };
    } while (this.snake.some((s) => s.x === cell.x && s.y === cell.y));
    this.food = cell;
  }

  _handleDirectionInput() {
    // Un solo disparo por pulsación (wasPressed, no isDown) y solo se
    // permite girar en el eje perpendicular al actual: evita que la
    // serpiente se invierta sobre su propio cuello.
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

    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }
      this.input.endFrame();
      return;
    }

    this.moveTimer += dt;
    if (this.moveTimer >= MOVE_INTERVAL) {
      this.moveTimer -= MOVE_INTERVAL;
      this._step();
    }

    this.input.endFrame();
  }

  _step() {
    this.direction = this.pendingDirection;
    const head = this.snake[0];
    const newHead = { x: head.x + this.direction.x, y: head.y + this.direction.y };

    if (newHead.x < 0 || newHead.x >= this.cols || newHead.y < 0 || newHead.y >= this.rows) {
      this._endGame();
      return;
    }

    if (this.snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      this._endGame();
      return;
    }

    this.snake.unshift(newHead);

    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      this.score += 10;
      this._spawnFood();
    } else {
      this.snake.pop();
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
    const cellSize = this.width / this.cols;

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#ffb454';
    ctx.fillRect(this.food.x * cellSize, this.food.y * cellSize, cellSize, cellSize);

    this.snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#e7edf3' : '#9aa7b2';
      ctx.fillRect(seg.x * cellSize + 1, seg.y * cellSize + 1, cellSize - 2, cellSize - 2);
    });

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
