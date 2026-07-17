import { GameBase } from '../../engine/GameBase.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { pointInRect } from '../../engine/CollisionUtils.js';
import { wrapText } from '../../engine/wrapText.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { t } from '../../engine/i18n.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';
import { icon } from '../../engine/IconRenderer.js';

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
const MAX_DAYS = 14;

// Escenas
const SCENES = {
  home: { nameKey: 'stick.scene.home', subtitleKey: 'stick.scene.subHome', actions: [
    { id: 'sleep', labelKey: 'stick.action.sleep', energyCost: 0 },
    { id: 'home_read', labelKey: 'stick.action.homeRead', energyCost: 15 },
  ], npcDialogueKey: 'stick.npc.home' },
  streets: { nameKey: 'stick.scene.streets', subtitleKey: 'stick.scene.subStreets', actions: [
    { id: 'walk', labelKey: 'stick.action.walk', energyCost: 10 },
    { id: 'panhandle', labelKey: 'stick.action.panhandle', energyCost: 20 },
  ], npcDialogueKey: 'stick.npc.streets' },
  gym: { nameKey: 'stick.scene.gym', subtitleKey: 'stick.scene.subGym', actions: [
    { id: 'light_weights', labelKey: 'stick.action.lightWeights', energyCost: 25 },
    { id: 'heavy_weights', labelKey: 'stick.action.heavyWeights', energyCost: 40 },
    { id: 'cardio', labelKey: 'stick.action.cardio', energyCost: 20 },
  ], npcDialogueKey: 'stick.npc.gym' },
  library: { nameKey: 'stick.scene.library', subtitleKey: 'stick.scene.subLibrary', actions: [
    { id: 'read_book', labelKey: 'stick.action.readBook', energyCost: 20 },
    { id: 'study', labelKey: 'stick.action.study', energyCost: 35 },
    { id: 'research', labelKey: 'stick.action.research', energyCost: 25 },
  ], npcDialogueKey: 'stick.npc.library' },
  job: { nameKey: 'stick.scene.job', subtitleKey: 'stick.scene.subJob', actions: [
    { id: 'work_part', labelKey: 'stick.action.workPart', energyCost: 30 },
    { id: 'work_full', labelKey: 'stick.action.workFull', energyCost: 50 },
    { id: 'overtime', labelKey: 'stick.action.overtime', energyCost: 70 },
  ], npcDialogueKey: 'stick.npc.job' },
  shop: { nameKey: 'stick.scene.shop', subtitleKey: 'stick.scene.subShop', actions: [
    { id: 'buy_food', labelKey: 'stick.action.buyFood', energyCost: 0 },
    { id: 'buy_drink', labelKey: 'stick.action.buyDrink', energyCost: 0 },
    { id: 'buy_vitamins', labelKey: 'stick.action.buyVitamins', energyCost: 0, moneyCost: 20 },
    { id: 'buy_books', labelKey: 'stick.action.buyBooks', energyCost: 0, moneyCost: 8 },
  ], npcDialogueKey: 'stick.npc.shop' },
  park: { nameKey: 'stick.scene.park', subtitleKey: 'stick.scene.subPark', actions: [
    { id: 'park_relax', labelKey: 'stick.action.parkRelax', energyCost: 15 },
    { id: 'park_find', labelKey: 'stick.action.parkFind', energyCost: 20 },
  ], npcDialogueKey: 'stick.npc.park' },
  market: { nameKey: 'stick.scene.market', subtitleKey: 'stick.scene.subMarket', actions: [
    { id: 'market_trade', labelKey: 'stick.action.marketTrade', energyCost: 25 },
    { id: 'market_job', labelKey: 'stick.action.marketJob', energyCost: 30 },
  ], npcDialogueKey: 'stick.npc.market' },
};

const SCENE_CONNECTIONS = {
  home: ['streets'],
  streets: ['home', 'gym', 'library', 'job', 'shop', 'park', 'market'],
  gym: ['streets'],
  library: ['streets'],
  job: ['streets'],
  shop: ['streets'],
  park: ['streets'],
  market: ['streets'],
};

