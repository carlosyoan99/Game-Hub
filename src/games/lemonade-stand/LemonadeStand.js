/**
 * Lemonade Stand-like (Tycoon / Economía)
 * Nivel 3 — Simulación de negocio día a día
 *
 * Mecánica: compra suministros, ajusta receta y precio,
 * el clima afecta la demanda, gana dinero y expande
 * tu imperio de limonada.
 */
import { GameBase } from '../../engine/GameBase.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { clamp, pointInRect } from '../../engine/CollisionUtils.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ─── Configuración ──────────────────────────────────────────────────

const WEATHERS = [
  { id: 'rainy', label: { es: 'Lluvioso', en: 'Rainy' }, mult: 0.4, color: '#4a6a8a' },
  { id: 'cloudy', label: { es: 'Nublado', en: 'Cloudy' }, mult: 0.7, color: '#7a8a9a' },
  { id: 'sunny', label: { es: 'Soleado', en: 'Sunny' }, mult: 1.0, color: '#ffb454' },
  { id: 'hot', label: { es: 'Caluroso', en: 'Hot' }, mult: 1.5, color: '#e74c3c' },
];

const ITEMS = {
  lemons: { unitPrice: 5, label: { es: 'Limones', en: 'Lemons' } },
  sugar: { unitPrice: 3, label: { es: 'Azúcar', en: 'Sugar' } },
  cups: { unitPrice: 2, label: { es: 'Vasos', en: 'Cups' } },
  ice: { unitPrice: 1, label: { es: 'Hielo', en: 'Ice' } },
};

const CUPS_PER_PITCHER = 6;
const DEFAULT_LEMONS_PER_PITCHER = 3;
const DEFAULT_SUGAR_PER_PITCHER = 3;
const ICE_PER_CUP = 2;

const STARTING_MONEY = 2000;
const WIN_MONEY = 10000;
const MAX_DAYS = 30;

const AD_COST = 50;
const AD_EFFECT = 0.15;

// ─── Clase principal ────────────────────────────────────────────────

export class LemonadeStand extends GameBase {
  init(engine) {
    super.init(engine, 'lemonade-stand');
    this.highscore = this.storage.get('highscore', 0);
    this.startTime = Date.now();
    this.phase = 'buy'; // 'buy' | 'sell' | 'results' | 'won' | 'lost'
    this.day = 1;
    this._newGame();
  }

  _defaultBindings() {
    return {
      confirm: ['Space', 'Enter', 'GamepadA'],
      left:    ['ArrowLeft', 'KeyA', 'GamepadLeft'],
      right:   ['ArrowRight', 'KeyD', 'GamepadRight'],
      up:      ['ArrowUp', 'KeyW', 'GamepadUp'],
      down:    ['ArrowDown', 'KeyS', 'GamepadDown'],
    };
  }

  _newGame() {
    this.money = STARTING_MONEY;
    this.inventory = { lemons: 0, sugar: 0, cups: 0, ice: 0 };
    this.recipe = { lemonsPerPitcher: DEFAULT_LEMONS_PER_PITCHER, sugarPerPitcher: DEFAULT_SUGAR_PER_PITCHER };
    this.pricePerCup = 25; // cents
    this.reputation = 50; // 0-100
    this.ads = 0;
    this.totalEarned = 0;
    this.totalSold = 0;
    this.totalDays = 0;
    this.day = 1;
    this.phase = 'buy';
    this.message = '';
    this.messageTimer = 0;
    this.suppliesBought = { lemons: 0, sugar: 0, cups: 0, ice: 0 };
    this.pitchersMade = 0;
    this.availableCups = 0;
    this.dailyReport = null;
    this.scrollY = 0;
    this._generateWeather();
  }

