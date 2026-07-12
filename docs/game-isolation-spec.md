# Game Isolation Spec

> Fecha: 2026-07-12
> Objetivo: Separar los recursos específicos de cada juego del motor de juego (`src/engine/`), haciendo que cada juego sea una unidad independiente con sus propias traducciones, documentación y estructura interna.

---

## 1. Problema detectado

Actualmente `src/engine/i18n.js` contiene **más de 500 líneas de traducciones específicas de juegos** (17 juegos × ~30 claves cada uno = ~500+ líneas). El motor no debería conocer los detalles internos de cada juego.

Además:
- Cada carpeta de juego tiene **un solo archivo .js** (sin subdivisión interna)
- No hay **README.md** por juego
- El `registry.js` apunta directamente a `./game/GameName.js` en lugar de a un `index.js`
- **7 juegos superan las 400 líneas** (Swords: 1562, Henry: 905, Territory: 902, Crush: 748, Bloons: 743, Bowman: 741, Asteroids: 557), lo que hace recomendable su división interna

---

## 2. Decisiones de arquitectura

### 2.1 i18n: mover traducciones a cada juego

| Aspecto | Decisión |
|---------|----------|
| **Mecanismo** | Cada carpeta de juego tiene un `i18n.js`. El engine i18n lo importa dinámicamente de forma implícita al cargar el juego. |
| **Carga** | Al `load()` del juego, el engine i18n hace `import(`../games/${id}/i18n.js`)`. Si falla (el archivo no existe), muestra `console.warn()` pero no bloquea la carga. |
| **Prefijos** | Cada juego mantiene su prefijo actual (ej. `'crush.'`, `'bloons.'`, `'flappy.'`). No se impone una convención automática basada en `game.id`. |
| **Claves compartidas** | Las claves `game.*`, `level.*`, `menu.*`, `settings.*` se quedan en `src/engine/i18n.js` como base común del engine y el hub. |
| **Registry keys** | Las claves `registry.<id>.title` / `registry.<id>.tagline` se quedan en `src/engine/i18n.js` porque son del hub, no del juego. |

**Formato del i18n.js de cada juego:**
```js
// src/games/pong/i18n.js
export default {
  'pong.level':      { es: 'Nivel {n}/{max} — {label}', en: 'Level {n}/{max} — {label}' },
  'pong.target':     { es: 'Meta: {n} puntos',          en: 'Target: {n} points' },
  'pong.bestLevel':  { es: 'Mejor: nivel {n}',          en: 'Best: level {n}' },
  'pong.gameComplete': { es: '¡PONG COMPLETADO!',       en: 'PONG COMPLETE!' },
  'pong.lost':       { es: 'DERROTA',                   en: 'DEFEAT' },
};
```

**API del engine i18n:**
```js
// src/engine/i18n.js — nuevos métodos
export function registerTranslations(translations) {
  // Mergea translations en el diccionario interno (sobrescribe si hay conflicto)
}

export function loadGameTranslations(gameId) {
  // Intenta import(`../games/${gameId}/i18n.js`)
  // Si éxito: registerTranslations(module.default)
  // Si falla: console.warn('No i18n found for game: ' + gameId)
}
```

### 2.2 Estructura de cada juego

| Aspecto | Decisión |
|---------|----------|
| **Punto de entrada** | Cada juego tiene un `index.js` que re-exporta la Game Class. `registry.js` apunta a `./pong/index.js`. |
| **División interna** | Estructura libre. Cada juego decide cómo organizarse. No hay plantilla obligatoria. Solo se requiere `index.js` + `README.md`. |
| **Archivos recomendados** | Para juegos grandes (>400 líneas), se sugiere separar en: `constants.js`, `entities.js`, `render.js`, `i18n.js`, etc., pero no es obligatorio. |

**Ejemplo de index.js:**
```js
// src/games/pong/index.js
export { Pong } from './Pong.js';
```

**Ejemplo de cambio en registry.js:**
```js
{
  id: 'pong',
  title: 'Pong',
  title_i18n: 'registry.pong.title',
  tagline: 'Rebote con ángulo variable vs. IA',
  tagline_i18n: 'registry.pong.tagline',
  level: 1,
  load: () => import('./pong/index.js').then((m) => m.Pong),
}
```

### 2.3 README.md por juego

Cada juego debe tener un `README.md` en su carpeta con **contenido técnico completo**:

- **Gameplay**: descripción del juego, objetivo, mecánicas principales
- **Controles**: teclado y ratón, combinaciones de teclas
- **Cómo ganar/perder**: condiciones de victoria y derrota
- **Constantes de balance**: tablas de niveles, velocidades, daños, valores de configuración
- **Estructura del código**: qué archivos componen el juego, qué hace cada uno
- **Engine features que usa**: qué partes del motor utiliza (Tilemap, Camera, Vector2, ParticleSystem, etc.)

**Plantilla recomendada:**
```md
# [Game Title]

## Gameplay
_Breve descripción del juego._

## Controles
| Tecla | Acción |
|-------|--------|
| ← → | Movimiento |
| Espacio | Disparar / Saltar |

## Objetivo
_Cómo se gana y cómo se pierde._

## Constantes de balance
_Tablas de dificultad, velocidades, etc._

## Estructura del código
_Lista de archivos y responsabilidades._

## Dependencias del engine
_Qué módulos de src/engine/ utiliza._
```

---

## 3. Plan de implementación

### Fase 1: Engine i18n — preparar carga dinámica

**Archivos a modificar:** `src/engine/i18n.js`

1. Añadir método `registerTranslations(translations)` que mergea un objeto de traducciones en `TRANSLATIONS` interno.
2. Añadir método `loadGameTranslations(gameId)` que:
   - Hace `import(`../games/${gameId}/i18n.js`)`
   - Si éxito: llama `registerTranslations(module.default)`
   - Si falla: `console.warn('Game i18n not found:', gameId)`
