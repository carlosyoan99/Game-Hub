/**
 * Street Fighter-like (Pelea 1v1)
 * Nivel 5 — Juego de lucha completo
 *
 * Mecánica: 2 jugadores (PvP local o vs IA) con 4 personajes,
 * barra de salud y super, rounds al mejor de 3, movimientos
 * especiales con combos de teclas.
 */
import { GameBase } from '../../engine/GameBase.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { aabbIntersects, clamp, pointInRect } from '../../engine/CollisionUtils.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ─── Personajes ──────────────────────────────────────────────────────

const CHAR_DEFS = [
  {
    id: 'ryu', name: 'Ryu',
    color: '#e7edf3', pantsColor: '#e7edf3', skinColor: '#d4a574',
    hp: 100, speed: 180, jumpVel: -420,
    attacks: {
      punch: { damage: 6, startup: 3, active: 2, recovery: 4, range: 40, hitstun: 12 },
      kick:  { damage: 9, startup: 5, active: 3, recovery: 6, range: 50, hitstun: 16 },
      special: { damage: 14, startup: 8, active: 4, recovery: 10, range: 70, hitstun: 20, name: 'Hadouken' },
      super: { damage: 25, startup: 10, active: 6, recovery: 12, range: 80, hitstun: 30, name: 'Shinku Hadouken' },
    },
    specialKey: '236P',
  },
  {
    id: 'ken', name: 'Ken',
    color: '#e74c3c', pantsColor: '#e7edf3', skinColor: '#d4a574',
    hp: 95, speed: 190, jumpVel: -430,
    attacks: {
      punch: { damage: 5, startup: 2, active: 2, recovery: 4, range: 38, hitstun: 11 },
      kick:  { damage: 8, startup: 4, active: 3, recovery: 5, range: 48, hitstun: 15 },
      special: { damage: 12, startup: 6, active: 3, recovery: 8, range: 65, hitstun: 18, name: 'Tatsumaki' },
      super: { damage: 22, startup: 8, active: 5, recovery: 10, range: 75, hitstun: 28, name: 'Shoryuken' },
    },
    specialKey: '623P',
  },
  {
    id: 'chunli', name: 'Chun-Li',
    color: '#4a9eff', pantsColor: '#4a9eff', skinColor: '#e8c898',
    hp: 90, speed: 210, jumpVel: -440,
    attacks: {
      punch: { damage: 4, startup: 2, active: 3, recovery: 3, range: 36, hitstun: 10 },
      kick:  { damage: 7, startup: 3, active: 4, recovery: 4, range: 52, hitstun: 14 },
      special: { damage: 10, startup: 5, active: 5, recovery: 7, range: 60, hitstun: 16, name: 'Lightning Kick' },
      super: { damage: 20, startup: 7, active: 8, recovery: 9, range: 70, hitstun: 26, name: 'Spinning Bird' },
    },
    specialKey: '236K',
  },
  {
    id: 'dhalsim', name: 'Dhalsim',
    color: '#d4a574', pantsColor: '#e74c3c', skinColor: '#6b3a2a',
    hp: 105, speed: 140, jumpVel: -400,
    attacks: {
      punch: { damage: 7, startup: 5, active: 4, recovery: 6, range: 55, hitstun: 14 },
      kick:  { damage: 10, startup: 7, active: 5, recovery: 8, range: 65, hitstun: 18 },
      special: { damage: 15, startup: 10, active: 6, recovery: 12, range: 90, hitstun: 22, name: 'Yoga Flame' },
      super: { damage: 28, startup: 12, active: 8, recovery: 14, range: 100, hitstun: 32, name: 'Yoga Inferno' },
    },
    specialKey: '214P',
  },
  // ── Nuevos personajes ───────────────────────────────────────────────
  {
    id: 'zangief', name: 'Zangief',
    color: '#e74c3c', pantsColor: '#1a1a2a', skinColor: '#d4a574',
    hp: 120, speed: 120, jumpVel: -380,
    attacks: {
      punch: { damage: 8, startup: 5, active: 3, recovery: 6, range: 32, hitstun: 14 },
      kick:  { damage: 11, startup: 7, active: 4, recovery: 8, range: 42, hitstun: 18 },
      special: { damage: 18, startup: 10, active: 5, recovery: 12, range: 30, hitstun: 24, name: 'Pile Driver' },
      super: { damage: 30, startup: 12, active: 8, recovery: 14, range: 35, hitstun: 35, name: 'Atomic Buster' },
    },
    specialKey: '360P',
  },
  {
    id: 'guile', name: 'Guile',
    color: '#4a9eff', pantsColor: '#4a9eff', skinColor: '#d4a574',
    hp: 100, speed: 170, jumpVel: -420,
    attacks: {
      punch: { damage: 5, startup: 3, active: 2, recovery: 3, range: 42, hitstun: 11 },
      kick:  { damage: 9, startup: 5, active: 3, recovery: 5, range: 55, hitstun: 16 },
      special: { damage: 13, startup: 10, active: 5, recovery: 8, range: 80, hitstun: 20, name: 'Sonic Boom' },
      super: { damage: 26, startup: 8, active: 6, recovery: 10, range: 90, hitstun: 30, name: 'Flash Kick' },
    },
    specialKey: '236P',
  },
  {
    id: 'bison', name: 'M. Bison',
    color: '#8b2a8b', pantsColor: '#e74c3c', skinColor: '#c48c5c',
    hp: 110, speed: 190, jumpVel: -420,
    attacks: {
      punch: { damage: 7, startup: 3, active: 3, recovery: 5, range: 40, hitstun: 13 },
      kick:  { damage: 10, startup: 5, active: 4, recovery: 6, range: 50, hitstun: 17 },
      special: { damage: 16, startup: 6, active: 6, recovery: 10, range: 75, hitstun: 22, name: 'Psycho Crusher' },
      super: { damage: 28, startup: 10, active: 8, recovery: 12, range: 85, hitstun: 32, name: 'Knee Press Nightmare' },
    },
    specialKey: '236K',
  },
];

