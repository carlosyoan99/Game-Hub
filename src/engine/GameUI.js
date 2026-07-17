/**
 * GameUI
 * Helpers reutilizables para renderizar overlays y HUD comunes.
 *
 * Reduce la duplicación de código (~200 líneas) entre juegos que
 * comparten el mismo patrón de pantalla de game over y configuración
 * básica de HUD.
 */
import { t } from './i18n.js';
import { icon } from './IconRenderer.js';

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

// ── Helper para formatear nombre del gamepad ────────────────────────────

/**
 * Extrae el nombre legible del control desde el raw gamepad.id.
 * El raw id suele ser algo como:
 *   "Xbox 360 Controller (XInput STANDARD GAMEPAD)"
 *   "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)"
 *   "Nintendo Switch Pro Controller"
 *
 * @param {string} rawId - Valor de e.gamepad.id
 * @returns {string} Nombre limpio del control
 */
function _formatGamepadName(rawId) {
  if (!rawId) return '';
  // Tomar solo la parte antes del primer paréntesis
  let name = rawId.split('(')[0].trim();

  // Limpiar vendor junk también cuando no hay paréntesis:
  // "STANDARD GAMEPAD Vendor: 054c Product: 05c4"
  if (!name || /STANDARD GAMEPAD|Vendor:|Product:/i.test(name)) {
    name = (name || rawId)
      .replace(/STANDARD GAMEPAD\s*/i, '')
      .replace(/Vendor:.*/i, '')
      .replace(/Product:.*/i, '')
      .replace(/\([^)]*\)/g, '') // remover cualquier paréntesis restante
      .replace(/\s*\d+$/, '')
      .trim();
  }
  return name || t('gamepad.tooltip');
}

// ── Gamepad indicator ────────────────────────────────────────────────────

/**
 * Renderiza un icono de gamepad en la esquina superior derecha cuando
 * hay un control conectado. Si el ratón está sobre el icono, muestra
 * un tooltip textual.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} input - El InputManager del engine (input.gamepad.connected)
 * @param {number} canvasWidth - Ancho del canvas
 * @param {number} mouseX - Posición X del ratón (para hover)
 * @param {number} mouseY - Posición Y del ratón
 * @param {number} [size=18] - Tamaño del icono
 */
export function renderGamepadIndicator(ctx, input, canvasWidth, mouseX = -999, mouseY = -999, size = 18) {
  if (!input.gamepad.connected) return;

  const x = canvasWidth - 16 - size / 2;
  const y = 16 + size / 2;

  // Sutil brillo detrás del icono
  ctx.save();
  ctx.fillStyle = 'rgba(154, 167, 178, 0.08)';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  icon(ctx, 'gamepad', x, y, size, '#9aa7b2');

  // Tooltip al hacer hover (radio de 22px desde el centro del icono)
  const dx = mouseX - x;
  const dy = mouseY - y;
  if (dx * dx + dy * dy < 22 * 22) {
    const label = input.gamepad.id ? _formatGamepadName(input.gamepad.id) : t('gamepad.tooltip');

    ctx.font = '12px monospace';
    const metrics = ctx.measureText(label);
    const padX = 8;
    const padY = 4;
    const tw = metrics.width + padX * 2;
    const th = 20;

    // Posicionar tooltip a la izquierda del icono
    let tx = x - tw - 6;
    const ty = y - th / 2;

    // No salirse del borde izquierdo
    if (tx < 4) tx = 4;

    ctx.save();
    // Sombra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(tx + 1, ty + 1, tw, th, 4);
    ctx.fill();
    // Fondo
    ctx.fillStyle = 'rgba(30, 39, 49, 0.92)';
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 4);
    ctx.fill();
    // Borde sutil
    ctx.strokeStyle = 'rgba(154, 167, 178, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 4);
    ctx.stroke();
    // Texto
    ctx.fillStyle = '#e7edf3';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, tx + tw / 2, ty + th / 2);
    ctx.restore();
  }
}

// ═════════════════════════════════════════════════════════════════════════
//  Toast Notifications
// ═════════════════════════════════════════════════════════════════════════

