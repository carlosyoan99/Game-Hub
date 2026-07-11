import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { pointInRect } from '../../engine/CollisionUtils.js';

/**
 * Papa's Pizzeria
 * Juego de gestión de tiempo: los clientes llegan en cola con pedidos
 * y el jugador debe preparar cada pizza siguiendo los pasos:
 *   tomar pedido → amasar → salsa → queso → topping(s) → hornear → servir
 *
 * Cada paso tiene un temporizador; si el cliente espera demasiado, se va.
 * Mecánica principal: colas + temporizadores + multitarea.
 */

// ─── Constantes ────────────────────────────────────────────────────────

const STEPS = ['order', 'dough', 'sauce', 'cheese', 'topping', 'bake', 'serve'];
const STEP_LABELS = {
  order: '📝 Tomar pedido',
  dough: '🔄 Amasar masa',
  sauce: '🍅 Poner salsa',
  cheese: '🧀 Añadir queso',
  topping: '🥓 Añadir topping',
  bake: '🔥 Hornear',
  serve: '🍕 Servir',
};
const STEP_TIME = {
  order: 1.2,
  dough: 2.0,
  sauce: 1.0,
  cheese: 1.0,
  topping: 1.5,
  bake: 3.0,
  serve: 0.8,
};

const TOPPINGS = ['Pepperoni', 'Champiñones', 'Pimiento', 'Cebolla', 'Aceituna'];
const MAX_QUEUE = 5;
const PATIENCE_BASE = 18; // segundos que espera un cliente antes de irse
const PATIENCE_CUSTOMER_VARIANCE = 4; // variación aleatoria ±
const SPAWN_INTERVAL_BASE = 7; // segundos entre llegadas
const SPAWN_INTERVAL_VARIANCE = 3;
const MAX_ANGER = 3; // clientes que se van = game over
const MONEY_PER_PIZZA = 10;
const TIP_PERFECT = 5; // propina extra si se sirve rápido (< 60% del tiempo de paciencia)

const STATION_COLS = 4;
const STATION_ROWS = 2;

// ─── Helper ────────────────────────────────────────────────────────────

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function makeOrder() {
  const numToppings = randomInt(1, 3);
  const shuffled = [...TOPPINGS].sort(() => Math.random() - 0.5);
  return {
    toppings: shuffled.slice(0, numToppings),
  };
}

// ─── Game Class ────────────────────────────────────────────────────────

export class PapaPizzeria {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('papa-pizzeria');

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.bestScore = this.storage.get('bestScore', 0);

