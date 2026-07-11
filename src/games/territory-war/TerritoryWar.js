/**
 * Territory War
 * Nivel 4 — Estrategia / Defensa
 *
 * Mecánica: dos equipos de figuras tipo stickman en un campo de batalla
 * dividido en zonas de territorio. Por turnos, los jugadores/IA mueven
 * sus unidades, atacan al enemigo y capturan territorio. El equipo que
 * elimina a todas las unidades enemigas o captura todo el territorio gana.
 */
import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { pointInRect, clamp } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';

const COLORS = {
  bg: '#0b0f14',
  panel: '#11161d',
  ink: '#e7edf3',
  inkDim: '#7c8894',
  line: '#1e2731',
  marquee: '#ffb454',
  playerColor: '#4a9eff',
  enemyColor: '#e74c3c',
  neutralZone: '#2a3a2a',
  playerZone: 'rgba(74, 158, 255, 0.15)',
  enemyZone: 'rgba(231, 76, 60, 0.15)',
};

const TERRAIN_COLS = 9;
const TERRAIN_ROWS = 5;
const TILE_SIZE = 60;
const GRID_OFFSET_X = 100;
const GRID_OFFSET_Y = 80;

const UNIT_TYPES = {
  infantry: {
    name: 'Infantería',
    hp: 50,
    maxHp: 50,
    damage: 15,
    range: 1,
    moveRange: 2,
    cost: 100,
    symbol: '⚔',
  },
  archer: {
    name: 'Arquero',
    hp: 35,
    maxHp: 35,
    damage: 12,
    range: 3,
    moveRange: 1,
    cost: 150,
    symbol: '🏹',
  },
  cavalry: {
    name: 'Caballería',
    hp: 60,
    maxHp: 60,
    damage: 20,
    range: 1,
    moveRange: 4,
    cost: 200,
    symbol: '🐴',
  },
};

export class TerritoryWar {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('territory-war');

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.highscore = this.storage.get('highscore', 0);
    this.wins = this.storage.get('wins', 0);

    this.GRID_OFFSET_X = (this.width - TERRAIN_COLS * TILE_SIZE) / 2;
    this.GRID_OFFSET_Y = (this.height - TERRAIN_ROWS * TILE_SIZE) / 2 + 20;