const STATE = { IDLE: 0, WALK_FWD: 1, WALK_BACK: 2, CROUCH: 3, JUMP: 4, PUNCH: 5, KICK: 6, SPECIAL: 7, SUPER: 8, HIT: 9, BLOCK: 10, KO: 11, WIN: 12 };
const JUMP_GRAVITY = 900;
const MAX_ROUNDS = 3;
const ROUND_TIME = 60; // segundos por round

export class StreetFighter extends GameBase {
  init(engine) {
    super.init(engine, 'street-fighter');
    this.highscore = this.storage.get('highscore', 0);
    this.startTime = Date.now();
    this.mode = 'select'; // 'select' | 'playing' | 'won' | 'lost'
    this.p1Char = 0;
    this.p2Char = 1;
    this.p2isAI = true;
    this.difficulty = 1; // 0=easy, 1=normal, 2=hard
    this._startSelect();
  }

  _defaultBindings() {
    return {
      p1left:   ['KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      p1right:  ['KeyD', 'GamepadRight', 'GamepadLStickRight'],
      p1up:     ['KeyW', 'GamepadUp', 'GamepadLStickUp'],
      p1down:   ['KeyS', 'GamepadDown', 'GamepadLStickDown'],
      p1punch:  ['KeyJ', 'GamepadX'],
      p1kick:   ['KeyK', 'GamepadA'],
      p1special:['KeyL', 'GamepadB'],
      p1super:  ['KeyU', 'GamepadY'],
      p2left:   ['ArrowLeft', 'GamepadLeft', 'GamepadLStickLeft'],
      p2right:  ['ArrowRight', 'GamepadRight', 'GamepadLStickRight'],
      p2up:     ['ArrowUp', 'GamepadUp', 'GamepadLStickUp'],
      p2down:   ['ArrowDown', 'GamepadDown', 'GamepadLStickDown'],
      p2punch:  ['KeyR', 'GamepadX'],
      p2kick:   ['KeyF', 'GamepadA'],
      p2special:['KeyT', 'GamepadB'],
      p2super:  ['KeyY', 'GamepadY'],
      select:   ['Space', 'Enter', 'GamepadA'],
      p2select: ['Enter', 'KeyF', 'GamepadA'],
      back:     ['Escape', 'GamepadB'],
      restart:  ['Space', 'GamepadStart', 'GamepadA'],
    };
  }

  _startSelect() {
    this.mode = 'select';
    this.selectPhase = 'p1'; // 'p1' | 'p2'
    this.p1Char = 0;
    this.p2Char = 6; // M. Bison as default P2 (different from P1)
    this.p1Confirmed = false;
    this.selectBlink = 0;
  }

  _startGame() {
    this.mode = 'playing';
    this.p1 = this._makeFighter(1, this.p1Char);
    this.p2 = this._makeFighter(2, this.p2Char);
    this.p2.isAI = this.p2isAI;
    this.round = 1;
    this.roundTimer = ROUND_TIME;
    this.roundState = 'intro'; // 'intro' | 'fight' | 'ko' | 'round_end'
    this.introTimer = 2;
    this.koTimer = 0;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.superFlash = 0;
    this.projectiles = [];
    this._resetPositions();
  }

  _makeFighter(playerNum, charIdx) {
    const def = CHAR_DEFS[charIdx];
    return {
      player: playerNum,
      charIdx,
      def,
      x: playerNum === 1 ? 100 : this.width - 100,
      y: this.height - 120,
      width: 32, height: 64,
      vx: 0, vy: 0,
      hp: def.hp,
      maxHp: def.hp,
      superMeter: 0,
      superMax: 100,
      state: STATE.IDLE,
      facing: playerNum === 1 ? 1 : -1,
      onGround: true,
      frameTimer: 0,
      currentAnim: 'idle',
      animFrame: 0,
      punchCombo: 0,
      comboPunchTimer: 0,
      hitstunTimer: 0,
      blockstunTimer: 0,
      invincible: 0,
      won: false,
    };
  }

  _resetPositions() {
    this.p1.x = 100;
    this.p1.y = this.height - 120;
    this.p1.vx = 0; this.p1.vy = 0;
    this.p2.x = this.width - 100;
    this.p2.y = this.height - 120;
    this.p2.vx = 0; this.p2.vy = 0;
    this.p1.state = STATE.IDLE;
    this.p2.state = STATE.IDLE;
    this.p1.onGround = true;
    this.p2.onGround = true;
    this.p1.hitstunTimer = 0;
    this.p2.hitstunTimer = 0;
  }

  _getAttack(fighter, type) {
    return fighter.def.attacks[type];
  }

  // ── Update ──────────────────────────────────────────────────────────

  update(dt) {
    if (this.mode === 'select') {
      this._updateSelect(dt);
      return;
    }
    if (this.handleRestartInput()) return;

    if (this.introTimer > 0) {
      this.introTimer -= dt;
      if (this.introTimer <= 0) this.roundState = 'fight';
      return;
    }

    if (this.roundState === 'ko') {
      this.koTimer -= dt;
      if (this.koTimer <= 0) this._endRound();
      return;
    }

    if (this.roundState === 'round_end') {
      if (this.input.wasActionPressed('select') || this.input.mouse.clickedThisFrame || this.input.wasPressed('Space')) {
        this._nextRound();
      }
      return;
    }

    if (this.roundTimer > 0) this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this._timeUp();
    }

    if (this.superFlash > 0) this.superFlash -= dt;

    this._updateFighter(this.p1, dt, false);
    this._updateFighter(this.p2, dt, this.p2.isAI);
    this._updateProjectiles(dt);
    this._checkCollisions();
    this._pushApart();
  }

