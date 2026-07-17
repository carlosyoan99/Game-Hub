/**
 * Territory War
 * Nivel 4 — Estrategia / Defensa
 *
 * Mecánica: dos equipos de figuras tipo stickman en un campo de batalla
 * dividido en zonas de territorio. Por turnos, los jugadores/IA mueven
 * sus unidades, atacan al enemigo y capturan territorio. El equipo que
 * elimina a todas las unidades enemigas o captura todo el territorio gana.
 */
import { GameBase } from '../../engine/GameBase.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { pointInRect } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { t } from '../../engine/i18n.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { icon } from '../../engine/IconRenderer.js';
import { COLORS, TERRAIN_COLS, TERRAIN_ROWS, UNIT_TYPES } from './constants.js';
import { aiBuyUnits, aiDoAction, getSpawnPoints, getValidMoves, getValidAttacks, captureTerritory, checkAllActionsDone } from './ai.js';

export class TerritoryWar extends GameBase {
  init(engine) {
    super.init(engine, 'territory-war');
    this.highscore = this.storage.get('highscore', 0);
    this.wins = this.storage.get('wins', 0);

    this._recomputeGrid();
    this._restart();
  }

  _defaultBindings() {
    return {
      cursorUp:     ['ArrowUp', 'KeyW', 'GamepadUp', 'GamepadLStickUp'],
      cursorDown:   ['ArrowDown', 'KeyS', 'GamepadDown', 'GamepadLStickDown'],
      cursorLeft:   ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      cursorRight:  ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      select:       ['Space', 'Enter', 'GamepadA'],
      cancel:       ['Escape', 'GamepadB'],
      endTurn:      ['KeyT', 'GamepadStart'],
      buyUnit:      ['KeyB', 'GamepadR1'],
      restart:      ['Space', 'GamepadStart', 'GamepadA'],
    };
  }

  _recomputeGrid() {
    this.TILE_SIZE = Math.min(
      (this.width - 40) / TERRAIN_COLS,
      (this.height - 80) / TERRAIN_ROWS
    );
    this.GRID_OFFSET_X = (this.width - TERRAIN_COLS * this.TILE_SIZE) / 2;
    this.GRID_OFFSET_Y = (this.height - TERRAIN_ROWS * this.TILE_SIZE) / 2 + 20;
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this._recomputeGrid();
  }

  _restart() {
    this.startTime = Date.now();
    this.rng = new SeededRandom();
    this.turn = 1; // 1 = player, 2 = enemy
    this.phase = 'action'; // 'action' | 'moving' | 'attacking' | 'ai-thinking' | 'won' | 'lost'
    this.turnNumber = 0;
    this.selectedUnit = null;
    this.selectedAction = null;
    this.validTargets = [];
    this.message = '';
    this.messageTimer = 0;
    this.particles = new ParticleSystem(100);
    this.animating = false;
    this.animationProgress = 0;
    this.animFrom = null;
    this.animTo = null;
    this.animUnit = null;
    this.cursorCol = Math.floor(TERRAIN_COLS / 3);
    this.cursorRow = Math.floor(TERRAIN_ROWS / 2);
    this.buySelected = 0;

    this.playerResources = 300;
    this.enemyResources = 300;

    this.territory = [];
    for (let row = 0; row < TERRAIN_ROWS; row++) {
      this.territory[row] = [];
      for (let col = 0; col < TERRAIN_COLS; col++) {
        this.territory[row][col] = {
          owner: 0, // 0 = neutral, 1 = player, 2 = enemy
          isSpawn: false,
        };
      }
    }

    for (let row = 0; row < TERRAIN_ROWS; row++) {
      this.territory[row][0].owner = 1;
      this.territory[row][TERRAIN_COLS - 1].owner = 2;
    }

    this.territory[2][0].isSpawn = true;
    this.territory[2][1].isSpawn = true;
    this.territory[2][TERRAIN_COLS - 1].isSpawn = true;
    this.territory[2][TERRAIN_COLS - 2].isSpawn = true;

    this.units = [];

    this._addUnit('infantry', 1, 0, 2);
    this._addUnit('archer', 1, 1, 2);
    this._addUnit('infantry', 1, 0, 3);
    this._addUnit('infantry', 2, TERRAIN_COLS - 1, 2);
    this._addUnit('archer', 2, TERRAIN_COLS - 2, 2);
    this._addUnit('infantry', 2, TERRAIN_COLS - 1, 3);

    this._startTurn();
  }

