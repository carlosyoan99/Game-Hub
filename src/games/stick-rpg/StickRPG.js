import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { pointInRect } from '../../engine/CollisionUtils.js';
import { wrapText } from '../../engine/wrapText.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { t } from '../../engine/i18n.js';

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

const SCENE_KEYS = Object.keys(SCENES);

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

// Eventos aleatorios
const RANDOM_EVENTS = [
  { textKey: 'stick.event.goldCoin', effect: (p) => { p.money += 10; } },
  { textKey: 'stick.event.rain', effect: null },
  { textKey: 'stick.event.music', effect: (p) => { p.charisma += 1; } },
  { textKey: 'stick.event.newspaper', effect: (p) => { p.intelligence += 1; } },
  { textKey: 'stick.event.dog', effect: (p) => { p.strength += 1; } },
  { textKey: 'stick.event.gift', effect: (p) => { p.money += 5; } },
  { textKey: 'stick.event.nightmare', effect: (p) => { p.energy = Math.max(0, p.energy - 10); } },
];

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
    this._updateSceneActions();
  }

  _restart() {
    this.rng = new SeededRandom();
    this.seedCode = SeededRandom.encode(this.rng.seed);
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
      label: SCENES[sceneKey].nameKey,
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
        AudioManager.sfx({ type: 'coin', volume: 0.25 });
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
        AudioManager.sfx({ type: 'coin', volume: 0.35 });
        HapticManager.vibrate('coin');
        this._showDialogue(t('stick.dialogue.buyVitamins'));
        break;
      case 'buy_books':
        this.player.money -= 8;
        this.player.intelligence += 3;
        AudioManager.sfx({ type: 'coin', volume: 0.25 });
        this._showDialogue(t('stick.dialogue.buyBooks'));
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
    this.dialogueText = t(SCENES[sceneKey].npcDialogueKey);
    this.dialogueTimer = 3.5;
    this._updateSceneActions();
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
      this.gameOverReason = t('stick.dialogue.bankrupt');
      AudioManager.sfx({ type: 'hit', volume: 0.5 });
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

    // Stats secundarias
    ctx.font = '10px monospace';
    ctx.fillStyle = '#7c8894';
    ctx.fillText(`💪${p.strength}  📖${p.intelligence}  🗣️${p.charisma}`, this.width - 12, 30);

    ctx.textAlign = 'left';
    ctx.font = '10px monospace';
    ctx.fillStyle = '#7c8894';
    ctx.fillText(t('game.seed', { seed: this.seedCode }), 12, 48);

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
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    if (this.status === 'won') {
      ctx.fillText(t('stick.end.won'), this.width / 2, this.height / 2 - 50);
    } else {
      ctx.fillText(t('stick.end.lost'), this.width / 2, this.height / 2 - 50);
      if (this.gameOverReason) {
        ctx.font = '16px monospace';
        ctx.fillText(this.gameOverReason, this.width / 2, this.height / 2 - 20);
      }
    }

    const p = this.player;
    ctx.font = '14px monospace';
    ctx.fillText(
      `${t('stick.label.day', { n: p.day })} | 💪${p.strength} 📖${p.intelligence} 🗣️${p.charisma} | ${t('stick.label.money', { n: p.money })}`,
      this.width / 2, this.height / 2 + 8,
    );
    ctx.fillText(t('stick.end.bestDay', { n: this.bestDay }), this.width / 2, this.height / 2 + 30);
    ctx.fillText(t('game.restart'), this.width / 2, this.height / 2 + 56);
    ctx.textAlign = 'left';
  }



  destroy() {
    this.input.detach();
  }
}