3. Mantener `t()`, `applyI18n()`, `initI18n()` sin cambios.

### Fase 2: Mover traducciones a cada juego

**17 archivos a crear:** `src/games/<id>/i18n.js` para cada juego

1. Extraer las claves específicas de cada juego del `TRANSLATIONS` en `src/engine/i18n.js`.
2. Crear `i18n.js` en cada carpeta de juego con sus claves (en el formato `export default { ... }`).
3. Eliminar las claves extraídas de `src/engine/i18n.js` (solo las específicas de juegos, no `game.*`, `level.*`, `menu.*`, `settings.*`, `registry.*`).

### Fase 3: Integrar carga en el flujo de juego

**Archivos a modificar:** `src/engine/i18n.js`, `src/main.js` (o `GameEngine.js`)

1. En `main.js`, al hacer `launchGame(gameMeta)`, llamar a `loadGameTranslations(gameMeta.id)` **antes** o en paralelo con `gameMeta.load()`.
2. Asegurar que `t()` funciona correctamente con las traducciones registradas dinámicamente.

### Fase 4: index.js por juego

**17 archivos a crear + 1 a modificar:**

1. Crear `src/games/<id>/index.js` en cada carpeta de juego con `export { GameClass } from './GameFile.js'`.
2. Modificar `src/games/registry.js` para que `load()` apunte a `./<id>/index.js`.

### Fase 5: README.md por juego

**17 archivos a crear:** `src/games/<id>/README.md`

1. Crear README.md para cada juego siguiendo la plantilla definida.
2. Contenido basado en el código fuente: gameplay, controles, constantes, estructura.

### Fase 6: Refactor opcional de juegos grandes

**Opcional, solo para juegos >400 líneas:**

- **Swords and Souls** (1562 líneas): dividir en `home.js`, `training.js`, `arena.js`, `shop.js`, `combat.js`, `constants.js`, `i18n.js`, `index.js`
- **Henry Stickmin** (905 líneas): dividir en `scenes/`, `choices.js`, `constants.js`, `i18n.js`, `index.js`
- **Territory War** (902 líneas): dividir en `units.js`, `ai.js`, `render.js`, `constants.js`, `i18n.js`, `index.js`
- **Crush the Castle** (748 líneas): dividir en `physics.js`, `castle.js`, `render.js`, `constants.js`, `i18n.js`, `index.js`
- **Bloons TD** (743 líneas): dividir en `bloons.js`, `towers.js`, `waves.js`, `render.js`, `constants.js`, `i18n.js`, `index.js`
- **Bowman** (741 líneas): dividir en `archer.js`, `physics.js`, `ai.js`, `render.js`, `constants.js`, `i18n.js`, `index.js`
- **Asteroids** (557 líneas): dividir en `ship.js`, `enemies.js`, `render.js`, `constants.js`, `i18n.js`, `index.js`

---

## 4. Archivos a modificar/crear (resumen)

| Acción | Archivos |
|--------|----------|
| **Modificar** | `src/engine/i18n.js` (añadir registerTranslations, loadGameTranslations) |
| **Modificar** | `src/games/registry.js` (cambiar rutas a ./<id>/index.js) |
| **Modificar** | `src/main.js` (llamar loadGameTranslations en launchGame) |
| **Crear (17)** | `src/games/<id>/index.js` para cada juego |
| **Crear (17)** | `src/games/<id>/i18n.js` para cada juego |
| **Crear (17)** | `src/games/<id>/README.md` para cada juego |
| **Refactor (7)** | División opcional de juegos >400 líneas |
| **No tocar** | `src/engine/` excepto `i18n.js` |

---

## 5. Riesgos y consideraciones

| Riesgo | Mitigación |
|--------|------------|
| **Import dinámico falla** en navegadores sin soporte o con URLs relativas incorrectas | Usar rutas absolutas desde la raíz del proyecto. El import dinámico es estándar en ES modules modernos. |
| **Carrera** entre `loadGameTranslations` y el render del juego que usa `t()` | Asegurar que `loadGameTranslations` se complete antes de render. Hacer `await` en paralelo con `gameMeta.load()`. |
| **Duplicación accidental** de claves entre juegos (ej. dos juegos usan `'score'` como clave) | Los prefijos (ej. `'pong.'`) evitan colisiones. El engine debe advertir si una clave ya está registrada. |
| **Aumento de requests HTTP** por los 17 archivos i18n.js adicionales | Son imports dinámicos bajo demanda (solo se carga el i18n del juego que se está jugando). El hub no necesita cargar los 17. |
| **Smoke test** necesita cargar i18n.js para funcionar | El smoke test simula DOM/canvas pero no navegador. Verificar que el import dinámico en entorno Node.js funciona (jsdom no necesita el import). |

---

## 6. Criterios de aceptación

- [ ] `src/engine/i18n.js` no contiene claves de juegos individuales (solo `game.*`, `level.*`, `menu.*`, `settings.*`, `registry.*`)
- [ ] Cada `src/games/<id>/i18n.js` exporta las traducciones de su juego
- [ ] Cada `src/games/<id>/index.js` exporta la Game Class
- [ ] Cada `src/games/<id>/README.md` documenta el juego
- [ ] `registry.js` apunta a `./<id>/index.js` para todos los juegos
- [ ] `launchGame()` carga traducciones junto con el juego
- [ ] `t()` funciona igual que antes (compatible hacia atrás)
- [ ] Smoke test pasa (17 juegos, 300 frames cada uno, sin excepciones)
- [ ] `node --check` pasa en todos los archivos modificados
