/**
 * IconRenderer
 * Sistema de iconos SVG para juegos canvas.
 * Los SVGs se definen como strings, se convierten a data URIs y se cachean
 * como Image objects para renderizar con ctx.drawImage().
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

// ─── Diccionario de iconos SVG ──────────────────────────────────────────
//
// Cada icono se define como un string SVG inline.
// Usamos fill="currentColor" para permitir colores dinámicos.
// Tamaño base: 24x24 viewBox.

const ICONS = {

  // ❤ Corazón
  heart: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,

  // 💚 Corazón verde (vida/health)
  heartgreen: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,

  // ⚔️ Espadas (combate)
  swords: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 17.5L3 6l2-2 11.5 11.5"/><path d="M9.5 10.5L21 22l-2 2L7.5 12.5"/><path d="M17 7l2-2 2 2-2 2z"/></svg>`,

  // 🏹 Arco y flecha
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>`,

  // 🛡️ Escudo
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,

  // 💰 Dinero/moneda
  money: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="6" x2="12" y2="18"/><path d="M9 9c0-1.66 1.34-3 3-3s3 1.34 3 3"/><path d="M15 15c0 1.66-1.34 3-3 3s-3-1.34-3-3"/></svg>`,

  // ⭐ Estrella
  star: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,

  // ⚡ Rayo (energía)
  bolt: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,

  // ✅ Check (correcto)
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`,

  // ❌ Cruz (incorrecto)
  cross: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,

  // 💪 Músculo (fuerza)
  muscle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 4c1.1 0 2 .9 2 2v3c0 5-3 9-8 10-5-1-8-5-8-10V6c0-1.1.9-2 2-2"/><path d="M14 9V4c0-1.1-.9-2-2-2s-2 .9-2 2v5"/></svg>`,

  // 🧠 Cerebro (inteligencia)
  brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.5 2 5 3.5 5 7c0 2.5 1.5 4.5 3 5.5v4c0 1.5 1.5 3 4 3s4-1.5 4-3v-4c1.5-1 3-3 3-5.5 0-3.5-3.5-7-7-7z"/></svg>`,

  // 🗣️ Charla (carisma/diálogo)
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,

  // 🏠 Casa
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,

  // 💀 Calavera (muerte)
  skull: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/><path d="M8 16c1 1.5 3 2 4 2s3-.5 4-2"/><line x1="12" y1="16" x2="12" y2="18"/></svg>`,

  // 👑 Corona
  crown: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.5 5.5L20 5l-3 7H7L4 5l5.5 2.5L12 2zM4 18h16v2H4v-2z"/></svg>`,

  // 🏆 Trofeo
  trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2m12 6h2a2 2 0 002-2V5a2 2 0 00-2-2h-2"/><path d="M6 3h12v6a6 6 0 01-12 0V3z"/><line x1="12" y1="15" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>`,

  // 🎯 Diana (objetivo)
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,

  // ⏱️ Reloj/temporizador
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,

  // 🔥 Fuego
  fire: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2C9 4 6 8 6 12c0 3.3 2.7 6 6 6s6-2.7 6-6c0-2-1.5-4.5-4.5-7 0 0-.5 2-1.5 3 0 0-.5-4-2.5-6z"/></svg>`,

  // 💣 Bomba
  bomb: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="14" r="8"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="10" y1="12" x2="14" y2="12"/><path d="M17 7l3-3M14 4l2 2"/></svg>`,

  // 🧪 Poción
  potion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2h4l-1 4h-2z"/><path d="M7 6h10v4c0 4-2 8-5 10-3-2-5-6-5-10V6z"/></svg>`,

  // 🍕 Pizza
  pizza: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8 2 4 4 2 8l10 14L22 8c-2-4-6-6-10-6zm0 3c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/></svg>`,

  // 🛒 Carrito
  cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.4a2 2 0 002 1.6h9.72a2 2 0 002-1.6L23 6H6"/></svg>`,

  // 🎵 Música
  music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8.5" cy="18.5" r="3.5"/><circle cx="17.5" cy="15.5" r="3.5"/><path d="M12 18V4l10-2v13"/></svg>`,

  // 📚 Libros
  books: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,

  // 🔑 Llave
  key: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="7"/><line x1="14" y1="12" x2="22" y2="12"/><line x1="18" y1="9" x2="18" y2="15"/></svg>`,

  // 🚨 Alarma
  alarm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/><path d="M18 8l2-2M6 8L4 6"/></svg>`,

  // 🎭 Teatro/disfraz
  theater: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 00-16 0"/></svg>`,

  // 🌍 Mundo/mapa
  world: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,

  // ⚙️ Engranaje (configuración)
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,

  // 🔒 Candado cerrado
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,

  // 🔓 Candado abierto
  unlock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>`,

  // 🏳️ Bandera (meta)
  flag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21V3l12 6-12 6z"/></svg>`,

  // ♻️ Reciclaje/día nuevo
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>`,

  // 🎮 Gamepad
  gamepad: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="8" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,

  // 💎 Diamante/gema
  gem: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 7l10 5 10-5"/><path d="M12 12v10"/></svg>`,

  // 🦸 Héroe/personaje
  hero: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><path d="M16 7l2-3M8 7L6 4"/></svg>`,

};

// ─── Caché de imágenes ──────────────────────────────────────────────────

const imageCache = {};

/**
 * Convierte un string SVG a un objeto Image.
 * @param {string} svgStr - SVG inline
 * @param {number} size - Tamaño en píxeles
 * @returns {Promise<Image>|null} - null si no estamos en browser
 */
function svgToImage(svgStr, size = 24) {
  if (!isBrowser) return null;

  const encoded = encodeURIComponent(svgStr)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
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
 * @param {string} name - Nombre del icono (ver ICONS)
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

  const svgStr = ICONS[name];
  if (!svgStr) {
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

  const key = `${name}_${size}_${color || ''}`;
  if (imageCache[key]) {
    ctx.drawImage(imageCache[key], x - size / 2, y - size / 2, size, size);
    return;
  }

  // Cargar asíncronamente
  svgToImage(finalSvg, size).then((img) => {
    if (img) {
      imageCache[key] = img;
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    }
  });
}

/**
 * Precarga un conjunto de iconos.
 * @param {string[]} names - Lista de nombres de iconos
 * @param {number} [size=16] - Tamaño
 */
export function preloadIcons(names, size = 16) {
  if (!isBrowser) return;
  for (const name of names) {
    const svgStr = ICONS[name];
    if (!svgStr) continue;
    const key = `${name}_${size}_`;
    if (!imageCache[key]) {
      svgToImage(svgStr, size).then((img) => {
        if (img) imageCache[key] = img;
      });
    }
  }
}

/**
 * Devuelve la lista de nombres de iconos disponibles.
 * @returns {string[]}
 */
export function getIconNames() {
  return Object.keys(ICONS);
}