/**
 * Crea un gestor de toasts con estado interno.
 * @returns {{ toasts: Array, addToast: Function, updateToasts: Function, renderToasts: Function }}
 */
export function createToastManager() {
  const toasts = [];

  /**
   * Añade un toast con animación slide-in (0.3s) + fade-out (últimos 0.5s).
   * @param {string} message
   */
  function addToast(message) {
    toasts.push({ message, timer: 3, alpha: 1, age: 0 });
    if (toasts.length > 3) toasts.shift();
  }

  /**
   * Actualiza los temporizadores de los toasts.
   * @param {number} dt - Delta time en segundos
   */
  function updateToasts(dt) {
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i];
      t.timer -= dt;
      t.age += dt;

      // Fade-out en los últimos 0.5s
      if (t.timer < 0.5) {
        t.alpha = Math.max(0, t.timer + 0.5);
      }

      if (t.timer < -0.5) {
        toasts.splice(i, 1);
      }
    }
  }

  /**
   * Renderiza todos los toasts centrados en la parte inferior
   * con animación slide-in (sube desde abajo en 0.3s) + fade-out.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   */
  function renderToasts(ctx, canvasWidth, canvasHeight) {
    if (toasts.length === 0) return;

    const SLIDE_DURATION = 0.3;   // segundos que dura el slide-in
    const SLIDE_DISTANCE = 40;     // píxeles que recorre al entrar

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '13px monospace';

    for (let i = 0; i < toasts.length; i++) {
      const t = toasts[i];

      // ── Animación de entrada: slide desde abajo ─────────────────
      const entryProgress = Math.min(1, t.age / SLIDE_DURATION);
      // easeOutCubic para un frenado suave
      const eased = 1 - Math.pow(1 - entryProgress, 3);
      const slideOffset = (1 - eased) * SLIDE_DISTANCE;

      // Alpha combinado: entrada * salida
      const entryAlpha = eased;
      const totalAlpha = entryAlpha * t.alpha;

      if (totalAlpha <= 0) continue;

      // Posición vertical final, más el offset de slide
      const baseY = canvasHeight - 50 - (toasts.length - 1 - i) * 34;
      const y = baseY + slideOffset;

      // Ancho del texto para dimensionar el fondo
      const tw = ctx.measureText(t.message).width;
      const padX = 14;
      const padY = 6;
      const bw = tw + padX * 2;
      const bh = 26;
      const bx = canvasWidth / 2 - bw / 2;
      const by = y - bh / 2;

      // Sombra ligera
      ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * totalAlpha})`;
      ctx.beginPath();
      ctx.roundRect(bx + 1, by + 2, bw, bh, 6);
      ctx.fill();

      // Fondo
      ctx.fillStyle = `rgba(30, 39, 49, ${0.9 * totalAlpha})`;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 6);
      ctx.fill();

      // Borde sutil
      ctx.strokeStyle = `rgba(154, 167, 178, ${0.25 * totalAlpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 6);
      ctx.stroke();

      // Texto
      ctx.fillStyle = `rgba(231, 237, 243, ${totalAlpha})`;
      ctx.fillText(t.message, canvasWidth / 2, y);
    }

    ctx.restore();
  }

  return { toasts, addToast, updateToasts, renderToasts };
}

// ═════════════════════════════════════════════════════════════════════════
//  Difficulty Selector
// ═════════════════════════════════════════════════════════════════════════

/**
 * Renderiza un selector de dificultad con tarjetas clickeables.
 * Cada dificultad se muestra como una tarjeta con label y descripción.
 * Devuelve un array de rectángulos { x, y, width, height } para hit testing.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 * @param {number}  opts.width          - Ancho del canvas
 * @param {number}  opts.height         - Alto del canvas
 * @param {Array<{id:string,label:string,description:string}>} opts.difficulties - Opciones de dificultad
 * @param {number} [opts.selectedIndex] - Índice seleccionado (para highlight)
 * @param {string} [opts.title]         - Título del selector (por defecto t('game.selectDifficulty'))
 * @param {string} [opts.subtitle]      - Subtítulo opcional
 * @param {object} [opts.colors]        - { bg?, cardBg?, cardBorder?, cardSelected?, text?, desc? }
 * @returns {Array<{x:number,y:number,width:number,height:number}>}
 */
