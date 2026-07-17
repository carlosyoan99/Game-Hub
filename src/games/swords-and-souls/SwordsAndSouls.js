/**
 * Swords and Souls — Refactorizado
 *
 * Versión modular: stats, training, combat, shop, render.
 * Este archivo orquesta el juego importando desde los submódulos.
 *
 * Mecánica: Hub con zonas, minijuegos de entrenamiento,
 * combate por turnos con IA adaptativa, tienda y subida de nivel.
 */
import { GameBase } from '../../engine/GameBase.js';
import { pointInRect } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { t } from '../../engine/i18n.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { BASE_HP, SCENES, SCENE_NAME_KEYS, ENEMIES, EQUIPMENT } from './constants.js';
import { addXp, assignStat, rest, getEnemyForWave } from './stats.js';
import {
  startTraining, updateTraining, handleTrainingClick,
  handleGamepadTrainingAction, finishTraining,
} from './training.js';
import {
  startCombat, updateCombat, doPlayerAction, fleeCombat,
} from './combat.js';
import { buyItem } from './shop.js';
import {
  renderBackground, renderMessage, renderHub, renderTraining,
  renderCombat, renderShop,
  getSceneButtons, getStatButtons, getRestButton,
} from './render.js';

export class SwordsAndSouls extends GameBase {

  init(engine) {
    super.init(engine, 'swords-and-souls');
    this.bestWave = this.storage.get('bestWave', 0);
    this.totalGold = this.storage.get('totalGold', 0);
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
  }

  // ─── Setup ───────────────────────────────────────────────────────

  _restart() {
    this.startTime = Date.now();
    this.rng = new SeededRandom();
    this.player = {
      level: 1, xp: 0, xpToNext: 20,
      hp: BASE_HP, maxHp: BASE_HP,
      str: 3, agi: 3, end: 3, arch: 1,
      gold: 0, statPoints: 0,
      weapon: { id: 'fists', name: 'Puños', strBonus: 0, archBonus: 0, cost: 0, icon: '✊' },
      armor: { id: 'rags', name: 'Harapos', defBonus: 0, cost: 0, icon: '🛡️' },
      potions: 0, bigPotions: 0,
      atkBonus: 0, allStatsBonus: 0,
    };
    this._resetState();
  }

  _resetState() {
    this.currentScene = 'home';
    this.subScene = null;
    this.message = '';
    this.messageTimer = 0;
    this.status = 'playing';
    this.wave = 0;
    this.winStreak = 0;
    this.particles = new ParticleSystem(120);
    this.focusIndex = 0;
    this.trainTarget = null;
    this.trainClicks = 0;
    this.trainMax = 10;
    this.trainTimer = 0;
    this.trainPhase = 'waiting';
    this.combatLog = [];
    this.combatTurn = 'player';
    this.combatPhase = 'idle';
    this.combatTimer = 0;
    this.enemy = null;
    this.playerDefending = false;
    this.shopCategory = null;
  }

