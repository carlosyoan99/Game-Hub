/**
 * GameUI
 * Helpers reutilizables para renderizar overlays y HUD comunes.
 *
 * Reduce la duplicación de código (~200 líneas) entre juegos que
 * comparten el mismo patrón de pantalla de game over y configuración
 * básica de HUD.
 */
import { t } from './i18n.js';

// ── Colores por defecto ────────────────────────────────────────────────

const DEFAULT_HUD_COLOR = '#9aa7b2';
const DEFAULT_OVERLAY_BG = 'rgba(0, 0, 0, 0.65)';
const DEFAULT_OVERLAY_TEXT = '#e7edf3';

// ── Overlay de Game Over ───────────────────────────────────────────────

/**
 * Renderiza el overlay semitransparente de game over con puntuación
 * y mensaje de reinicio.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 * @param {number}  opts.width         - Ancho del canvas
 * @param {number}  opts.height        - Alto del canvas
 * @param {number}  [opts.score]       - Puntuación actual (se muestra en línea 2 si no hay subtitle)
 * @param {string}  [opts.title]       - Texto principal (por defecto t('game.gameOver'))
 * @param {string}  [opts.subtitle]    - Texto secundario (línea 2, reemplaza score si se provee)
 * @param {string}  [opts.actionText]  - Texto de acción (línea 3, por defecto t('game.restart'))
 * @param {object}  [opts.colors]      - { bg?, text? } colores del overlay
 */
export function renderOverlay(ctx, { width, height, score, title, subtitle, actionText, colors = {} }) {
  const bg = colors.bg || DEFAULT_OVERLAY_BG;
  const text = colors.text || DEFAULT_OVERLAY_TEXT;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = text;
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText(title || t('game.gameOver'), width / 2, height / 2 - 30);

  // Línea 2: subtitle > score > nada
  ctx.font = '16px monospace';
  if (subtitle != null) {
    ctx.fillText(subtitle, width / 2, height / 2 + 5);
  } else if (score != null) {
    ctx.fillText(t('game.score', { n: score }), width / 2, height / 2 + 5);
  }

  // Línea 3: acción
  ctx.fillText(actionText || t('game.restart'), width / 2, height / 2 + 35);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ── Overlay de Pausa ───────────────────────────────────────────────────

/**
 * Renderiza el overlay de pausa.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 * @param {number}  opts.width          - Ancho del canvas
 * @param {number}  opts.height         - Alto del canvas
 * @param {string}  [opts.extraText]    - Texto adicional (por defecto "P / ESC")
 * @param {object}  [opts.colors]       - { bg?, text? }
 */
export function renderPauseOverlay(ctx, { width, height, extraText = 'P / ESC', colors = {} }) {
  const bg = colors.bg || DEFAULT_OVERLAY_BG;
  const text = colors.text || DEFAULT_OVERLAY_TEXT;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = text;
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText(t('game.paused'), width / 2, height / 2);

  ctx.font = '16px monospace';
  ctx.fillText(extraText, width / 2, height / 2 + 35);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ── Helpers de HUD ─────────────────────────────────────────────────────

/**
 * Prepara el contexto de canvas para renderizar texto del HUD.
 * Configura color, fuente y textBaseline = 'top'.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} [color]  Color del texto (por defecto #9aa7b2)
 */
export function setupHUDContext(ctx, color = DEFAULT_HUD_COLOR) {
  ctx.fillStyle = color;
  ctx.font = '14px monospace';
  ctx.textBaseline = 'top';
}

/**
 * Restaura textAlign y textBaseline a sus valores por defecto
 * después de renderizar el HUD.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
export function clearHUDContext(ctx) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ── HUD por defecto ────────────────────────────────────────────────────

/**
 * Renderiza el HUD estándar: score a la izquierda, record debajo,
 * y opcionalmente lives a la derecha. Soporta líneas extra.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game  - Instancia del juego (this), expone score, highscore, lives, width
 * @param {object}  [opts]
 * @param {boolean} [opts.showLives=true]  - Mostrar lives a la derecha
 * @param {string[]} [opts.extraLeft]      - Líneas extra a la izquierda (debajo de record)
 * @param {string[]} [opts.extraRight]     - Líneas extra a la derecha (debajo de lives)
 * @param {string[]} [opts.extraCenter]    - Líneas extra al centro
 */
export function renderDefaultHUD(ctx, game, { showLives = true, extraLeft = [], extraRight = [], extraCenter = [] } = {}) {
  setupHUDContext(ctx);

  let leftY = 10;
  if (game.score != null) {
    ctx.fillText(t('game.score', { n: game.score }), 10, leftY);
    leftY += 18;
  }
  if (game.highscore != null) {
    ctx.fillText(t('game.record', { n: game.highscore }), 10, leftY);
    leftY += 18;
  }
  for (const line of extraLeft) {
    ctx.fillText(line, 10, leftY);
    leftY += 18;
  }

  let rightY = 10;
  if (showLives && game.lives != null) {
    ctx.textAlign = 'right';
    ctx.fillText(t('game.lives', { n: game.lives }), game.width - 10, rightY);
    rightY += 18;
    ctx.textAlign = 'left';
  }

  for (const line of extraRight) {
    ctx.textAlign = 'right';
    ctx.fillText(line, game.width - 10, rightY);
    rightY += 18;
    ctx.textAlign = 'left';
  }

  let centerY = 10;
  for (const line of extraCenter) {
    ctx.textAlign = 'center';
    ctx.fillText(line, game.width / 2, centerY);
    centerY += 18;
    ctx.textAlign = 'left';
  }

  clearHUDContext(ctx);
}
