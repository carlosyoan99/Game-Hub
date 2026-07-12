/**
 * Swords and Souls
 * Nivel 5 — RPG y Acción Compleja
 *
 * Mecánica principal:
 *   1. Hub con zonas: Casa, Entrenamiento, Arena, Tienda
 *   2. Minijuegos de entrenamiento que suben estadísticas (clic repetitivo,
 *      puntería, reflejos)
 *   3. Combate por turnos contra IA adaptativa (la IA aprende de tus
 *      patrones ofensivos/defensivos)
 *   4. Subida de nivel con asignación de puntos
 *   5. Tienda para comprar equipo
 *
 * Persistencia: localStorage vía StorageManager.
 */
import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { pointInRect } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { BASE_HP, HP_PER_LEVEL, SCENES, SCENE_NAME_KEYS, SCENE_SUBTITLE_KEYS, EQUIPMENT, ENEMIES } from './constants.js';

// ─── Clase principal ────────────────────────────────────────────────────

export class SwordsAndSouls {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('swords-and-souls');

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.bestWave = this.storage.get('bestWave', 0);
    this.totalGold = this.storage.get('totalGold', 0);

    this._restart();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
    this._layoutScene();
  }

  _restart() {
    this.rng = new SeededRandom();
    this.seedCode = SeededRandom.encode(this.rng.seed);
    this.player = {
      level: 1,
      xp: 0,
      xpToNext: 20,
      hp: BASE_HP,
      maxHp: BASE_HP,
      str: 3,
      agi: 3,
      end: 3,
      arch: 1,
      gold: 0,
      statPoints: 0,
      weapon: EQUIPMENT.weapons[0],
      armor: EQUIPMENT.armor[0],
      potions: 0,
      bigPotions: 0,
      atkBonus: 0, // permanente de piedra de afilar
      allStatsBonus: 0, // permanente de tomo antiguo
    };

    this.currentScene = 'home';
    this.subScene = null; // 'train-archery' | 'train-spar' | 'train-endurance' | 'combat' | null
    this.message = '';
    this.messageTimer = 0;
    this.status = 'playing'; // 'playing' | 'won' | 'lost'
    this.wave = 0;
    this.winStreak = 0;
    this.particles = new ParticleSystem(120);

    // Estado de entrenamiento
    this.trainTarget = null;
    this.trainClicks = 0;
    this.trainMax = 10;
    this.trainTimer = 0;
    this.trainPhase = 'waiting'; // 'waiting' | 'active' | 'done'

    // Estado de combate
    this.combatLog = [];
    this.combatTurn = 'player'; // 'player' | 'enemy'
    this.combatPhase = 'idle'; // 'idle' | 'player-choice' | 'animating' | 'result'
    this.combatTimer = 0;
    this.enemy = null;
    this.playerDefending = false;

    this._layoutScene();
  }

  _layoutScene() {
    // Only layout menu buttons for sub-scenes that need them
    // Main scene layout is done in render
  }

  // ─── Cálculos de estadísticas derivadas ─────────────────────────────

  _getAttack() {
    return this.player.str + this.player.weapon.strBonus + this.player.atkBonus + this.player.allStatsBonus;
  }

  _getArchery() {
    return this.player.arch + this.player.weapon.archBonus + this.player.allStatsBonus;
  }

  _getDefense() {
    return this.player.end + this.player.armor.defBonus + this.player.allStatsBonus;
  }

  _getSpeed() {
    return this.player.agi + this.player.allStatsBonus;
  }

  _addXp(amount) {
    this.player.xp += amount;
    while (this.player.xp >= this.player.xpToNext) {
      this.player.xp -= this.player.xpToNext;
      this.player.level++;
      this.player.xpToNext = Math.floor(this.player.xpToNext * 1.4) + 5;
      this.player.maxHp = BASE_HP + (this.player.level - 1) * HP_PER_LEVEL;
      this.player.hp = this.player.maxHp;
      this.player.statPoints += 3;
      AudioManager.sfx({ type: 'powerup', volume: 0.5 });
      HapticManager.vibrate('powerup');
      this._showMessage(`🎉 ¡Subiste a nivel ${this.player.level}! +3 puntos de stat`);
    }
  }

  _showMessage(text) {
    this.message = text;
    this.messageTimer = 3;
  }

  _getEnemyForWave() {
    const idx = Math.min(this.wave, ENEMIES.length - 1);
    const base = ENEMIES[idx];
    const scale = 1 + this.wave * 0.15;
    return {
      name: base.name,
      emoji: base.emoji,
      hp: Math.floor(base.hp * scale),
      maxHp: Math.floor(base.hp * scale),
      str: Math.floor(base.str * scale),
      def: Math.floor(base.def * scale),
      arch: Math.floor(base.arch * scale),
      xpReward: Math.floor(base.xpReward * scale),
      goldReward: Math.floor(base.goldReward * scale),
      lastAction: 'none', // Para que la IA se adapte
    };
  }

  // ─── Update ──────────────────────────────────────────────────────────

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) this._restart();
      this.input.endFrame();
      return;
    }

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }

    this.particles.update(dt);

    // Sub-escenas con su propia lógica
    if (this.subScene === 'train-archery' || this.subScene === 'train-spar' || this.subScene === 'train-endurance') {
      this._updateTraining(dt);
    } else if (this.subScene === 'combat') {
      this._updateCombat(dt);
    } else {
      // Hub principal: manejar clicks en botones
      if (this.input.mouse.clickedThisFrame) {
        this._handleHubClick(this.input.mouse.x, this.input.mouse.y);
      }
    }

    this.input.endFrame();
  }

  // ─── Hub ─────────────────────────────────────────────────────────────

  _handleHubClick(x, y) {
    // Botón de volver al hub si estamos en subescena
    if (this.subScene && pointInRect(x, y, this._getBackButtonRect())) {
      if (this.subScene === 'combat') {
        this._fleeCombat();
      } else {
        this.subScene = null;
        this._showMessage('De vuelta en el hub');
      }
      return;
    }

    // Botones de navegación del hub
    if (!this.subScene) {
      const sceneKeys = SCENES;
      const buttons = this._getSceneButtons();
      for (let i = 0; i < buttons.length; i++) {
        if (pointInRect(x, y, buttons[i])) {
          this._goToScene(sceneKeys[i]);
          return;
        }
      }

      // Botón de asignar stats
      if (this.player.statPoints > 0) {
        const statBtns = this._getStatButtons();
        for (const btn of statBtns) {
          if (pointInRect(x, y, btn)) {
            this._assignStat(btn.stat);
            return;
          }
        }
      }

      // Botón de descansar (Casa)
      if (this.currentScene === 'home') {
        const restBtn = this._getRestButton();
        if (restBtn && pointInRect(x, y, restBtn)) {
          this._rest();
          return;
        }
      }

      // Botones de entrenamiento
      if (this.currentScene === 'training') {
        const btnW = this.width * 0.84;
        const startX = this.width * 0.08;
        const startY = 70;
        const gap = 8;
        const btnH = 52;
        const options = [
          { id: 'train-archery', y: startY },
          { id: 'train-spar', y: startY + (btnH + gap) },
          { id: 'train-endurance', y: startY + (btnH + gap) * 2 },
        ];
        for (const opt of options) {
          if (pointInRect(x, y, { x: startX, y: opt.y, width: btnW, height: btnH })) {
            this._startTraining(opt.id);
            return;
          }
        }
      }

      // Botón de combate en la arena
      if (this.currentScene === 'arena' && this.player.hp > 0) {
        const fightBtn = { x: this.width / 2 - 80, y: 170, width: 160, height: 36 };
        if (pointInRect(x, y, fightBtn)) {
          this._startCombat();
          return;
        }
      }
    }

    // Sub-escenas específicas
    if (this.subScene === 'shop') {
      this._handleShopClick(x, y);
    }
  }

  _goToScene(sceneKey) {
    this.currentScene = sceneKey;
    this._showMessage(`→ ${t(SCENE_NAME_KEYS[sceneKey])}`);

    switch (sceneKey) {
      case 'training':
        // Mostrar opciones de entrenamiento
        break;
      case 'arena':
        if (this.player.hp <= 0) {
          this._showMessage('😵 Estás demasiado herido. Descansa en casa.');
        }
        break;
      case 'shop':
        this.subScene = 'shop';
        break;
    }
  }

  // ─── Descanso ────────────────────────────────────────────────────────

  _rest() {
    const heal = Math.floor(this.player.maxHp * 0.4);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    this._showMessage(`💤 Descansaste. +${heal} HP`);
  }

  // ─── Asignación de stats ─────────────────────────────────────────────

  _assignStat(stat) {
    if (this.player.statPoints <= 0) return;
    this.player[stat]++;
    this.player.statPoints--;
    this.player.maxHp = BASE_HP + (this.player.level - 1) * HP_PER_LEVEL;
    const labels = { str: 'Fuerza', agi: 'Agilidad', end: 'Resistencia', arch: 'Arquería' };
    this._showMessage(`⚡ ${labels[stat]} +1`);
  }

  // ─── Entrenamiento ───────────────────────────────────────────────────

  _startTraining(type) {
    this.subScene = type;
    this.trainClicks = 0;
    this.trainPhase = 'waiting';
    this.trainTimer = 0;

    switch (type) {
      case 'train-archery':
        this.trainMax = 5 + this.player.arch;
        this._spawnArcheryTarget();
        break;
      case 'train-spar':
        this.trainMax = 8 + this.player.str;
        this.trainTimer = 3;
        this.trainPhase = 'active';
        break;
      case 'train-endurance':
        this.trainMax = 6 + this.player.end;
        this.trainTimer = 2.5;
        this.trainPhase = 'active';
        break;
    }
  }

  _spawnArcheryTarget() {
    const margin = 60;
    this.trainTarget = {
      x: margin + this.rng.next() * (this.width - margin * 2),
      y: margin + this.rng.next() * (this.height - margin * 2 - 100),
      radius: 18 + this.rng.next() * 8,
      vx: (this.rng.next() - 0.5) * 100,
      vy: (this.rng.next() - 0.5) * 80,
      life: 2,
    };
    this.trainPhase = 'active';
    this.trainTimer = 2;
  }

  _updateTraining(dt) {
    if (this.trainPhase === 'done') return;

    // Botón de volver: permite salir del entrenamiento antes de completarlo
    if (this.input.mouse.clickedThisFrame && pointInRect(this.input.mouse.x, this.input.mouse.y, this._getBackButtonRect())) {
      this.trainPhase = 'done';
      this.subScene = null;
      this._showMessage('Entrenamiento cancelado');
      return;
    }

    // Tiempo restante
    if (this.trainTimer > 0) {
      this.trainTimer -= dt;
      if (this.trainTimer <= 0) {
        if (this.subScene === 'train-archery') {
          // No más blancos por ahora
          this._finishTraining();
          return;
        } else if (this.subScene === 'train-endurance') {
          this._finishTraining();
          return;
        }
      }
    }

    // Click durante entrenamiento
    if (this.input.mouse.clickedThisFrame) {
      const mx = this.input.mouse.x;
      const my = this.input.mouse.y;

      if (this.subScene === 'train-archery' && this.trainTarget) {
        // Click en el blanco
        const dx = mx - this.trainTarget.x;
        const dy = my - this.trainTarget.y;
        if (Math.hypot(dx, dy) < this.trainTarget.radius) {
          this.trainClicks++;
          this.particles.emit(this.trainTarget.x, this.trainTarget.y, '#ffb454', 8, 80, { vyOffset: -20 });
          AudioManager.sfx({ type: 'shoot', volume: 0.25 });
          HapticManager.vibrate('shoot');
          this._spawnArcheryTarget();
          if (this.trainClicks >= this.trainMax) {
            this._finishTraining();
            return;
          }
        }
      } else if (this.subScene === 'train-spar' && this.trainPhase === 'active') {
        // Click rápido en el sparring (zona grande)
        const sparBtn = this._getSparButton();
        if (pointInRect(mx, my, sparBtn)) {
          this.trainClicks++;
          AudioManager.sfx({ type: 'hit', volume: 0.2 });
          this.particles.emit(mx, my, '#e7edf3', 4, 60, { vyOffset: -15 });
          if (this.trainClicks >= this.trainMax) {
            this._finishTraining();
            return;
          }
        }
      } else if (this.subScene === 'train-endurance') {
        this.trainClicks++;
        if (this.trainClicks >= this.trainMax) {
          this._finishTraining();
          return;
        }
        // Reiniciar timer parcialmente
        this.trainTimer = Math.min(this.trainTimer + 0.3, 2.5);
      }
    }

    // Mover blanco de arquería
    if (this.subScene === 'train-archery' && this.trainTarget) {
      this.trainTarget.x += this.trainTarget.vx * dt;
      this.trainTarget.y += this.trainTarget.vy * dt;
      // Rebotar en bordes
      if (this.trainTarget.x < 60 || this.trainTarget.x > this.width - 60) this.trainTarget.vx *= -1;
      if (this.trainTarget.y < 60 || this.trainTarget.y > this.height - 160) this.trainTarget.vy *= -1;
    }

    // Endurance: perder ritmo = penalización
    if (this.subScene === 'train-endurance' && this.trainPhase === 'active') {
      // Si pasan 1.5s sin click, se acaba
    }
  }

  _finishTraining() {
    this.trainPhase = 'done';

    let stat = 'str';
    let statLabel = 'Fuerza';
    let xpGain = 5 + this.trainClicks;

    switch (this.subScene) {
      case 'train-archery':
        stat = 'arch';
        statLabel = 'Arquería';
        this.player.arch += Math.ceil(this.trainClicks / 3);
        break;
      case 'train-spar':
        stat = 'str';
        statLabel = 'Fuerza';
        this.player.str += Math.ceil(this.trainClicks / 3);
        break;
      case 'train-endurance':
        stat = 'end';
        statLabel = 'Resistencia';
        this.player.end += Math.ceil(this.trainClicks / 3);
        break;
    }

    this._addXp(xpGain);
    this._showMessage(`🏋️ ${statLabel}: +${Math.ceil(this.trainClicks / 3)} | +${xpGain} XP`);
    this.subScene = null;
  }

  // ─── Combate por turnos ──────────────────────────────────────────────

  _startCombat() {
    if (this.player.hp <= 0) {
      this._showMessage('😵 No puedes combatir así. Descansa primero.');
      return;
    }

    this.wave++;
    this.enemy = this._getEnemyForWave();
    this.combatLog = [`¡${this.enemy.name} aparece!`];
    this.combatTurn = 'player';
    this.combatPhase = 'player-choice';
    this.playerDefending = false;
    this.subScene = 'combat';
  }

  _updateCombat(dt) {
    if (this.combatPhase === 'animating') {
      this.combatTimer -= dt;
      if (this.combatTimer <= 0) {
        if (this.combatTurn === 'enemy') {
          this._executeEnemyTurn();
        } else {
          // Transición a turno enemigo
          this.combatTurn = 'enemy';
          this.combatPhase = 'ai-thinking';
          this.combatTimer = 0.6;
        }
      }
      return;
    }

    if (this.combatPhase === 'ai-thinking') {
      this.combatTimer -= dt;
      if (this.combatTimer <= 0) {
        this.combatPhase = 'animating';
        this.combatTimer = 0.5;
      }
      return;
    }

    if (this.combatPhase === 'player-choice' && this.input.mouse.clickedThisFrame) {
      this._handleCombatClick(this.input.mouse.x, this.input.mouse.y);
    }
  }

  _handleCombatClick(x, y) {
    const btns = this._getCombatButtons();
    for (const btn of btns) {
      if (pointInRect(x, y, btn)) {
        this._doPlayerAction(btn.action);
        return;
      }
    }
  }

  _doPlayerAction(action) {
    const player = this.player;
    const enemy = this.enemy;
    let msg = '';

    switch (action) {
      case 'attack': {
        const atk = this._getAttack() + this.rng.nextInt(0, 3);
        const def = enemy.def;
        const dmg = Math.max(1, atk - def + this.rng.nextInt(0, 2));
        enemy.hp -= dmg;
        msg = `⚔️ ¡${dmg} de daño!`;
        AudioManager.sfx({ type: 'hit', volume: 0.35, playbackRate: 0.9 });
        HapticManager.vibrate('hit');
        this.particles.emit(this.width * 0.7, this.height * 0.35, '#ff6b4a', 10, 120, { vyOffset: -30 });
        enemy.lastAction = 'player-attack';
        break;
      }
      case 'archery': {
        const atk = this._getArchery() + this.rng.nextInt(0, 2);
        const def = Math.floor(enemy.def * 0.5);
        const dmg = Math.max(1, atk - def + this.rng.nextInt(0, 2));
        enemy.hp -= dmg;
        msg = `🏹 ¡${dmg} de daño preciso!`;
        AudioManager.sfx({ type: 'shoot', volume: 0.35 });
        HapticManager.vibrate('shoot');
        this.particles.emit(this.width * 0.7, this.height * 0.35, '#4a9eff', 8, 140, { vyOffset: -40 });
        enemy.lastAction = 'player-archery';
        break;
      }
      case 'defend': {
        this.playerDefending = true;
        msg = '🛡️ Te preparas para defender';
        enemy.lastAction = 'player-defend';
        break;
      }
      case 'heal': {
        if (player.potions > 0) {
          const heal = 30;
          player.hp = Math.min(player.maxHp, player.hp + heal);
          player.potions--;
          msg = `💚 +${heal} HP (quedan ${player.potions})`;
          AudioManager.sfx({ type: 'powerup', volume: 0.3, playbackRate: 0.6 });
          HapticManager.vibrate('powerup');
          this.particles.emit(this.width * 0.3, this.height * 0.4, '#3a9a5a', 8, 60, { vyOffset: -20 });
        } else {
          this._showMessage('❌ No tienes pociones');
          return;
        }
        break;
      }
      case 'heal_big': {
        if (player.bigPotions > 0) {
          const heal = 60;
          player.hp = Math.min(player.maxHp, player.hp + heal);
          player.bigPotions--;
          msg = `💚💚 +${heal} HP (quedan ${player.bigPotions})`;
          AudioManager.sfx({ type: 'powerup', volume: 0.35, playbackRate: 0.5 });
          HapticManager.vibrate('powerup');
          this.particles.emit(this.width * 0.3, this.height * 0.4, '#3a9a5a', 12, 80, { vyOffset: -20 });
        } else {
          this._showMessage('❌ No tienes pociones grandes');
          return;
        }
        break;
      }
    }

    if (msg) {
      this.combatLog.push(msg);
    }

    // Check enemy death
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      this._winCombat();
      return;
    }

    // Avanzar a turno enemigo
    this.combatPhase = 'animating';
    this.combatTimer = 0.5;
  }

  _executeEnemyTurn() {
    const enemy = this.enemy;
    const player = this.player;
    let msg = '';

    // IA adaptativa: elige acción según HP y último movimiento del jugador
    const enemyHpPct = enemy.hp / enemy.maxHp;
    const actions = [];

    // Siempre puede ataque básico
    actions.push('attack');

    // Si tiene mucha vida, puede atacar más
    if (enemyHpPct > 0.5) {
      actions.push('attack');
      actions.push('attack');
      // Si el jugador se defendió mucho, la IA usa arquería (ignora defensa parcial)
      if (enemy.lastAction === 'player-defend' && enemy.arch > 0) {
        actions.push('archery');
        actions.push('archery');
      }
    }

    // Si le queda poca vida, puede defenderse o atacar desesperadamente
    if (enemyHpPct < 0.3) {
      actions.push('desperate');
      actions.push('desperate');
    }

    // Si el jugador atacó mucho, la IA se defiende
    if (enemy.lastAction === 'player-attack' || enemy.lastAction === 'player-archery') {
      actions.push('defend');
    }

    const choice = actions[this.rng.nextInt(0, actions.length - 1)];

    switch (choice) {
      case 'attack': {
        const atk = enemy.str + this.rng.nextInt(0, 2);
        const def = this.playerDefending ? this._getDefense() * 1.5 : this._getDefense();
        const dmg = Math.max(1, atk - def + this.rng.nextInt(0, 1));
        player.hp -= dmg;
        msg = `💥 ${enemy.name} ataca: ¡${dmg} de daño!`;
        AudioManager.sfx({ type: 'hit', volume: 0.4 });
        HapticManager.vibrate('hit');
        this.particles.emit(this.width * 0.3, this.height * 0.4, '#e74c3c', 8, 100, { vyOffset: -25 });
        break;
      }
      case 'archery': {
        const atk = enemy.arch + this.rng.nextInt(0, 1);
        const dmg = Math.max(1, atk + this.rng.nextInt(0, 1));
        player.hp -= dmg;
        msg = `🏹 ${enemy.name} dispara: ¡${dmg} de daño!`;
        AudioManager.sfx({ type: 'shoot', volume: 0.3 });
        HapticManager.vibrate('shoot');
        this.particles.emit(this.width * 0.3, this.height * 0.4, '#e74c3c', 6, 120, { vyOffset: -30 });
        break;
      }
      case 'defend': {
        msg = `🛡️ ${enemy.name} se defiende`;
        // Efecto: el próximo ataque del jugador hará menos daño
        enemy.def += 3;
        break;
      }
      case 'desperate': {
        const atk = enemy.str * 1.5 + this.rng.nextInt(0, 4);
        const dmg = Math.max(1, atk - this._getDefense());
        player.hp -= dmg;
        msg = `🔥 ${enemy.name} ataque desesperado: ¡${dmg} de daño!`;
        AudioManager.sfx({ type: 'explosion', volume: 0.45 });
        HapticManager.vibrate('explosion');
        this.particles.emit(this.width * 0.3, this.height * 0.4, '#ffb454', 15, 150, { vyOffset: -40 });
        break;
      }
    }

    // Restaurar defensa extra del enemigo si se defendió
    if (choice === 'defend') {
      // Ya se aplicó arriba, se mantiene para el siguiente turno
    } else if (enemy.def > this._getEnemyForWave().def) {
      // Restaurar defensa gradualmente
      enemy.def = Math.max(enemy.def - 1, this._getEnemyForWave().def);
    }

    this.playerDefending = false;
    this.combatLog.push(msg);

    // Check player death
    if (player.hp <= 0) {
      player.hp = 0;
      this._loseCombat();
      return;
    }

    // Volver a turno del jugador
    this.combatTurn = 'player';
    this.combatPhase = 'player-choice';
  }

  _winCombat() {
    const enemy = this.enemy;
    AudioManager.sfx({ type: 'powerup', volume: 0.5 });
    HapticManager.vibrate('powerup');
    this.player.gold += enemy.goldReward;
    this._addXp(enemy.xpReward);
    this.winStreak++;
    this.combatLog.push(`🏆 ${enemy.name} derrotado! +${enemy.xpReward}XP, +${enemy.goldReward} oro`);

    if (this.wave > this.bestWave) {
      this.bestWave = this.wave;
      this.storage.set('bestWave', this.bestWave);
    }
    if (this.player.gold > this.totalGold) {
      this.totalGold = this.player.gold;
      this.storage.set('totalGold', this.totalGold);
    }

    // Curar un poco tras combate
    const heal = Math.floor(this.player.maxHp * 0.15);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);

    this.subScene = null;
    this._showMessage(`🏆 ${enemy.name} derrotado! +${enemy.xpReward}XP`);
  }

  _loseCombat() {
    this.combatLog.push('💀 Has caído...');
    this.winStreak = 0;
    this.subScene = null;
    if (this.wave > this.bestWave) {
      this.bestWave = this.wave;
      this.storage.set('bestWave', this.bestWave);
    }
    // Revivir con algo de vida
    AudioManager.sfx({ type: 'explosion', volume: 0.5 });
    HapticManager.vibrate('explosion');
    this.player.hp = Math.floor(this.player.maxHp * 0.3);
    this._showMessage('💀 Derrotado. Los héroes se levantan de nuevo.');
  }

  // ─── Escape de combate ──────────────────────────────────────────────

  _fleeCombat() {
    // No penalizamos la oleada — el jugador puede intentarlo de nuevo
    this.wave = Math.max(0, this.wave - 1);
    this.enemy = null;
    this.combatPhase = 'idle';
    this.subScene = null;
    this._showMessage('🏃 Has huido del combate');
  }

  // ─── Tienda ──────────────────────────────────────────────────────────

  _handleShopClick(x, y) {
    // Categorías
    const categories = [
      { id: 'weapons', label: 'Armas' },
      { id: 'armor', label: 'Armaduras' },
      { id: 'items', label: 'Objetos' },
    ];

    const catBtns = this._getCategoryButtons();
    if (!this.shopCategory) {
      for (let i = 0; i < catBtns.length; i++) {
        if (pointInRect(x, y, catBtns[i])) {
          this.shopCategory = categories[i].id;
          return;
        }
      }
    } else {
      // Botón de volver a categorías
      const backRect = { x: 10, y: 60, width: 80, height: 24 };
      if (pointInRect(x, y, backRect)) {
        this.shopCategory = null;
        return;
      }

      // Items de la categoría
      const items = EQUIPMENT[this.shopCategory];
      const buttons = this._getShopItemButtons(items);
      for (let i = 0; i < buttons.length; i++) {
        if (pointInRect(x, y, buttons[i])) {
          this._buyItem(this.shopCategory, i);
          return;
        }
      }
    }
  }

  _buyItem(category, index) {
    const items = EQUIPMENT[category];
    const item = items[index];
    const p = this.player;

    if (p.gold < item.cost) {
      this._showMessage(`❌ No tienes suficiente oro (${item.cost})`);
      return;
    }

    p.gold -= item.cost;

    switch (category) {
      case 'weapons':
        p.weapon = item;
        AudioManager.sfx({ type: 'select', volume: 0.4 });
        HapticManager.vibrate('select');
        this._showMessage(`🗡️ ${item.name} equipada!`);
        break;
      case 'armor':
        p.armor = item;
        AudioManager.sfx({ type: 'select', volume: 0.4 });
        HapticManager.vibrate('select');
        this._showMessage(`🛡️ ${item.name} equipada!`);
        break;
      case 'items':
        if (item.id === 'potion_hp') {
          p.potions++;
          AudioManager.sfx({ type: 'coin', volume: 0.3 });
          this._showMessage(`🧪 ${item.name} adquirida! (${p.potions})`);
        } else if (item.id === 'potion_big') {
          p.bigPotions++;
          AudioManager.sfx({ type: 'coin', volume: 0.3 });
          this._showMessage(`🧪 ${item.name} adquirida! (${p.bigPotions})`);
        } else if (item.id === 'sharpening_stone') {
          p.atkBonus += 2;
          AudioManager.sfx({ type: 'powerup', volume: 0.4 });
          HapticManager.vibrate('powerup');
          this._showMessage(`⚔️ ¡Ataque permanente +2!`);
        } else if (item.id === 'tome') {
          p.allStatsBonus++;
          AudioManager.sfx({ type: 'powerup', volume: 0.4 });
          HapticManager.vibrate('powerup');
          this._showMessage(`📖 ¡Todas las stats +1!`);
        }
        break;
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    this._renderBackground(ctx);

    if (this.subScene === 'train-archery' || this.subScene === 'train-spar' || this.subScene === 'train-endurance') {
      this._renderTraining(ctx);
    } else if (this.subScene === 'combat') {
      this._renderCombat(ctx);
    } else if (this.subScene === 'shop') {
      this._renderShop(ctx);
    } else {
      this._renderHub(ctx);
    }

    this.particles.render(ctx);

    // Message overlay
    if (this.message) {
      const alpha = Math.min(1, this.messageTimer);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(this.width / 2 - 160, this.height - 50, 320, 36);
      ctx.fillStyle = `rgba(231, 237, 243, ${alpha})`;
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.message, this.width / 2, this.height - 32);
      ctx.textAlign = 'left';
    }
  }

  _renderBackground(ctx) {
    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#0d1b2a');
    grad.addColorStop(0.5, '#1b2838');
    grad.addColorStop(1, '#0f1a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
  }

  _getSceneButtons() {
    const count = SCENES.length;
    const btnW = Math.min(160, (this.width - 60) / count);
    const btnH = 40;
    const totalW = count * btnW + (count - 1) * 10;
    const startX = (this.width - totalW) / 2;
    const y = this.height - 60;
    return SCENES.map((_, i) => ({
      x: startX + i * (btnW + 10),
      y,
      width: btnW,
      height: btnH,
    }));
  }

  _getStatButtons() {
    const stats = ['str', 'agi', 'end', 'arch'];
    const labels = ['💪', '💨', '🛡️', '🏹'];
    const buttons = [];
    const startX = this.width * 0.55;
    const startY = 80;
    for (let i = 0; i < stats.length; i++) {
      buttons.push({
        x: startX,
        y: startY + i * 26,
        width: 140,
        height: 22,
        stat: stats[i],
        label: `${labels[i]} ${stats[i].toUpperCase()}`,
      });
    }
    return buttons;
  }

  _getRestButton() {
    if (this.currentScene !== 'home') return null;
    return { x: this.width * 0.55, y: 190, width: 140, height: 28 };
  }

  _getBackButtonRect() {
    return { x: 10, y: 8, width: 80, height: 24 };
  }

  _renderHub(ctx) {
    // Header
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 20px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(t(SCENE_NAME_KEYS[this.currentScene]), 15, 12);

    ctx.fillStyle = '#7c8894';
    ctx.font = '11px monospace';
    ctx.fillText(t(SCENE_SUBTITLE_KEYS[this.currentScene]), 15, 36);

    // Stats bar (top right)
    const p = this.player;
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Nv.${p.level}  ❤️${p.hp}/${p.maxHp}  💰${p.gold}`, this.width - 15, 12);
    ctx.font = '10px monospace';
    ctx.fillStyle = '#7c8894';
    ctx.fillText(`XP ${p.xp}/${p.xpToNext}  💪${p.str}  💨${p.agi}  🛡️${p.end}  🏹${p.arch}`, this.width - 15, 30);
    ctx.textAlign = 'left';

    // Separator
    ctx.strokeStyle = '#1e2731';
    ctx.beginPath();
    ctx.moveTo(10, 56);
    ctx.lineTo(this.width - 10, 56);
    ctx.stroke();

    // Content per scene
    if (this.currentScene === 'home') {
      this._renderHome(ctx);
    } else if (this.currentScene === 'training') {
      this._renderTrainingOptions(ctx);
    } else if (this.currentScene === 'arena') {
      this._renderArenaOptions(ctx);
    }

    // Stat points assignment
    if (p.statPoints > 0) {
      ctx.fillStyle = '#ffb454';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(t('swords.statsAvailable', { n: p.statPoints }), this.width * 0.55, 64);

      const btns = this._getStatButtons();
      for (const btn of btns) {
        ctx.fillStyle = '#11161d';
        ctx.strokeStyle = '#2a3a4a';
        ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
        ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
        ctx.fillStyle = '#9aa7b2';
        ctx.font = '10px monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, btn.x + 6, btn.y + btn.height / 2);
      }
    }

    // Rest button for home
    if (this.currentScene === 'home') {
      const restBtn = this._getRestButton();
      if (restBtn && p.hp < p.maxHp) {
        ctx.fillStyle = '#1a2a1a';
        ctx.strokeStyle = '#3a5a3a';
        ctx.fillRect(restBtn.x, restBtn.y, restBtn.width, restBtn.height);
        ctx.strokeRect(restBtn.x, restBtn.y, restBtn.width, restBtn.height);
      ctx.fillStyle = '#7cbd7c';
      ctx.font = '11px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(t('swords.rest'), restBtn.x + restBtn.width / 2, restBtn.y + restBtn.height / 2);
      ctx.textAlign = 'left';
      }

      // Equipment display
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.fillText(`🗡️ ${p.weapon.name} (ATQ +${p.weapon.strBonus + p.weapon.archBonus})`, 15, 70);
      ctx.fillText(`🛡️ ${p.armor.name} (DEF +${p.armor.defBonus})`, 15, 84);
      ctx.fillText(`🧪 Pociones: ${p.potions} | Grandes: ${p.bigPotions}`, 15, 98);
      if (p.atkBonus > 0) ctx.fillText(`⚔️ Bono ataque: +${p.atkBonus}`, 15, 112);
      if (p.allStatsBonus > 0) ctx.fillText(`📖 Bono stats: +${p.allStatsBonus}`, 15, 126);

      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.fillText(t('swords.bestWave', { n: this.bestWave }), 15, this.height - 95);
      ctx.fillText(t('swords.totalGold', { n: this.totalGold }), 15, this.height - 81);
      ctx.fillText(t('game.seed', { seed: this.seedCode }), 15, this.height - 67);
    }

    // Scene nav buttons
    const buttons = this._getSceneButtons();
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const isCurrent = SCENES[i] === this.currentScene;
      ctx.fillStyle = isCurrent ? '#1e2a38' : '#11161d';
      ctx.strokeStyle = isCurrent ? '#4a7abb' : '#1e2731';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
      ctx.fillStyle = isCurrent ? '#b0c4e0' : '#9aa7b2';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t(SCENE_NAME_KEYS[SCENES[i]]), btn.x + btn.width / 2, btn.y + btn.height / 2);
    }
    ctx.textAlign = 'left';
  }

  _renderHome(ctx) {
    // Already handled in _renderHub
  }

  _renderTrainingOptions(ctx) {
    const options = [
      { id: 'train-archery', labelKey: 'swords.trainingArchery', descKey: 'swords.trainingDescArch', clicks: '5-8' },
      { id: 'train-spar', labelKey: 'swords.trainingSpar', descKey: 'swords.trainingDescSpar', clicks: '8-12' },
      { id: 'train-endurance', labelKey: 'swords.trainingEndurance', descKey: 'swords.trainingDescEnd', clicks: '6-10' },
    ];

    const btnH = 52;
    const btnW = this.width * 0.84;
    const startX = this.width * 0.08;
    const startY = 70;
    const gap = 8;

    for (let i = 0; i < options.length; i++) {
      const y = startY + i * (btnH + gap);
      const btn = { x: startX, y, width: btnW, height: btnH };

      ctx.fillStyle = '#11161d';
      ctx.strokeStyle = '#1e2731';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

      ctx.fillStyle = '#e7edf3';
      ctx.font = '13px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(t(options[i].labelKey), btn.x + 10, btn.y + 6);
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.fillText(t(options[i].descKey), btn.x + 10, btn.y + 24);
      ctx.fillText(options[i].clicks, btn.x + btn.width - 80, btn.y + 6);
    }
  }

  _renderArenaOptions(ctx) {
    const canFight = this.player.hp > 0;

    ctx.fillStyle = '#7c8894';
    ctx.font = '12px monospace';      ctx.fillText(t('swords.currentWave', { n: this.wave + 1 }), 15, 70);
    ctx.fillText(t('swords.winStreak', { n: this.winStreak }), 15, 88);

    if (this.wave < ENEMIES.length) {
      const nextEnemy = this._getEnemyForWave();
      ctx.fillStyle = '#e7edf3';
      ctx.font = '14px monospace';
      ctx.fillText(t('swords.nextEnemy', { emoji: nextEnemy.emoji, name: nextEnemy.name }), 15, 112);
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.fillText(`HP: ${nextEnemy.hp}  ATQ: ${nextEnemy.str}  DEF: ${nextEnemy.def}`, 15, 130);
      ctx.fillText(t('swords.enemyReward', { xp: nextEnemy.xpReward, gold: nextEnemy.goldReward }), 15, 144);

      // Fight button
      const fightBtn = { x: this.width / 2 - 80, y: 170, width: 160, height: 36 };
      ctx.fillStyle = canFight ? '#2a1a1a' : '#11161d';
      ctx.strokeStyle = canFight ? '#8a3a3a' : '#1e2731';
      ctx.fillRect(fightBtn.x, fightBtn.y, fightBtn.width, fightBtn.height);
      ctx.strokeRect(fightBtn.x, fightBtn.y, fightBtn.width, fightBtn.height);

      ctx.fillStyle = canFight ? '#e74c3c' : '#4a5058';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(canFight ? t('swords.fight') : t('swords.injured'), fightBtn.x + fightBtn.width / 2, fightBtn.y + fightBtn.height / 2);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = '#ffb454';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(t('swords.allDefeated'), 15, 112);
    }
  }

  _renderTraining(ctx) {
    const backBtn = this._getBackButtonRect();
    ctx.fillStyle = '#11161d';
    ctx.strokeStyle = '#1e2731';
    ctx.fillRect(backBtn.x, backBtn.y, backBtn.width, backBtn.height);
    ctx.strokeRect(backBtn.x, backBtn.y, backBtn.width, backBtn.height);
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('← VOLVER', backBtn.x + 6, backBtn.y + backBtn.height / 2);

    const labelKeys = {
      'train-archery': 'swords.trainingArchery',
      'train-spar': 'swords.trainingSpar',
      'train-endurance': 'swords.trainingEndurance',
    };

    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 16px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(t(labelKeys[this.subScene]), 15, 12);

    ctx.fillStyle = '#7c8894';
    ctx.font = '11px monospace';
    ctx.fillText(t('swords.progress', { n: this.trainClicks, max: this.trainMax }), 15, 38);

    // Progress bar
    const pct = this.trainClicks / this.trainMax;
    const barW = this.width - 30;
    const barH = 8;
    ctx.fillStyle = '#1e2731';
    ctx.fillRect(15, 56, barW, barH);
    ctx.fillStyle = '#ffb454';
    ctx.fillRect(15, 56, barW * pct, barH);

    if (this.trainPhase === 'done') {
      ctx.fillStyle = '#3a7d5c';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t('swords.trainingComplete'), this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#9aa7b2';
      ctx.font = '12px monospace';
      ctx.fillText(t('swords.clickToContinue'), this.width / 2, this.height / 2 + 10);
      ctx.textAlign = 'left';
      return;
    }

    switch (this.subScene) {
      case 'train-archery':
        if (this.trainTarget) {
          // Moving target
          const t = this.trainTarget;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
          ctx.fillStyle = '#e74c3c';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Bullseye
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.radius * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();

          ctx.fillStyle = '#9aa7b2';
          ctx.font = '11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('¡Haz clic en el blanco!', this.width / 2, this.height - 30);
          ctx.textAlign = 'left';
        }
        break;

      case 'train-spar': {
        const sparBtn = this._getSparButton();
        ctx.fillStyle = '#1a1a2a';
        ctx.strokeStyle = '#3a3a5a';
        ctx.fillRect(sparBtn.x, sparBtn.y, sparBtn.width, sparBtn.height);
        ctx.strokeRect(sparBtn.x, sparBtn.y, sparBtn.width, sparBtn.height);

        ctx.fillStyle = '#9aa7b2';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎯', sparBtn.x + sparBtn.width / 2, sparBtn.y + sparBtn.height / 2);
        ctx.textAlign = 'left';

        ctx.fillStyle = '#9aa7b2';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('¡Haz clic rápido en el saco!', this.width / 2, this.height - 30);
        ctx.textAlign = 'left';
        break;
      }

      case 'train-endurance':
        ctx.fillStyle = '#9aa7b2';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🏃 ¡Haz clic para mantener el ritmo!', this.width / 2, this.height * 0.4);
        ctx.font = '11px monospace';
        ctx.fillText('Clickea lo más rápido que puedas', this.width / 2, this.height * 0.45);
        ctx.textAlign = 'left';
        break;
    }
  }

  _getSparButton() {
    return { x: this.width / 2 - 40, y: this.height / 2 - 40, width: 80, height: 80 };
  }

  _renderCombat(ctx) {
    const backBtn = this._getBackButtonRect();
    ctx.fillStyle = '#11161d';
    ctx.strokeStyle = '#1e2731';
    ctx.fillRect(backBtn.x, backBtn.y, backBtn.width, backBtn.height);
    ctx.strokeRect(backBtn.x, backBtn.y, backBtn.width, backBtn.height);
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('swords.flee'), backBtn.x + 6, backBtn.y + backBtn.height / 2);

    // Enemy display (right half)
    if (this.enemy) {
      const e = this.enemy;
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`${e.emoji} ${e.name}`, this.width * 0.55, 12);

      // Enemy HP bar
      const eHpW = this.width * 0.35;
      const eHpX = this.width * 0.55;
      ctx.fillStyle = '#333';
      ctx.fillRect(eHpX, 36, eHpW, 12);
      const eHpPct = e.hp / e.maxHp;
      ctx.fillStyle = eHpPct > 0.5 ? '#e74c3c' : eHpPct > 0.25 ? '#ffb454' : '#8a3a3a';
      ctx.fillRect(eHpX, 36, eHpW * eHpPct, 12);
      ctx.fillStyle = '#9aa7b2';
      ctx.font = '9px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${e.hp}/${e.maxHp}`, eHpX + eHpW / 2 - 20, 42);
    }

    // Player display (left half)
    const p = this.player;
    ctx.fillStyle = '#4a9eff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('🧑 Tú', 15, 12);

    const pHpW = this.width * 0.35;
    ctx.fillStyle = '#333';
    ctx.fillRect(15, 36, pHpW, 12);
    const pHpPct = p.hp / p.maxHp;
    ctx.fillStyle = pHpPct > 0.5 ? '#3a9a5a' : pHpPct > 0.25 ? '#ffb454' : '#e74c3c';
    ctx.fillRect(15, 36, pHpW * pHpPct, 12);
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '9px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${p.hp}/${p.maxHp}`, 15 + pHpW / 2 - 20, 42);

    // Divider
    ctx.strokeStyle = '#1e2731';
    ctx.beginPath();
    ctx.moveTo(this.width / 2, 8);
    ctx.lineTo(this.width / 2, 56);
    ctx.stroke();

    // Combat log
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    const logStartY = 62;
    const logLines = this.combatLog.slice(-5);
    for (let i = 0; i < logLines.length; i++) {
      ctx.fillText(logLines[i], 15, logStartY + i * 16);
    }

    // Combat buttons
    if (this.combatPhase === 'player-choice') {
      const btns = this._getCombatButtons();
      for (const btn of btns) {
        const disabled = (btn.action === 'heal' && p.potions <= 0) || (btn.action === 'heal_big' && p.bigPotions <= 0);
        ctx.fillStyle = disabled ? '#0d1117' : '#11161d';
        ctx.strokeStyle = disabled ? '#1a1f26' : '#1e2731';
        ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
        ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

        ctx.fillStyle = disabled ? '#4a5058' : '#e7edf3';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2);
      }
      ctx.textAlign = 'left';
    } else if (this.combatPhase === 'ai-thinking' || this.combatPhase === 'animating') {
      ctx.fillStyle = '#ffb454';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.combatTurn === 'enemy' ? t('swords.enemyTurn') : t('swords.combatLogPlaceholder'), this.width / 2, this.height - 30);
      ctx.textAlign = 'left';
    }

    // Escaped via back button
  }

  _getCombatButtons() {
    const btnW = Math.min(130, (this.width - 50) / 4);
    const btnH = 36;
    const gap = 6;
    const totalW = 4 * btnW + 3 * gap;
    const startX = (this.width - totalW) / 2;
    const y = this.height - 50;

    const actions = [
      { action: 'attack', label: t('swords.combatAttack') },
      { action: 'archery', label: t('swords.combatArchery') },
      { action: 'defend', label: t('swords.combatDefend') },
      { action: 'heal', label: t('swords.combatHeal', { n: this.player.potions }) },
    ];

    // Add big potion as 5th button if available
    return actions.map((a, i) => ({
      x: startX + i * (btnW + gap),
      y,
      width: btnW,
      height: btnH,
      action: a.action,
      label: a.label,
    }));
  }

  _renderShop(ctx) {
    const backBtn = this._getBackButtonRect();
    ctx.fillStyle = '#11161d';
    ctx.strokeStyle = '#1e2731';
    ctx.fillRect(backBtn.x, backBtn.y, backBtn.width, backBtn.height);
    ctx.strokeRect(backBtn.x, backBtn.y, backBtn.width, backBtn.height);
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('swords.back'), backBtn.x + 6, backBtn.y + backBtn.height / 2);

    ctx.fillStyle = '#ffb454';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(t('swords.shopTitle'), 15, 12);
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '11px monospace';
    ctx.fillText(t('swords.shopGold', { n: this.player.gold }), this.width - 100, 14);

    if (!this.shopCategory) {
      // Show categories
      const categories = [
        { id: 'weapons', labelKey: 'swords.shopWeapons', descKey: 'swords.shopWeaponsDesc' },
        { id: 'armor', labelKey: 'swords.shopArmor', descKey: 'swords.shopArmorDesc' },
        { id: 'items', labelKey: 'swords.shopItems', descKey: 'swords.shopItemsDesc' },
      ];

      const catBtns = this._getCategoryButtons();
      for (let i = 0; i < catBtns.length; i++) {
        const btn = catBtns[i];
        ctx.fillStyle = '#11161d';
        ctx.strokeStyle = '#1e2731';
        ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
        ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
        ctx.fillStyle = '#e7edf3';
        ctx.font = '13px monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText(t(categories[i].labelKey), btn.x + 10, btn.y + 16);
        ctx.fillStyle = '#7c8894';
        ctx.font = '10px monospace';
        ctx.fillText(t(categories[i].descKey), btn.x + 10, btn.y + 34);
      }
    } else {
      // Show items in category
      const items = EQUIPMENT[this.shopCategory];
      const itemBtns = this._getShopItemButtons(items);

      // Back to categories
      const catBack = { x: 10, y: 60, width: 80, height: 24 };
      ctx.fillStyle = '#11161d';
      ctx.strokeStyle = '#1e2731';
      ctx.fillRect(catBack.x, catBack.y, catBack.width, catBack.height);
      ctx.strokeRect(catBack.x, catBack.y, catBack.width, catBack.height);
      ctx.fillStyle = '#9aa7b2';
      ctx.font = '9px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('swords.shopCategories'), catBack.x + 4, catBack.y + catBack.height / 2);

      for (let i = 0; i < itemBtns.length; i++) {
        const btn = itemBtns[i];
        const item = items[i];
        const owned = this._isItemOwned(item);
        const canAfford = this.player.gold >= item.cost;

        ctx.fillStyle = '#11161d';
        ctx.strokeStyle = owned ? '#3a5a3a' : (canAfford ? '#1e2731' : '#1a1f26');
        ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
        ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

        ctx.fillStyle = owned ? '#7cbd7c' : '#e7edf3';
        ctx.font = '12px monospace';
        ctx.textBaseline = 'top';
        ctx.fillText(item.name, btn.x + 10, btn.y + 6);

        ctx.fillStyle = '#7c8894';
        ctx.font = '10px monospace';
        ctx.fillText(item.desc, btn.x + 10, btn.y + 24);

        ctx.textAlign = 'right';
        if (owned) {
          ctx.fillStyle = '#3a7d5c';
          ctx.fillText(t('swords.shopEquipped'), btn.x + btn.width - 10, btn.y + 10);
        } else if (item.cost === 0) {
          ctx.fillStyle = '#3a7d5c';
          ctx.fillText(t('swords.shopFree'), btn.x + btn.width - 10, btn.y + 10);
        } else {
          ctx.fillStyle = canAfford ? '#ffb454' : '#8a3a3a';
          ctx.fillText(t('swords.shopCost', { n: item.cost }), btn.x + btn.width - 10, btn.y + 10);
        }
        ctx.textAlign = 'left';
      }
    }
  }

  _getCategoryButtons() {
    const btnW = this.width * 0.84;
    const btnH = 50;
    const startX = this.width * 0.08;
    const startY = 70;
    const gap = 8;
    return [
      { x: startX, y: startY, width: btnW, height: btnH },
      { x: startX, y: startY + btnH + gap, width: btnW, height: btnH },
      { x: startX, y: startY + (btnH + gap) * 2, width: btnW, height: btnH },
    ];
  }

  _getShopItemButtons(items) {
    const btnW = this.width * 0.84;
    const btnH = 46;
    const startX = this.width * 0.08;
    const startY = 94;
    const gap = 6;
    return items.map((_, i) => ({
      x: startX,
      y: startY + i * (btnH + gap),
      width: btnW,
      height: btnH,
    }));
  }

  _isItemOwned(item) {
    const p = this.player;
    if (item.strBonus !== undefined && item.archBonus !== undefined) {
      // Weapon
      return p.weapon.id === item.id;
    }
    if (item.defBonus !== undefined) {
      // Armor
      return p.armor.id === item.id;
    }
    return false;
  }

  // ─── Limpieza ────────────────────────────────────────────────────────

  destroy() {
    this.input.detach();
  }
}
