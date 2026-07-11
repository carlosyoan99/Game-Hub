/**
 * AssetLoader
 * Carga y cachea imágenes/audio/JSON por URL para que varios juegos
 * puedan compartir assets sin recargarlos, y para poder hacer
 * `await AssetLoader.loadImage(...)` antes de arrancar un juego.
 */
class AssetLoaderImpl {
  constructor() {
    this._cache = new Map();
  }

  loadImage(url) {
    if (this._cache.has(url)) return this._cache.get(url);
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${url}`));
      img.src = url;
    });
    this._cache.set(url, promise);
    return promise;
  }

  loadAudio(url) {
    if (this._cache.has(url)) return this._cache.get(url);
    const promise = new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.oncanplaythrough = () => resolve(audio);
      audio.onerror = () => reject(new Error(`No se pudo cargar el audio: ${url}`));
      audio.src = url;
    });
    this._cache.set(url, promise);
    return promise;
  }

  async loadJSON(url) {
    if (this._cache.has(url)) return this._cache.get(url);
    const promise = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`No se pudo cargar JSON: ${url}`);
      return res.json();
    });
    this._cache.set(url, promise);
    return promise;
  }

  clearCache() {
    this._cache.clear();
  }
}

// Singleton: los assets se comparten entre juegos de forma natural.
export const AssetLoader = new AssetLoaderImpl();
