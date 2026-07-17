/**
 * Guitar Hero-like (Ritmo)
 *
 * Mecánica: 5 carriles (A S D F Espacio), notas que caen,
 * zona de golpe en la parte inferior, combo multiplicador,
 * canciones procedurales, modo práctica.
 *
 * Módulos:
 *   notes.js   — Constantes de carril, canciones, generación procedural
 *   judge.js   — Sistema de timing, combo, puntuación, HP
 *   render.js  — Efectos visuales, renderizado de notas, HUD, explosiones
 */
import { GameBase } from '../../engine/GameBase.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { clamp } from '../../engine/CollisionUtils.js';
import { t } from '../../engine/i18n.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

import {
  LANE_COUNT, LANE_COLORS,
  HIT_ZONE_Y_RATIO, NOTE_SPEED, NOTE_HEIGHT,
  SONG_DEFS, generateSongFromDef, getLaneX,
} from './notes.js';
import {
  MAX_MISS_DISTANCE, HP_DECAY_RATE, HP_HIT_GAIN, HP_PERFECT_GAIN, HP_MISS_LOSS, MAX_HP,
  findBestNote, judgeHit, getComboMultiplier, getScoreForHit, getJudgmentDisplay,
} from './judge.js';
import {
  renderGame, renderSelect,
  spawnHitExplosion, spawnNoteStreak,
  updateParticles, updateStars, updateStreaks,
} from './render.js';

export class GuitarHero extends GameBase {
  init(engine) {
    super.init(engine, 'guitar-hero');
    this.highscore = this.storage.get('highscore', 0);
    this.startTime = Date.now();
    this.phase = 'select';
    this.selectedSong = 0;
    this.practiceMode = false;
    this.practiceSpeed = 0.75;
    this.notesHit = 0;
    this.totalNotes = 0;
    this._startSelect();
  }

  _defaultBindings() {
    return {
      lane0: ['KeyA', 'GamepadLeft'],
      lane1: ['KeyS', 'GamepadDown'],
      lane2: ['KeyD', 'GamepadUp'],
      lane3: ['KeyF', 'GamepadX'],
      lane4: ['Space', 'GamepadA'],
      pause: ['KeyP', 'Escape', 'GamepadStart'],
      select: ['Space', 'Enter', 'GamepadA'],
      next:   ['Space', 'Enter', 'GamepadA'],
      restart:['Space', 'GamepadStart', 'GamepadA'],
      left:   ['ArrowLeft', 'KeyA', 'GamepadLeft'],
      right:  ['ArrowRight', 'KeyD', 'GamepadRight'],
      up:     ['ArrowUp', 'KeyW', 'GamepadUp'],
      down:   ['ArrowDown', 'KeyS', 'GamepadDown'],
    };
  }

  _startSelect() {
    this.phase = 'select';
    this.selectBlink = 0;
    this.practiceMode = false;
    this.practiceSpeed = 0.75;
    this.selectedSong = 0;
  }

  _startGame() {
    const def = SONG_DEFS[this.selectedSong] || SONG_DEFS[0];
    this.song = generateSongFromDef(def, this.rng);
    this.isPractice = this.practiceMode;
    this.speedMult = this.isPractice ? this.practiceSpeed : 1.0;
    this.totalNotes = this.song.totalNotes;
    this.notesHit = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.combo = 0;
    this.hp = MAX_HP;
    this.noteIndex = 0;
    this.songTime = -2;
    this.activeNotes = [];
    this.particles = [];
    this.stars = [];
    this.streakParticles = [];
    this.hitEffects = [];
    this.concertLights = [];
    this.beatTimer = 0;
    this.beatFlash = 0;
    this.equalizer = Array.from({ length: 12 }, () => this.rng.next() * 20 + 10);
    this.judgmentText = null;
    this.judgmentTimer = 0;
    this.starPower = 0;
    this.starPowerActive = false;
    this.starPowerTimer = 0;
    this.paused = false;
    this.phase = 'intro';
    this.songStartTime = Date.now();
  }