  // ─── Update ──────────────────────────────────────────────────────

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.wasActionPressed('restart') || this.input.mouse.clickedThisFrame) this._restart();
      return;
    }

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }

    this.particles.update(dt);

    if (this.subScene === 'train-archery' || this.subScene === 'train-spar' || this.subScene === 'train-endurance') {
      this._updateTrainingModule(dt);
    } else if (this.subScene === 'combat') {
      this._updateCombatModule(dt);
    } else if (this.subScene === 'shop') {
      this._handleGamepadShop();
      if (this.input.mouse.clickedThisFrame) this._handleShopClick(this.input.mouse.x, this.input.mouse.y);
    } else {
      this._handleGamepadHub();
      if (this.input.mouse.clickedThisFrame) this._handleHubClick(this.input.mouse.x, this.input.mouse.y);
    }
  }

  _updateTrainingModule(dt) {
    this._handleGamepadTraining();
    updateTraining(this, dt);
    if (this.input.mouse.clickedThisFrame) {
      const mx = this.input.mouse.x, my = this.input.mouse.y;
      const backBtn = { x: 10, y: 8, width: 80, height: 24 };
      if (pointInRect(mx, my, backBtn)) {
        finishTraining(this);
        this.subScene = null;
        this._showMessage('Entrenamiento cancelado');
        return;
      }
      handleTrainingClick(this, mx, my);
    }
  }

  _updateCombatModule(dt) {
    this._handleGamepadCombat();
    updateCombat(this, dt);
    if (this.combatPhase === 'player-choice' && this.input.mouse.clickedThisFrame) {
      this._handleCombatClick(this.input.mouse.x, this.input.mouse.y);
    }
  }

  // ─── Hub ─────────────────────────────────────────────────────────

  _handleHubClick(x, y) {
    if (this.subScene) {
      const backBtn = { x: 10, y: 8, width: 80, height: 24 };
      if (pointInRect(x, y, backBtn)) {
        if (this.subScene === 'combat') fleeCombat(this);
        else this.subScene = null;
        return;
      }
    }

    if (!this.subScene) {
      const buttons = getSceneButtons(this);
      for (let i = 0; i < buttons.length; i++) {
        if (pointInRect(x, y, buttons[i])) { this._goToScene(SCENES[i]); return; }
      }

      if (this.player.statPoints > 0) {
        const statBtns = getStatButtons(this);
        for (const btn of statBtns) {
          if (pointInRect(x, y, btn)) {
            const label = assignStat(this.player, btn.stat);
            if (label) this._showMessage(`⚡ ${label} +1`);
            return;
          }
        }
      }

      if (this.currentScene === 'home') {
        const restBtn = getRestButton(this);
        if (restBtn && pointInRect(x, y, restBtn)) {
          const healed = rest(this.player);
          this._showMessage(`💤 Descansaste. +${healed} HP`);
          return;
        }
      }

      if (this.currentScene === 'training') {
        const trainings = ['train-archery', 'train-spar', 'train-endurance'];
        const startY = 70, btnH = 52, gap = 8, btnW = this.width * 0.84, startX = this.width * 0.08;
        for (let i = 0; i < trainings.length; i++) {
          const btn = { x: startX, y: startY + i * (btnH + gap), width: btnW, height: btnH };
          if (pointInRect(x, y, btn)) { startTraining(this, trainings[i]); return; }
        }
      }

      if (this.currentScene === 'arena' && this.player.hp > 0) {
        const fightBtn = { x: this.width / 2 - 80, y: 170, width: 160, height: 36 };
        if (pointInRect(x, y, fightBtn)) {
          const result = startCombat(this);
          if (result.error) this._showMessage(result.error);
          return;
        }
      }
    }

    if (this.subScene === 'shop') this._handleShopClick(x, y);
  }

  _handleGamepadHub() {
    if (this.input.wasActionPressed('back') && this.subScene) {
      if (this.subScene === 'combat') fleeCombat(this);
      else this.subScene = null;
      return;
    }
    if (this.input.wasActionPressed('navigateLeft') || this.input.wasActionPressed('navigateRight')) {
      const dir = this.input.wasActionPressed('navigateRight') ? 1 : -1;
      const curIdx = SCENES.indexOf(this.currentScene);
      this._goToScene(SCENES[(curIdx + dir + SCENES.length) % SCENES.length]);
      return;
    }
    if (this.input.wasActionPressed('navigateUp')) this.focusIndex = Math.max(0, this.focusIndex - 1);
    if (this.input.wasActionPressed('navigateDown')) this.focusIndex++;
    if (this.input.wasActionPressed('select')) {
      if (this.currentScene === 'home') {
        if (this.player.statPoints > 0) {
          const label = assignStat(this.player, ['str', 'agi', 'end', 'arch'][this.focusIndex % 4]);
          if (label) this._showMessage(`⚡ ${label} +1`);
        } else if (this.player.hp < this.player.maxHp) {
          const healed = rest(this.player);
          this._showMessage(`💤 Descansaste. +${healed} HP`);
        }
      } else if (this.currentScene === 'training') {
        startTraining(this, ['train-archery', 'train-spar', 'train-endurance'][this.focusIndex % 3]);
      } else if (this.currentScene === 'arena' && this.player.hp > 0) {
        const result = startCombat(this);
        if (result.error) this._showMessage(result.error);
      }
    }
  }

  _handleGamepadTraining() {
    if (this.input.wasActionPressed('back')) {
      finishTraining(this);
      this.subScene = null;
      this._showMessage('Entrenamiento cancelado');
    }
    if (this.input.wasActionPressed('select')) {
      handleGamepadTrainingAction(this);
    }
  }

  _handleGamepadCombat() {
    if (this.input.wasActionPressed('back')) { fleeCombat(this); return; }
    if (this.combatPhase === 'player-choice') {
      if (this.input.wasActionPressed('navigateLeft') && this.focusIndex > 0) this.focusIndex--;
      if (this.input.wasActionPressed('navigateRight') && this.focusIndex < 3) this.focusIndex++;
      if (this.input.wasActionPressed('select')) {
        const actions = ['attack', 'archery', 'defend', 'heal'];
        const result = doPlayerAction(this, actions[this.focusIndex], this.rng);
        if (result && result.msg && result.skip) this._showMessage(result.msg);
      }
    }
  }

  _handleGamepadShop() {
    if (this.input.wasActionPressed('back')) {
      if (this.shopCategory) { this.shopCategory = null; }
      else { this.subScene = null; }
      return;
    }
    if (!this.shopCategory) {
      if (this.input.wasActionPressed('navigateUp') && this.focusIndex > 0) this.focusIndex--;
      if (this.input.wasActionPressed('navigateDown') && this.focusIndex < 2) this.focusIndex++;
      if (this.input.wasActionPressed('select')) {
        this.shopCategory = ['weapons', 'armor', 'items'][this.focusIndex];
        this.focusIndex = 0;
      }
    } else {
      const items = EQUIPMENT[this.shopCategory] || [];
      if (this.input.wasActionPressed('navigateUp') && this.focusIndex > 0) this.focusIndex--;
      if (this.input.wasActionPressed('navigateDown') && this.focusIndex < items.length - 1) this.focusIndex++;
      if (this.input.wasActionPressed('select')) {
        const result = buyItem(this.player, this.shopCategory, this.focusIndex);
        if (result) this._showMessage(result.msg || result.error);
      }
    }
  }

  _goToScene(sceneKey) {
    this.currentScene = sceneKey;
    this.focusIndex = 0;
    this._showMessage(`→ ${t(SCENE_NAME_KEYS[sceneKey])}`);
    if (sceneKey === 'arena' && this.player.hp <= 0) {
      this._showMessage('😵 Estás demasiado herido. Descansa en casa.');
    }
    if (sceneKey === 'shop') {
      this.subScene = 'shop';
      this.shopCategory = null;
      this.focusIndex = 0;
    }
  }

  _handleCombatClick(x, y) {
    const btns = this._getCombatBtns();
    for (const btn of btns) {
      if (pointInRect(x, y, btn)) {
        const result = doPlayerAction(this, btn.action, this.rng);
        if (result && result.msg && result.skip) this._showMessage(result.msg);
        return;
      }
    }
  }

  _getCombatBtns() {
    const btnW = Math.min(130, (this.width - 50) / 4);
    const btnH = 36;
    const gap = 6;
    const totalW = 4 * btnW + 3 * gap;
    const startX = (this.width - totalW) / 2;
    const y = this.height - 50;
    return [
      { action: 'attack', x: startX, y, width: btnW, height: btnH },
      { action: 'archery', x: startX + 1 * (btnW + gap), y, width: btnW, height: btnH },
      { action: 'defend', x: startX + 2 * (btnW + gap), y, width: btnW, height: btnH },
      { action: 'heal', x: startX + 3 * (btnW + gap), y, width: btnW, height: btnH },
    ];
  }

  _handleShopClick(x, y) {
    if (!this.shopCategory) {
      const categories = ['weapons', 'armor', 'items'];
      const startY = 70, btnH = 40, gap = 8, btnW = this.width * 0.84;
      const startX = this.width * 0.08;
      for (let i = 0; i < categories.length; i++) {
        const btn = { x: startX, y: startY + i * (btnH + gap), width: btnW, height: btnH };
        if (pointInRect(x, y, btn)) { this.shopCategory = categories[i]; return; }
      }
    } else {
      const backCat = { x: 10, y: 60, width: 130, height: 22 };
      if (pointInRect(x, y, backCat)) { this.shopCategory = null; return; }

      const items = EQUIPMENT[this.shopCategory] || [];
      for (let i = 0; i < items.length; i++) {
        const btn = { x: 10, y: 90 + i * 44, width: this.width - 20, height: 40 };
        if (pointInRect(x, y, btn)) {
          const result = buyItem(this.player, this.shopCategory, i);
          if (result) this._showMessage(result.msg || result.error);
          return;
        }
      }
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  _showMessage(text) {
    this.message = text;
    this.messageTimer = 3;
  }

  onShowMessage(text) {
    this._showMessage(text);
  }

  _getEnemyForWave() {
    return getEnemyForWave(this.wave, ENEMIES);
  }

  onParticles(x, y, color, count, opts) {
    const vy = opts?.vyOffset || 0;
    for (let i = 0; i < count; i++) {
      this.particles.emit(x, y, color, 2, 30, { vyOffset: vy });
    }
  }

  onTrainingComplete(xpGain, statLabel) {
    addXp(this.player, xpGain, {
      onLevelUp: (level) => this._showMessage(`🎉 ¡Subiste a nivel ${level}! +3 puntos de stat`),
    });
    this._showMessage(`🏋️ ${statLabel}: +${Math.ceil(this.trainClicks / 3)} | +${xpGain} XP`);
  }

  onCombatWin(enemy) {
    addXp(this.player, enemy.xpReward, {
      onLevelUp: (level) => this._showMessage(`🎉 ¡Subiste a nivel ${level}! +3 puntos de stat`),
    });
    if (this.wave > this.bestWave) {
      this.bestWave = this.wave;
      this.storage.set('bestWave', this.bestWave);
    }
    if (this.player.gold > this.totalGold) {
      this.totalGold = this.player.gold;
      this.storage.set('totalGold', this.totalGold);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('swords-and-souls', this.wave, false, duration);
    if (this.wave >= 1) ProgressionManager.checkAchievement('swords-and-souls', 'first-wave');
    if (this.wave >= 10) ProgressionManager.checkAchievement('swords-and-souls', 'swords-wave-10');
    if (this.wave >= 20) ProgressionManager.checkAchievement('swords-and-souls', 'swords-legend');
  }

  // ─── Render ──────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);
    renderBackground(ctx, this.width, this.height);

    if (this.subScene === 'train-archery' || this.subScene === 'train-spar' || this.subScene === 'train-endurance') {
      renderTraining(ctx, this);
    } else if (this.subScene === 'combat') {
      renderCombat(ctx, this);
    } else if (this.subScene === 'shop') {
      renderShop(ctx, this);
    } else {
      renderHub(ctx, this);
    }

    this.particles.render(ctx);
    renderMessage(ctx, this.width, this.height, this.message, this.messageTimer);
  }
}
