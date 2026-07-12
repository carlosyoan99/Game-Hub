/**
 * AssetLoader
 * Carga y cachea imágenes/audio/JSON por URL para que varios juegos
 * puedan compartir assets sin recargarlos, y para poder hacer
 * `await AssetLoader.loadImageAsync(...)` antes de arrancar un juego.
 *
 * Todos los métodos devuelven Promises que se resuelven cuando el recurso
 * está listo para usar (imagen decodificada, audio descodificado, JSON parseado).
 */
class AssetLoaderImpl {
  constructor() {
    this._cache = new Map();
  }

  /** Carga una imagen y devuelve Promise<HTMLImageElement> (resuelta en onload). */
  loadImageAsync(url) {
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

  /** Carga audio y devuelve Promise<HTMLAudioElement> (resuelto en oncanplaythrough). */
  loadAudioAsync(url) {
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

  /** Carga JSON y devuelve Promise<object>. */
  async loadJSONAsync(url) {
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
