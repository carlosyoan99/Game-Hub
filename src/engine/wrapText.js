/**
 * wrapText
 * Dibuja texto con word-wrap en un contexto Canvas 2D.
 * Parte el texto por palabras y salta de línea cuando supera maxWidth.
 * El contexto debe tener `font` configurado antes de llamar a esta función.
 *
 * Uso:
 *   import { wrapText } from '../../engine/wrapText.js';
 *   ctx.font = '14px monospace';
 *   wrapText(ctx, 'Texto largo que se parte solo', x, y, maxWidth, lineHeight);
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text     Texto a dibujar (con espacios entre palabras).
 * @param {number} x        Coordenada X inicial.
 * @param {number} y        Coordenada Y inicial (esquina superior de la primera línea).
 * @param {number} maxWidth  Ancho máximo en píxeles antes de partir.
 * @param {number} lineHeight  Altura de cada línea en píxeles.
 */
export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';

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

  let offsetY = y;
  for (const l of lines) {
    ctx.fillText(l, x, offsetY);
    offsetY += lineHeight;
  }
}