export function renderDifficultySelector(ctx, opts) {
  const {
    width, height,
    difficulties,
    selectedIndex = -1,
    title = t('game.selectDifficulty'),
    subtitle = '',
    colors = {},
  } = opts;

  const bg = colors.bg || '#0b0f14';
  const cardBg = colors.cardBg || '#11161d';
  const cardBorder = colors.cardBorder || '#1e2731';
  const cardSelected = colors.cardSelected || '#2a3a4a';
  const text = colors.text || '#e7edf3';
  const desc = colors.desc || '#7c8894';

  const count = difficulties.length;
  const cardW = 170;
  const cardH = 70;
  const gap = 16;
  const totalW = count * cardW + (count - 1) * gap;
  const startX = Math.max(10, (width - totalW) / 2);
  const cardY = height / 2 + 5;

  // Fondo
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Título
  ctx.fillStyle = text;
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, width / 2, height / 2 - 90);

  // Subtítulo
  if (subtitle) {
    ctx.font = '14px monospace';
    ctx.fillStyle = desc;
    ctx.fillText(subtitle, width / 2, height / 2 - 50);
  }

  // Tarjetas
  const buttons = [];
  for (let i = 0; i < count; i++) {
    const x = startX + i * (cardW + gap);
    const y = cardY;
    buttons.push({ x, y, width: cardW, height: cardH });

    // Fondo de tarjeta
    const isSelected = i === selectedIndex;
    ctx.fillStyle = isSelected ? cardSelected : cardBg;
    ctx.fillRect(x, y, cardW, cardH);

    // Borde
    ctx.strokeStyle = isSelected ? '#4a9eff' : cardBorder;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(x, y, cardW, cardH);

    // Label
    ctx.fillStyle = text;
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(difficulties[i].label, x + cardW / 2, y + 24);

    // Descripción
    ctx.font = '11px monospace';
    ctx.fillStyle = desc;
    ctx.fillText(difficulties[i].description, x + cardW / 2, y + 48);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  return buttons;
}

// ═════════════════════════════════════════════════════════════════════════
//  Boss Health Bar
// ═════════════════════════════════════════════════════════════════════════

/**
 * Renderiza una barra de vida de jefe consistente.
 * Cambia de color según el porcentaje: verde > 50%, amarillo > 25%, rojo.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 * @param {number} opts.x       - Posición X de la barra
 * @param {number} opts.y       - Posición Y de la barra
 * @param {number} opts.width   - Ancho de la barra
 * @param {number} [opts.height=12] - Alto de la barra
 * @param {number} opts.hp      - HP actual
 * @param {number} opts.maxHp   - HP máximo
 * @param {string} [opts.label] - Etiqueta opcional (ej. "BOSS")
 * @param {object} [opts.colors] - { bg?, fill?, border?, low?, mid? }
 *   - bg: fondo de la barra (default 'rgba(0,0,0,0.5)')
 *   - fill: color de relleno (default automático según %)
 *   - border: color del borde (default 'rgba(255,255,255,0.2)')
 *   - low: color cuando hp < 25% (default '#e74c3c')
 *   - mid: color cuando hp < 50% (default '#ffb454')
 *   - high: color cuando hp >= 50% (default '#3a9a5a')
 */