  update(dt) {
    if (this.phase === 'select') {
      this._updateSelect(dt);
      return;
    }

    if (this.handleRestartInput()) return;

    if (this.paused) {
      if (this.input.wasActionPressed('pause') || this.input.wasPressed('KeyP')) {
        this.paused = false;
      }
      return;
    }

    if (this.phase === 'intro') {
      this.songTime += dt;
      if (this.songTime >= 0) {
        this.phase = 'playing';
        this.songStartTime = Date.now();
      }
      return;
    }

    const effectiveDt = this.speedMult ? dt * this.speedMult : dt;
    this.songTime += effectiveDt;

    if (this.starPowerActive) {
      this.starPowerTimer -= effectiveDt;
      if (this.starPowerTimer <= 0) {
        this.starPowerActive = false;
      }
    }

    while (this.noteIndex < this.song.notes.length) {
      const note = this.song.notes[this.noteIndex];
      const noteTime = note.beat / (this.song.bpm / 60);
      if (noteTime > this.songTime + 1.5) break;

      this.activeNotes.push({
        lane: note.lane,
        targetTime: noteTime,
        y: 0,
        hit: false,
        missed: false,
        missEffectSpawned: false,
        chord: note.chord || false,
      });
      this.noteIndex++;
    }

    for (const n of this.activeNotes) {
      if (n.hit || n.missed) continue;
      const scrollTime = (this.height * 0.85) / NOTE_SPEED;
      const hitY = this.height * HIT_ZONE_Y_RATIO;
      const noteTime = n.targetTime;
      const spawnY = -NOTE_HEIGHT;
      n.y = spawnY + ((this.songTime - (noteTime - scrollTime)) / scrollTime) * (hitY - spawnY);

      if (this.songTime > n.targetTime + MAX_MISS_DISTANCE) {
        n.missed = true;
        this._onMiss();
      }
    }

    this.activeNotes = this.activeNotes.filter(n => !n.missed || this.songTime - n.targetTime < 0.5);

    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (this.input.wasActionPressed(`lane${lane}`)) {
        this._hitLane(lane);
      }
    }

    if (this.input.wasActionPressed('pause') || this.input.wasPressed('KeyP')) {
      this.paused = true;
    }

    if (!this.isPractice) {
      this.hp -= HP_DECAY_RATE * effectiveDt;
    }
    this.hp = clamp(this.hp, 0, MAX_HP);

    if (!this.starPowerActive) {
      this.starPower = Math.min(100, this.starPower + 0.5 * effectiveDt);
    }

    if (this.input.wasActionPressed('lane4') && this.combo >= 5 && this.starPower >= 50) {
      this._activateStarPower();
    }

    this.beatTimer += effectiveDt;
    const beatInterval = 60 / this.song.bpm;
    if (this.beatTimer >= beatInterval) {
      this.beatTimer -= beatInterval;
      this.beatFlash = 1;
      for (let i = 0; i < this.equalizer.length; i++) {
        this.equalizer[i] = this.rng.next() * 30 + 15;
      }
    }
    this.beatFlash = Math.max(0, this.beatFlash - effectiveDt * 3);

    this.particles = updateParticles(this.particles, effectiveDt);
    this.stars = updateStars(this.stars, effectiveDt);
    this.streakParticles = updateStreaks(this.streakParticles, effectiveDt);

    if (this.judgmentTimer > 0) {
      this.judgmentTimer -= effectiveDt;
      if (this.judgmentTimer <= 0) this.judgmentText = null;
    }

    if (!this.isPractice && this.hp <= 0) {
      this._endGame(false);
    } else if (this.songTime > this.song.length) {
      if (this.isPractice) {
        this.phase = 'prac-result';
      } else {
        this._endGame(true);
      }
    }

