import { GameBase } from '../../engine/GameBase.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { pointInRect } from '../../engine/CollisionUtils.js';
import { wrapText } from '../../engine/wrapText.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';

const START_LIVES = 3;
const FEEDBACK_DURATION = 0.7; // segundos que se muestra "¡Correcto!"/"¡Incorrecto!" antes de continuar

/**
 * Preguntas del cuestionario. A diferencia de los juegos anteriores no
 * hay física ni tilemap: el "estado" es la pregunta actual + vidas +
 * feedback, y cada pregunta es un paso de una máquina de estados simple
 * (question -> feedback -> siguiente pregunta o game over).
 *
 * type: 'choice' -> una de las 4 opciones visibles es la correcta (índice `correct`).
 * type: 'hidden' -> las 4 opciones visibles son señuelos (ninguna es
 *   correcta); la respuesta real es una zona discreta de la pantalla
 *   (`hiddenZone`, en fracción 0..1 del canvas) que no se anuncia como
 *   botón — apenas insinuada con un tinte sutil, no invisible del todo.
 */
const QUESTIONS = [
  { type: 'choice', prompt: '¿Cuánto es 2 + 2?', options: ['3', '4', '22', 'Pescado'], correct: 1 },
  { type: 'choice', prompt: '¿De qué color es el caballo blanco de Napoleón?', options: ['Negro', 'Marrón', 'Blanco', 'Depende del caballo'], correct: 2 },
  { type: 'hidden', prompt: 'Encuentra la respuesta correcta. No es ninguna de estas cuatro.', options: ['Aquí', 'No es esta', 'Tampoco', 'Ni de broma'], hiddenZone: { xRatio: 0.04, yRatio: 0.08, wRatio: 0.06, hRatio: 0.06 } },
  { type: 'choice', prompt: "¿Cuántas veces aparece la letra 'A' en ABRACADABRA?", options: ['4', '5', '6', '11'], correct: 1 },
  { type: 'choice', prompt: '¿Cuál de estas cuatro opciones es la correcta?', options: ['Ninguna de estas', 'Ninguna de estas', 'Ninguna de estas', 'Esta'], correct: 3 },
  { type: 'choice', prompt: "Elige la respuesta INCORRECTA: '¿Cuánto es 1 + 1?'", options: ['2', 'Dos', 'II', 'Tres'], correct: 3 },
  { type: 'hidden', prompt: 'La salida está escondida...', options: ['Salir', 'Cerrar', 'Continuar', 'Terminar'], hiddenZone: { xRatio: 0.9, yRatio: 0.88, wRatio: 0.06, hRatio: 0.06 } },
  { type: 'choice', prompt: '¿Listo para terminar?', options: ['No', 'Todavía no', 'Espera', 'Sí'], correct: 3 },

  // Nuevas preguntas (expansión)
  { type: 'choice', prompt: '¿Cuántos meses tienen 28 días?', options: ['1', '2', '6', 'Todos'], correct: 3 },
  { type: 'choice', prompt: '¿Qué pesa más: 1kg de plomo o 1kg de plumas?', options: ['Plomo', 'Plumas', 'Igual', 'Depende'], correct: 2 },
  { type: 'hidden', prompt: 'La respuesta no está en los botones. Busca en la pantalla...', options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'], hiddenZone: { xRatio: 0.5, yRatio: 0.04, wRatio: 0.06, hRatio: 0.04 } },
  { type: 'choice', prompt: '¿Cuál es el número que falta? 1, 1, 2, 3, 5, 8, ?', options: ['10', '12', '13', '21'], correct: 2 },
  { type: 'choice', prompt: '¿Cuál de estas palabras no es un color?', options: ['Rojo', 'Azul', 'Silla', 'Verde'], correct: 2 },
  { type: 'choice', prompt: '¿Qué pescado tiene más huesos?', options: ['Sardina', 'Merluza', 'Bacalao', 'El que pesa más'], correct: 3 },
  { type: 'hidden', prompt: 'Has llegado lejos. Un último acertijo visual...', options: ['Salida', 'Puerta', 'Ventana', 'Trampilla'], hiddenZone: { xRatio: 0.7, yRatio: 0.82, wRatio: 0.06, hRatio: 0.06 } },
  { type: 'choice', prompt: '¿Cuál es la respuesta a la pregunta definitiva?', options: ['42', 'Sí', 'No', 'Naranja'], correct: 0 },
  { type: 'choice', prompt: '¿Qué viene después? O, T, T, F, F, S, S, ?', options: ['O', 'E', 'N', 'T'], correct: 1 },
  { type: 'choice', prompt: '¿Cuántas veces puedes restar 5 de 25?', options: ['5', '4', 'Una', 'Infinitas'], correct: 2 },
];

/**
 * TrickQuiz
 * Primer juego del hub sin física: la interacción es 100% click/touch
 * contra zonas rectangulares, evaluadas con `pointInRect` de
 * CollisionUtils — la misma utilidad que ya existía en el motor desde
 * Nivel 1, aquí usada por primera vez de verdad (antes solo AABB/círculo
 * tenían casos de uso reales).
 */
export class TrickQuiz extends GameBase {
  init(engine) {
    super.init(engine, 'trick-quiz');
    this.bestQuestion = this.storage.get('bestQuestion', 0);

    this._restart();
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this._layoutCurrentQuestion();
  }

  get currentQuestion() {
    return QUESTIONS[this.questionIndex];
  }

  _restart() {
    this.questionIndex = 0;
    this.lives = START_LIVES;
    this.status = 'question'; // 'question' | 'feedback' | 'lost' | 'won'
    this.feedbackTimer = 0;
    this.feedbackKind = null; // 'correct' | 'wrong'
    this._layoutCurrentQuestion();
  }

  _layoutCurrentQuestion() {
    const q = this.currentQuestion;
    const cols = 2;
    const rows = 2;
    const marginX = this.width * 0.08;
    const marginTop = this.height * 0.4;
    const marginBottom = this.height * 0.08;
    const gap = 14;
    const areaWidth = this.width - marginX * 2;
    const areaHeight = this.height - marginTop - marginBottom;
    const btnWidth = (areaWidth - gap) / cols;
    const btnHeight = (areaHeight - gap) / rows;

    this.buttons = q.options.map((label, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        label,
        x: marginX + col * (btnWidth + gap),
        y: marginTop + row * (btnHeight + gap),
        width: btnWidth,
        height: btnHeight,
      };
    });

    this.hiddenZoneRect =
      q.type === 'hidden'
        ? {
            x: q.hiddenZone.xRatio * this.width,
            y: q.hiddenZone.yRatio * this.height,
            width: q.hiddenZone.wRatio * this.width,
            height: q.hiddenZone.hRatio * this.height,
          }
        : null;
  }

  update(dt) {
    if (this.handleRestartInput()) return;

    if (this.status === 'feedback') {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) {
        if (this.feedbackKind === 'correct') this._advanceQuestion();
        else this.status = 'question'; // reintenta la misma pregunta
      }
      this.input.endFrame();
      return;
    }

    if (this.input.mouse.clickedThisFrame) {
      this._handleClick(this.input.mouse.x, this.input.mouse.y);
    }

    this.input.endFrame();
  }

  _handleClick(x, y) {
    const q = this.currentQuestion;

    if (q.type === 'hidden' && pointInRect(x, y, this.hiddenZoneRect)) {
      this._onCorrect();
      return;
    }

    for (let i = 0; i < this.buttons.length; i++) {
      if (pointInRect(x, y, this.buttons[i])) {
        const isCorrect = q.type === 'choice' && i === q.correct;
        if (isCorrect) this._onCorrect();
        else this._onWrong();
        return;
      }
    }
    // Click fuera de cualquier botón/zona: no penaliza, evita castigar
    // toques accidentales en el margen de la pantalla.
  }

  _onCorrect() {
    this.status = 'feedback';
    this.feedbackKind = 'correct';
    this.feedbackTimer = FEEDBACK_DURATION;
    AudioManager.sfx({ type: 'tquiz_correct', volume: 0.3 });
    HapticManager.vibrate('coin');
  }

  _onWrong() {
    this.lives -= 1;
    AudioManager.sfx({ type: 'tquiz_wrong', volume: 0.4 });
    HapticManager.vibrate('hit');
    if (this.lives <= 0) {
      this.status = 'lost';
      AudioManager.sfx({ type: 'explosion', volume: 0.4 });
      return;
    }
    this.status = 'feedback';
    this.feedbackKind = 'wrong';
    this.feedbackTimer = FEEDBACK_DURATION;
  }

  _advanceQuestion() {
    this.questionIndex += 1;
    if (this.questionIndex > this.bestQuestion) {
      this.bestQuestion = this.questionIndex;
      this.storage.set('bestQuestion', this.bestQuestion);
    }
    if (this.questionIndex >= QUESTIONS.length) {
      this.status = 'won';
      AudioManager.sfx({ type: 'powerup', volume: 0.5 });
      HapticManager.vibrate('powerup');
      return;
    }
    this.status = 'question';
    this._layoutCurrentQuestion();
  }

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.status === 'lost' || this.status === 'won') {
      this._renderEndScreen(ctx);
      return;
    }

    const q = this.currentQuestion;

    ctx.fillStyle = '#9aa7b2';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Pregunta ${this.questionIndex + 1}/${QUESTIONS.length}`, 10, 10);
    ctx.fillText(`Vidas: ${'*'.repeat(Math.max(0, this.lives))}`, this.width - 90, 10);

    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 18px monospace';
    wrapText(ctx, q.prompt, this.width * 0.08, this.height * 0.14, this.width * 0.84, 24);

    for (const btn of this.buttons) {
      ctx.fillStyle = '#11161d';
      ctx.strokeStyle = '#1e2731';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

      ctx.fillStyle = '#e7edf3';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      wrapText(ctx, btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2 - 6, btn.width - 16, 16);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Pista sutil de la zona oculta: un tinte apenas perceptible, no un
    // botón etiquetado. El jugador tiene que fijarse, no adivinar a ciegas.
    if (this.hiddenZoneRect) {
      ctx.fillStyle = 'rgba(255, 180, 84, 0.07)';
      ctx.fillRect(this.hiddenZoneRect.x, this.hiddenZoneRect.y, this.hiddenZoneRect.width, this.hiddenZoneRect.height);
    }

    if (this.status === 'feedback') {
      ctx.fillStyle = this.feedbackKind === 'correct' ? 'rgba(58, 125, 92, 0.35)' : 'rgba(92, 58, 58, 0.45)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.feedbackKind === 'correct' ? '¡Correcto!' : '¡Incorrecto!', this.width / 2, this.height / 2);
      ctx.textAlign = 'left';
    }
  }

  _renderEndScreen(ctx) {
    const message = this.status === 'won' ? '¡COMPLETASTE EL CUESTIONARIO!' : 'GAME OVER';
    const subtitle = `Pregunta ${this.questionIndex + 1}/${QUESTIONS.length} | Mejor: ${this.bestQuestion + 1}`;
    renderOverlay(ctx, {
      width: this.width, height: this.height,
      title: message,
      subtitle,
      actionText: t('game.restart'),
    });
  }

}