  _addUnit(type, owner, col, row) {
    const template = UNIT_TYPES[type];
    this.units.push({
      type, owner, col, row,
      hp: template.hp, maxHp: template.maxHp,
      damage: template.damage, range: template.range,
      moveRange: template.moveRange,
      hasMoved: false, hasAttacked: false,
      symbol: template.symbol, nameKey: template.nameKey,
    });
  }

  _startTurn() {
    this.turnNumber++;
    this.phase = 'action';

    for (const unit of this.units) {
      unit.hasMoved = false;
      unit.hasAttacked = false;
    }

    if (this.turn === 1) {
      this.playerResources += 50 + this.turnNumber * 5;
    } else {
      this.enemyResources += 50 + this.turnNumber * 5;
    }

    if (this.turn === 2) {
      this._aiBuyUnits();
    }

    this.selectedUnit = null;
    this.selectedAction = null;
    this.validTargets = [];
    this.message = t('territory.turnMessage', { n: this.turnNumber, player: this.turn === 1 ? t('territory.yourTurn') : t('territory.enemyTurn') });
    this.messageTimer = 2;

    if (this.turn === 2) {
      this.phase = 'ai-thinking';
      this.aiTimer = 1;
    }
  }

  _aiBuyUnits() {
    aiBuyUnits(this);
  }

  _aiDoAction() {
    aiDoAction(this);
  }

  _getSpawnPoints(owner) {
    return getSpawnPoints(this, owner);
  }

  _endTurn() {
    const playerUnits = this.units.filter((u) => u.owner === 1 && u.hp > 0);
    const enemyUnits = this.units.filter((u) => u.owner === 2 && u.hp > 0);

    if (enemyUnits.length === 0) {
      this.phase = 'won';
      this._recordProgressionPlay(true);
      this.wins++;
      this.storage.set('wins', this.wins);
      if (this.turnNumber > this.highscore) {
        this.highscore = this.turnNumber;
        this.storage.set('highscore', this.highscore);
      }
      this.message = '¡Victoria! Territorio enemigo conquistado';
      return;
    }
    if (playerUnits.length === 0) {
      this.phase = 'lost';
      this._recordProgressionPlay(false);
      this.message = 'Derrota... Todas tus unidades caídas';
      this._checkHighscore();
      return;
    }

    this.turn = this.turn === 1 ? 2 : 1;
    this._startTurn();
  }

  _checkHighscore() {
    if (this.turnNumber > this.highscore) {
      this.highscore = this.turnNumber;
      this.storage.set('highscore', this.highscore);
    }
  }

  _getActionableUnits(owner) {
    return this.units.filter(
      (u) => u.owner === owner && u.hp > 0 && (!u.hasMoved || !u.hasAttacked)
    );
  }

  _getValidMoves(unit) {
    return getValidMoves(this, unit);
  }

  _getValidAttacks(unit) {
    return getValidAttacks(this, unit);
  }

  update(dt) {
    // ── Gamepad restart en pantallas finales ──
    if ((this.phase === 'won' || this.phase === 'lost') && this.input.wasActionPressed('restart')) {
      this._restart();
      return;
    }
    if (this.handleRestartInput(['won', 'lost'])) return;

    if (this.messageTimer > 0) this.messageTimer -= dt;
    this.particles.update(dt);

    if (this.phase === 'ai-thinking') {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this._aiDoAction();
      }

      return;
    }