// Eventos aleatorios (ampliados)
const RANDOM_EVENTS = [
  { textKey: 'stick.event.goldCoin', effect: (p) => { p.money += 10; } },
  { textKey: 'stick.event.rain', effect: null },
  { textKey: 'stick.event.music', effect: (p) => { p.charisma += 1; } },
  { textKey: 'stick.event.newspaper', effect: (p) => { p.intelligence += 1; } },
  { textKey: 'stick.event.dog', effect: (p) => { p.strength += 1; } },
  { textKey: 'stick.event.gift', effect: (p) => { p.money += 5; } },
  { textKey: 'stick.event.nightmare', effect: (p) => { p.energy = Math.max(0, p.energy - 10); } },
  { textKey: 'stick.event.lottery', effect: (p) => { p.money += 20; } },
  { textKey: 'stick.event.mentor', effect: (p) => { p.intelligence += 2; } },
  { textKey: 'stick.event.pickpocket', effect: (p) => { p.money -= 5; p.charisma -= 1; } },
  { textKey: 'stick.event.freeSample', effect: (p) => { p.energy = Math.min(100, p.energy + 15); } },
  { textKey: 'stick.event.argue', effect: (p) => { p.strength += 1; p.charisma -= 1; } },
  { textKey: 'stick.event.medal', effect: (p) => { p.strength += 2; } },
];

// Diálogos NPC adicionales por escena (variedad)
const NPC_DIALOGUES = {
  home: [
    'Mamá: "¡Hola, cariño! ¿Has estado comiendo bien?"',
    'Mamá: "He preparado tu plato favorito para cenar."',
    'Hermano pequeño: "Oye, ¿me enseñas a hacer ese juego?"',
    'Papá: "El periódico de hoy tiene buenas ofertas de trabajo."',
    'Vecino: "¿Podrías cuidar a mi gato este fin de semana?"',
  ],
  streets: [
    'Extraño: "Oye, ¿tienes hora? ... Bah, da igual."',
    'Mendigo: "Una moneda, por favor. Que tengas buen día."',
    'Turista: "Disculpe, ¿cómo llego al museo?"',
    'Repartidor: "¡Aparta! ¡Pedidos urgentes!"',
    'Anciana: "Los jóvenes de hoy... en mis tiempos todo era más barato."',
    'Artista callejero: "¿Quieres un retrato? Solo $5."',
  ],
  gym: [
    'Entrenador: "¡Sin dolor no hay ganancia!"',
    'Chica musculosa: "¿Primera vez? No te rindas."',
    'Viejo sabio: "La constancia es más importante que la fuerza."',
    'Adolescente: "Mi récord son 100 flexiones. ¿Y el tuyo?"',
  ],
  library: [
    'Bibliotecaria: "Shhh..."',
    'Estudiante: "¿Entiendes esto de física cuántica? Yo tampoco."',
    'Señor mayor: "Leo aquí desde que abrieron. Me sé todos los libros."',
    'Niña: "¿Me recomiendas un libro de aventuras?"',
  ],
  job: [
    'Jefe: "Buen trabajo hoy."',
    'Compañero: "¿Viste el partido anoche? Increíble."',
    'Compañera: "¿ Puedes cubrir mi turno mañana? Te invito un café."',
    'Cliente: "¡Excelente servicio! Voy a dejar una reseña."',
  ],
  shop: [
    'Dependiente: "Tenemos ofertas hoy."',
    'Dueño: "Llevo 30 años aquí. Nunca vi algo igual."',
    'Cliente: "¿Crees que esto le gustará a mi esposa?"',
    'Reponedor: "Los nuevos productos llegaron esta mañana."',
  ],
  park: [
    'Anciano: "He visto cosas maravillosas en este parque."',
    'Jardinero: "Estas rosas las planté yo hace 10 años."',
    'Niño: "¡Mira, un pato! ¡Quiero tocarlo!"',
    'Corredor: "¿Cuántos kilómetros llevas? Yo voy por 5."',
  ],
  market: [
    'Vendedor: "¡Llévelo, llévelo! ¡Todo está más caro!"',
    'Pescadero: "¡Pescado fresco! ¡Hoy lo pesqué yo mismo!"',
    'Señora: "Siempre regateo, es parte de la diversión."',
    'Músico: "Toco aquí todos los días. Es mi escenario."',
  ],
};

// ─── Game Class ────────────────────────────────────────────────────────

export class StickRPG extends GameBase {
  init(engine) {
    super.init(engine, 'stick-rpg');
    this.bestDay = this.storage.get('bestDay', 0);

    this._restart();
  }