    this._restart();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
    this.GRID_OFFSET_X = (width - TERRAIN_COLS * TILE_SIZE) / 2;
    this.GRID_OFFSET_Y = (height - TERRAIN_ROWS * TILE_SIZE) / 2 + 20;
  }

  _restart() {
    this.turn = 1; // 1 = player, 2 = enemy
    this.phase = 'action'; // 'action' | 'moving' | 'attacking' | 'ai-thinking' | 'won' | 'lost'
    this.turnNumber = 0;
    this.selectedUnit = null;
    this.selectedAction = null; // 'move' | 'attack'
    this.validTargets = [];
    this.message = '';
    this.messageTimer = 0;
    this.particles = new ParticleSystem(100);
    this.animating = false;
    this.animationProgress = 0;
    this.animFrom = null;
    this.animTo = null;
    this.animUnit = null;

    // Resources
    this.playerResources = 300;
    this.enemyResources = 300;

    // Initialize terrain
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

    // Set spawn zones
    for (let row = 0; row < TERRAIN_ROWS; row++) {
      this.territory[row][0].owner = 1;
      this.territory[row][TERRAIN_COLS - 1].owner = 2;
    }

    // Player spawn cols
    this.territory[2][0].isSpawn = true;
    this.territory[2][1].isSpawn = true;

    // Enemy spawn cols
    this.territory[2][TERRAIN_COLS - 1].isSpawn = true;
    this.territory[2][TERRAIN_COLS - 2].isSpawn = true;

    // Initialize units
    this.units = [];

    // Player starting units
    this._addUnit('infantry', 1, 0, 2);
    this._addUnit('archer', 1, 1, 2);
    this._addUnit('infantry', 1, 0, 3);

    // Enemy starting units
    this._addUnit('infantry', 2, TERRAIN_COLS - 1, 2);
    this._addUnit('archer', 2, TERRAIN_COLS - 2, 2);
    this._addUnit('infantry', 2, TERRAIN_COLS - 1, 3);

    this._startTurn();
  }

  _addUnit(type, owner, col, row) {
    const template = UNIT_TYPES[type];
    this.units.push({
      type,
      owner,
      col,
      row,
      hp: template.hp,
      maxHp: template.maxHp,
      damage: template.damage,
      range: template.range,
      moveRange: template.moveRange,
      hasMoved: false,
      hasAttacked: false,
      symbol: template.symbol,
      name: template.name,
    });
  }

  _startTurn() {
    this.turnNumber++;
    this.phase = 'action';

    // Reset unit actions
    for (const unit of this.units) {
      unit.hasMoved = false;
      unit.hasAttacked = false;
    }

    // Give resources
    if (this.turn === 1) {
      this.playerResources += 50 + this.turnNumber * 5;
    } else {
      this.enemyResources += 50 + this.turnNumber * 5;
    }

    // AI buys units
    if (this.turn === 2) {
      this._aiBuyUnits();
    }

    this.selectedUnit = null;
    this.selectedAction = null;
    this.validTargets = [];
    this.message = `Turno ${this.turnNumber}: ${this.turn === 1 ? 'Tu turno' : 'Turno enemigo'}`;
    this.messageTimer = 2;

    // AI starts thinking
    if (this.turn === 2) {
      this.phase = 'ai-thinking';
      this.aiTimer = 1;
    }
  }

  _aiBuyUnits() {
    // AI tries to buy units at its spawn points
    const spawnPoints = this._getSpawnPoints(2);
    if (spawnPoints.length === 0) return;

    // Try to buy cavalry if can afford
    const affordableUnits = ['infantry', 'archer', 'cavalry'].filter(
      (t) => UNIT_TYPES[t].cost <= this.enemyResources
    );

    if (affordableUnits.length === 0) return;

    // Buy 1-2 units
    const buyCount = Math.min(1 + Math.floor(Math.random() * 2), affordableUnits.length, spawnPoints.length);
    for (let i = 0; i < buyCount; i++) {
      const type = affordableUnits[Math.floor(Math.random() * affordableUnits.length)];
      const cost = UNIT_TYPES[type].cost;
      if (this.enemyResources >= cost && spawnPoints.length > 0) {
        const sp = spawnPoints.shift();
        if (sp) {
          this._addUnit(type, 2, sp.col, sp.row);
          this.enemyResources -= cost;
        }
      }
    }
  }

  _getSpawnPoints(owner) {
    const points = [];
    for (let row = 0; row < TERRAIN_ROWS; row++) {
      for (let col = 0; col < TERRAIN_COLS; col++) {
        if (this.territory[row][col].isSpawn && this.territory[row][col].owner === owner) {
          // Check no unit on this tile
          const occupied = this.units.some((u) => u.col === col && u.row === row && u.hp > 0);
          if (!occupied) {
            points.push({ col, row });
          }
        }
      }
    }
    return points;
  }

  _endTurn() {
    // Check win condition
    const playerUnits = this.units.filter((u) => u.owner === 1 && u.hp > 0);
    const enemyUnits = this.units.filter((u) => u.owner === 2 && u.hp > 0);

    // Check territory captured
    if (enemyUnits.length === 0) {
      this.phase = 'won';
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
      this.message = 'Derrota... Todas tus unidades caídas';
      this._checkHighscore();
      return;
    }

    // Switch turn
    this.turn = this.turn === 1 ? 2 : 1;
    this._startTurn();
  }

  _checkHighscore() {
    if (this.turnNumber > this.highscore) {
      this.highscore = this.turnNumber;
      this.storage.set('highscore', this.highscore);
    }
  }

  /** Get units that haven't performed their action */
  _getActionableUnits(owner) {
    return this.units.filter(
      (u) => u.owner === owner && u.hp > 0 && (!u.hasMoved || !u.hasAttacked)
    );
  }

  /** Get valid movement tiles for a unit */
  _getValidMoves(unit) {
    if (unit.hasMoved) return [];
    const moves = [];
    for (let dr = -unit.moveRange; dr <= unit.moveRange; dr++) {
      for (let dc = -unit.moveRange; dc <= unit.moveRange; dc++) {
        if (dr === 0 && dc === 0) continue;
        const dist = Math.abs(dr) + Math.abs(dc);
        if (dist > unit.moveRange) continue;

        const nr = unit.row + dr;
        const nc = unit.col + dc;
        if (nr < 0 || nr >= TERRAIN_ROWS || nc < 0 || nc >= TERRAIN_COLS) continue;

        // Check no unit on tile
        const occupied = this.units.some((u) => u.col === nc && u.row === nr && u.hp > 0);
        if (occupied) continue;

        moves.push({ col: nc, row: nr });
      }
    }
    return moves;
  }

  /** Get valid attack targets for a unit */
  _getValidAttacks(unit) {
    if (unit.hasAttacked) return [];
    const targets = [];
    for (const other of this.units) {
      if (other.owner === unit.owner || other.hp <= 0) continue;
      const dist = Math.abs(other.col - unit.col) + Math.abs(other.row - unit.row);
      if (dist <= unit.range) {
        targets.push(other);
      }
    }
    return targets;
  }

  update(dt) {
    if (this.phase === 'won' || this.phase === 'lost') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }
      this.input.endFrame();
      return;
    }

    // Update message timer
    if (this.messageTimer > 0) this.messageTimer -= dt;

    // Update particles
    this._updateParticles(dt);

    // AI phase
    if (this.phase === 'ai-thinking') {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this._aiDoAction();
      }
      this.input.endFrame();
      return;
    }

    // Animation phase
    if (this.animating) {
      this.animationProgress += dt * 3;
      if (this.animationProgress >= 1) {
        this.animationProgress = 0;
        this.animating = false;

        if (this.animUnit) {
          // Apply attack damage
          if (this.animTarget) {
            this.animTarget.hp -= this.animUnit.damage;
            this.animUnit.hasAttacked = true;
            this._spawnParticles(
              this._tileToPixel(this.animTarget.col, this.animTarget.row).x,
              this._tileToPixel(this.animTarget.col, this.animTarget.row).y,
              '#e74c3c',
              10,
              100
            );

            if (this.animTarget.hp <= 0) {
              this._spawnParticles(
                this._tileToPixel(this.animTarget.col, this.animTarget.row).x,
                this._tileToPixel(this.animTarget.col, this.animTarget.row).y,
                '#ffb454',
                15,
                150
              );
              // Capturar territorio al eliminar unidad
              this._captureTerritory(this.animTarget.col, this.animTarget.row, this.animUnit.owner);
            }
          }
          if (this._checkAllActionsDone()) {
            this._endTurn();
          } else {
            this.phase = 'action';
          }
        }
        this.animUnit = null;
        this.animTarget = null;
      }
      this.input.endFrame();
      return;
    }

    // Player action phase
    if (this.phase === 'action' && this.turn === 1) {
      this._handlePlayerInput();
    }

    this.input.endFrame();
  }

  _handlePlayerInput() {
    if (!this.input.mouse.clickedThisFrame) return;

    const mx = this.input.mouse.x;
    const my = this.input.mouse.y;

    // "End Turn" button
    if (pointInRect(mx, my, this._getEndTurnRect())) {
      this._endTurn();
      return;
    }

    // "Buy Unit" button
    const buyRect = this._getBuyButtonRect();
    if (pointInRect(mx, my, buyRect)) {
      this._playerBuyUnit();
      return;
    }

    // Check tile click
    const tile = this._pixelToTile(mx, my);
    if (!tile) return;
    const { col, row } = tile;

    // If a unit is selected and we click a valid move target
    if (this.selectedUnit && this.validTargets.some((t) => t.col === col && t.row === row)) {
      // Move unit
      this.selectedUnit.col = col;
      this.selectedUnit.row = row;
      this.selectedUnit.hasMoved = true;

      // Capture territory
      this._captureTerritory(col, row, 1);

      this.selectedUnit = null;
      this.validTargets = [];
      this.selectedAction = null;
      return;
    }

    // If a unit is selected and we click a valid attack target
    if (this.selectedUnit && this.validTargets.some((u) => u.col === col && u.row === row)) {
      const target = this.validTargets.find((u) => u.col === col && u.row === row);
      if (target) {
        // Animate attack
        this.animating = true;
        this.animationProgress = 0;
        this.animUnit = this.selectedUnit;
        this.animTarget = target;
        this.phase = 'attacking';
        this.selectedUnit = null;
        this.validTargets = [];
        return;
      }
    }

    // Try selecting a unit
    const clickedUnit = this.units.find(
      (u) => u.owner === 1 && u.hp > 0 && u.col === col && u.row === row
    );

    if (clickedUnit) {
      this.selectedUnit = clickedUnit;
      this.selectedAction = null;
      // Show move targets
      this.validTargets = this._getValidMoves(clickedUnit);
      // Show attack targets
      const attacks = this._getValidAttacks(clickedUnit);
      this.validTargets = [...this.validTargets, ...attacks];
      return;
    }

    // Click elsewhere deselects
    this.selectedUnit = null;
    this.validTargets = [];
  }

  _playerBuyUnit() {
    // Find player spawn point
    const spawnPoints = this._getSpawnPoints(1);
    if (spawnPoints.length === 0) {
      this.message = 'No hay punto de aparición libre';
      this.messageTimer = 1.5;
      return;
    }

    // Try to buy infantry (cheapest)
    const template = UNIT_TYPES['infantry'];
    if (this.playerResources >= template.cost) {
      const sp = spawnPoints[0];
      this._addUnit('infantry', 1, sp.col, sp.row);
      this.playerResources -= template.cost;
      this.message = '¡Unidad comprada!';
      this.messageTimer = 1;
    } else {
      this.message = 'No tienes suficientes recursos';
      this.messageTimer = 1.5;
    }
  }

  _captureTerritory(col, row, owner) {
    // Capture adjacent territories
    const directions = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dc, dr] of directions) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc >= 0 && nc < TERRAIN_COLS && nr >= 0 && nr < TERRAIN_ROWS) {
        if (this.territory[nr][nc].owner !== owner) {
          this.territory[nr][nc].owner = owner;
          this._spawnParticles(
            this._tileToPixel(nc, nr).x,
            this._tileToPixel(nc, nr).y,
            owner === 1 ? '#4a9eff' : '#e74c3c',
            5,
            60
          );
        }
      }
    }
  }

  _checkAllActionsDone() {
    const actionable = this._getActionableUnits(this.turn);
    return actionable.length === 0;
  }

  _aiDoAction() {
    const units = this._getActionableUnits(2);
    if (units.length === 0) {
      this._endTurn();
      return;
    }

    // Pick a unit that hasn't moved or attacked
    const unit = units[0];

    // Try to attack first
    const attacks = this._getValidAttacks(unit);
    if (attacks.length > 0) {
      // Attack nearest target
      const target = attacks.reduce((nearest, t) => {
        const d1 = Math.abs(t.col - unit.col) + Math.abs(t.row - unit.row);
        const d2 = Math.abs(nearest.col - unit.col) + Math.abs(nearest.row - unit.row);
        return d1 < d2 ? t : nearest;
      });

      if (target) {
        this.animating = true;
        this.animationProgress = 0;
        this.animUnit = unit;
        this.animTarget = target;
        this.phase = 'attacking';
        return;
      }
    }

    // Try to move toward enemy territory
    if (!unit.hasMoved) {
      const moves = this._getValidMoves(unit);
      if (moves.length > 0) {
        // Move toward nearest player unit or center
        const sorted = moves.sort((a, b) => {
          const distA = a.col; // Move right (toward player side)
          const distB = b.col;
          return distB - distA; // Enemy is on right, so move LEFT
        });

        const bestMove = sorted[sorted.length - 1];
        if (bestMove) {
          unit.col = bestMove.col;
          unit.row = bestMove.row;
          unit.hasMoved = true;
          this._captureTerritory(bestMove.col, bestMove.row, 2);
        }
      }
    }

    unit.hasAttacked = true;
    // Check if all done
    if (this._checkAllActionsDone()) {
      this._endTurn();
    } else {
      // Continue with next unit after short delay
      this.aiTimer = 0.3 + Math.random() * 0.3;
    }
  }

  _pixelToTile(px, py) {
    const col = Math.floor((px - this.GRID_OFFSET_X) / TILE_SIZE);
    const row = Math.floor((py - this.GRID_OFFSET_Y) / TILE_SIZE);
    if (col >= 0 && col < TERRAIN_COLS && row >= 0 && row < TERRAIN_ROWS) {
      return { col, row };
    }
    return null;
  }

  _tileToPixel(col, row) {
    return {
      x: this.GRID_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2,
      y: this.GRID_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  _getEndTurnRect() {
    return {
      x: this.width - 120,
      y: 8,
      width: 110,
      height: 30,
    };
  }

  _getBuyButtonRect() {
    return {
      x: 10,
      y: this.height - 60,
      width: 160,
      height: 30,
    };
  }

  _spawnParticles(x, y, color, count, speed) {
    this.particles.emit(x, y, color, count, speed, { vyOffset: -30, lifeMin: 0.3, lifeMax: 0.5 });
  }

  _updateParticles(dt) {
    this.particles.update(dt);
  }

  render(ctx) {
    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    // Grid border
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      this.GRID_OFFSET_X - 2,
      this.GRID_OFFSET_Y - 2,
      TERRAIN_COLS * TILE_SIZE + 4,
      TERRAIN_ROWS * TILE_SIZE + 4
    );

    // Render territory tiles
    for (let row = 0; row < TERRAIN_ROWS; row++) {
      for (let col = 0; col < TERRAIN_COLS; col++) {
        const x = this.GRID_OFFSET_X + col * TILE_SIZE;
        const y = this.GRID_OFFSET_Y + row * TILE_SIZE;
        const terr = this.territory[row][col];

        // Tile background
        if (terr.owner === 0) {
          ctx.fillStyle = '#1a2a1a';
        } else if (terr.owner === 1) {
          ctx.fillStyle = '#0d1a2e';
        } else {
          ctx.fillStyle = '#2e0d1a';
        }
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Territory color overlay
        if (terr.owner === 1) {
          ctx.fillStyle = COLORS.playerZone;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        } else if (terr.owner === 2) {
          ctx.fillStyle = COLORS.enemyZone;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }

        // Grid line
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

        // Spawn zone marker
        if (terr.isSpawn) {
          ctx.strokeStyle = terr.owner === 1 ? '#4a9eff' : '#e74c3c';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
          ctx.setLineDash([]);
        }
      }
    }

    // Render units
    for (const unit of this.units) {
      if (unit.hp <= 0) continue;

      const pos = this._tileToPixel(unit.col, unit.row);
      const isSelected = this.selectedUnit === unit;
      const isEnemy = unit.owner === 2;

      // Selection highlight
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, TILE_SIZE * 0.4, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.marquee;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Unit circle background
      const color = isEnemy ? COLORS.enemyColor : COLORS.playerColor;
      ctx.fillStyle = isSelected ? '#1e2731' : '#11161d';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Unit symbol
      ctx.fillStyle = color;
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unit.symbol, pos.x, pos.y);

      // HP bar
      const barW = 30;
      const barH = 4;
      const barX = pos.x - barW / 2;
      const barY = pos.y + 22;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);
      const hpPct = unit.hp / unit.maxHp;
      ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : hpPct > 0.25 ? '#ffb454' : '#e74c3c';
      ctx.fillRect(barX + 1, barY + 1, (barW - 2) * hpPct, barH - 2);

      // Unit name (small)
      ctx.fillStyle = COLORS.inkDim;
      ctx.font = '8px monospace';
      ctx.fillText(unit.name, pos.x, barY + 9);
      ctx.textAlign = 'left';
    }

    // Valid move targets
    for (const target of this.validTargets) {
      if (target.hp !== undefined) {
        // Attack target
        const pos = this._tileToPixel(target.col, target.row);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(231, 76, 60, 0.15)';
        ctx.fill();
      } else {
        // Move target
        const pos = this._tileToPixel(target.col, target.row);
        ctx.fillStyle = 'rgba(74, 158, 255, 0.15)';
        ctx.fillRect(
          this.GRID_OFFSET_X + target.col * TILE_SIZE + 2,
          this.GRID_OFFSET_Y + target.row * TILE_SIZE + 2,
          TILE_SIZE - 4,
          TILE_SIZE - 4
        );
        ctx.strokeStyle = 'rgba(74, 158, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          this.GRID_OFFSET_X + target.col * TILE_SIZE + 2,
          this.GRID_OFFSET_Y + target.row * TILE_SIZE + 2,
          TILE_SIZE - 4,
          TILE_SIZE - 4
        );
      }
    }

    this.particles.render(ctx);

    // Attack animation
    if (this.animating && this.animUnit && this.animTarget) {
      const from = this._tileToPixel(this.animUnit.col, this.animUnit.row);
      const to = this._tileToPixel(this.animTarget.col, this.animTarget.row);
      const t = this.animationProgress;

      // Projectile line
      ctx.strokeStyle = COLORS.marquee;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      ctx.stroke();

      // Hit flash at target
      if (t > 0.8) {
        const flashAlpha = (t - 0.8) / 0.2;
        ctx.beginPath();
        ctx.arc(to.x, to.y, 15 * flashAlpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 180, 84, ${flashAlpha * 0.5})`;
        ctx.fill();
      }
    }

    // Animation progress - draw moving unit
    if (this.animating && this.animUnit && this.animTarget) {
      // Already handled above
    }

    // HUD
    ctx.fillStyle = COLORS.inkDim;
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Turno: ${this.turnNumber}`, 10, 10);

    // Turn indicator
    const turnColor = this.turn === 1 ? COLORS.playerColor : COLORS.enemyColor;
    ctx.fillStyle = turnColor;
    ctx.fillText(this.turn === 1 ? '► TÚ' : '◄ BOT', 10, 30);

    // Resources
    ctx.fillStyle = COLORS.inkDim;
    ctx.fillText(`Recursos: $${this.playerResources}`, this.width / 2 - 60, 10);

    // High score
    if (this.highscore > 0) {
      ctx.fillText(`Récord: ${this.highscore} turnos`, this.width - 200, 10);
    }
    if (this.wins > 0) {
      ctx.fillText(`Victorias: ${this.wins}`, this.width - 200, 28);
    }

    // End Turn button
    const endRect = this._getEndTurnRect();
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(endRect.x, endRect.y, endRect.width, endRect.height);
    ctx.strokeStyle = COLORS.line;
    ctx.strokeRect(endRect.x, endRect.y, endRect.width, endRect.height);
    ctx.fillStyle = COLORS.ink;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TERMINAR TURNO', endRect.x + endRect.width / 2, endRect.y + endRect.height / 2);
    ctx.textAlign = 'left';

    // Buy unit button
    const buyRect = this._getBuyButtonRect();
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(buyRect.x, buyRect.y, buyRect.width, buyRect.height);
    ctx.strokeStyle = COLORS.line;
    ctx.strokeRect(buyRect.x, buyRect.y, buyRect.width, buyRect.height);
    ctx.fillStyle = COLORS.playerColor;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('COMPRAR INFANTERÍA ($100)', buyRect.x + buyRect.width / 2, buyRect.y + buyRect.height / 2);
    ctx.textAlign = 'left';

    // Message
    if (this.messageTimer > 0 && this.message) {
      const alpha = Math.min(1, this.messageTimer);
      ctx.fillStyle = COLORS.marquee;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = alpha;
      ctx.fillText(this.message, this.width / 2, this.GRID_OFFSET_Y + TERRAIN_ROWS * TILE_SIZE + 30);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    // Unit info
    if (this.selectedUnit) {
      const u = this.selectedUnit;
      ctx.fillStyle = COLORS.inkDim;
      ctx.font = '11px monospace';
      const infoY = this.height - 25;
      ctx.fillText(`${u.name} | HP: ${u.hp}/${u.maxHp} | ATQ: ${u.damage} | RNG: ${u.range} | MOV: ${u.moveRange}`, 10, infoY);
    }

    // Win/Lose overlay
    if (this.phase === 'won' || this.phase === 'lost') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = COLORS.ink;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (this.phase === 'won') {
        ctx.fillText('¡VICTORIA!', this.width / 2, this.height / 2 - 30);
        ctx.font = '16px monospace';
        ctx.fillText(`Territorio enemigo conquistado en ${this.turnNumber} turnos`, this.width / 2, this.height / 2 + 10);
      } else {
        ctx.fillText('DERROTA', this.width / 2, this.height / 2 - 30);
        ctx.font = '16px monospace';
        ctx.fillText('Todas tus unidades han caído', this.width / 2, this.height / 2 + 10);
      }

      ctx.fillText('Click o Espacio para reiniciar', this.width / 2, this.height / 2 + 40);
      ctx.textAlign = 'left';
    }
  }

  destroy() {
    this.input.detach();
  }
}
