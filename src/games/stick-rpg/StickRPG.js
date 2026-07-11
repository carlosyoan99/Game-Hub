import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { pointInRect } from '../../engine/CollisionUtils.js';

/**
 * Stick RPG (versión simple)
 * Juego de simulación con sistema de días/energía, diálogos con NPCs
 * y cambio de escenas en un mapa urbano.
 *
 * El jugador puede moverse entre escenas (Home, Streets, Gym, Library,
 * Job, Shop). Cada escena tiene actividades que consumen energía y
 * otorgan dinero o mejoran estadísticas (fuerza, inteligencia, carisma).
 * Dormir en casa regenera energía y avanza al día siguiente.
 *
 * Mecánica principal: días + energía + diálogos + cambio de escenas.
 */

// ─── Constantes ────────────────────────────────────────────────────────

const MAX_ENERGY = 100;
const START_MONEY = 20;
const SLEEP_ENERGY_RESTORE = 100;
const STARTING_DAY = 1;

// Escenas
const SCENES = {
  home: {
    name: '🏠 Casa',
    subtitle: 'Tu hogar — descansa y recupérate',
    actions: [
      { id: 'sleep', label: '😴 Dormir (recupera energía → día siguiente)', energyCost: 0 },
      { id: 'home_read', label: '📖 Leer revistas viejas (+1 inteligencia)', energyCost: 15 },
    ],
    npcDialogue: 'Mamá: "¡Hola, cariño! ¿Has estado comiendo bien?"',
  },
  streets: {
    name: '🏙️ Calles',
    subtitle: 'El centro de la ciudad — conecta con todo',
    actions: [
      { id: 'walk', label: '🚶 Caminar (+1 carisma)', energyCost: 10 },
      { id: 'panhandle', label: '🪙 Pedir monedas (+$2-$5)', energyCost: 20 },
    ],
    npcDialogue: 'Extraño: "Oye, ¿tienes hora? ... Bah, da igual."',
  },
  gym: {
    name: '💪 Gimnasio',
    subtitle: 'Pesa, corre, suda — todo duele',
    actions: [
      { id: 'light_weights', label: '🏋️ Pesas ligeras (+1 fuerza, $0)', energyCost: 25 },
      { id: 'heavy_weights', label: '🏋️‍♂️ Pesas pesadas (+2 fuerza, $0)', energyCost: 40 },
      { id: 'cardio', label: '🏃 Cardio (+1 fuerza, +1 carisma)', energyCost: 20 },
    ],
    npcDialogue: 'Entrenador: "¡Sin dolor no hay ganancia! Bueno, tampoco exageres."',
  },
  library: {
    name: '📚 Biblioteca',
    subtitle: 'Silencio — el conocimiento espera',
    actions: [
      { id: 'read_book', label: '📕 Leer un libro (+2 inteligencia)', energyCost: 20 },
      { id: 'study', label: '✏️ Estudiar (+3 inteligencia)', energyCost: 35 },
      { id: 'research', label: '🔍 Investigar (+1 inteligencia, +$5)', energyCost: 25 },
    ],
    npcDialogue: 'Bibliotecaria: "Shhh... Este libro sobre bootstraping es fascinante."',
  },
  job: {
    name: '💼 Trabajo',
    subtitle: 'Gana dinero — la rutina diaria',
    actions: [
      { id: 'work_part', label: '🛠️ Trabajo parcial (+$15)', energyCost: 30 },
      { id: 'work_full', label: '🔨 Trabajo completo (+$25)', energyCost: 50 },
      { id: 'overtime', label: '⏰ Horas extra (+$40)', energyCost: 70 },
    ],
    npcDialogue: 'Jefe: "Buen trabajo hoy. No llegues tarde mañana."',
  },
  shop: {
    name: '🛒 Tienda',
    subtitle: 'Gasta tu dinero... o solo mira',
    actions: [
      { id: 'buy_food', label: '🥪 Comprar comida (+10 energía, -$5)', energyCost: 0 },
      { id: 'buy_drink', label: '🧃 Comprar bebida (+5 energía, -$3)', energyCost: 0 },
      { id: 'buy_vitamins', label: '💊 Vitaminas (+2 a todas las stats)', energyCost: 0, moneyCost: 20 },
      { id: 'buy_books', label: '📚 Libros usados (+3 inteligencia)', energyCost: 0, moneyCost: 8 },
    ],
    npcDialogue: 'Dependiente: "Tenemos ofertas hoy. Bueno, siempre tenemos las mismas ofertas."',
  },
};