    if (this.animating) {
      this.animationProgress += dt * 3;
      if (this.animationProgress >= 1) {
        this.animationProgress = 0;
        this.animating = false;

        if (this.animUnit) {
          if (this.animTarget) {
            AudioManager.sfx({ type: 'territory_hit', volume: 0.25 });
            this.animTarget.hp -= this.animUnit.damage;
            this.animUnit.hasAttacked = true;
            this.particles.burst(
              this._tileToPixel(this.animTarget.col, this.animTarget.row).x,
              this._tileToPixel(this.animTarget.col, this.animTarget.row).y,
              '#e74c3c', 10, 100
            );

            if (this.animTarget.hp <= 0) {
              this.particles.burst(
                this._tileToPixel(this.animTarget.col, this.animTarget.row).x,
                this._tileToPixel(this.animTarget.col, this.animTarget.row).y,
                '#ffb454', 15, 150
              );
              this._captureTerritory(this.animTarget.col, this.animTarget.row, this.animUnit.owner);
            }
          }
          if (this._checkAllActionsDone()) {
            this._endTurn();
          } else {
            this.phase = 'action';
            // Si es turno de la IA, volver a 'ai-thinking' para que continúe
            if (this.turn === 2) {
              this.phase = 'ai-thinking';
              this.aiTimer = 0.3 + (this.rng ? this.rng.next() : Math.random()) * 0.3;
            }
          }
        }
        this.animUnit = null;
        this.animTarget = null;
      }

      return;
    }

    if (this.phase === 'action' && this.turn === 1) {
      this._handlePlayerInput();
    }

    // ── Gamepad grid cursor ──
    if (this.phase === 'action' && this.turn === 1) {
      if (this.input.wasActionPressed('cursorUp') && this.cursorRow > 0) this.cursorRow--;
      if (this.input.wasActionPressed('cursorDown') && this.cursorRow < TERRAIN_ROWS - 1) this.cursorRow++;
      if (this.input.wasActionPressed('cursorLeft') && this.cursorCol > 0) this.cursorCol--;
      if (this.input.wasActionPressed('cursorRight') && this.cursorCol < TERRAIN_COLS - 1) this.cursorCol++;

      if (this.input.wasActionPressed('select')) {
        this._gamepadSelect();
      }
      if (this.input.wasActionPressed('cancel')) {
        this.selectedUnit = null;
        this.validTargets = [];
      }
      if (this.input.wasActionPressed('endTurn')) {
        this._endTurn();
      }
      if (this.input.wasActionPressed('buyUnit')) {
        this._gamepadBuyUnit();
      }
    }

