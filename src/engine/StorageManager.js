/**
 * StorageManager
 * Namespacing de localStorage por juego para evitar colisiones de claves
 * entre juegos distintos (p.ej. "highscore" en Breakout vs. Asteroids).
 * Uso: new StorageManager('breakout').get('highscore', 0)
 */
export class StorageManager {
  constructor(namespace) {
    this.namespace = namespace;
  }

  _key(key) {
    return `gamehub:${this.namespace}:${key}`;
  }

  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(this._key(key));
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw);
      // Validar tipo contra el fallback para evitar datos corruptos
      if (parsed === null || parsed === undefined) return fallback;
      const fbType = typeof fallback;
      if (fbType === 'number' || fbType === 'string' || fbType === 'boolean') {
        if (typeof parsed !== fbType) return fallback;
      }
      if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
      return parsed;
    } catch {
      return fallback;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(this._key(key), JSON.stringify(value));
      return true;
    } catch {
      return false; // p.ej. localStorage lleno o deshabilitado
    }
  }

  remove(key) {
    localStorage.removeItem(this._key(key));
  }
}
