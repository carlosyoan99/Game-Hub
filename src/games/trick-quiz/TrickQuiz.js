import { GameBase } from '../../engine/GameBase.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';
import { icon } from '../../engine/IconRenderer.js';
import { pointInRect } from '../../engine/CollisionUtils.js';
import { wrapText } from '../../engine/wrapText.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
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
// Preguntas organizadas por categorías temáticas
const QUESTION_POOL = [
  // 🧮 Matemáticas
  { category: 'math', type: 'choice', prompt: '¿Cuánto es 2 + 2?', options: ['3', '4', '22', 'Pescado'], correct: 1 },
  { category: 'math', type: 'choice', prompt: '¿Cuál es el número que falta? 1, 1, 2, 3, 5, 8, ?', options: ['10', '12', '13', '21'], correct: 2 },
  { category: 'math', type: 'choice', prompt: '¿Cuántas veces puedes restar 5 de 25?', options: ['5', '4', 'Una', 'Infinitas'], correct: 2 },
  { category: 'math', type: 'choice', prompt: "¿Cuántas veces aparece la letra 'A' en ABRACADABRA?", options: ['4', '5', '6', '11'], correct: 1 },
  { category: 'math', type: 'choice', prompt: '¿Cuántos meses tienen 28 días?', options: ['1', '2', '6', 'Todos'], correct: 3 },
  { category: 'math', type: 'choice', prompt: '¿Qué pesa más: 1kg de plomo o 1kg de plumas?', options: ['Plomo', 'Plumas', 'Igual', 'Depende'], correct: 2 },
  { category: 'math', type: 'choice', prompt: '¿Qué número es mayor: 0.5 o 0.25?', options: ['0.5', '0.25', 'Son iguales', 'Depende del contexto'], correct: 0 },
  { category: 'math', type: 'choice', prompt: 'Si un tren sale de Madrid a 120km/h, ¿qué hora es?', options: ['Las 3', 'Las 5', 'No se puede saber', 'Hora de cenar'], correct: 2 },

  // 🌍 Lógica y trampas
  { category: 'logic', type: 'choice', prompt: '¿De qué color es el caballo blanco de Napoleón?', options: ['Negro', 'Marrón', 'Blanco', 'Depende del caballo'], correct: 2 },
  { category: 'logic', type: 'choice', prompt: '¿Cuál de estas cuatro opciones es la correcta?', options: ['Ninguna de estas', 'Ninguna de estas', 'Ninguna de estas', 'Esta'], correct: 3 },
  { category: 'logic', type: 'choice', prompt: "Elige la respuesta INCORRECTA: '¿Cuánto es 1 + 1?'", options: ['2', 'Dos', 'II', 'Tres'], correct: 3 },
  { category: 'logic', type: 'choice', prompt: '¿Cuál de estas palabras no es un color?', options: ['Rojo', 'Azul', 'Silla', 'Verde'], correct: 2 },
  { category: 'logic', type: 'choice', prompt: '¿Qué pescado tiene más huesos?', options: ['Sardina', 'Merluza', 'Bacalao', 'El que pesa más'], correct: 3 },
  { category: 'logic', type: 'choice', prompt: '¿Cuántos animales de cada especie metió Moisés en el arca?', options: ['2', '1', 'Ninguno (Noé fue)', 'Depende'], correct: 2 },
  { category: 'logic', type: 'choice', prompt: '¿Qué viene después? O, T, T, F, F, S, S, ?', options: ['O', 'E', 'N', 'T'], correct: 1 },
  { category: 'logic', type: 'choice', prompt: '¿Cuál es la respuesta a la pregunta definitiva?', options: ['42', 'Sí', 'No', 'Naranja'], correct: 0 },

  // 🤪 Acertijos visuales / ocultos
  { category: 'hidden', type: 'hidden', prompt: 'Encuentra la respuesta correcta. No es ninguna de estas cuatro.', options: ['Aquí', 'No es esta', 'Tampoco', 'Ni de broma'], hiddenZone: { xRatio: 0.04, yRatio: 0.08, wRatio: 0.06, hRatio: 0.06 } },
  { category: 'hidden', type: 'hidden', prompt: 'La salida está escondida...', options: ['Salir', 'Cerrar', 'Continuar', 'Terminar'], hiddenZone: { xRatio: 0.9, yRatio: 0.88, wRatio: 0.06, hRatio: 0.06 } },
  { category: 'hidden', type: 'hidden', prompt: 'La respuesta no está en los botones. Busca en la pantalla...', options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'], hiddenZone: { xRatio: 0.5, yRatio: 0.04, wRatio: 0.06, hRatio: 0.04 } },
  { category: 'hidden', type: 'hidden', prompt: 'Has llegado lejos. Un último acertijo visual...', options: ['Salida', 'Puerta', 'Ventana', 'Trampilla'], hiddenZone: { xRatio: 0.7, yRatio: 0.82, wRatio: 0.06, hRatio: 0.06 } },
  { category: 'hidden', type: 'hidden', prompt: 'Busca con atención, la respuesta está fuera de lo común.', options: ['Centro', 'Abajo', 'Arriba', 'Lados'], hiddenZone: { xRatio: 0.48, yRatio: 0.5, wRatio: 0.04, hRatio: 0.04 } },
  { category: 'hidden', type: 'hidden', prompt: 'El camino correcto no siempre es el más visible.', options: ['Puerta azul', 'Puerta roja', 'Puerta verde', 'Ventana'], hiddenZone: { xRatio: 0.15, yRatio: 0.15, wRatio: 0.04, hRatio: 0.04 } },
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

  _defaultBindings() {
    return {
      navigateUp:    ['ArrowUp', 'KeyW', 'GamepadUp', 'GamepadLStickUp'],
      navigateDown:  ['ArrowDown', 'KeyS', 'GamepadDown', 'GamepadLStickDown'],
      navigateLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      navigateRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      select:        ['Space', 'Enter', 'GamepadA'],
      restart:       ['Space', 'GamepadStart', 'GamepadA'],
    };
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this._layoutCurrentQuestion();
  }

  get currentQuestion() {
    return this.questions[this.questionIndex];
  }

  _restart() {
    this.startTime = Date.now();
    this.rng = new SeededRandom();
    // Barajar preguntas y seleccionar un subconjunto variado (mezcla de categorías)
    this.questions = this.rng.shuffle([...QUESTION_POOL]);
    // Seleccionar hasta 12 preguntas variadas (al menos 2 de cada categoría si es posible)
    const categoryCounts = {};
    this.questions = this.questions.filter(q => {
      categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
      return categoryCounts[q.category] <= 4;
    });
    this.questionIndex = 0;
    this.lives = START_LIVES;
    this.status = 'question'; // 'question' | 'feedback' | 'lost' | 'won'
    this.feedbackTimer = 0;
    this.feedbackKind = null; // 'correct' | 'wrong'
    this.selectedButton = 0; // índice del botón seleccionado (0-3) para gamepad/teclado
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
    // ── Gamepad restart en pantallas finales ──
    if ((this.status === 'won' || this.status === 'lost') && this.input.wasActionPressed('restart')) {
      this._restart();
      return;
    }
    if (this.handleRestartInput()) return;

    if (this.status === 'feedback') {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) {
        if (this.feedbackKind === 'correct') this._advanceQuestion();
        else {
          this.status = 'question';
          this.selectedButton = 0;
        }
      }

      return;
    }

    // ── Input: gamepad / teclado ──
    if (this.input.wasActionPressed('navigateUp') && this.selectedButton >= 2) this.selectedButton -= 2;
    if (this.input.wasActionPressed('navigateDown') && this.selectedButton < 2) this.selectedButton += 2;
    if (this.input.wasActionPressed('navigateLeft') && this.selectedButton % 2 === 1) this.selectedButton -= 1;
    if (this.input.wasActionPressed('navigateRight') && this.selectedButton % 2 === 0) this.selectedButton += 1;

    if (this.input.wasActionPressed('select')) {
      this._handleButtonSelect(this.selectedButton);
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

  _handleButtonSelect(index) {
    const q = this.currentQuestion;

    // Hidden zone: no se puede seleccionar con gamepad (requiere click directo)
    if (q.type === 'hidden') return;

    const isCorrect = index === q.correct;
    if (isCorrect) this._onCorrect();
    else this._onWrong();
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
      this._recordProgressionPlay(false);
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
    if (this.questionIndex >= this.questions.length) {
      this.status = 'won';
      this._recordProgressionPlay(true);
      AudioManager.sfx({ type: 'powerup', volume: 0.5 });
      HapticManager.vibrate('powerup');
      return;
    }
    this.status = 'question';
    this._layoutCurrentQuestion();
  }

  _recordProgressionPlay(won) {
    const duration = (Date.now() - this.startTime) / 1000;
    const score = this.currentQuestion || 0;
    ProgressionManager.recordGamePlay('trick-quiz', score, won, duration);
    if (won) ProgressionManager.checkAchievement('trick-quiz', 'first-win');
    if (this.winStreak > 3) ProgressionManager.checkAchievement('trick-quiz', 'trickster');
    if (this.correct > 10) ProgressionManager.checkAchievement('trick-quiz', 'quiz-master');
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
    ctx.textBaseline = 'top';      const cat = this.currentQuestion.category || '';
      // Dibujar icono de categoría antes del texto
      const catIcon = cat === 'math' ? 'bolt' : cat === 'logic' ? 'brain' : cat === 'hidden' ? 'target' : null;
      if (catIcon) icon(ctx, catIcon, 16, 17, 14, '#ffb454');
      ctx.fillText(`Pregunta ${this.questionIndex + 1}/${this.questions.length}`, 10, 10);
    ctx.fillText('Vidas: ', this.width - 90, 10);
    const lifeX = this.width - 90 + ctx.measureText('Vidas: ').width;
    for (let i = 0; i < this.lives; i++) {
      icon(ctx, 'heart', lifeX + i * 18, 17, 14, '#e74c3c');
    }

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
    const subtitle = `Pregunta ${this.questionIndex + 1}/${this.questions.length} | Mejor: ${this.bestQuestion + 1}`;
    renderOverlay(ctx, {
      width: this.width, height: this.height,
      title: message,
      subtitle,
      actionText: t('game.restart'),
    });
  }

}