    this._restart();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
  }

  _restart() {
    // Cola de clientes. Cada cliente: { order, patience, patienceMax, step, stepTimer, served }
    this.queue = [];
    this.currentCustomerIndex = 0; // índice en la cola del cliente que se está atendiendo

    this.money = 0;
    this.score = 0;
    this.anger = 0; // clientes perdidos
    this.spawnTimer = 0;
    this.totalServed = 0;
    this.status = 'playing'; // 'playing' | 'lost' | 'won'
    this.messageText = null;
    this.messageTimer = 0;

    this.spawnTimer = randomBetween(1, 3); // primer cliente llega pronto
    this._spawnCustomer();

    this._layoutStations();
  }

  _layoutStations() {
    const marginX = this.width * 0.05;
    const marginY = this.height * 0.36; // debajo del área de cola
    const gap = 10;
    const areaWidth = this.width - marginX * 2;
    const areaHeight = this.height * 0.56;
    const btnWidth = (areaWidth - gap * (STATION_COLS - 1)) / STATION_COLS;
    const btnHeight = (areaHeight - gap) / STATION_ROWS;

    this.stations = STEPS.map((step, i) => {
      const col = i % STATION_COLS;
      const row = Math.floor(i / STATION_COLS);
      return {
        step,
        label: STEP_LABELS[step],
        x: marginX + col * (btnWidth + gap),
        y: marginY + row * (btnHeight + gap),
        width: btnWidth,
        height: btnHeight,
      };
    });
  }

  // ─── Llegada de clientes ─────────────────────────────────────────────

  _spawnCustomer() {
    if (this.queue.length >= MAX_QUEUE) return;
    const patience = PATIENCE_BASE + randomBetween(-PATIENCE_CUSTOMER_VARIANCE, PATIENCE_CUSTOMER_VARIANCE);
    this.queue.push({
      order: makeOrder(),
      patience,
      patienceMax: patience,
      step: 0,
      stepTimer: 0,
      serving: false,
    });
  }

  // ─── Update ──────────────────────────────────────────────────────────

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) this._restart();
      this.input.endFrame();
      return;
    }

    // Spawn de nuevos clientes
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.queue.length < MAX_QUEUE) {
      this._spawnCustomer();
      this.spawnTimer = SPAWN_INTERVAL_BASE + randomBetween(-SPAWN_INTERVAL_VARIANCE, SPAWN_INTERVAL_VARIANCE);
    }

    // Actualizar temporizadores de clientes (iteración inversa para
    // que splice(i,1) no desplace índices no procesados)
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const c = this.queue[i];
      if (c.step >= STEPS.length) continue; // ya servido

      // Si está en proceso de un paso, avanzar el timer
      if (c.stepTimer > 0) {
        c.stepTimer -= dt;
        if (c.stepTimer <= 0) {
          c.stepTimer = 0;
          c.step += 1;

          if (c.step >= STEPS.length) {
            // Pizza completada — se sirve automáticamente
            this._serveCustomer(i);
          }
        }
      }

      // Paciencia: solo baja si el cliente no está siendo atendido actualmente
      // o si está esperando en cola (índice > 0 antes del actual)
      if (i > this.currentCustomerIndex || (i === this.currentCustomerIndex && c.stepTimer <= 0 && c.step < STEPS.length)) {
        c.patience -= dt;
      }

      // Cliente se va si se agotó su paciencia
      if (c.patience <= 0 && c.step >= 0) {
        this._customerLeft(i);
      }
    }

    // Input: click en estaciones
    if (this.input.mouse.clickedThisFrame) {
      this._handleClick(this.input.mouse.x, this.input.mouse.y);
    }

    this.input.endFrame();

    // Mensaje temporizado
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.messageText = null;
    }
  }

  _handleClick(x, y) {
    // Click en un cliente de la cola para seleccionarlo
    for (let i = 0; i < this.queue.length; i++) {
      const rect = this._customerRect(i);
      if (pointInRect(x, y, rect)) {
        this.currentCustomerIndex = i;
        return;
      }
    }

    // Click en una estación para el cliente actual
    const c = this.queue[this.currentCustomerIndex];
    if (!c || c.step >= STEPS.length || c.patience <= 0) return;

    for (const station of this.stations) {
      if (pointInRect(x, y, station)) {
        const stepIdx = STEPS.indexOf(station.step);
        if (stepIdx === c.step && c.stepTimer <= 0) {
          // Iniciar el temporizador del paso
          c.stepTimer = STEP_TIME[station.step];
        }
        return;
      }
    }
  }

  _serveCustomer(index) {
    const c = this.queue[index];
    this.money += MONEY_PER_PIZZA;

    const timeRatio = 1 - (c.patienceMax - c.patience) / c.patienceMax;
    const tip = timeRatio < 0.6 ? TIP_PERFECT : 0;
    this.money += tip;

    this.score += MONEY_PER_PIZZA + tip;
    this.totalServed += 1;

    this._showMessage(tip > 0 ? `+$${MONEY_PER_PIZZA + tip} (+propina!)` : `+$${MONEY_PER_PIZZA}`);

    c.step = -1; // marcado como servido, será eliminado
    c.patience = 0;

    // Reajustar índice antes de quitar de la cola
    if (index < this.currentCustomerIndex) {
      this.currentCustomerIndex -= 1;
    }
    this.queue.splice(index, 1);
    if (this.currentCustomerIndex >= this.queue.length) {
      this.currentCustomerIndex = Math.max(0, this.queue.length - 1);
    }

    // Victoria: servir suficiente pizzas
    if (this.totalServed >= 10) {
      this.status = 'won';
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        this.storage.set('bestScore', this.bestScore);
      }
    }
  }

  _customerLeft(index) {
    this.anger += 1;
    this._showMessage('Cliente se fue 😤');

    // Reajustar índice antes de quitar de la cola
    if (index < this.currentCustomerIndex) {
      this.currentCustomerIndex -= 1;
    }
    this.queue.splice(index, 1);
    if (this.currentCustomerIndex >= this.queue.length) {
      this.currentCustomerIndex = Math.max(0, this.queue.length - 1);
    }

    if (this.anger >= MAX_ANGER) {
      this.status = 'lost';
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        this.storage.set('bestScore', this.bestScore);
      }
    }
  }

  _showMessage(text) {
    this.messageText = text;
    this.messageTimer = 2.0;
  }

  _customerRect(index) {
    const gap = 6;
    const totalWidth = this.width * 0.9;
    const cardWidth = Math.min(120, (totalWidth - gap * (this.queue.length - 1)) / Math.max(1, this.queue.length));
    const x = this.width * 0.05 + index * (cardWidth + gap);
    const y = 50;
    const height = 100;
    return { x, y, width: cardWidth, height };
  }

  // ─── Render ──────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.status !== 'playing') {
      this._renderEndScreen(ctx);
      return;
    }

    // ── Barra superior: stats ──
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`🍕 Servidas: ${this.totalServed}/10`, 10, 10);
    ctx.fillText(`$${this.money}`, this.width / 2 - 20, 10);
    ctx.textAlign = 'right';
    ctx.fillText(`😤 Enfados: ${this.anger}/${MAX_ANGER}`, this.width - 10, 10);

    if (this.bestScore > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7c8894';
      ctx.font = '11px monospace';
      ctx.fillText(`Mejor puntuación: ${this.bestScore}`, this.width / 2, 28);
    }

    // ── Cola de clientes ──
    for (let i = 0; i < this.queue.length; i++) {
      this._renderCustomer(ctx, i);
    }

    if (this.queue.length === 0) {
      ctx.fillStyle = '#7c8894';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Esperando clientes...', this.width / 2, 95);
    }

    // ── Estaciones ──
    const activeCustomer = this.queue[this.currentCustomerIndex];
    for (const station of this.stations) {
      this._renderStation(ctx, station, activeCustomer);
    }

    // ── Mensaje ──
    if (this.messageText) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(this.width / 2 - 100, this.height - 40, 200, 32);
      ctx.fillStyle = '#e7edf3';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.messageText, this.width / 2, this.height - 24);
    }
  }

  _renderCustomer(ctx, index) {
    const c = this.queue[index];
    const rect = this._customerRect(index);
    const isActive = index === this.currentCustomerIndex;

    // Fondo
    ctx.fillStyle = isActive ? '#1e2a38' : '#11161d';
    ctx.strokeStyle = isActive ? '#ffb454' : '#1e2731';
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // Paciencia
    const pct = Math.max(0, c.patience / c.patienceMax);
    const barW = rect.width - 12;
    const barH = 8;
    const barX = rect.x + 6;
    const barY = rect.y + 6;

    ctx.fillStyle = '#1e2731';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = pct > 0.5 ? '#3a7d5c' : pct > 0.25 ? '#b48a3a' : '#8a3a3a';
    ctx.fillRect(barX, barY, barW * pct, barH);

    // Pedido
    ctx.fillStyle = '#e7edf3';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(c.order.toppings.join(', ') || 'Queso', rect.x + rect.width / 2, barY + barH + 4);

    // Paso actual
    const stepName = c.step >= 0 && c.step < STEPS.length ? STEP_LABELS[STEPS[c.step]].split(' ').slice(1).join(' ') : '';
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.fillText(stepName, rect.x + rect.width / 2, barY + barH + 20);

    // Timer del paso si está activo
    if (c.stepTimer > 0) {
      ctx.fillStyle = '#ffb454';
      ctx.font = '10px monospace';
      ctx.fillText(`${c.stepTimer.toFixed(1)}s`, rect.x + rect.width / 2, barY + barH + 34);
    }

    // Check si está servido
    if (c.step < 0) {
      ctx.fillStyle = '#3a7d5c';
      ctx.font = '16px monospace';
      ctx.fillText('✓', rect.x + rect.width / 2, rect.y + rect.height / 2);
    }
  }

  _renderStation(ctx, station, activeCustomer) {
    const isNext = activeCustomer && STEPS.indexOf(station.step) === activeCustomer.step && activeCustomer.stepTimer <= 0;
    const isActive = activeCustomer && STEPS.indexOf(station.step) === activeCustomer.step && activeCustomer.stepTimer > 0;

    ctx.fillStyle = isActive ? '#2a3a1a' : isNext ? '#1a2738' : '#11161d';
    ctx.strokeStyle = isActive ? '#5a8a3a' : isNext ? '#4a7abb' : '#1e2731';
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.fillRect(station.x, station.y, station.width, station.height);
    ctx.strokeRect(station.x, station.y, station.width, station.height);

    // Etiqueta
    ctx.fillStyle = isActive ? '#b8d4a0' : isNext ? '#b0c4e0' : '#7c8894';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(station.label, station.x + station.width / 2, station.y + station.height / 2 - 6);

    // Barra de progreso si está activa
    if (isActive) {
      const pct = 1 - activeCustomer.stepTimer / STEP_TIME[station.step];
      const bw = station.width - 16;
      const bx = station.x + 8;
      const by = station.y + station.height / 2 + 6;
      ctx.fillStyle = '#1e2731';
      ctx.fillRect(bx, by, bw, 6);
      ctx.fillStyle = '#ffb454';
      ctx.fillRect(bx, by, bw * pct, 6);
    }
  }

  _renderEndScreen(ctx) {
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    if (this.status === 'won') {
      ctx.fillText('🎉 ¡PIZZERÍA EN MARCHA!', this.width / 2, this.height / 2 - 40);
    } else {
      ctx.fillText('😤 DEMASIADOS CLIENTES PERDIDOS', this.width / 2, this.height / 2 - 40);
    }

    ctx.font = '15px monospace';
    ctx.fillText(`Pizzas servidas: ${this.totalServed}  |  Puntuación: ${this.score}`, this.width / 2, this.height / 2 + 2);
    ctx.fillText(`Mejor puntuación: ${this.bestScore}`, this.width / 2, this.height / 2 + 24);
    ctx.fillText('Click o Espacio para reiniciar', this.width / 2, this.height / 2 + 52);
    ctx.textAlign = 'left';
  }

  destroy() {
    this.input.detach();
  }
}
