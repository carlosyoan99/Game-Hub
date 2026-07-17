/**
 * Henry Stickmin (colección)
 * Nivel 5 — RPG y Acción Compleja
 *
 * Mecánica: árbol de decisiones con puntos de ramificación.
 * Cada escena presenta una situación, un dibujo de palitos y 2-3 opciones.
 * Según la elección, la historia avanza a una nueva escena o termina en
 * un final (éxito o fracaso cómico). Animaciones secuenciales: el texto
 * se revela carácter a carácter (efecto máquina de escribir) y las
 * viñetas aparecen con un pequeño fade.
 *
 * Inspirado en la saga Henry Stickmin de PuffballsUnited.
 */
import { GameBase } from '../../engine/GameBase.js';
import { pointInRect } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';
import { TYPE_SPEED, SCENES } from './constants.js';
import { renderGame } from './render.js';

export class HenryStickmin extends GameBase {
  init(engine) {
    super.init(engine, 'henry-stickmin');
    this.bestEndings = this.storage.get('bestEndings', null);

    this._restart();
  }

  _defaultBindings() {
    return {
      navigateLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      navigateRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      select:        ['Space', 'Enter', 'GamepadA'],
      restart:       ['Space', 'GamepadStart', 'GamepadA'],
    };
  }

  _restart() {
    this.startTime = Date.now();
    this.sceneId = 'intro';
    this.phase = 'text';
    this.typeChars = 0;
    this.typeTimer = 0;
    this.textFull = '';
    this.textLines = [];
    this.currentEndings = [];
    this.totalEndingsFound = this.storage.get('endings', 0) || 0;
    this.endingDisplay = null;
    this.timeToSkip = 0;
    this.selectedChoice = 0;

    this._loadScene('intro');
  }

  _loadScene(sceneId) {
    const scene = SCENES[sceneId];
    if (!scene) return;

    this.sceneId = sceneId;
    this.textFull = scene.text;
    this.textLines = scene.text.split('\n');
    this.typeChars = 0;
    this.typeTimer = 0;
    this.phase = 'text';
    this.endingDisplay = null;

    if (scene.ending) {
      this.phase = 'ending';
      this.endingDisplay = scene.ending;

      if (!this.currentEndings.includes(sceneId)) {
        this.currentEndings.push(sceneId);
        this.totalEndingsFound++;
        this.storage.set('endings', this.totalEndingsFound);
        if (this.bestEndings === null || this.currentEndings.length > this.bestEndings) {
          this.bestEndings = this.currentEndings.length;
          this.storage.set('bestEndings', this.bestEndings);
        }
      }
    }
  }

  _layoutButtons() {
    const scene = SCENES[this.sceneId];
    if (!scene || !scene.choices) return [];

    const count = scene.choices.length;
    const btnW = Math.min(240, (this.width - 60) / count);
    const btnH = 42;
    const gap = 10;
    const totalW = count * btnW + (count - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const y = this.height - 70;

    return scene.choices.map((choice, i) => ({
      x: startX + i * (btnW + gap),
      y,
      width: btnW,
      height: btnH,
      choice,
    }));
  }

  update(dt) {
    if (this.phase === 'end_screen') {
      if (this.input.wasPressed('Space') || this.input.wasActionPressed('select') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }

      return;
    }

    if (this.phase === 'text') {
      this.typeTimer += dt * 1000;
      this.typeChars = Math.floor(this.typeTimer / TYPE_SPEED);

      const rawText = this.textLines.join('\n');

      // Click / espacio / gamepad: si el texto aún se está revelando, lo completa;
      // si ya está completo, avanza a opciones inmediatamente.
      if (this.input.mouse.clickedThisFrame || this.input.wasPressed('Space') || this.input.wasActionPressed('select')) {
        if (this.typeChars < rawText.length) {
          this.typeChars = rawText.length;
          this.typeTimer = rawText.length * TYPE_SPEED;
        } else {
          AudioManager.sfx({ type: 'henry_choose', volume: 0.2 });
          HapticManager.vibrate('select');
          this.phase = 'choices';
        }
        this.timeToSkip = 0;
      }

      // Auto-avance tras 3 segundos de texto completo
      if (this.typeChars >= rawText.length) {
        this.timeToSkip += dt;
        if (this.timeToSkip > 3) {
          this.phase = 'choices';
          this.timeToSkip = 0;
        }
      }

      return;
    }

    if (this.phase === 'choices') {
      // ── Gamepad / teclado ──
      const buttons = this._layoutButtons();
      if (buttons.length > 0) {
        if (this.input.wasActionPressed('navigateLeft') && this.selectedChoice > 0) this.selectedChoice--;
        if (this.input.wasActionPressed('navigateRight') && this.selectedChoice < buttons.length - 1) this.selectedChoice++;

        if (this.input.wasActionPressed('select')) {
          const btn = buttons[this.selectedChoice];
          AudioManager.sfx({ type: 'henry_choose', volume: 0.3 });
          HapticManager.vibrate('select');
          if (btn.choice.next) {
            this._loadScene(btn.choice.next);
            this.selectedChoice = 0;
          } else if (btn.choice.ending) {
            this.phase = 'ending';
            this.endingDisplay = btn.choice.ending;
          }
        }
      }

      if (this.input.mouse.clickedThisFrame) {
        const mx = this.input.mouse.x;
        const my = this.input.mouse.y;

        for (const btn of buttons) {
          if (pointInRect(mx, my, btn)) {
            AudioManager.sfx({ type: 'henry_choose', volume: 0.3 });
            HapticManager.vibrate('select');
            if (btn.choice.next) {
              this._loadScene(btn.choice.next);
            } else if (btn.choice.ending) {
              this.phase = 'ending';
              this.endingDisplay = btn.choice.ending;
            }
            break;
          }
        }
      }

      return;
    }

    if (this.phase === 'ending') {
      if (this.input.mouse.clickedThisFrame || this.input.wasPressed('Space') || this.input.wasActionPressed('select')) {
        AudioManager.sfx({ type: this.endingDisplay?.type === 'success' ? 'henry_success' : 'henry_fail', volume: 0.4 });
        HapticManager.vibrate(this.endingDisplay?.type === 'success' ? 'powerup' : 'hit');
        this._recordProgressionPlay();
        this.phase = 'end_screen';
      }

      return;
    }

    this.input.endFrame();
  }

  render(ctx) {
    renderGame(ctx, this);
  }

  _recordProgressionPlay() {
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('henry-stickmin', this.totalEndingsFound, true, duration);
    if (this.totalEndingsFound >= 1) ProgressionManager.checkAchievement('henry-stickmin', 'first-ending');
    if (this.totalEndingsFound >= 5) ProgressionManager.checkAchievement('henry-stickmin', 'ending-collector');
    if (this.totalEndingsFound >= 10) ProgressionManager.checkAchievement('henry-stickmin', 'henry-completionist');
  }


}