    if (this.phase === 'prac-result') {
      if (this.input.wasActionPressed('select') || this.input.mouse.clickedThisFrame || this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
        this._restart();
      }
    }
  }

  _updateSelect(dt) {
    this.selectBlink += dt;

    const totalCards = SONG_DEFS.length + 1;
    const cardW = 144;
    const gap = 10;
    const totalW = totalCards * cardW + (totalCards - 1) * gap;
    const startX = Math.max(10, (this.width - totalW) / 2);

    if (this.input.wasActionPressed('left') || this.input.wasPressed('ArrowLeft') || this.input.wasActionPressed('lane0')) {
      this.selectedSong = (this.selectedSong - 1 + totalCards) % totalCards;
      AudioManager.sfx({ type: 'select', volume: 0.2 });
    }
    if (this.input.wasActionPressed('right') || this.input.wasPressed('ArrowRight') || this.input.wasActionPressed('lane2')) {
      this.selectedSong = (this.selectedSong + 1) % totalCards;
      AudioManager.sfx({ type: 'select', volume: 0.2 });
    }

    if (this.selectedSong === SONG_DEFS.length) {
      if (this.input.wasPressed('ArrowUp') || this.input.wasActionPressed('up') || this.input.wasPressed('KeyW')) {
        this.practiceSpeed = this.practiceSpeed >= 1.0 ? 0.5 : this.practiceSpeed + 0.25;
        AudioManager.sfx({ type: 'select', volume: 0.15 });
      }
      if (this.input.wasPressed('ArrowDown') || this.input.wasActionPressed('down') || this.input.wasPressed('KeyS')) {
        this.practiceSpeed = this.practiceSpeed <= 0.5 ? 1.0 : this.practiceSpeed - 0.25;
        AudioManager.sfx({ type: 'select', volume: 0.15 });
      }
    }

    if (this.input.mouse.clickedThisFrame) {
      const startY = 90;
      const cardH = 220;
      for (let i = 0; i < totalCards; i++) {
        const x = startX + i * (cardW + gap);
        const mx = this.input.mouse.x;
        const my = this.input.mouse.y;
        if (mx >= x && mx <= x + cardW && my >= startY && my <= startY + cardH) {
          this.selectedSong = i;
          this._startGameFromSelect();
          return;
        }
      }
    }

    if (this.input.wasActionPressed('select') || this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
      this._startGameFromSelect();
    }
  }

  _startGameFromSelect() {
    this.practiceMode = this.selectedSong >= SONG_DEFS.length;
    AudioManager.sfx({ type: 'powerup', volume: 0.3 });
    this._startGame();
  }

  _hitLane(lane) {
    const best = findBestNote(this.activeNotes, lane, this.songTime);
    if (!best) return;

    best.hit = true;
    this.notesHit++;
    const hx = getLaneX(lane, this.width);
    const hy = this.height * HIT_ZONE_Y_RATIO;
    const dist = Math.abs(this.songTime - best.targetTime);
    const type = judgeHit(dist);
    const mult = getComboMultiplier(this.combo, this.starPowerActive);

    this.score += getScoreForHit(type, mult);

    if (type === 'perfect') {
      this.combo++;
      this.hp = Math.min(MAX_HP, this.hp + HP_PERFECT_GAIN);
      this.perfectCount++;
      spawnHitExplosion(this.particles, this.stars, hx, hy, LANE_COLORS[lane], 'perfect');
      spawnNoteStreak(this.streakParticles, lane, best.y, this.width);
      HapticManager.vibrate('powerup');
    } else if (type === 'good') {
      this.combo++;
      this.hp = Math.min(MAX_HP, this.hp + HP_HIT_GAIN);
      this.goodCount++;
      spawnHitExplosion(this.particles, this.stars, hx, hy, LANE_COLORS[lane], 'good');
      spawnNoteStreak(this.streakParticles, lane, best.y, this.width);
      HapticManager.vibrate('hit');
    }

    const display = getJudgmentDisplay(type);
    this.judgmentText = { text: t(display.text), color: display.color, timer: type === 'perfect' ? 0.5 : 0.4 };
    this.judgmentTimer = type === 'perfect' ? 0.5 : 0.4;

    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.combo > 0 && this.combo % 30 === 0 && !this.starPowerActive) {
      this.starPower = Math.min(100, this.starPower + 10);
    }
  }

  _onMiss() {
    this.combo = 0;
    this.missCount++;
    if (!this.isPractice) {
      this.hp = Math.max(0, this.hp - HP_MISS_LOSS);
    }
    const display = getJudgmentDisplay('miss');
    this.judgmentText = { text: t(display.text), color: display.color, timer: 0.3 };
    this.judgmentTimer = 0.3;
    AudioManager.sfx({ type: 'hit', volume: 0.2 });
    for (const n of this.activeNotes) {
      if (n.missed && !n.missEffectSpawned) {
        n.missEffectSpawned = true;
        spawnHitExplosion(this.particles, this.stars, getLaneX(n.lane, this.width), this.height * HIT_ZONE_Y_RATIO, '#ff4d4d', 'miss');
        break;
      }
    }
  }

  _activateStarPower() {
    this.starPowerActive = true;
    this.starPowerTimer = 5;
    this.starPower -= 50;
    AudioManager.sfx({ type: 'powerup', volume: 0.4 });
    HapticManager.vibrate('powerup');
  }

  _endGame(won) {
    this.phase = won ? 'won' : 'lost';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('guitar-hero', this.score, won, duration);
    if (won) ProgressionManager.checkAchievement('guitar-hero', 'first-song');
    if (this.perfectCount >= 50) ProgressionManager.checkAchievement('guitar-hero', 'perfect-streak');
    if (this.score >= 100000) ProgressionManager.checkAchievement('guitar-hero', 'guitar-legend');
  }

  _restart() {
    this._startSelect();
    this.score = 0;
    this.notesHit = 0;
    this.totalNotes = 0;
  }

  render(ctx) {
    if (this.phase === 'select') {
      renderSelect(ctx, this.width, this.height, this.selectedSong, this.selectBlink, this.practiceSpeed);
    } else {
      renderGame(ctx, this);
    }
  }
}