    this.input.endFrame();
  }

  _handlePlayerInput() {
    if (!this.input.mouse.clickedThisFrame) return;

    const mx = this.input.mouse.x;
    const my = this.input.mouse.y;

    if (pointInRect(mx, my, this._getEndTurnRect())) {
      this._endTurn();
      return;
    }

    const buyButtons = this._getBuyButtons();
    for (let i = 0; i < buyButtons.length; i++) {
      if (pointInRect(mx, my, buyButtons[i].rect)) {
        this._playerBuyUnit(buyButtons[i].type);
        return;
      }
    }

    const tile = this._pixelToTile(mx, my);
    if (!tile) return;
    const { col, row } = tile;

    if (this.selectedUnit && this.validTargets.some((t) => t.col === col && t.row === row)) {
      if (this.validTargets.some((u) => u.hp !== undefined && u.col === col && u.row === row)) {
        const target = this.validTargets.find((u) => u.col === col && u.row === row);
        if (target) {
          this.animating = true;
          this.animationProgress = 0;
          this.animUnit = this.selectedUnit;
          this.animTarget = target;
          this.phase = 'attacking';
          AudioManager.sfx({ type: 'territory_attack', volume: 0.2 });
          this.selectedUnit = null;
          this.validTargets = [];
          return;
        }
      } else {
        this.selectedUnit.col = col;
        this.selectedUnit.row = row;
        this.selectedUnit.hasMoved = true;
        this._captureTerritory(col, row, 1);
        this.selectedUnit = null;
        this.validTargets = [];
        this.selectedAction = null;
        return;
      }
    }

    const clickedUnit = this.units.find(
      (u) => u.owner === 1 && u.hp > 0 && u.col === col && u.row === row
    );

    if (clickedUnit) {
      this.selectedUnit = clickedUnit;
      this.selectedAction = null;
      this.validTargets = this._getValidMoves(clickedUnit);
      const attacks = this._getValidAttacks(clickedUnit);
      this.validTargets = [...this.validTargets, ...attacks];
      return;
    }

    this.selectedUnit = null;
    this.validTargets = [];
  }

  _gamepadSelect() {
    const { cursorCol: col, cursorRow: row } = this;

    // Deseleccionar si click en el mismo tile
    if (this.selectedUnit && this.selectedUnit.col === col && this.selectedUnit.row === row) {
      this.selectedUnit = null;
      this.validTargets = [];
      return;
    }

    // Si hay un objetivo válido (ataque o movimiento)
    if (this.selectedUnit && this.validTargets.some((t) => t.col === col && t.row === row)) {
      const target = this.validTargets.find((t) => t.col === col && t.row === row);
      if (target && target.hp !== undefined) {
        // Atacar
        this.animating = true;
        this.animationProgress = 0;
        this.animUnit = this.selectedUnit;
        this.animTarget = target;
        this.phase = 'attacking';
        AudioManager.sfx({ type: 'territory_attack', volume: 0.2 });
        this.selectedUnit = null;
        this.validTargets = [];
        return;
      } else if (target) {
        // Mover
        this.selectedUnit.col = col;
        this.selectedUnit.row = row;
        this.selectedUnit.hasMoved = true;
        this._captureTerritory(col, row, 1);
        this.selectedUnit = null;
        this.validTargets = [];
        this.selectedAction = null;
        return;
      }
    }

    // Seleccionar unidad propia
    const clickedUnit = this.units.find(
      (u) => u.owner === 1 && u.hp > 0 && u.col === col && u.row === row
    );

    if (clickedUnit && !clickedUnit.hasAttacked) {
      this.selectedUnit = clickedUnit;
      this.validTargets = this._getValidMoves(clickedUnit);
      const attacks = this._getValidAttacks(clickedUnit);
      this.validTargets = [...this.validTargets, ...attacks];
    }
  }

  _gamepadBuyUnit() {
    const unitTypes = this._getBuyableUnits();
    this.buySelected = (this.buySelected + 1) % unitTypes.length;
    this._playerBuyUnit(unitTypes[this.buySelected]);
  }

  _getBuyableUnits() {
    return ['infantry', 'archer', 'cavalry'];
  }

  _playerBuyUnit(type) {
    const template = UNIT_TYPES[type];
    if (!template) return;

    const spawnPoints = this._getSpawnPoints(1);
    if (spawnPoints.length === 0) {
      this.message = t('territory.noSpawn');
      this.messageTimer = 1.5;
      return;
    }

    if (this.playerResources >= template.cost) {
      const sp = spawnPoints[0];
      this._addUnit(type, 1, sp.col, sp.row);
      this.playerResources -= template.cost;
      this.message = t('territory.unitBought');
      this.messageTimer = 1;
    } else {
      this.message = t('territory.noResources');
      this.messageTimer = 1.5;
    }
  }

  _captureTerritory(col, row, owner) {
    captureTerritory(this, col, row, owner);
  }

  _checkAllActionsDone() {
    return checkAllActionsDone(this);
  }

  _pixelToTile(px, py) {
    const col = Math.floor((px - this.GRID_OFFSET_X) / this.TILE_SIZE);
    const row = Math.floor((py - this.GRID_OFFSET_Y) / this.TILE_SIZE);
    if (col >= 0 && col < TERRAIN_COLS && row >= 0 && row < TERRAIN_ROWS) {
      return { col, row };
    }
    return null;
  }

  _tileToPixel(col, row) {
    return {
      x: this.GRID_OFFSET_X + col * this.TILE_SIZE + this.TILE_SIZE / 2,
      y: this.GRID_OFFSET_Y + row * this.TILE_SIZE + this.TILE_SIZE / 2,
    };
  }

  _getEndTurnRect() {
    return { x: this.width - 120, y: 8, width: 110, height: 30 };
  }

  _getBuyButtons() {
    const unitTypes = this._getBuyableUnits();
    const btnW = 140;
    const btnH = 30;
    const gap = 8;
    const startX = 10;
    const y = this.height - 60;
    return unitTypes.map((type, i) => ({
      type,
      rect: {
        x: startX + i * (btnW + gap),
        y,
        width: btnW,
        height: btnH,
      },
    }));
  }

  _recordProgressionPlay(won) {
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('territory-war', this.turnNumber, won, duration);
    if (won) ProgressionManager.checkAchievement('territory-war', 'first-victory');
    if (this.wins >= 5) ProgressionManager.checkAchievement('territory-war', 'war-veteran');
    if (this.wins >= 10) ProgressionManager.checkAchievement('territory-war', 'territory-legend');
  }

  render(ctx) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      this.GRID_OFFSET_X - 2, this.GRID_OFFSET_Y - 2,
      TERRAIN_COLS * this.TILE_SIZE + 4, TERRAIN_ROWS * this.TILE_SIZE + 4
    );

    for (let row = 0; row < TERRAIN_ROWS; row++) {
      for (let col = 0; col < TERRAIN_COLS; col++) {
        const x = this.GRID_OFFSET_X + col * this.TILE_SIZE;
        const y = this.GRID_OFFSET_Y + row * this.TILE_SIZE;
        const terr = this.territory[row][col];

        if (terr.owner === 0) ctx.fillStyle = '#1a2a1a';
        else if (terr.owner === 1) ctx.fillStyle = '#0d1a2e';
        else ctx.fillStyle = '#2e0d1a';
        ctx.fillRect(x, y, this.TILE_SIZE, this.TILE_SIZE);

        if (terr.owner === 1) {
          ctx.fillStyle = COLORS.playerZone;
          ctx.fillRect(x, y, this.TILE_SIZE, this.TILE_SIZE);
        } else if (terr.owner === 2) {
          ctx.fillStyle = COLORS.enemyZone;
          ctx.fillRect(x, y, this.TILE_SIZE, this.TILE_SIZE);
        }

        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, this.TILE_SIZE, this.TILE_SIZE);

        if (terr.isSpawn) {
          ctx.strokeStyle = terr.owner === 1 ? '#4a9eff' : '#e74c3c';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(x + 3, y + 3, this.TILE_SIZE - 6, this.TILE_SIZE - 6);
          ctx.setLineDash([]);
        }
      }
    }

    for (const unit of this.units) {
      if (unit.hp <= 0) continue;
      const pos = this._tileToPixel(unit.col, unit.row);
      const isSelected = this.selectedUnit === unit;
      const isEnemy = unit.owner === 2;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.TILE_SIZE * 0.4, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.marquee;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const color = isEnemy ? COLORS.enemyColor : COLORS.playerColor;
      ctx.fillStyle = isSelected ? '#1e2731' : '#11161d';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      const iconName = unit.symbol === '⚔' ? 'swords' : unit.symbol === '🏹' ? 'arrow' : unit.symbol === '🐴' ? 'target' : unit.symbol === '💚' ? 'heartgreen' : unit.symbol === '🛡' ? 'shield' : null;
      if (iconName) {
        icon(ctx, iconName, pos.x, pos.y, 20, color);
      } else {
        ctx.fillStyle = color;
        ctx.font = '18px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit.symbol, pos.x, pos.y);
      }

      const barW = 30;
      const barH = 4;
      const barX = pos.x - barW / 2;
      const barY = pos.y + 22;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);
      const hpPct = unit.hp / unit.maxHp;
      ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : hpPct > 0.25 ? '#ffb454' : '#e74c3c';
      ctx.fillRect(barX + 1, barY + 1, (barW - 2) * hpPct, barH - 2);

      ctx.fillStyle = COLORS.inkDim;
      ctx.font = '8px monospace';
      ctx.fillText(t(unit.nameKey), pos.x, barY + 9);
      ctx.textAlign = 'left';
    }

    for (const target of this.validTargets) {
      if (target.hp !== undefined) {
        const pos = this._tileToPixel(target.col, target.row);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(231, 76, 60, 0.15)';
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(74, 158, 255, 0.15)';
        ctx.fillRect(
          this.GRID_OFFSET_X + target.col * this.TILE_SIZE + 2,
          this.GRID_OFFSET_Y + target.row * this.TILE_SIZE + 2,
          this.TILE_SIZE - 4, this.TILE_SIZE - 4
        );
        ctx.strokeStyle = 'rgba(74, 158, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          this.GRID_OFFSET_X + target.col * this.TILE_SIZE + 2,
          this.GRID_OFFSET_Y + target.row * this.TILE_SIZE + 2,
          this.TILE_SIZE - 4, this.TILE_SIZE - 4
        );
      }
    }

    this.particles.render(ctx);

    if (this.animating && this.animUnit && this.animTarget) {
      const from = this._tileToPixel(this.animUnit.col, this.animUnit.row);
      const to = this._tileToPixel(this.animTarget.col, this.animTarget.row);
      const t = this.animationProgress;

      ctx.strokeStyle = COLORS.marquee;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      ctx.stroke();

      if (t > 0.8) {
        const flashAlpha = (t - 0.8) / 0.2;
        ctx.beginPath();
        ctx.arc(to.x, to.y, 15 * flashAlpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 180, 84, ${flashAlpha * 0.5})`;
        ctx.fill();
      }
    }

    ctx.fillStyle = COLORS.inkDim;
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(t('territory.turn', { n: this.turnNumber }), 10, 10);

    const turnColor = this.turn === 1 ? COLORS.playerColor : COLORS.enemyColor;
    ctx.fillStyle = turnColor;
    ctx.fillText(this.turn === 1 ? '► ' + t('territory.you') : '◄ ' + t('territory.bot'), 10, 30);

    ctx.fillStyle = COLORS.inkDim;
    ctx.fillText(t('territory.resources', { n: this.playerResources }), this.width / 2 - 60, 10);


    if (this.highscore > 0) {
      ctx.fillText(t('territory.record', { n: this.highscore }), this.width - 200, 10);
    }
    if (this.wins > 0) {
      ctx.fillText(t('territory.wins', { n: this.wins }), this.width - 200, 28);
    }

    const endRect = this._getEndTurnRect();
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(endRect.x, endRect.y, endRect.width, endRect.height);
    ctx.strokeStyle = COLORS.line;
    ctx.strokeRect(endRect.x, endRect.y, endRect.width, endRect.height);
    ctx.fillStyle = COLORS.ink;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('territory.endTurn'), endRect.x + endRect.width / 2, endRect.y + endRect.height / 2);
    ctx.textAlign = 'left';

    const buyButtons = this._getBuyButtons();
    for (const btn of buyButtons) {
      const r = btn.rect;
      const template = UNIT_TYPES[btn.type];
      const canAfford = this.playerResources >= template.cost;

      ctx.fillStyle = canAfford ? COLORS.panel : '#1a1a2a';
      ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.strokeStyle = canAfford ? COLORS.line : '#333';
      ctx.strokeRect(r.x, r.y, r.width, r.height);

      const buyIconName = template.symbol === '⚔' ? 'swords' : template.symbol === '🏹' ? 'arrow' : template.symbol === '🐴' ? 'target' : template.symbol === '💚' ? 'heartgreen' : template.symbol === '🛡' ? 'shield' : null;
      if (buyIconName) {
        icon(ctx, buyIconName, r.x + 14, r.y + r.height / 2, 14, canAfford ? COLORS.playerColor : COLORS.inkDim);
      }
      ctx.fillStyle = canAfford ? COLORS.playerColor : COLORS.inkDim;
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${t(template.nameKey)} $${template.cost}`, r.x + 26, r.y + r.height / 2);
    }
    ctx.textAlign = 'left';

    if (this.messageTimer > 0 && this.message) {
      const alpha = Math.min(1, this.messageTimer);
      ctx.fillStyle = COLORS.marquee;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = alpha;
      ctx.fillText(this.message, this.width / 2, this.GRID_OFFSET_Y + TERRAIN_ROWS * this.TILE_SIZE + 30);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    if (this.selectedUnit) {
      const u = this.selectedUnit;
      ctx.fillStyle = COLORS.inkDim;
      ctx.font = '11px monospace';
      const infoY = this.height - 25;
      ctx.fillText(`${t(u.nameKey)} | ${t('territory.hpInfo', { n: u.hp, max: u.maxHp })} | ${t('territory.atqInfo', { n: u.damage })} | ${t('territory.rngInfo', { n: u.range })} | ${t('territory.movInfo', { n: u.moveRange })}`, 10, infoY);
    }

    if (this.phase === 'won' || this.phase === 'lost') {
      const colors = { text: COLORS.ink };
      if (this.phase === 'won') {
        renderOverlay(ctx, {
          width: this.width, height: this.height,
          title: t('territory.victory'),
          subtitle: t('territory.victoryMsg', { n: this.turnNumber }),
          actionText: t('game.restart'),
          colors,
        });
      } else {
        renderOverlay(ctx, {
          width: this.width, height: this.height,
          title: t('territory.defeat'),
          subtitle: t('territory.defeatMsg'),
          actionText: t('game.restart'),
          colors,
        });
      }
    }
  }

}
