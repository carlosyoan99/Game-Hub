/**
 * IconRenderer
 * Sistema de iconos SVG para juegos canvas.
 * Los SVGs se cargan desde /assets/icons/{name}.svg, se cachean como texto,
 * se convierten a data URIs y se renderizan con ctx.drawImage().
 *
 * Compatible con Node.js (smoke tests): cuando Image no está disponible,
 * icon() dibuja un placeholder de texto sin lanzar error.
 *
 * Uso:
 *   import { icon } from '../../engine/IconRenderer.js';
 *   icon(ctx, 'heart', x, y, 16);
 *   icon(ctx, 'star', x, y, 20, '#ffb454'); // color personalizado
 */

// ─── Detectar si estamos en Node.js ──────────────────────────────────
const isBrowser = typeof Image !== 'undefined';

// ─── Cachés ──────────────────────────────────────────────────────────
const svgTextCache = {};    // nombre → texto SVG (promesa)
const imageCache = {};      // clave → Image object cargado

// ─── Lista de iconos conocidos ──────────────────────────────────────
// Se usa para getIconNames() y validación
const KNOWN_ICONS = [
  'heart', 'heartgreen', 'swords', 'arrow', 'shield', 'money', 'star',
  'bolt', 'check', 'cross', 'muscle', 'brain', 'chat', 'home', 'skull',
  'crown', 'trophy', 'target', 'clock', 'fire', 'bomb', 'potion', 'pizza',
  'cart', 'music', 'books', 'key', 'alarm', 'theater', 'world', 'gear',
  'lock', 'unlock', 'flag', 'refresh', 'gamepad', 'gem', 'hero',
];

/**
 * Obtiene el texto SVG de un icono, cacheándolo.
 * En browser: fetch desde /assets/icons/{name}.svg
 * En Node.js: retorna null
 * @param {string} name
 * @returns {Promise<string|null>}
 */
async function _getSvgText(name) {
  if (!isBrowser) return null;
  if (svgTextCache[name]) return svgTextCache[name];

  const promise = (async () => {
    try {
      const res = await fetch(`/assets/icons/${name}.svg`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      console.warn(`IconRenderer: no se pudo cargar "${name}.svg" —`, err.message);
      return null;
    }
  })();

  svgTextCache[name] = promise;
  return promise;
}

/**
 * Convierte un string SVG a un objeto Image.
 * El escalado se aplica en ctx.drawImage(), no aquí.
 * @param {string} svgStr - SVG inline
 * @returns {Promise<Image>|null} - null si no estamos en browser
 */
function _svgToImage(svgStr) {
  if (!isBrowser) return null;

  const encoded = encodeURIComponent(svgStr)
    .replace(/'/g, '%27')
    .replace(/\"/g, '%22');
  const dataUri = `data:image/svg+xml;charset=utf-8,${encoded}`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load SVG icon'));
    img.src = dataUri;
  });
}

/**
 * Renderiza un icono SVG en el canvas.
 * En Node.js (smoke tests) solo dibuja un placeholder de texto.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} name - Nombre del icono
 * @param {number} x - Posición X (centro)
 * @param {number} y - Posición Y (centro)
 * @param {number} [size=16] - Tamaño en píxeles
 * @param {string} [color] - Color personalizado (reemplaza currentColor)
 */
export function icon(ctx, name, x, y, size = 16, color) {
  if (!isBrowser) {
    // Placeholder para Node.js (smoke tests)
    ctx.fillStyle = '#7c8894';
    ctx.font = `${size}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('•', x, y);
    return;
  }

  const key = `${name}_${size}_${color || ''}`;

  // Si ya está en caché de imágenes, dibujar inmediatamente
  if (imageCache[key]) {
    ctx.drawImage(imageCache[key], x - size / 2, y - size / 2, size, size);
    return;
  }

  // Fast path: icono desconocido, placeholder inmediato
  if (!KNOWN_ICONS.includes(name)) {
    ctx.fillStyle = '#7c8894';
    ctx.font = `${size}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`[${name}]`, x, y);
    return;
  }

  // Cargar SVG text + convertir a imagen asíncronamente
  _getSvgText(name).then((svgStr) => {
    if (!svgStr) {
      // Fallback: mostrar nombre del icono
      ctx.fillStyle = '#7c8894';
      ctx.font = `${size}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`[${name}]`, x, y);
      return;
    }

    let finalSvg = svgStr;
    if (color) {
      finalSvg = svgStr.replace(/currentColor/g, color);
    }

    return _svgToImage(finalSvg);
  }).then((img) => {
    if (img) {
      imageCache[key] = img;
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    }
  });
}

/**
 * Precarga un conjunto de iconos (texto SVG + Image).
 * @param {string[]} names - Lista de nombres de iconos
 * @param {number} [size=16] - Tamaño
 */
export async function preloadIcons(names, size = 16) {
  if (!isBrowser) return;
  const promises = names.map(async (name) => {
    const svgStr = await _getSvgText(name);
    if (!svgStr) return;
    const key = `${name}_${size}_`;
    if (!imageCache[key]) {
      const img = await _svgToImage(svgStr);
      if (img) imageCache[key] = img;
    }
  });
  await Promise.allSettled(promises);
}

/**
 * Devuelve la lista de nombres de iconos disponibles.
 * @returns {string[]}
 */
export function getIconNames() {
  return KNOWN_ICONS.slice();
}
