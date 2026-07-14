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
import { renderOverlay } from '../../engine/GameUI.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { pointInRect } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { TYPE_SPEED, SCENES, SCENE_IDS } from './constants.js';

export class HenryStickmin extends GameBase {
  init(engine) {
    super.init(engine, 'henry-stickmin');
    this.bestEndings = this.storage.get('bestEndings', null);

    this._restart();
  }

  _restart() {
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
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }
      this.input.endFrame();
      return;
    }

    if (this.phase === 'text') {
      this.typeTimer += dt * 1000;
      this.typeChars = Math.floor(this.typeTimer / TYPE_SPEED);

      const rawText = this.textLines.join('\n');

      // Click / espacio: si el texto aún se está revelando, lo completa;
      // si ya está completo, avanza a opciones inmediatamente.
      if (this.input.mouse.clickedThisFrame || this.input.wasPressed('Space')) {
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

      this.input.endFrame();
      return;
    }

    if (this.phase === 'choices') {
      if (this.input.mouse.clickedThisFrame) {
        const buttons = this._layoutButtons();
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

      this.input.endFrame();
      return;
    }

    if (this.phase === 'ending') {
      if (this.input.mouse.clickedThisFrame || this.input.wasPressed('Space')) {
        AudioManager.sfx({ type: this.endingDisplay?.type === 'success' ? 'henry_success' : 'henry_fail', volume: 0.4 });
        HapticManager.vibrate(this.endingDisplay?.type === 'success' ? 'powerup' : 'hit');
        this.phase = 'end_screen';
      }
      this.input.endFrame();
      return;
    }

    this.input.endFrame();
  }

  render(ctx) {
    ctx.fillStyle = '#0f1722';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = '#2a3a5a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, this.width - 16, this.height - 16);
    ctx.strokeStyle = '#1e2a42';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, this.width - 24, this.height - 24);

    if (this.phase === 'end_screen') {
      this._renderEndScreen(ctx);
      return;
    }

    const scene = SCENES[this.sceneId];
    if (!scene) return;

    ctx.fillStyle = '#ffb454';
    ctx.font = 'bold 20px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(scene.title, 24, 20);

    ctx.font = '36px monospace';
    ctx.fillStyle = '#e7edf3';
    ctx.textAlign = 'center';
    ctx.fillText(scene.emoji, this.width / 2, 60);

    const vignetteY = 110;
    const vignetteH = Math.min(180, this.height * 0.35);
    ctx.fillStyle = '#111a28';
    ctx.fillRect(24, vignetteY, this.width - 48, vignetteH);
    ctx.strokeStyle = '#1e2a42';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, vignetteY, this.width - 48, vignetteH);

    this._renderStickman(ctx, scene.stickmanPose, this.width / 2, vignetteY + vignetteH / 2);

    if (this.phase === 'text' || this.phase === 'choices') {
      this._renderText(ctx, scene);
    }

    if (this.phase === 'choices') {
      const buttons = this._layoutButtons();
      for (const btn of buttons) {
        ctx.fillStyle = '#141e30';
        ctx.strokeStyle = '#2a3a5a';
        ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
        ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

        ctx.fillStyle = '#e7edf3';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        this._drawWrappedText(ctx, btn.choice.label, btn.x + btn.width / 2, btn.y + btn.height / 2 - 4, btn.width - 10);
        ctx.textAlign = 'left';
      }
    }

    if (this.phase === 'ending' && this.endingDisplay) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, this.width, this.height);

      const isSuccess = this.endingDisplay.type === 'success';
      ctx.fillStyle = isSuccess ? '#3a7d5c' : '#8a3a3a';
      ctx.fillRect(this.width / 2 - 180, this.height / 2 - 70, 360, 140);

      ctx.strokeStyle = isSuccess ? '#5a9d7c' : '#aa5a5a';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.width / 2 - 180, this.height / 2 - 70, 360, 140);

      ctx.fillStyle = '#e7edf3';
      ctx.font = `bold ${isSuccess ? '22' : '20'}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isSuccess ? t('henry.success') : t('henry.fail'),
        this.width / 2, this.height / 2 - 45);

      ctx.font = '12px monospace';
      ctx.fillStyle = '#b0c4d8';
      ctx.fillText(this.endingDisplay.text, this.width / 2, this.height / 2 + 5);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#7c8894';
      ctx.fillText(t('game.continue'), this.width / 2, this.height / 2 + 50);
      ctx.textAlign = 'left';
    }
  }

  _renderText(ctx, scene) {
    const textY = 300;
    const textX = 30;
    const maxW = this.width - 60;
    const lineH = 20;

    const fullText = this.textLines.join('\n');
    const visibleText = fullText.slice(0, this.typeChars);

    const chars = visibleText.length;
    let charsUsed = 0;
    let lineIdx = 0;

    ctx.fillStyle = '#c8d6e5';
    ctx.font = '13px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    for (const line of this.textLines) {
      if (charsUsed >= chars) break;
      const lineChars = Math.min(line.length, chars - charsUsed);
      const partialLine = line.slice(0, lineChars);
      ctx.fillText(partialLine, textX, textY + lineIdx * lineH, maxW);
      charsUsed += line.length + 1;
      lineIdx++;
    }

    if (this.phase === 'text' && this.typeChars < fullText.length) {
      const cursorX = textX + ctx.measureText(visibleText.split('\n').pop() || '').width;
      const cursorY = textY + (lineIdx - 1) * lineH;
      const blink = Math.sin(Date.now() * 0.006) > 0;
      if (blink) {
        ctx.fillStyle = '#ffb454';
        ctx.fillRect(cursorX + 2, cursorY, 2, 15);
      }
    }

    if (this.phase === 'text' && this.typeChars < fullText.length) {
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(t('henry.clickToSkip'), this.width - 24, this.height - 100);
      ctx.textAlign = 'left';
    }

    if (this.phase === 'text' && this.typeChars >= fullText.length) {
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(t('henry.clickToContinue'), this.width - 24, this.height - 100);
      ctx.textAlign = 'left';
    }
  }

  _renderStickman(ctx, pose, x, y) {
    const size = 30;

    ctx.fillStyle = '#e7edf3';
    ctx.beginPath();
    ctx.arc(x, y - size * 0.6, size * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0b0f14';
    switch (pose) {
      case 'thinking':
        ctx.fillRect(x - 8, y - size * 0.65, 2, 2);
        ctx.fillRect(x + 6, y - size * 0.65, 2, 2);
        ctx.strokeStyle = '#e7edf3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + size * 0.25, y - size * 0.3);
        ctx.lineTo(x + size * 0.4, y);
        ctx.stroke();
        break;
      case 'dancing':
        ctx.fillRect(x - 8, y - size * 0.7, 2, 3);
        ctx.fillRect(x + 6, y - size * 0.7, 2, 3);
        ctx.strokeStyle = '#e7edf3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + size * 0.3, y - size * 0.2);
        ctx.lineTo(x + size * 0.6, y - size * 0.7);
        ctx.moveTo(x - size * 0.3, y - size * 0.2);
        ctx.lineTo(x - size * 0.6, y - size * 0.7);
        ctx.stroke();
        break;
      case 'running':
      case 'driving':
        ctx.fillRect(x - 7, y - size * 0.65, 3, 2);
        ctx.fillRect(x + 5, y - size * 0.65, 3, 2);
        ctx.fillRect(x - 8, y - size * 0.65, 2, 2);
        ctx.fillRect(x + 6, y - size * 0.65, 2, 2);
        break;
      case 'flying':
      case 'tripping':
        ctx.beginPath();
        ctx.arc(x - 6, y - size * 0.65, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 6, y - size * 0.65, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'ko':
      case 'injured':
        ctx.strokeStyle = '#0b0f14';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 10, y - size * 0.72);
        ctx.lineTo(x - 4, y - size * 0.58);
        ctx.moveTo(x - 4, y - size * 0.72);
        ctx.lineTo(x - 10, y - size * 0.58);
        ctx.moveTo(x + 4, y - size * 0.72);
        ctx.lineTo(x + 10, y - size * 0.58);
        ctx.moveTo(x + 10, y - size * 0.72);
        ctx.lineTo(x + 4, y - size * 0.58);
        ctx.stroke();
        break;
      case 'facepalm':
        ctx.fillStyle = '#0b0f14';
        ctx.fillRect(x - 6, y - size * 0.65, 2, 2);
        ctx.fillRect(x + 4, y - size * 0.65, 2, 2);
        ctx.strokeStyle = '#e7edf3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - size * 0.5, size * 0.3, 0, Math.PI, false);
        ctx.stroke();
        break;
      default:
        ctx.fillRect(x - 6, y - size * 0.65, 2, 2);
        ctx.fillRect(x + 4, y - size * 0.65, 2, 2);
        break;
    }

    ctx.strokeStyle = '#e7edf3';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.4);
    ctx.lineTo(x, y + size * 0.2);
    ctx.stroke();

    ctx.beginPath();
    switch (pose) {
      case 'running':
      case 'driving':
        ctx.moveTo(x, y + size * 0.2);
        ctx.lineTo(x - size * 0.25, y + size * 0.6);
        ctx.moveTo(x, y + size * 0.2);
        ctx.lineTo(x + size * 0.3, y + size * 0.5);
        break;
      case 'dancing':
        ctx.moveTo(x, y + size * 0.2);
        ctx.lineTo(x - size * 0.3, y + size * 0.7);
        ctx.moveTo(x, y + size * 0.2);
        ctx.lineTo(x + size * 0.3, y + size * 0.5);
        break;
      case 'flying':
        ctx.moveTo(x, y + size * 0.2);
        ctx.lineTo(x - size * 0.4, y + size * 0.4);
        ctx.moveTo(x, y + size * 0.2);
        ctx.lineTo(x + size * 0.4, y + size * 0.4);
        break;
      default:
        ctx.moveTo(x, y + size * 0.2);
        ctx.lineTo(x - size * 0.2, y + size * 0.6);
        ctx.moveTo(x, y + size * 0.2);
        ctx.lineTo(x + size * 0.2, y + size * 0.6);
        break;
    }
    ctx.stroke();

    ctx.beginPath();
    switch (pose) {
      case 'crawling':
        ctx.moveTo(x - size * 0.3, y + size * 0.1);
        ctx.lineTo(x + size * 0.5, y - size * 0.4);
        ctx.moveTo(x + size * 0.3, y + size * 0.1);
        ctx.lineTo(x - size * 0.5, y + size * 0.4);
        break;
      case 'holding_tool':
        ctx.moveTo(x - size * 0.2, y - size * 0.3);
        ctx.lineTo(x + size * 0.7, y - size * 0.2);
        ctx.moveTo(x + size * 0.7, y - size * 0.2);
        ctx.lineTo(x + size * 0.8, y - size * 0.5);
        ctx.moveTo(x + size * 0.8, y - size * 0.5);
        ctx.lineTo(x + size * 0.6, y - size * 0.6);
        break;
      case 'reaching':
        ctx.moveTo(x, y - size * 0.2);
        ctx.lineTo(x + size * 0.6, y - size * 0.6);
        ctx.moveTo(x, y - size * 0.2);
        ctx.lineTo(x - size * 0.3, y - size * 0.3);
        break;
      default:
        ctx.moveTo(x - size * 0.3, y - size * 0.1);
        ctx.lineTo(x + size * 0.3, y + size * 0.1);
        ctx.moveTo(x + size * 0.3, y - size * 0.1);
        ctx.lineTo(x - size * 0.3, y + size * 0.1);
        break;
    }
    ctx.stroke();

    ctx.fillStyle = '#2a3a5a';
    switch (pose) {
      case 'nervous':
        ctx.save();
        ctx.translate(x - 5, y - size * 0.8);
        ctx.rotate(0.15);
        ctx.fillRect(-10, -4, 20, 4);
        ctx.fillRect(-6, -8, 12, 6);
        ctx.restore();
        break;
      case 'sweating':
        ctx.fillRect(x - 8, y - size * 0.82, 16, 4);
        ctx.fillRect(x - 5, y - size * 0.88, 10, 6);
        ctx.fillStyle = '#4a9eff';
        ctx.beginPath();
        ctx.arc(x + 15, y - size * 0.75, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'walking_away':
        ctx.fillRect(x - 8, y - size * 0.82, 16, 4);
        ctx.fillRect(x - 5, y - size * 0.9, 10, 8);
        ctx.strokeStyle = '#0b0f14';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 12, y - size * 0.62);
        ctx.lineTo(x + 12, y - size * 0.62);
        ctx.stroke();
        ctx.fillRect(x - 10, y - size * 0.7, 8, 5);
        ctx.fillRect(x + 2, y - size * 0.7, 8, 5);
        break;
      default:
        ctx.fillRect(x - 8, y - size * 0.82, 16, 4);
        ctx.fillRect(x - 5, y - size * 0.88, 10, 6);
        break;
    }

    ctx.fillStyle = '#7c8894';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('▼ Henry Stickmin', x, y + 15 + 4);
    ctx.textAlign = 'left';
  }

  _drawWrappedText(ctx, text, cx, cy, maxWidth) {
    const words = text.split(' ');
    let line = '';
    let lines = [];
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);

    const lineH = 14;
    const startY = cy - ((lines.length - 1) * lineH) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, startY + i * lineH);
    }
  }

  _renderEndScreen(ctx) {
    const isSuccess = this.endingDisplay?.type === 'success';
    const title = isSuccess ? t('henry.success') : t('henry.fail');
    renderOverlay(ctx, {
      width: this.width, height: this.height,
      title,
      actionText: t('game.restart'),
    });

    // Stats extra después del overlay
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const midY = this.height / 2 + 55;
    ctx.fillText(t('henry.endingsFound', { n: this.currentEndings.length }), this.width / 2, midY);
    ctx.fillText(t('henry.totalEndings', { n: this.totalEndingsFound }), this.width / 2, midY + 20);
    if (this.bestEndings !== null) {
      ctx.fillText(t('henry.bestSession', { n: this.bestEndings }), this.width / 2, midY + 40);
    }
    ctx.fillStyle = '#7c8894';
    ctx.font = '11px monospace';
    ctx.fillText(t('henry.keepTrying'), this.width / 2, midY + 60);
    ctx.textAlign = 'left';
  }

}