export function renderBossHealthBar(ctx, opts) {
  const {
    x, y,
    width,
    height = 12,
    hp, maxHp,
    label = '',
    colors = {},
  } = opts;

  if (maxHp <= 0) return;

  const hpPct = Math.max(0, Math.min(1, hp / maxHp));
  const bgColor = colors.bg || 'rgba(0, 0, 0, 0.5)';
  const borderColor = colors.border || 'rgba(255, 255, 255, 0.2)';
  const lowColor = colors.low || '#e74c3c';
  const midColor = colors.mid || '#ffb454';
  const highColor = colors.high || '#3a9a5a';

  // Color de relleno según HP
  let fillColor = colors.fill;
  if (!fillColor) {
    if (hpPct < 0.25) fillColor = lowColor;
    else if (hpPct < 0.50) fillColor = midColor;
    else fillColor = highColor;
  }

  // Etiqueta (si hay)
  if (label) {
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x, y - 2);
  }

  // Fondo
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, width, height);

  // Relleno
  ctx.fillStyle = fillColor;
  if (hpPct > 0) {
    ctx.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * hpPct), height - 2);
  }

  // Borde
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  // Indicador de enrage (pulso cuando HP < 30%)
  if (hpPct < 0.3) {
    const pulse = 0.3 + Math.sin(Date.now() * 0.008) * 0.2;
    ctx.fillStyle = `rgba(255, 0, 0, ${pulse * 0.15})`;
    ctx.fillRect(x + 1, y + 1, (width - 2) * hpPct, height - 2);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ═════════════════════════════════════════════════════════════════════════
//  Achievement Popup
// ═════════════════════════════════════════════════════════════════════════

/**
 * Renderiza un popup de logro desbloqueado con animación slide-in.
 * Debe llamarse por cada frame durante el tiempo que dure el popup.
 *
 * Uso típico:
 *   const popup = { title, description, timer: 3, alpha: 1, age: 0 };
 *   // En update:
 *   popup.timer -= dt; popup.age += dt;
 *   if (popup.timer < 0.5) popup.alpha = Math.max(0, popup.timer + 0.5);
 *   // En render:
 *   renderAchievementPopup(ctx, { width, height, ...popup });
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 * @param {number}  opts.width       - Ancho del canvas
 * @param {number}  opts.height      - Alto del canvas
 * @param {string}  opts.title       - Nombre del logro
 * @param {string}  [opts.description] - Descripción del logro
 * @param {number}  [opts.timer=3]    - Tiempo restante en segundos
 * @param {number}  [opts.alpha=1]    - Opacidad actual
 * @param {number}  [opts.age=0]      - Edad en segundos (para slide-in)
 * @param {object}  [opts.colors]     - { bg?, text?, accent? }
 */
export function renderAchievementPopup(ctx, opts) {
  const {
    width, height,
    title,
    description = '',
    timer = 3,
    alpha = 1,
    age = 0,
    colors = {},
  } = opts;

  if (alpha <= 0) return;

  const bg = colors.bg || 'rgba(30, 39, 49, 0.95)';
  const text = colors.text || '#e7edf3';
  const accent = colors.accent || '#ffd700';

  // Dimensiones del popup
  const popupW = Math.min(380, width - 40);
  const popupH = 70;
  const popupX = (width - popupW) / 2;

  // Animación slide-in (0.4s)
  const slideDuration = 0.4;
  const slideDistance = 30;
  const entryProgress = Math.min(1, age / slideDuration);
  const eased = 1 - Math.pow(1 - entryProgress, 3); // easeOutCubic
  const slideOffset = (1 - eased) * slideDistance;

  // Fade-out en los últimos 0.5s
  const displayAlpha = alpha;
  const totalAlpha = eased * displayAlpha;

  if (totalAlpha <= 0) return;

  const popupY = 10 - slideOffset;

  ctx.save();
  ctx.globalAlpha = totalAlpha;

  // Sombra
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.roundRect(popupX + 2, popupY + 2, popupW, popupH, 8);
  ctx.fill();

  // Fondo
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(popupX, popupY, popupW, popupH, 8);
  ctx.fill();

  // Borde con acento
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(popupX, popupY, popupW, popupH, 8);
  ctx.stroke();

  // Barra decorativa izquierda
  ctx.fillStyle = accent;
  ctx.fillRect(popupX + 2, popupY + 8, 4, popupH - 16);

  // Icono de trofeo
  icon(ctx, 'star', popupX + 32, popupY + popupH / 2, 22, accent);

  // Título
  ctx.fillStyle = accent;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, popupX + 52, popupY + 24);

  // Descripción
  if (description) {
    ctx.fillStyle = text;
    ctx.font = '11px monospace';
    ctx.fillText(description, popupX + 52, popupY + 48);
  }

  ctx.restore();
}