  _updateSelect(dt) {
    this.selectBlink += dt;

    if (this.selectPhase === 'p1') {
      // P1 cycles characters with keyboard A/D or gamepad
      if (this.input.wasActionPressed('p1left')) {
        this.p1Char = (this.p1Char - 1 + CHAR_DEFS.length) % CHAR_DEFS.length;
        AudioManager.sfx({ type: 'select', volume: 0.2 });
      }
      if (this.input.wasActionPressed('p1right')) {
        this.p1Char = (this.p1Char + 1) % CHAR_DEFS.length;
        AudioManager.sfx({ type: 'select', volume: 0.2 });
      }
      // Confirm P1 selection
      if (this.input.wasActionPressed('select') || this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        AudioManager.sfx({ type: 'powerup', volume: 0.3 });
        this.p1Confirmed = true;
        this.selectPhase = 'p2';
        // Set P2 default to a different character
        this.p2Char = (this.p1Char + 3) % CHAR_DEFS.length;
      }
    } else if (this.selectPhase === 'p2') {
      // P2 cycles characters with arrow keys or gamepad
      if (this.input.wasActionPressed('p2left')) {
        do {
          this.p2Char = (this.p2Char - 1 + CHAR_DEFS.length) % CHAR_DEFS.length;
        } while (this.p2Char === this.p1Char); // Skip P1's char
        AudioManager.sfx({ type: 'select', volume: 0.2 });
      }
      if (this.input.wasActionPressed('p2right')) {
        do {
          this.p2Char = (this.p2Char + 1) % CHAR_DEFS.length;
        } while (this.p2Char === this.p1Char); // Skip P1's char
        AudioManager.sfx({ type: 'select', volume: 0.2 });
      }
      // Confirm P2 selection
      if (this.input.wasActionPressed('p2select') || this.input.wasActionPressed('select') || this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        AudioManager.sfx({ type: 'powerup', volume: 0.3 });
        this._startGame();
      }
    }
  }

  _updateFighter(fighter, dt, isAI) {
    if (fighter.hp <= 0 || fighter.state === STATE.KO) {
      fighter.state = STATE.KO;
      return;
    }
    if (fighter.state === STATE.WIN) return;

    if (isAI) {
      this._updateAI(fighter, dt);
    } else {
      this._updateInput(fighter, dt);
    }

    // Physics
    if (!fighter.onGround) {
      fighter.vy += JUMP_GRAVITY * dt;
      fighter.y += fighter.vy * dt;
      if (fighter.y >= this.height - 120) {
        fighter.y = this.height - 120;
        fighter.vy = 0;
        fighter.onGround = true;
      }
    }

    fighter.x += fighter.vx * dt;
    fighter.x = clamp(fighter.x, 20, this.width - 20 - fighter.width);

    // Hitstun / blockstun
    if (fighter.hitstunTimer > 0) fighter.hitstunTimer -= dt;
    if (fighter.blockstunTimer > 0) fighter.blockstunTimer -= dt;
    if (fighter.invincible > 0) fighter.invincible -= dt;

    // Super meter gain
    fighter.superMeter = Math.min(fighter.superMax, fighter.superMeter + 0.3 * dt);
  }