const SCENE_KEYS = Object.keys(SCENES);

// Conexiones entre escenas (grafo simple)
const SCENE_CONNECTIONS = {
  home: ['streets'],
  streets: ['home', 'gym', 'library', 'job', 'shop'],
  gym: ['streets'],
  library: ['streets'],
  job: ['streets'],
  shop: ['streets'],
};

// ─── Game Class ────────────────────────────────────────────────────────

export class StickRPG {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('stick-rpg');

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.bestDay = this.storage.get('bestDay', 0);

    this._restart();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
  }

  _restart() {
    this.player = {
      energy: MAX_ENERGY,
      money: START_MONEY,
      strength: 1,
      intelligence: 1,
      charisma: 1,
      day: STARTING_DAY,
    };

    this.currentScene = 'home';
    this.dialogueText = null;
    this.dialogueTimer = 0;
    this.status = 'playing'; // 'playing' | 'won' | 'lost'
    this.gameOverReason = null;

    this._updateSceneActions();
  }

  _updateSceneActions() {
    const scene = SCENES[this.currentScene];
    const marginX = this.width * 0.08;
    const actionAreaTop = this.height * 0.35;
    const actionAreaBottom = this.height * 0.88;
    const areaH = actionAreaBottom - actionAreaTop;
    const gap = 8;

    const totalGap = gap * (scene.actions.length - 1);
    const btnH = Math.min(44, (areaH - totalGap) / Math.max(1, scene.actions.length));

    this.actionButtons = scene.actions.map((action, i) => ({
      action,
      x: marginX,
      y: actionAreaTop + i * (btnH + gap),
      width: this.width - marginX * 2,
      height: btnH,
    }));

    // Botones de navegación (escenas conectadas)
    const connections = SCENE_CONNECTIONS[this.currentScene] || [];
    const navGap = 8;
    const navBtnW = 90;
    const totalNavW = connections.length * navBtnW + (connections.length - 1) * navGap;
    const navStartX = (this.width - totalNavW) / 2;
    const navY = this.height * 0.91;

    this.navButtons = connections.map((sceneKey, i) => ({
      sceneKey,
      label: SCENES[sceneKey].name,
      x: navStartX + i * (navBtnW + navGap),
      y: navY,
      width: navBtnW,
      height: 30,
    }));
  }

  // ─── Update ──────────────────────────────────────────────────────────

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) this._restart();
      this.input.endFrame();
      return;
    }

    // Diálogo temporizado
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.dialogueText = null;
    }

    if (this.input.mouse.clickedThisFrame) {
      this._handleClick(this.input.mouse.x, this.input.mouse.y);
    }

    this.input.endFrame();
  }

  _handleClick(x, y) {
    // Click en botón de acción
    for (const btn of this.actionButtons) {
      if (pointInRect(x, y, btn)) {
        this._performAction(btn.action);
        return;
      }
    }

    // Click en botón de navegación
    for (const btn of this.navButtons) {
      if (pointInRect(x, y, btn)) {
        this._goToScene(btn.sceneKey);
        return;
      }
    }
  }

  _performAction(action) {
    const energyCost = action.energyCost || 0;

    // Compras: verificamos dinero
    if (action.moneyCost && this.player.money < action.moneyCost) {
      this._showDialogue('❌ No tienes suficiente dinero.');
      return;
    }

    // Verificar energía
    if (energyCost > this.player.energy) {
      this._showDialogue('😴 Demasiado cansado. Vuelve a casa a dormir.');
      return;
    }

    // Ejecutar acción específica
    this.player.energy -= energyCost;

    switch (action.id) {
      case 'sleep':
        this.player.energy = Math.min(MAX_ENERGY, this.player.energy + SLEEP_ENERGY_RESTORE);
        this.player.day += 1;
        this._showDialogue(`☀️ Día ${this.player.day}. ¡ Energía al máximo!`);
        this._checkWinCondition();
        break;
      case 'home_read':
        this.player.intelligence += 1;
        this._showDialogue('📖 Encontraste un artículo fascinante sobre... bueno, algo.');
        break;
      case 'walk':
        this.player.charisma += 1;
        this._showDialogue('🚶 Saliste a caminar. Saludaste a 3 personas.');
        break;
      case 'panhandle':
        const earned = Math.floor(Math.random() * 4) + 2;
        this.player.money += earned;
        this._showDialogue(`🪙 Alguien te dio $${earned}. No es mucho, pero algo es algo.`);
        break;
      case 'light_weights':
        this.player.strength += 1;
        this._showDialogue('🏋️ Pesas ligeras. Mañana dolerá.');
        break;
      case 'heavy_weights':
        this.player.strength += 2;
        this._showDialogue('🏋️‍♂️ ¡Casi no puedes levantar los brazos! +2 fuerza.');
        break;
      case 'cardio':
        this.player.strength += 1;
        this.player.charisma += 1;
        this._showDialogue('🏃 Corriste 20 minutos. Te sientes más fuerte y con más confianza.');
        break;
      case 'read_book':
        this.player.intelligence += 2;
        this._showDialogue('📕 Libro interesante. +2 inteligencia.');
        break;
      case 'study':
        this.player.intelligence += 3;
        this._showDialogue('✏️ Estudio intenso. +3 inteligencia.');
        break;
      case 'research':
        this.player.intelligence += 1;
        this.player.money += 5;
        this._showDialogue('🔍 Investigación remunerada: +1 inteligencia, +$5.');
        break;
      case 'work_part':
        this.player.money += 15;
        this._showDialogue('🛠️ $15 por medio día de trabajo.');
        break;
      case 'work_full':
        this.player.money += 25;
        this._showDialogue('🔨 Jornada completa: $25.');
        break;
      case 'overtime':
        this.player.money += 40;
        this._showDialogue('⏰ Horas extra: $40. Estás agotado.');
        break;
      case 'buy_food':
        this.player.energy = Math.min(MAX_ENERGY, this.player.energy + 10);
        this.player.money -= 5;
        this._showDialogue('🥪 Comida comprada. +10 energía, -$5.');
        break;
      case 'buy_drink':
        this.player.energy = Math.min(MAX_ENERGY, this.player.energy + 5);
        this.player.money -= 3;
        this._showDialogue('🧃 Bebida energética. +5 energía, -$3.');
        break;
      case 'buy_vitamins':
        this.player.money -= 20;
        this.player.strength += 2;
        this.player.intelligence += 2;
        this.player.charisma += 2;
        this._showDialogue('💊 Vitaminas: +2 a todas las stats.');
        break;
      case 'buy_books':
        this.player.money -= 8;
        this.player.intelligence += 3;
        this._showDialogue('📚 Libros usados: +3 inteligencia.');
        break;
    }

    this._checkDeathCondition();
  }

  _showDialogue(text) {
    this.dialogueText = text;
    this.dialogueTimer = 3.5;
  }

  _goToScene(sceneKey) {
    this.currentScene = sceneKey;
    this.dialogueText = SCENES[sceneKey].npcDialogue;
    this.dialogueTimer = 3.5;
    this._updateSceneActions();
  }

  _checkWinCondition() {
    // Victoria: sobrevivir 7 días o alcanzar stats altas
    const statsTotal = this.player.strength + this.player.intelligence + this.player.charisma;
    if (this.player.day >= 7 || statsTotal >= 30) {
      this.status = 'won';
      if (this.player.day > this.bestDay) {
        this.bestDay = this.player.day;
        this.storage.set('bestDay', this.bestDay);
      }
    }
  }

  _checkDeathCondition() {
    // No se muere por energía 0 — solo no puede hacer acciones
    // Pero si el dinero es negativo (no debería pasar, pero por si acaso)
    if (this.player.money < 0) {
      this.status = 'lost';
      this.gameOverReason = '💸 Te quedaste sin dinero.';
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.status !== 'playing') {
      this._renderEndScreen(ctx);
      return;
    }

    const scene = SCENES[this.currentScene];

    // ── Encabezado: escena y stats ──
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(scene.name, 12, 10);

    ctx.fillStyle = '#7c8894';
    ctx.font = '11px monospace';
    ctx.fillText(scene.subtitle, 12, 34);

    // Stats en la esquina superior derecha
    const p = this.player;
    const statsText = `Día ${p.day}  ⚡${p.energy}/${MAX_ENERGY}  💰$${p.money}`;
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(statsText, this.width - 12, 12);

    // Stats secundarias
    ctx.font = '10px monospace';
    ctx.fillStyle = '#7c8894';
    ctx.fillText(`💪${p.strength}  📖${p.intelligence}  🗣️${p.charisma}`, this.width - 12, 30);

    ctx.textAlign = 'left';

    // ── Línea decorativa ──
    ctx.strokeStyle = '#1e2731';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, 52);
    ctx.lineTo(this.width - 10, 52);
    ctx.stroke();

    // ── Diálogo NPC ──
    if (this.dialogueText) {
      ctx.fillStyle = 'rgba(11, 15, 20, 0.85)';
      const dlgY = 60;
      const dlgH = 56;
      ctx.fillRect(10, dlgY, this.width - 20, dlgH);
      ctx.strokeStyle = '#2a3a4a';
      ctx.strokeRect(10, dlgY, this.width - 20, dlgH);

      // Pequeño indicador de quién habla
      ctx.fillStyle = '#ffb454';
      ctx.font = '10px monospace';
      ctx.fillText('NPC:', 18, dlgY + 6);

      ctx.fillStyle = '#e7edf3';
      ctx.font = '13px monospace';
      this._wrapText(ctx, this.dialogueText, 18, dlgY + 22, this.width - 40, 18);
    }

    // ── Acciones ──
    const firstActionY = this.height * 0.35;
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.fillText('— ACCIONES —', 12, firstActionY - 12);

    for (const btn of this.actionButtons) {
      const action = btn.action;
      const canAfford = !action.moneyCost || this.player.money >= action.moneyCost;
      const hasEnergy = !action.energyCost || this.player.energy >= action.energyCost;
      const isDisabled = !canAfford || !hasEnergy || this.status !== 'playing';

      ctx.fillStyle = isDisabled ? '#0d1117' : '#11161d';
      ctx.strokeStyle = isDisabled ? '#1a1f26' : '#1e2731';
      ctx.lineWidth = 1;
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

      // Si es la acción de dormir, destacarla
      if (action.id === 'sleep') {
        ctx.strokeStyle = '#3a5a3a';
        ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
      }

      ctx.fillStyle = isDisabled ? '#4a5058' : '#e7edf3';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(action.label, btn.x + 10, btn.y + btn.height / 2);

      // Coste a la derecha
      const costs = [];
      if (action.energyCost > 0) {
        const color = this.player.energy >= action.energyCost ? '#b48a3a' : '#8a3a3a';
        ctx.fillStyle = color;
        costs.push(`⚡${action.energyCost}`);
      }
      if (action.moneyCost > 0) {
        const color = this.player.money >= action.moneyCost ? '#3a7d5c' : '#8a3a3a';
        ctx.fillStyle = color;
        costs.push(`$${action.moneyCost}`);
      }
      if (costs.length > 0) {
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(costs.join(' '), btn.x + btn.width - 10, btn.y + btn.height / 2);
      }
    }

    // ── Navegación ──
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const navLabelY = this.navButtons.length > 0 ? this.navButtons[0].y - 12 : this.height - 30;
    ctx.fillText('— IR A —', this.width / 2, navLabelY);
    ctx.textAlign = 'left';

    for (const btn of this.navButtons) {
      const isCurrent = btn.sceneKey === this.currentScene;
      ctx.fillStyle = isCurrent ? '#1e2a38' : '#11161d';
      ctx.strokeStyle = '#1e2731';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

      ctx.fillStyle = '#9aa7b2';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2);
    }
    ctx.textAlign = 'left';
  }

  _renderEndScreen(ctx) {
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    if (this.status === 'won') {
      ctx.fillText('🏆 ¡RPG COMPLETADO!', this.width / 2, this.height / 2 - 50);
    } else {
      ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 50);
      if (this.gameOverReason) {
        ctx.font = '16px monospace';
        ctx.fillText(this.gameOverReason, this.width / 2, this.height / 2 - 20);
      }
    }

    const p = this.player;
    ctx.font = '14px monospace';
    ctx.fillText(
      `Día ${p.day} | 💪${p.strength} 📖${p.intelligence} 🗣️${p.charisma} | 💰$${p.money}`,
      this.width / 2, this.height / 2 + 8,
    );
    ctx.fillText(`Mejor día alcanzado: ${this.bestDay}`, this.width / 2, this.height / 2 + 30);
    ctx.fillText('Click o Espacio para reiniciar', this.width / 2, this.height / 2 + 56);
    ctx.textAlign = 'left';
  }

  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let offsetY = y;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, offsetY);
        line = word;
        offsetY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, offsetY);
  }

  destroy() {
    this.input.detach();
  }
}