  _defaultBindings() {
    return {
      navigateUp:    ['ArrowUp', 'KeyW', 'GamepadUp', 'GamepadLStickUp'],
      navigateDown:  ['ArrowDown', 'KeyS', 'GamepadDown', 'GamepadLStickDown'],
      navigateLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      navigateRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      select:        ['Space', 'Enter', 'GamepadA'],
      back:          ['Escape', 'GamepadB'],
      restart:       ['Space', 'GamepadStart', 'GamepadA'],
    };
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this._updateSceneActions();
  }

  _restart() {
    this.startTime = Date.now();
    this.rng = new SeededRandom();
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
    this.focusMode = 'actions'; // 'actions' | 'navigation'
    this.focusIndex = 0;

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
      label: SCENES[sceneKey].nameKey,
      x: navStartX + i * (navBtnW + navGap),
      y: navY,
      width: navBtnW,
      height: 30,
    }));
  }

  // ─── Update ──────────────────────────────────────────────────────────

  _recordProgressionPlay(won) {
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('stick-rpg', this.player?.day || 0, won, duration);
    if (this.player?.day >= 1) ProgressionManager.checkAchievement('stick-rpg', 'first-day');
    if (this.player?.money >= 10000) ProgressionManager.checkAchievement('stick-rpg', 'stick-rich');
    if (this.player?.day >= 30) ProgressionManager.checkAchievement('stick-rpg', 'rpg-legend');
  }

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.wasActionPressed('restart') || this.input.mouse.clickedThisFrame) this._restart();

      return;
    }

    // Diálogo temporizado
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.dialogueText = null;
    }

    // ── Input: gamepad / teclado ──
    if (this.input.wasActionPressed('navigateUp')) {
      if (this.focusMode === 'actions' && this.focusIndex > 0) this.focusIndex--;
    }
    if (this.input.wasActionPressed('navigateDown')) {
      if (this.focusMode === 'actions' && this.focusIndex < this.actionButtons.length - 1) this.focusIndex++;
    }
    if (this.input.wasActionPressed('navigateLeft') || this.input.wasActionPressed('navigateRight')) {
      if (this.navButtons.length > 0) {
        if (this.focusMode === 'navigation') {
          if (this.input.wasActionPressed('navigateLeft') && this.focusIndex > 0) this.focusIndex--;
          else if (this.input.wasActionPressed('navigateRight') && this.focusIndex < this.navButtons.length - 1) this.focusIndex++;
        } else {
          this.focusMode = 'navigation';
          this.focusIndex = 0;
        }
      }
    }
    if (this.input.wasActionPressed('back') && this.focusMode === 'navigation') {
      this.focusMode = 'actions';
      this.focusIndex = 0;
    }

    if (this.input.wasActionPressed('select')) {
      if (this.focusMode === 'actions' && this.actionButtons[this.focusIndex]) {
        this._performAction(this.actionButtons[this.focusIndex].action);
      } else if (this.focusMode === 'navigation' && this.navButtons[this.focusIndex]) {
        this._goToScene(this.navButtons[this.focusIndex].sceneKey);
      }
    }

    if (this.input.mouse.clickedThisFrame) {
      this._handleClick(this.input.mouse.x, this.input.mouse.y);
      // Al hacer click con el ratón, sincronizar el foco
      this._syncFocusFromMouse(this.input.mouse.x, this.input.mouse.y);
    }

    this.input.endFrame();
  }

  _syncFocusFromMouse(x, y) {
    // Sincroniza el foco gamepad según la posición del ratón
    for (let i = 0; i < this.actionButtons.length; i++) {
      if (pointInRect(x, y, this.actionButtons[i])) {
        this.focusMode = 'actions';
        this.focusIndex = i;
        return;
      }
    }
    for (let i = 0; i < this.navButtons.length; i++) {
      if (pointInRect(x, y, this.navButtons[i])) {
        this.focusMode = 'navigation';
        this.focusIndex = i;
        return;
      }
    }
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
    // Cada día, algunas acciones pueden no estar disponibles (variedad)
    if (this.rng.next() < 0.08 && action.id !== 'sleep') {
      this._showDialogue(t('stick.dialogue.closed', { action: t(action.labelKey) }));
      return;
    }

    const energyCost = action.energyCost || 0;

    // Compras: verificamos dinero
    if (action.moneyCost && this.player.money < action.moneyCost) {
      this._showDialogue(t('stick.dialogue.noMoney'));
      return;
    }

    // Verificar energía
    if (energyCost > this.player.energy) {
      this._showDialogue(t('stick.dialogue.tired'));
      return;
    }

    // Ejecutar acción específica
    this.player.energy -= energyCost;

    switch (action.id) {
      case 'sleep':
        this.player.energy = Math.min(MAX_ENERGY, this.player.energy + SLEEP_ENERGY_RESTORE);
        this.player.day += 1;
        this._showDialogue(t('stick.dialogue.sleep', { n: this.player.day }));
        AudioManager.sfx({ type: 'powerup', volume: 0.3 });
        this._checkWinCondition();
        break;
      case 'home_read':
        this.player.intelligence += 1;
        AudioManager.sfx({ type: 'select', volume: 0.25 });
        this._showDialogue(t('stick.dialogue.homeRead'));
        break;
      case 'walk':
        this.player.charisma += 1;
        this._showDialogue(t('stick.dialogue.walk'));
        break;
      case 'panhandle':
        const earned = this.rng.nextInt(2, 5);
        this.player.money += earned;
        AudioManager.sfx({ type: 'stick_buy', volume: 0.25 });
        this._showDialogue(t('stick.dialogue.panhandle', { n: earned }));
        break;
      case 'light_weights':
        this.player.strength += 1;
        this._showDialogue(t('stick.dialogue.lightWeights'));
        break;
      case 'heavy_weights':
        this.player.strength += 2;
        this._showDialogue(t('stick.dialogue.heavyWeights'));
        break;
      case 'cardio':
        this.player.strength += 1;
        this.player.charisma += 1;
        this._showDialogue(t('stick.dialogue.cardio'));
        break;
      case 'read_book':
        this.player.intelligence += 2;
        this._showDialogue(t('stick.dialogue.readBook'));
        break;
      case 'study':
        this.player.intelligence += 3;
        this._showDialogue(t('stick.dialogue.study'));
        break;
      case 'research':
        this.player.intelligence += 1;
        this.player.money += 5;
        this._showDialogue(t('stick.dialogue.research'));
        break;
      case 'work_part':
        this.player.money += 15;
        this._showDialogue(t('stick.dialogue.workPart'));
        break;
      case 'work_full':
        this.player.money += 25;
        this._showDialogue(t('stick.dialogue.workFull'));
        break;
      case 'overtime':
        this.player.money += 40;
        this._showDialogue(t('stick.dialogue.overtime'));
        break;
      case 'buy_food':
        this.player.energy = Math.min(MAX_ENERGY, this.player.energy + 10);
        this.player.money -= 5;
        AudioManager.sfx({ type: 'select', volume: 0.25 });
        this._showDialogue(t('stick.dialogue.buyFood'));
        break;
      case 'buy_drink':
        this.player.energy = Math.min(MAX_ENERGY, this.player.energy + 5);
        this.player.money -= 3;
        AudioManager.sfx({ type: 'select', volume: 0.25 });
        this._showDialogue(t('stick.dialogue.buyDrink'));
        break;
      case 'buy_vitamins':
        this.player.money -= 20;
        this.player.strength += 2;
        this.player.intelligence += 2;
        this.player.charisma += 2;
        AudioManager.sfx({ type: 'stick_buy', volume: 0.35 });
        HapticManager.vibrate('coin');
        this._showDialogue(t('stick.dialogue.buyVitamins'));
        break;
      case 'buy_books':
        this.player.money -= 8;
        this.player.intelligence += 3;
        AudioManager.sfx({ type: 'stick_buy', volume: 0.25 });
        this._showDialogue(t('stick.dialogue.buyBooks'));
        break;
    }

    this._checkDeathCondition();
  }

  _showDialogue(text) {
    this.dialogueText = text;
    this.dialogueTimer = 3.5;
  }

  _getRandomNpcDialogue(sceneKey) {
    const dialogues = NPC_DIALOGUES[sceneKey];
    if (!dialogues || dialogues.length === 0) return t(SCENES[sceneKey].npcDialogueKey);
    // Usar el día como semilla de selección para que cambie cada día
    const dayOffset = (this.player.day - 1) * 3;
    const index = (this.rng.nextInt(0, dialogues.length - 1) + dayOffset) % dialogues.length;
    return dialogues[index];
  }

  _goToScene(sceneKey) {
    this.currentScene = sceneKey;
    this.dialogueText = this._getRandomNpcDialogue(sceneKey);
    this.dialogueTimer = 3.5;
    this._updateSceneActions();

    // Evento aleatorio al entrar a una escena (30% de probabilidad)
    if (this.rng.next() < 0.3) {
      const evt = RANDOM_EVENTS[this.rng.nextInt(0, RANDOM_EVENTS.length - 1)];
      if (evt.effect) evt.effect(this.player);
      this._showDialogue(t(evt.textKey));
    }
  }

  _checkWinCondition() {
    // Evento aleatorio al despertar
    if (this.rng.next() < 0.4) {
      const evt = RANDOM_EVENTS[this.rng.nextInt(0, RANDOM_EVENTS.length - 1)];
      if (evt.effect) evt.effect(this.player);
      this._showDialogue(t(evt.textKey));
    }

    // Victoria: sobrevivir 14 días o alcanzar stats altas
    const statsTotal = this.player.strength + this.player.intelligence + this.player.charisma;
    if (this.player.day >= MAX_DAYS || statsTotal >= 40) {
      this.status = 'won';
      this._recordProgressionPlay(true);
      AudioManager.sfx({ type: 'powerup', volume: 0.6 });
      HapticManager.vibrate('powerup');
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
      this._recordProgressionPlay(false);
      this.gameOverReason = t('stick.dialogue.bankrupt');
      AudioManager.sfx({ type: 'stick_fight', volume: 0.5 });
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
    ctx.fillText(t(scene.nameKey), 12, 10);

    ctx.fillStyle = '#7c8894';
    ctx.font = '11px monospace';
    ctx.fillText(t(scene.subtitleKey), 12, 34);

    // Stats en la esquina superior derecha
    const p = this.player;
    const statsText = `${t('stick.label.day', { n: p.day })}  ⚡${p.energy}/${MAX_ENERGY}  ${t('stick.label.money', { n: p.money })}`;
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(statsText, this.width - 12, 12);

    // Stats secundarias con iconos SVG
    ctx.font = '10px monospace';
    ctx.fillStyle = '#7c8894';
    const statsSecX = this.width - 12;
    icon(ctx, 'muscle', statsSecX, 37, 12, '#b48a3a');
    ctx.fillText(`${p.strength} `, statsSecX + 8, 30);
    icon(ctx, 'brain', statsSecX + 40, 37, 12, '#4a7abb');
    ctx.fillText(`${p.intelligence} `, statsSecX + 48, 30);
    icon(ctx, 'chat', statsSecX + 80, 37, 12, '#3a9a5a');
    ctx.fillText(`${p.charisma}`, statsSecX + 88, 30);

    ctx.textAlign = 'left';
    ctx.font = '10px monospace';
    ctx.fillStyle = '#7c8894';


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
      ctx.fillText(t('stick.label.npc'), 18, dlgY + 6);

      ctx.fillStyle = '#e7edf3';
      ctx.font = '13px monospace';
      wrapText(ctx, this.dialogueText, 18, dlgY + 22, this.width - 40, 18);
    }

    // ── Acciones ──
    const firstActionY = this.height * 0.35;
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.fillText(t('stick.label.actions'), 12, firstActionY - 12);

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
      ctx.fillText(t(action.labelKey), btn.x + 10, btn.y + btn.height / 2);

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
    ctx.fillText(t('stick.label.go'), this.width / 2, navLabelY);
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
      ctx.fillText(t(btn.label), btn.x + btn.width / 2, btn.y + btn.height / 2);
    }
    ctx.textAlign = 'left';
  }

  _renderEndScreen(ctx) {
    const title = this.status === 'won' ? t('stick.end.won') : t('stick.end.lost');
    const subtitle = this.gameOverReason || null;
    renderOverlay(ctx, {
      width: this.width, height: this.height,
      title,
      subtitle,
      actionText: t('game.restart'),
    });

    // Líneas extra de stats después del overlay
    const p = this.player;
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statsY = this.height / 2 + 60;
    ctx.fillText(
      `${t('stick.label.day', { n: p.day })} | 💪${p.strength} 📖${p.intelligence} 🗣️${p.charisma} | ${t('stick.label.money', { n: p.money })}`,
      this.width / 2, statsY,
    );
    ctx.fillText(t('stick.end.bestDay', { n: this.bestDay }), this.width / 2, statsY + 20);
    ctx.textAlign = 'left';
  }



}