  _generateWeather() {
    // Weighted random: sunnier weather more likely
    const weights = [1, 2, 3, 2]; // rainy, cloudy, sunny, hot
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.rng.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        this.weather = WEATHERS[i];
        return;
      }
    }
    this.weather = WEATHERS[2]; // default sunny
  }

  _maxPitchers() {
    return Math.floor(
      Math.min(
        this.inventory.lemons / this.recipe.lemonsPerPitcher,
        this.inventory.sugar / this.recipe.sugarPerPitcher
      )
    );
  }

  _maxCups() {
    const pitchers = this._maxPitchers();
    return Math.min(pitchers * CUPS_PER_PITCHER, this.inventory.cups, Math.floor(this.inventory.ice / ICE_PER_CUP));
  }

  _calculateSales() {
    const maxCups = this._maxCups();
    if (maxCups <= 0) return { sold: 0, revenue: 0, customers: 0 };

    // Base demand
    const baseCustomers = 20 + this.rng.nextInt(0, 14);

    // Weather modifier
    const weatherMult = this.weather.mult;

    // Price modifier (¢25 optimal, higher reduces demand, lower increases)
    const priceDiff = (this.pricePerCup - 25) / 100;
    const priceMult = Math.max(0.3, 1 - priceDiff * 0.8);

    // Reputation modifier
    const repMult = 0.5 + this.reputation / 100;

    // Quality modifier (recipe balance affects quality)
    const ratio = this.recipe.lemonsPerPitcher / this.recipe.sugarPerPitcher;
    const idealRatio = 1.0; // 1:1 is ideal
    const qualityPct = Math.max(50, 100 - Math.abs(ratio - idealRatio) * 40);
    const qualityMult = qualityPct / 100;

    // Advertising modifier
    const adMult = 1 + this.ads * AD_EFFECT;

    // Calculate customers
    const customers = Math.round(baseCustomers * weatherMult * priceMult * repMult * qualityMult * adMult);

    // Calculate sold (limited by supply)
    const sold = Math.min(customers, maxCups);

    // Revenue
    const revenue = sold * this.pricePerCup;

    // Update reputation
    const repChange = (qualityPct / 100 - 0.5) * 2; // -1 to +1
    this.reputation = clamp(this.reputation + repChange, 0, 100);

    return {
      sold,
      revenue,
      customers,
      qualityPct: Math.round(qualityPct),
      maxCups,
      priceDiff,
    };
  }

  _runDay() {
    const sales = this._calculateSales();
    const sold = sales.sold;

    // Calculate costs
    const pitchersUsed = Math.ceil(sold / CUPS_PER_PITCHER);
    const lemonsUsed = pitchersUsed * this.recipe.lemonsPerPitcher;
    const sugarUsed = pitchersUsed * this.recipe.sugarPerPitcher;
    const cupsUsed = sold;
    const iceUsed = sold * ICE_PER_CUP;
    const costLemons = lemonsUsed * ITEMS.lemons.unitPrice;
    const costSugar = sugarUsed * ITEMS.sugar.unitPrice;
    const costCups = cupsUsed * ITEMS.cups.unitPrice;
    const costIce = iceUsed * ITEMS.ice.unitPrice;
    const adCost = this.ads * AD_COST;
    const totalCost = costLemons + costSugar + costCups + costIce + adCost;

    // Update inventory
    this.inventory.lemons -= lemonsUsed;
    this.inventory.sugar -= sugarUsed;
    this.inventory.cups -= cupsUsed;
    this.inventory.ice -= iceUsed;

    // Revenue
    const revenue = sold * this.pricePerCup;
    this.money += revenue - totalCost;
    this.totalEarned += revenue;
    this.totalSold += sold;
    this.totalDays++;

    // Daily report
    this.dailyReport = {
      day: this.day,
      weather: this.weather,
      pricePerCup: this.pricePerCup,
      sold,
      revenue,
      totalCost,
      profit: revenue - totalCost,
      customers: sales.customers,
      qualityPct: sales.qualityPct,
      lemonsUsed,
      sugarUsed,
      cupsUsed,
      iceUsed,
      adCost,
      pitchersMade: pitchersUsed,
    };

    // Check win/lose
    if (this.money <= 0 && this.day > 1) {
      this.phase = 'lost';
      this._endGame(false);
    } else if (this.totalEarned >= WIN_MONEY) {
      this.phase = 'won';
      this._endGame(true);
    } else if (this.day >= MAX_DAYS) {
      this.phase = 'won';
      this._endGame(true);
    } else {
      this.phase = 'results';
      this.day++;
      this._generateWeather();
    }

    // Reset daily purchases
    this.suppliesBought = { lemons: 0, sugar: 0, cups: 0, ice: 0 };
    this.pitchersMade = 0;
    this.availableCups = 0;

    AudioManager.sfx({ type: 'powerup', volume: 0.3 });
  }

  _buyItem(item, qty) {
    if (this.phase !== 'buy') return;
    const cost = qty * ITEMS[item].unitPrice;
    if (this.money >= cost) {
      this.inventory[item] += qty;
      this.money -= cost;
      this.suppliesBought[item] = (this.suppliesBought[item] || 0) + qty;
      AudioManager.sfx({ type: 'select', volume: 0.1 });
    }
  }

  _endGame(won) {
    this.phase = won ? 'won' : 'lost';
    this.status = won ? 'won' : 'lost';

    const score = this.totalEarned;
    if (score > this.highscore) {
      this.highscore = score;
      this.storage.set('highscore', this.highscore);
    }

    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('lemonade-stand', score, won, duration);

    if (won) ProgressionManager.checkAchievement('lemonade-stand', 'first-profit');
    if (this.totalEarned >= 5000) ProgressionManager.checkAchievement('lemonade-stand', 'lemonade-tycoon');
    if (this.reputation >= 80) ProgressionManager.checkAchievement('lemonade-stand', 'master-chef');
    if (this.totalSold >= 200) ProgressionManager.checkAchievement('lemonade-stand', 'mass-production');
  }

  _restart() {
    this._newGame();
    this.status = 'playing';
  }

  // ── Update ────────────────────────────────────────────────────────

  update(dt) {
    if (this.phase === 'won' || this.phase === 'lost') {
      if (this.handleRestartInput()) return;
      // After handling restart, return
      return;
    }

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }

    if (this.phase === 'buy') {
      this._updateBuy(dt);
    } else if (this.phase === 'sell') {
      this._updateSell(dt);
    } else if (this.phase === 'results') {
      if (this.input.wasActionPressed('confirm') || this.input.mouse.clickedThisFrame) {
        this.phase = 'buy';
        AudioManager.sfx({ type: 'select', volume: 0.2 });
      }
    }
  }

  _updateBuy(dt) {
    // Buy buttons via click
    if (this.input.mouse.clickedThisFrame) {
      const buttons = this._getBuyButtons();
      for (const btn of buttons) {
        if (pointInRect(this.input.mouse.x, this.input.mouse.y, btn.rect)) {
          btn.action();
          break;
        }
      }
    }

    // Buy via keyboard
    const buyAmount = 5;
    if (this.input.wasActionPressed('left')) {
      // Navigate to previous item group
    }
    if (this.input.wasActionPressed('right')) {
      // Navigate to next item group
    }

    // 'S' key to start selling
    if (this.input.wasPressed('KeyS') || this.input.wasActionPressed('confirm')) {
      const maxCups = this._maxCups();
      if (maxCups > 0) {
        this.phase = 'sell';
        this.availableCups = maxCups;
        AudioManager.sfx({ type: 'select', volume: 0.2 });
      } else {
        this.message = t('lemonade.noStock');
        this.messageTimer = 2;
      }
    }
  }

  _updateSell(dt) {
    // Adjust price
    if (this.input.wasActionPressed('left') || this.input.wasPressed('KeyA')) {
      this.pricePerCup = Math.max(5, this.pricePerCup - 5);
      AudioManager.sfx({ type: 'select', volume: 0.1 });
    }
    if (this.input.wasActionPressed('right') || this.input.wasPressed('KeyD')) {
      this.pricePerCup = Math.min(100, this.pricePerCup + 5);
      AudioManager.sfx({ type: 'select', volume: 0.1 });
    }

    // Adjust recipe
    if (this.input.wasPressed('KeyW') || this.input.wasActionPressed('up')) {
      this.recipe.lemonsPerPitcher = clamp(this.recipe.lemonsPerPitcher + 1, 1, 6);
    }
    if (this.input.wasPressed('KeyS') || this.input.wasActionPressed('down')) {
      this.recipe.lemonsPerPitcher = clamp(this.recipe.lemonsPerPitcher - 1, 1, 6);
    }
    if (this.input.wasPressed('KeyQ')) {
      this.recipe.sugarPerPitcher = clamp(this.recipe.sugarPerPitcher + 1, 1, 6);
    }
    if (this.input.wasPressed('KeyE')) {
      this.recipe.sugarPerPitcher = clamp(this.recipe.sugarPerPitcher - 1, 1, 6);
    }

    // Toggle ads
    if (this.input.wasPressed('KeyR')) {
      if (this.ads > 0) {
        this.ads = 0;
      } else if (this.money >= AD_COST) {
        this.ads = 1;
        this.money -= AD_COST;
        AudioManager.sfx({ type: 'powerup', volume: 0.2 });
      }
    }

    // Start day
    if (this.input.mouse.clickedThisFrame || this.input.wasPressed('Space') || this.input.wasActionPressed('confirm')) {
      // Check if clicked start day button
      const startBtn = this._getStartDayButton();
      if (!this.input.mouse.clickedThisFrame || pointInRect(this.input.mouse.x, this.input.mouse.y, startBtn)) {
        this._runDay();
      }
    }

    // Click on price slider
    if (this.input.mouse.clickedThisFrame) {
      const sliderBounds = { x: this.width / 2 - 100, y: 145, width: 200, height: 20 };
      if (pointInRect(this.input.mouse.x, this.input.mouse.y, sliderBounds)) {
        this.pricePerCup = Math.round(5 + ((this.input.mouse.x - sliderBounds.x) / sliderBounds.width) * 95 / 5) * 5;
        this.pricePerCup = clamp(this.pricePerCup, 5, 100);
      }
    }

    // Buy buttons on sell screen
    if (this.input.mouse.clickedThisFrame) {
      const buttons = this._getSellBuyButtons();
      for (const btn of buttons) {
        if (pointInRect(this.input.mouse.x, this.input.mouse.y, btn.rect)) {
          btn.action();
          break;
        }
      }
    }
  }

  // ── UI Layout helpers ─────────────────────────────────────────────

  _getBuyButtons() {
    const items = ['lemons', 'sugar', 'cups', 'ice'];
    const btnW = 160;
    const btnH = 70;
    const gap = 16;
    const startX = (this.width - (items.length * btnW + (items.length - 1) * gap)) / 2;
    const startY = 180;

    const buttons = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const x = startX + i * (btnW + gap);
      const y = startY;
      buttons.push({
        rect: { x, y, width: btnW, height: btnH },
        item,
        label: ITEMS[item].label,
        action: () => this._buyItem(item, 10),
      });
      // +5 button
      buttons.push({
        rect: { x, y: y + btnH + 6, width: (btnW - 6) / 2, height: 36 },
        item,
        label: '+5',
        action: () => this._buyItem(item, 5),
      });
      // +1 button
      buttons.push({
        rect: { x: x + (btnW + 6) / 2, y: y + btnH + 6, width: (btnW - 6) / 2, height: 36 },
        item,
        label: '+1',
        action: () => this._buyItem(item, 1),
      });
    }
    return buttons;
  }

  _getSellBuyButtons() {
    const items = ['lemons', 'sugar', 'cups', 'ice'];
    const btnW = 50;
    const btnH = 28;
    const startX = this.width / 2 - 100;
    const startY = 300;

    const buttons = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const x = startX;
      const y = startY + i * 36;
      buttons.push({
        rect: { x, y, width: btnW, height: btnH },
        item,
        label: '+10',
        action: () => this._buyItem(item, 10),
      });
      buttons.push({
        rect: { x: x + btnW + 6, y, width: btnW, height: btnH },
        item,
        label: '+5',
        action: () => this._buyItem(item, 5),
      });
      buttons.push({
        rect: { x: x + (btnW + 6) * 2, y, width: btnW, height: btnH },
        item,
        label: '+1',
        action: () => this._buyItem(item, 1),
      });
    }
    return buttons;
  }

  _getStartDayButton() {
    return { x: this.width / 2 - 100, y: this.height - 60, width: 200, height: 40 };
  }

  // ── Render ────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.phase === 'won' || this.phase === 'lost') {
      this._renderGameOver(ctx);
      return;
    }

    if (this.phase === 'buy') this._renderBuy(ctx);
    else if (this.phase === 'sell') this._renderSell(ctx);
    else if (this.phase === 'results') this._renderResults(ctx);
  }

  _renderHeader(ctx) {
    // Top bar
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, this.width, 50);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('lemonade.title'), this.width / 2, 14);

    ctx.fillStyle = '#e7edf3';
    ctx.font = '12px monospace';
    ctx.fillText(t('lemonade.day', { n: this.day }), this.width / 2, 34);

    // Money
    ctx.textAlign = 'left';
    ctx.font = '14px monospace';
    ctx.fillStyle = this.money >= 0 ? '#3a9a5a' : '#e74c3c';
    ctx.fillText(t('lemonade.money', { n: this.money }), 10, 24);

    // Weather
    ctx.textAlign = 'right';
    ctx.fillStyle = this.weather?.color || '#9aa7b2';
    ctx.fillText(t('lemonade.weather', { w: this.weather?.label?.es || '' }), this.width - 10, 24);

    // Reputation
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '10px monospace';
    ctx.fillText(t('lemonade.reputation', { n: this.reputation }), this.width - 10, 40);

    // Total earned
    ctx.fillStyle = '#9aa7b2';
    ctx.textAlign = 'left';
    ctx.fillText(t('lemonade.total', { n: this.totalEarned }), 10, 40);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderBuy(ctx) {
    this._renderHeader(ctx);

    // Section title
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('lemonade.supplies'), this.width / 2, 70);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Inventory display
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '12px monospace';
    const invY = 90;
    const invLabels = [
      t('lemonade.lemonsInv', { n: this.inventory.lemons }),
      t('lemonade.sugarInv', { n: this.inventory.sugar }),
      t('lemonade.cupsInv', { n: this.inventory.cups }),
      t('lemonade.iceInv', { n: this.inventory.ice }),
    ];
    const invStartX = (this.width - 400) / 2;
    for (let i = 0; i < invLabels.length; i++) {
      const x = invStartX + i * 100;
      ctx.fillText(invLabels[i], x, invY);
    }

    // Buy buttons
    const buttons = this._getBuyButtons();
    const items = ['lemons', 'sugar', 'cups', 'ice'];
    const btnW = 160;
    const btnH = 70;
    const gap = 16;
    const startX = (this.width - (items.length * btnW + (items.length - 1) * gap)) / 2;
    const startY = 180;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const x = startX + i * (btnW + gap);
      const y = startY;

      // Big buy button
      const cost10 = 10 * ITEMS[item].unitPrice;
      ctx.fillStyle = this.money >= cost10 ? '#1a2a1a' : '#1a1a1a';
      ctx.fillRect(x, y, btnW, btnH);
      ctx.strokeStyle = this.money >= cost10 ? '#3a9a5a' : '#3a2a2a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, btnW, btnH);

      ctx.fillStyle = this.money >= cost10 ? '#e7edf3' : '#5a5a5a';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ITEMS[item].label.es, x + btnW / 2, y + 20);
      ctx.font = '12px monospace';
      ctx.fillStyle = this.money >= cost10 ? '#4a9eff' : '#4a4a4a';
      ctx.fillText(`x10 = ¢${cost10}`, x + btnW / 2, y + 44);

      // Small buttons
      ctx.font = '11px monospace';
      ctx.fillStyle = this.money >= 5 * ITEMS[item].unitPrice ? '#9aa7b2' : '#4a4a4a';
      ctx.fillText('+5', x + btnW / 4, y + btnH + 24);
      ctx.fillText('+1', x + btnW * 3 / 4, y + btnH + 24);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Helper: max pitchers info
    ctx.fillStyle = '#7c8894';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxP = this._maxPitchers();
    ctx.fillText(t('lemonade.recipeHint'), this.width / 2, this.height - 70);
    ctx.fillStyle = maxP > 0 ? '#3a9a5a' : '#e74c3c';
    ctx.fillText(`${maxP} jarras = ${maxP * CUPS_PER_PITCHER} vasos`, this.width / 2, this.height - 50);

    // Start selling button
    const canSell = this._maxCups() > 0;
    ctx.fillStyle = canSell ? '#3a9a5a' : '#3a3a3a';
    ctx.fillRect(this.width / 2 - 80, this.height - 36, 160, 30);
    ctx.fillStyle = canSell ? '#e7edf3' : '#7a7a7a';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(canSell ? t('lemonade.startDay') : t('lemonade.noStock'), this.width / 2, this.height - 22);

    // Message
    if (this.message && this.messageTimer > 0) {
      ctx.fillStyle = '#ffb454';
      ctx.font = '14px monospace';
      ctx.fillText(this.message, this.width / 2, this.height - 6);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderSell(ctx) {
    this._renderHeader(ctx);

    const cx = this.width / 2;
    const btnW = 160;
    const btnH = 40;

    // Weather display (large)
    ctx.fillStyle = this.weather.color;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1;

    // ── Price setting ───────────────────────────────────────────────
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('lemonade.price', { n: this.pricePerCup }), cx, 80);

    // Price slider
    const sliderX = cx - 100;
    const sliderY = 105;
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(sliderX, sliderY, 200, 8);
    const sliderPct = (this.pricePerCup - 5) / 95;
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(sliderX, sliderY, 200 * sliderPct, 8);
    // Slider thumb
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(sliderX + 200 * sliderPct - 4, sliderY - 4, 8, 16);

    ctx.fillStyle = '#9aa7b2';
    ctx.font = '10px monospace';
    ctx.fillText('5¢', sliderX, sliderY + 20);
    ctx.fillText('100¢', sliderX + 192, sliderY + 20);
    ctx.fillText('← A  D →', cx, sliderY + 36);

    // ── Recipe ──────────────────────────────────────────────────────
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t('lemonade.recipe'), cx, 170);

    ctx.fillStyle = '#e7edf3';
    ctx.font = '13px monospace';
    ctx.fillText(`${t('lemonade.lemons', { n: this.recipe.lemonsPerPitcher, p: '' })}`, cx - 80, 196);
    ctx.fillText(`${t('lemonade.sugar', { n: this.recipe.sugarPerPitcher, p: '' })}`, cx + 80, 196);

    // Recipe buttons
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '10px monospace';
    ctx.fillText('W↑ S↓', cx - 80, 214);
    ctx.fillText('Q↑ E↓', cx + 80, 214);

    // ── Inventory summary ───────────────────────────────────────────
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(t('lemonade.inventory'), cx, 250);

    const invItems = [
      `${t('lemonade.lemonsInv', { n: this.inventory.lemons })}`,
      `${t('lemonade.sugarInv', { n: this.inventory.sugar })}`,
      `${t('lemonade.cupsInv', { n: this.inventory.cups })}`,
      `${t('lemonade.iceInv', { n: this.inventory.ice })}`,
    ];
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '11px monospace';
    for (let i = 0; i < invItems.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      ctx.fillText(invItems[i], cx - 100 + col * 200, 274 + row * 20);
    }

    // ── Ads toggle ──────────────────────────────────────────────────
    ctx.fillStyle = this.ads > 0 ? '#4a9eff' : '#5a5a5a';
    ctx.fillRect(cx - 40, 310, 80, 24);
    ctx.fillStyle = this.ads > 0 ? '#e7edf3' : '#9aa7b2';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`📢 ${t('lemonade.ads', { n: this.ads })}`, cx, 322);

    // ── Available cups ──────────────────────────────────────────────
    ctx.fillStyle = this.availableCups > 0 ? '#3a9a5a' : '#e74c3c';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`☕ ${this.availableCups} ${t('lemonade.sold', { n: '' })}`, cx, 370);

    // ── Projected earnings ──────────────────────────────────────────
    if (this.availableCups > 0) {
      ctx.fillStyle = '#9aa7b2';
      ctx.font = '12px monospace';
      const projected = this.availableCups * this.pricePerCup;
      ctx.fillText(t('lemonade.revenue', { n: projected }), cx, 395);
    }

    // ── Start day button ────────────────────────────────────────────
    const startBtn = this._getStartDayButton();
    const canStart = this.availableCups > 0;
    ctx.fillStyle = canStart ? '#3a9a5a' : '#3a3a3a';
    ctx.fillRect(startBtn.x, startBtn.y, startBtn.width, startBtn.height);
    ctx.strokeStyle = canStart ? '#5acc7a' : '#5a5a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(startBtn.x, startBtn.y, startBtn.width, startBtn.height);

    ctx.fillStyle = canStart ? '#e7edf3' : '#7a7a7a';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('lemonade.startDay'), cx, startBtn.y + startBtn.height / 2);

    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.fillText('Space para empezar', cx, startBtn.y + startBtn.height + 16);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderResults(ctx) {
    if (!this.dailyReport) return;

    // Background
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Weather banner
    ctx.fillStyle = this.dailyReport.weather.color;
    ctx.globalAlpha = 0.1;
    ctx.fillRect(0, 0, this.width, 80);
    ctx.globalAlpha = 1;

    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('lemonade.results'), this.width / 2, 20);

    ctx.fillStyle = this.dailyReport.weather.color;
    ctx.font = '14px monospace';
    ctx.fillText(t('lemonade.weather', { w: this.dailyReport.weather.label.es }), this.width / 2, 44);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const col1X = this.width / 2 - 160;
    const col2X = this.width / 2 + 20;
    let y = 90;
    const lineH = 28;

    // Stats display
    ctx.font = '13px monospace';
    const leftCol = [
      { label: t('lemonade.customers', { n: this.dailyReport.customers }), color: '#e7edf3' },
      { label: t('lemonade.sold', { n: this.dailyReport.sold }), color: '#4a9eff' },
      { label: t('lemonade.quality', { n: this.dailyReport.qualityPct }), color: '#ffb454' },
      { label: t('lemonade.price', { n: this.dailyReport.pricePerCup }), color: '#9aa7b2' },
    ];
    const rightCol = [
      { label: t('lemonade.revenue', { n: this.dailyReport.revenue }), color: '#3a9a5a' },
      { label: t('lemonade.cost', { n: this.dailyReport.totalCost }), color: '#e74c3c' },
    ];

    for (const item of leftCol) {
      ctx.fillStyle = item.color;
      ctx.fillText(item.label, col1X, y);
      y += lineH;
    }

    y = 90;
    for (const item of rightCol) {
      ctx.fillStyle = item.color;
      ctx.fillText(item.label, col2X, y);
      y += lineH;
    }

    // Divider
    y = 160;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(col1X, y);
    ctx.lineTo(col1X + 360, y);
    ctx.stroke();

    // Profit
    y = 186;
    const profit = this.dailyReport.profit;
    ctx.fillStyle = profit >= 0 ? '#3a9a5a' : '#e74c3c';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('lemonade.profit', { n: profit }), this.width / 2, y);

    // Total earned
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '13px monospace';
    ctx.fillText(t('lemonade.total', { n: this.totalEarned }), this.width / 2, y + 28);

    // Reputation change
    ctx.font = '12px monospace';
    ctx.fillText(t('lemonade.reputation', { n: this.reputation }), this.width / 2, y + 50);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Items used
    ctx.fillStyle = '#7c8894';
    ctx.font = '11px monospace';
    ctx.fillText(`🍋${this.dailyReport.lemonsUsed} 🧊${this.dailyReport.iceUsed} 🥤${this.dailyReport.cupsUsed}`, col1X, y + 80);

    // Continue button
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(this.width / 2 - 100, this.height - 50, 200, 36);
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('lemonade.nextDay'), this.width / 2, this.height - 32);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderGameOver(ctx) {
    const won = this.phase === 'won';
    const accuracy = this.totalDays > 0 ? Math.floor(this.totalSold / this.totalDays) : 0;
    renderOverlay(ctx, {
      width: this.width, height: this.height,
      title: won ? t('lemonade.victory') : t('lemonade.gameOver'),
      score: this.totalEarned,
      subtitle: `${t('lemonade.sold', { n: this.totalSold })} | ${accuracy} vasos/día`,
      actionText: t('game.restart'),
    });
  }
}