  _updateInput(fighter, dt) {
    const prefix = fighter.player === 1 ? 'p1' : 'p2';
    if (fighter.hitstunTimer > 0) { fighter.state = STATE.HIT; return; }
    if (fighter.blockstunTimer > 0) { fighter.state = STATE.BLOCK; fighter.vx = 0; return; }

    // Don't process input during attack animations
    if (fighter.state === STATE.PUNCH || fighter.state === STATE.KICK ||
        fighter.state === STATE.SPECIAL || fighter.state === STATE.SUPER) {
      fighter.frameTimer -= dt;
      if (fighter.frameTimer <= 0) {
        fighter.state = STATE.IDLE;
        fighter.vx = 0;
      }
      return;
    }

    const left = this.input.isActionDown(`${prefix}left`);
    const right = this.input.isActionDown(`${prefix}right`);
    const down = this.input.isActionDown(`${prefix}down`);
    const up = this.input.isActionDown(`${prefix}up`);

    // Movement
    if (down && fighter.onGround) {
      fighter.state = STATE.CROUCH;
      fighter.vx = 0;
    } else if (left) {
      fighter.state = STATE.WALK_BACK;
      fighter.vx = -fighter.def.speed;
      fighter.facing = -1;
    } else if (right) {
      fighter.state = STATE.WALK_FWD;
      fighter.vx = fighter.def.speed;
      fighter.facing = 1;
    } else if (up && fighter.onGround) {
      fighter.state = STATE.JUMP;
      fighter.vy = fighter.def.jumpVel;
      fighter.onGround = false;
    } else {
      fighter.state = STATE.IDLE;
      fighter.vx = 0;
    }

    // Attacks
    if (this.input.wasActionPressed(`${prefix}punch`)) {
      this._doAttack(fighter, 'punch');
    } else if (this.input.wasActionPressed(`${prefix}kick`)) {
      this._doAttack(fighter, 'kick');
    } else if (this.input.wasActionPressed(`${prefix}special`)) {
      this._doAttack(fighter, 'special');
    } else if (this.input.wasActionPressed(`${prefix}super`) && fighter.superMeter >= fighter.superMax) {
      this._doAttack(fighter, 'super');
      fighter.superMeter = 0;
      this.superFlash = 0.3;
    }
  }

  _doAttack(fighter, type) {
    const atk = this._getAttack(fighter, type);
    if (!atk) return;
    const stateMap = { punch: STATE.PUNCH, kick: STATE.KICK, special: STATE.SPECIAL, super: STATE.SUPER };
    fighter.state = stateMap[type];
    fighter.frameTimer = (atk.startup + atk.active + atk.recovery) / 60;
    fighter.currentAttack = { ...atk, type };
    fighter.vx = 0;
    AudioManager.sfx({ type: 'hit', volume: 0.2 });

    // Spawn projectile for special attacks (Ryu=0, Dhalsim=3, Guile=5)
    if (type === 'special' && (fighter.charIdx === 0 || fighter.charIdx === 3 || fighter.charIdx === 5)) {
      this.projectiles.push({
        x: fighter.x + fighter.width / 2 + fighter.facing * 30,
        y: fighter.y + 24,
        vx: fighter.facing * 400,
        vy: 0,
        life: 1.5,
        damage: atk.damage,
      });
    }

    // Super spawns a fast projectile for all characters
    if (type === 'super') {
      this.projectiles.push({
        x: fighter.x + fighter.width / 2 + fighter.facing * 30,
        y: fighter.y + 24,
        vx: fighter.facing * 600,
        vy: 0,
        life: 2.0,
        damage: atk.damage,
      });
    }
  }

