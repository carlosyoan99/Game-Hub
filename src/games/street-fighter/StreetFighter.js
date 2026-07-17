/**
 * Street Fighter-like (Pelea 1v1)
 *
 * Mecánica: 2 jugadores (PvP local o vs IA) con 7 personajes,
 * barra de salud y super, rounds al mejor de 3, movimientos
 * especiales.
 *
 * Módulos:
 *   fighters/ — Definiciones de personajes (Ryu, Ken, Chun-Li, etc.)
 *   combat.js — Colisiones, proyectiles, rounds, KO
 *   input.js  — Input humano y IA
 */
import { GameBase } from '../../engine/GameBase.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

import { CHAR_DEFS } from './fighters/index.js';
import {
  STATE, MAX_ROUNDS, ROUND_TIME,
  updateProjectiles, checkCollisions,
  timeUp, endRound, nextRound, pushApart,
} from './combat.js';
import { updateInput, updateAI, applyFighterPhysics } from './input.js';

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
    this.hitEffects = [];
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
      timeUp(this);
    }

    if (this.superFlash > 0) this.superFlash -= dt;

    this._updateFighter(this.p1, dt, false);
    this._updateFighter(this.p2, dt, this.p2.isAI);
    this.projectiles = updateProjectiles(this.projectiles, dt, this.width);
    checkCollisions(this);
    pushApart(this.p1, this.p2);
  }

  _updateSelect(dt) {
    this.selectBlink += dt;

    if (this.selectPhase === 'p1') {
      if (this.input.wasActionPressed('p1left')) {
        this.p1Char = (this.p1Char - 1 + CHAR_DEFS.length) % CHAR_DEFS.length;
        AudioManager.sfx({ type: 'select', volume: 0.2 });
      }
      if (this.input.wasActionPressed('p1right')) {
        this.p1Char = (this.p1Char + 1) % CHAR_DEFS.length;
        AudioManager.sfx({ type: 'select', volume: 0.2 });
      }
      if (this.input.wasActionPressed('select') || this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        AudioManager.sfx({ type: 'powerup', volume: 0.3 });
        this.p1Confirmed = true;
        this.selectPhase = 'p2';
        this.p2Char = (this.p1Char + 3) % CHAR_DEFS.length;
      }
    } else if (this.selectPhase === 'p2') {
      if (this.input.wasActionPressed('p2left')) {
        do {
          this.p2Char = (this.p2Char - 1 + CHAR_DEFS.length) % CHAR_DEFS.length;
        } while (this.p2Char === this.p1Char);
        AudioManager.sfx({ type: 'select', volume: 0.2 });
      }
      if (this.input.wasActionPressed('p2right')) {
        do {
          this.p2Char = (this.p2Char + 1) % CHAR_DEFS.length;
        } while (this.p2Char === this.p1Char);
        AudioManager.sfx({ type: 'select', volume: 0.2 });
      }
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
      updateAI(fighter, dt, this);
    } else {
      updateInput(fighter, dt, this);
    }

    applyFighterPhysics(fighter, dt, this);
  }

  // ── Round management ────────────────────────────────────────────────

  _endRound() {
    const winner = endRound(this);
    if (winner) {
      this._endGame(winner === 'p1');
    } else {
      this.roundState = 'round_end';
    }
  }

  _nextRound() {
    nextRound(this);
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
        e.x += e.vx * (1 / 60);
        e.y += e.vy * (1 / 60);
        e.vy += 500 * (1 / 60);
        e.life -= 1 / 60;
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

    // Character grid
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

      const isP1Selecting = i === this.p1Char && this.selectPhase === 'p1';
      const isP2Selecting = i === this.p2Char && this.selectPhase === 'p2';
      const isConfirmedP1 = i === this.p1Char && this.p1Confirmed;

      // Card background
      if (isP1Selecting || isConfirmedP1) {
        ctx.fillStyle = '#2a1a1a';
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
      } else if (isP2Selecting) {
        ctx.fillStyle = '#1a1a2a';
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 3;
      } else {
        ctx.fillStyle = '#11161d';
        ctx.strokeStyle = '#2a3a4a';
        ctx.lineWidth = 1;
      }

      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeRect(x, y, cardW, cardH);

      if (isP1Selecting || isP2Selecting) {
        const blink = Math.floor(this.selectBlink * 4) % 2 === 0;
        if (blink) {
          ctx.fillStyle = isP1Selecting ? '#e74c3c' : '#4a9eff';
          ctx.globalAlpha = 0.2;
          ctx.fillRect(x + 2, y + 2, cardW - 4, cardH - 4);
          ctx.globalAlpha = 1;
        }
      }

      if (isConfirmedP1) {
        ctx.fillStyle = 'rgba(231, 76, 60, 0.15)';
        ctx.fillRect(x, y, cardW, cardH);
        ctx.fillStyle = '#e74c3c';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('P1', x + cardW / 2, y + 2);
      }

      if (isP2Selecting) {
        ctx.fillStyle = '#4a9eff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('P2', x + cardW / 2, y + 2);
      }

      // Character preview
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