  _updateAI(fighter, dt) {
    if (fighter.hitstunTimer > 0) { fighter.state = STATE.HIT; return; }
    if (fighter.blockstunTimer > 0) { fighter.state = STATE.BLOCK; fighter.vx = 0; return; }
    if (fighter.state === STATE.PUNCH || fighter.state === STATE.KICK ||
        fighter.state === STATE.SPECIAL || fighter.state === STATE.SUPER) {
      fighter.frameTimer -= dt;
      if (fighter.frameTimer <= 0) { fighter.state = STATE.IDLE; fighter.vx = 0; }
      return;
    }

    const opponent = fighter.player === 1 ? this.p2 : this.p1;
    const dx = opponent.x - fighter.x;
    const dist = Math.abs(dx);
    const aggro = 0.5 + this.difficulty * 0.25;
    const reaction = 0.3 - this.difficulty * 0.08;

    fighter.aiTimer = fighter.aiTimer || 0;
    fighter.aiTimer -= dt;
    if (fighter.aiTimer > 0) return;
    fighter.aiTimer = reaction + Math.random() * 0.2;

    // AI decision
    if (dist < 60 && Math.random() < aggro * 0.4) {
      this._doAttack(fighter, Math.random() < 0.5 ? 'punch' : 'kick');
    } else if (dist < 100 && Math.random() < aggro * 0.15 && fighter.superMeter >= fighter.superMax) {
      this._doAttack(fighter, 'super');
      fighter.superMeter = 0;
      this.superFlash = 0.3;
    } else if (dist < 120 && Math.random() < aggro * 0.1) {
      this._doAttack(fighter, 'special');
    } else if (dist > 100 && Math.random() < 0.5) {
      fighter.state = STATE.WALK_FWD;
      fighter.vx = fighter.def.speed * (dx > 0 ? 1 : -1);
      fighter.facing = dx > 0 ? 1 : -1;
    } else if (dist > 40 && Math.random() < 0.3) {
      fighter.state = STATE.WALK_BACK;
      fighter.vx = -fighter.def.speed * (dx > 0 ? 1 : -1);
    } else {
      fighter.state = STATE.IDLE;
      fighter.vx = 0;
    }
  }

  _updateProjectiles(dt) {
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.life -= dt;
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0 && p.x > -50 && p.x < this.width + 50);
  }

  // ── Collisions ──────────────────────────────────────────────────────

  _checkCollisions() {
    const fighters = [this.p1, this.p2];

    for (let fi = 0; fi < fighters.length; fi++) {
      const attacker = fighters[fi];
      if (attacker.hp <= 0 || attacker.state === STATE.KO || attacker.state === STATE.WIN) continue;
      if (!attacker.currentAttack || attacker.frameTimer <= 0) continue;

      const opponent = fighters[1 - fi];
      if (opponent.hp <= 0 || opponent.state === STATE.KO || opponent.state === STATE.WIN) continue;
      if (opponent.invincible > 0) continue;

      const atk = attacker.currentAttack;
      const atkDuration = (atk.startup + atk.active + atk.recovery) / 60;
      const elapsed = atkDuration - attacker.frameTimer;
      const activeStart = atk.startup / 60;
      const activeEnd = (atk.startup + atk.active) / 60;

      // Only check during active frames
      if (elapsed < activeStart || elapsed > activeEnd) continue;

      // Hitbox
      const hitbox = {
        x: attacker.x + (attacker.facing > 0 ? attacker.width : -atk.range),
        y: attacker.y + 10,
        width: atk.range,
        height: attacker.height - 20,
      };
      const defBox = { x: opponent.x, y: opponent.y, width: opponent.width, height: opponent.height };

      if (!aabbIntersects(hitbox, defBox)) continue;

      // Check if opponent is blocking (holding away from attacker)
      const holdingBack = (opponent.vx !== 0 && (
        (attacker.x < opponent.x && opponent.vx > 0) ||
        (attacker.x > opponent.x && opponent.vx < 0)
      ));
      const blocking = opponent.state === STATE.BLOCK || holdingBack;
      const isProjectile = atk.type === 'special' && (attacker.charIdx === 0 || attacker.charIdx === 3 || attacker.charIdx === 5);

      if (blocking && !isProjectile) {
        // Blocked
        const chipDmg = Math.floor(atk.damage * 0.15);
        opponent.hp -= chipDmg;
        opponent.blockstunTimer = atk.hitstun / 60;
        HapticManager.vibrate('hit');
        this._spawnHitEffect(opponent.x + opponent.width / 2, opponent.y + 20, true);
      } else {
        // Hit
        opponent.hp -= atk.damage;
        opponent.hitstunTimer = atk.hitstun / 60;
        opponent.vx = attacker.facing * 300;
        attacker.superMeter = Math.min(attacker.superMax, attacker.superMeter + 5);
        AudioManager.sfx({ type: 'hit', volume: 0.4 });
        HapticManager.vibrate('hit');
        this._spawnHitEffect(opponent.x + opponent.width / 2, opponent.y + 20, false);

        // Super flash
        if (atk.type === 'super') {
          AudioManager.sfx({ type: 'explosion', volume: 0.5 });
          this._spawnHitEffect(opponent.x + opponent.width / 2, opponent.y, false);
        }

        if (opponent.hp <= 0) {
          opponent.hp = 0;
          this._ko(opponent);
          return;
        }
      }
      attacker.currentAttack = null;
    }

    // Special projectiles (hadouken)
    for (const p of this.projectiles) {
      for (const f of fighters) {
        if (f.hp <= 0 || f.invincible > 0) continue;
        const fBox = { x: f.x, y: f.y, width: f.width, height: f.height };
        const pBox = { x: p.x - 8, y: p.y - 8, width: 16, height: 16 };
        if (aabbIntersects(pBox, fBox)) {
          p.life = 0;
          f.hp -= p.damage;
          f.hitstunTimer = 0.3;
          AudioManager.sfx({ type: 'hit', volume: 0.3 });
          this._spawnHitEffect(p.x, p.y, false);
          if (f.hp <= 0) { f.hp = 0; this._ko(f); return; }
        }
      }
    }
  }

  _spawnHitEffect(x, y, blocked) {
    this.hitEffects = this.hitEffects || [];
    for (let i = 0; i < 6; i++) {
      this.hitEffects.push({
        x, y,
        vx: (Math.random() - 0.5) * 200,
        vy: -Math.random() * 200,
        life: 0.3 + Math.random() * 0.3,
        color: blocked ? '#4a9eff' : '#ffd700',
      });
    }
  }

  _ko(loser) {
    loser.state = STATE.KO;
    const winner = loser.player === 1 ? this.p2 : this.p1;
    if (winner.player === 1) this.p1Wins++;
    else this.p2Wins++;
    this.koTimer = 2;
    this.roundState = 'ko';
    AudioManager.sfx({ type: 'explosion', volume: 0.5 });
    HapticManager.vibrate('explosion');
  }

  _timeUp() {
    // Fighter with more HP wins
    if (this.p1.hp > this.p2.hp) { this.p1Wins++; this._ko(this.p2); }
    else if (this.p2.hp > this.p1.hp) { this.p2Wins++; this._ko(this.p1); }
    else { this.p1Wins++; this.p2Wins++; this._ko(this.p1); } // Draw - both get a win
    this.roundState = 'ko';
    this.koTimer = 2;
  }

  _endRound() {
    this.roundState = 'round_end';
    if (this.p1Wins >= 2) {
      this._endGame(true);
    } else if (this.p2Wins >= 2) {
      this._endGame(false);
    }
  }

  _nextRound() {
    this.round++;
    this.roundTimer = ROUND_TIME;
    this.roundState = 'intro';
    this.introTimer = 2;
    this._resetPositions();
    // Restore partial HP
    this.p1.hp = Math.max(this.p1.hp, Math.floor(this.p1.maxHp * 0.3));
    this.p2.hp = Math.max(this.p2.hp, Math.floor(this.p2.maxHp * 0.3));
    this.p1.superMeter = Math.min(this.p1.superMax, this.p1.superMeter + 15);
    this.p2.superMeter = Math.min(this.p2.superMax, this.p2.superMeter + 15);
    this.projectiles = [];
    this.hitEffects = [];
  }

  _pushApart() {
    const dx = this.p1.x - this.p2.x;
    const overlap = Math.abs(dx) - (this.p1.width + this.p2.width) / 2;
    if (overlap < 0) {
      const push = overlap / 2;
      this.p1.x -= push;
      this.p2.x += push;
    }
  }

  _endGame(won) {
    this.mode = won ? 'won' : 'lost';
    this.status = won ? 'won' : 'lost';
    const score = this.p1Wins * 1000 + this.round * 100;
    if (score > this.highscore) {
      this.highscore = score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('street-fighter', score, won, duration);
    if (won) ProgressionManager.checkAchievement('street-fighter', 'first-victory');
    if (this.difficulty >= 2) ProgressionManager.checkAchievement('street-fighter', 'fighting-legend');
    ProgressionManager.checkAchievement('street-fighter', 'round-fighter');
  }

  // ── Render ──────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.mode === 'select') {
      this._renderSelect(ctx);
      return;
    }

    // Stage background
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#0a0a1a');
    grad.addColorStop(0.3, '#1a1a3a');
    grad.addColorStop(0.6, '#2a1a2a');
    grad.addColorStop(1, '#1a0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Floor
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, this.height - 100, this.width, 100);
    ctx.strokeStyle = '#4a4a5a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.height - 100);
    ctx.lineTo(this.width, this.height - 100);
    ctx.stroke();

    // Projectiles
    for (const p of this.projectiles) {
      ctx.fillStyle = '#ff6b4a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hit effects
    if (this.hitEffects) {
      for (const e of this.hitEffects) {
        e.x += e.vx * (1/60);
        e.y += e.vy * (1/60);
        e.vy += 500 * (1/60);
        e.life -= 1/60;
        if (e.life > 0) {
          ctx.globalAlpha = e.life;
          ctx.fillStyle = e.color;
          ctx.fillRect(e.x - 4, e.y - 4, 8, 8);
        }
      }
      this.hitEffects = this.hitEffects.filter(e => e.life > 0);
      ctx.globalAlpha = 1;
    }

    // Fighters
    this._renderFighter(ctx, this.p1);
    this._renderFighter(ctx, this.p2);

    // HUD
    setupHUDContext(ctx);
    this._renderHUD(ctx);

    // Super flash overlay
    if (this.superFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.superFlash * 0.4})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Round intro
    if (this.introTimer > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const msg = this.introTimer > 1 ? t('fighter.round', { n: this.round }) : t('fighter.fight');
      ctx.fillText(msg, this.width / 2, this.height / 2 - 30);
      ctx.textAlign = 'left';
    }

    // KO overlay
    if (this.roundState === 'ko') {
      ctx.fillStyle = '#ff4d4d';
      ctx.font = 'bold 64px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('fighter.ko'), this.width / 2, this.height / 2 - 30);
      ctx.textAlign = 'left';
    }

    if (this.roundState === 'round_end' || this.mode === 'won' || this.mode === 'lost') {
      renderOverlay(ctx, {
        width: this.width, height: this.height,
        title: this.mode === 'won' ? t('fighter.p1wins') : this.mode === 'lost' ? t('fighter.p1loses') : '',
        subtitle: `${this.p1Wins} - ${this.p2Wins}`,
        actionText: t('game.restart'),
      });
    }
  }

  _renderSelect(ctx) {
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Title shows which player is selecting
    const titleText = this.selectPhase === 'p1' ? 'PLAYER 1 SELECT' : 'PLAYER 2 SELECT';
    ctx.fillStyle = this.selectPhase === 'p1' ? '#e74c3c' : '#4a9eff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText, this.width / 2, 30);

    // Character grid (7 characters: 4 cols × 2 rows)
    const cols = 4;
    const cardW = 140;
    const cardH = 170;
    const gap = 12;
    const totalW = cols * cardW + (cols - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const startY = 70;

    for (let i = 0; i < CHAR_DEFS.length; i++) {
      const ch = CHAR_DEFS[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);

      const isP1Char = i === this.p1Char;
      const isP2Char = i === this.p2Char && this.selectPhase === 'p2';
      const isConfirmedP1 = i === this.p1Char && this.p1Confirmed;
      const isP1Selecting = i === this.p1Char && this.selectPhase === 'p1';
      const isP2Selecting = i === this.p2Char && this.selectPhase === 'p2';
      const isLocked = i === this.p1Char && this.p1Confirmed;

      // Card background
      if (isP1Selecting || isConfirmedP1) {
        ctx.fillStyle = '#2a1a1a';
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
      } else if (isP2Selecting) {
        ctx.fillStyle = '#1a1a2a';
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 3;
      } else if (isLocked) {
        ctx.fillStyle = '#2a1a1a';
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = '#11161d';
        ctx.strokeStyle = '#2a3a4a';
        ctx.lineWidth = 1;
      }

      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeRect(x, y, cardW, cardH);

      // P1/P2 indicator blink on the selected card
      if (isP1Selecting || isP2Selecting) {
        const blink = Math.floor(this.selectBlink * 4) % 2 === 0;
        if (blink) {
          ctx.fillStyle = isP1Selecting ? '#e74c3c' : '#4a9eff';
          ctx.globalAlpha = 0.2;
          ctx.fillRect(x + 2, y + 2, cardW - 4, cardH - 4);
          ctx.globalAlpha = 1;
        }
      }

      // Lock overlay for P1's confirmed character
      if (isConfirmedP1) {
        ctx.fillStyle = 'rgba(231, 76, 60, 0.15)';
        ctx.fillRect(x, y, cardW, cardH);
        ctx.fillStyle = '#e74c3c';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('P1', x + cardW / 2, y + 2);
      }
      if (isP2Selecting || (!this.p1Confirmed && i === this.p2Char)) {
        // Show P2 indicator on hovered character during P2 phase
        if (this.selectPhase === 'p2' && isP2Selecting) {
          ctx.fillStyle = '#4a9eff';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText('P2', x + cardW / 2, y + 2);
        }
      }

      // Character preview (simple body, scaled for card height)
      ctx.fillStyle = ch.skinColor;
      ctx.beginPath();
      ctx.arc(x + cardW / 2, y + 50, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ch.color;
      ctx.fillRect(x + cardW / 2 - 16, y + 68, 32, 42);
      ctx.fillStyle = ch.pantsColor;
      ctx.fillRect(x + cardW / 2 - 14, y + 95, 28, 25);

      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(ch.name, x + cardW / 2, y + 148);
      ctx.fillStyle = '#9aa7b2';
      ctx.font = '10px monospace';
      ctx.fillText(`HP:${ch.hp} SPD:${ch.speed}`, x + cardW / 2, y + 162);
      ctx.textAlign = 'left';
    }

    // Bottom instructions
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.selectPhase === 'p1') {
      ctx.fillText('A/D o ← → para mover  |  Espacio para confirmar', this.width / 2, this.height - 40);
    } else {
      ctx.fillText('← → para mover  |  Enter/F para confirmar', this.width / 2, this.height - 40);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderFighter(ctx, f) {
    if (f.hp <= 0 && f.state === STATE.KO) {
      ctx.globalAlpha = 0.5;
    }

    const def = f.def;
    const cx = f.x + f.width / 2;
    const bodyY = f.y;

    // Body
    ctx.fillStyle = def.color;
    ctx.fillRect(cx - 12, bodyY + 20, 24, 36);

    // Head
    ctx.fillStyle = def.skinColor;
    ctx.beginPath();
    ctx.arc(cx, bodyY + 14, 14, 0, Math.PI * 2);
    ctx.fill();

    // Hair/headband
    ctx.fillStyle = def.color;
    ctx.fillRect(cx - 10, bodyY + 4, 20, 6);

    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 5 + f.facing * 2, bodyY + 12, 3, 3);
    ctx.fillRect(cx + 2 + f.facing * 2, bodyY + 12, 3, 3);

    // Legs
    ctx.fillStyle = def.pantsColor;
    const legOffset = f.state === STATE.KICK ? 8 : 0;
    ctx.fillRect(cx - 10, bodyY + 56, 8, 20);
    ctx.fillRect(cx + 2, bodyY + 56 + legOffset, 8, 20 - legOffset);

    // Arms
    ctx.fillStyle = def.skinColor;
    if (f.state === STATE.PUNCH || f.state === STATE.SPECIAL || f.state === STATE.SUPER) {
      ctx.fillRect(cx + f.facing * 8, bodyY + 24, f.facing * 30, 8);
    } else {
      ctx.fillRect(cx + f.facing * 2, bodyY + 24, 6, 22);
      ctx.fillRect(cx - f.facing * 8, bodyY + 24, 6, 22);
    }

    // Super aura
    if (f.superMeter >= f.superMax) {
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, bodyY + 36, 40, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  _renderHUD(ctx) {
    const barW = 250;
    const barH = 16;
    const barY = 14;
    const p1BarX = 20;
    const p2BarX = this.width - 20 - barW;

    // P1 Health
    const p1HpPct = this.p1.hp / this.p1.maxHp;
    ctx.fillStyle = '#2a1a1a';
    ctx.fillRect(p1BarX, barY, barW, barH);
    ctx.fillStyle = p1HpPct > 0.5 ? '#3a9a5a' : p1HpPct > 0.25 ? '#ffb454' : '#e74c3c';
    ctx.fillRect(p1BarX + 1, barY + 1, (barW - 2) * p1HpPct, barH - 2);

    // P2 Health
    const p2HpPct = this.p2.hp / this.p2.maxHp;
    ctx.fillStyle = '#2a1a1a';
    ctx.fillRect(p2BarX, barY, barW, barH);
    ctx.fillStyle = p2HpPct > 0.5 ? '#3a9a5a' : p2HpPct > 0.25 ? '#ffb454' : '#e74c3c';
    ctx.fillRect(p2BarX + 1, barY + 1, (barW - 2) * p2HpPct, barH - 2);

    // Super meter
    const superH = 6;
    const p1SuperPct = this.p1.superMeter / this.p1.superMax;
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(p1BarX, barY + barH + 4, barW, superH);
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(p1BarX + 1, barY + barH + 5, (barW - 2) * p1SuperPct, superH - 2);

    const p2SuperPct = this.p2.superMeter / this.p2.superMax;
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(p2BarX, barY + barH + 4, barW, superH);
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(p2BarX + 1, barY + barH + 5, (barW - 2) * p2SuperPct, superH - 2);

    // Names
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(CHAR_DEFS[this.p1.charIdx].name, p1BarX, barY - 2);
    ctx.textAlign = 'right';
    ctx.fillText(CHAR_DEFS[this.p2.charIdx].name, p2BarX + barW, barY - 2);
    ctx.textAlign = 'left';

    // Round indicator
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    const winsStr = Array(MAX_ROUNDS).fill('○').map((_, i) => {
      if (i < this.p1Wins) return '●';
      if (i >= MAX_ROUNDS - this.p2Wins) return '●';
      return '○';
    }).join(' ');
    ctx.fillText(`${this.p1Wins}  ${winsStr}  ${this.p2Wins}`, this.width / 2, 14);
    ctx.textAlign = 'left';

    // Timer
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(this.roundTimer).toString(), this.width / 2, 42);
    ctx.textAlign = 'left';

    // Highscore
    if (this.highscore > 0) {
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.fillText(t('game.record', { n: this.highscore }), 10, this.height - 10);
    }
  }

}
