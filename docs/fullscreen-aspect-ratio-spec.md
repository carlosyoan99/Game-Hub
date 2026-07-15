# GameHub Engine — Pantalla Completa y Proporción de Aspecto

> **Fecha**: Julio 2026
> **Estado**: Especificación — basada en entrevista con el desarrollador
> **Objetivo**: Adaptar todos los juegos y la interfaz del hub para que ocupen la pantalla completa con proporción de aspecto configurable (4:3, 5:3, 16:9) y efectos visuales CRT auténticos.

---

## 1. Visión General

El hub actual renderiza los juegos en un canvas flexible que se redimensiona con la ventana manteniendo una proporción 5:3 (900×540 máximo). El objetivo es transformar la experiencia para que:

1. El canvas tenga una **resolución interna fija de 900×540** (independientemente de la proporción elegida).
2. La proporción visible sea **configurable** entre 4:3 (clásico CRT), 5:3 (actual) y 16:9 (panorámico).
3. El canvas se renderice a un **buffer interno (offscreen canvas)** y se escale con CSS para ocupar todo el espacio disponible, manteniendo la proporción y añadiendo **barras con efecto glow dinámico**.
4. Se superpongan **efectos CRT**: scanlines, curvatura leve (CSS/SVG overlay), recuadro CRT y glow de borde.
5. Todo se envuelva en un **marco CRT** que también aplique al hub/menú.
6. Haya un **botón para activar fullscreen real** del navegador.
7. Todo sea **togleable desde settings** (efecto CRT on/off, proporción de aspecto).

### 1.1 Principios de diseño

- **Resolución interna constante**: Todos los juegos dibujan a 900×540. El escalado se hace por CSS, no por los juegos. Así ningún juego necesita modificaciones para soportar la nueva proporción.
- **Sin dependencias externas**: Todo el efecto CRT se hace con CSS + SVG + Canvas 2D. Sin WebGL, sin bibliotecas de post-processing.
- **Rendimiento**: El offscreen canvas evita re-renderizar los juegos a diferentes resoluciones. El muestreo dinámico de glow se hace a baja frecuencia (~4-5 fps) para minimizar CPU.
- **Persistencia**: La configuración de proporción y efecto CRT se guarda en localStorage (SettingsManager).
- **Accesibilidad**: El efecto CRT se puede desactivar completamente desde settings (respetar reducedMotion).

### 1.2 Lo que NO cambia

- Resolución interna de dibujo: 900×540
- Ciclo de vida `init/update/render/destroy`
- Carga dinámica vía `import()`
- i18n ES/EN
- Sin dependencias externas

---

## 2. Arquitectura de Renderizado

### 2.1 Flujo actual

```
Game.render(ctx) → canvas visible (900×540 reales)
                     ↓
               Escalado CSS (max-width: 100%)
                     ↓
               Bordes: 2px solid var(--line)
```

### 2.2 Flujo propuesto

```
Game.render(ctx) → OffscreenCanvas (siempre 900×540)
                     ↓
               ctx.drawImage(offscreenCanvas, 0, 0, destW, destH)
                     ↓
               Canvas visible (dimensiones calculadas según proporción)
                     ↓
               + Barras CRT con glow dinámico
                     ↓
               + Overlay CSS/SVG: scanlines, curvatura, marco CRT
                     ↓
               + Botón fullscreen
```

### 2.3 Componentes del nuevo sistema

| Componente | Archivo | Propósito |
|------------|---------|-----------|
| `AspectRatioManager.js` | `src/engine/` | Gestiona proporción, dimensiones, escalado, offscreen canvas |
| `CRTEffects.js` | `src/engine/` | Overlay CSS/SVG con scanlines, curvatura, marco, glow |
| Integración en `main.js` | `src/main.js` | Botón fullscreen, activación del marco CRT en hub |
| Integración en `SettingsManager` | `src/engine/SettingsManager.js` | Nuevas settings: aspectRatio, crtEffect |
| Estilos CRT | `styles/main.css` | Clases CSS para scanlines, curvatura, marco |
| SVG overlay | `assets/effects/` | Máscaras SVG para curvatura y marco |

---

## 3. Resolución y Proporción de Aspecto

### 3.1 Resolución interna

**900×540** — se mantiene la resolución actual como resolución base de dibujo para todos los juegos. Esto asegura que ningún juego requiera modificaciones para adaptarse al nuevo sistema.

### 3.2 Proporciones configurables

| Proporción | Ratio | Dimensiones visibles (base 900 ancho) | Tipo de barras |
|------------|-------|---------------------------------------|----------------|
| **4:3** | 1.33:1 | 900 × 675 | Barras superior e inferior (pillarboxing vertical) |
| **5:3** | 1.66:1 | 900 × 540 | Sin barras (es la proporción actual) |
| **16:9** | 1.78:1 | 960 × 540 | Barras laterales (letterboxing horizontal) |

**Cálculo**: El canvas visible siempre se escala para ocupar el máximo espacio disponible en el viewport, manteniendo la proporción seleccionada. El offscreen canvas interno (900×540) se renderiza dentro de esa área, y las barras rellenan el espacio sobrante.

### 3.3 Almacenamiento en SettingsManager

```js
SettingsManager.aspectRatio;    // '4:3' | '5:3' | '16:9'  (default: '5:3')
SettingsManager.crtEffect;      // true | false  (default: true)
```

### 3.4 Ajuste automático

- `fitCanvas()` en `main.js` se modifica para calcular dimensiones según `aspectRatio`.
- En `handleResize` se recalcula el tamaño del canvas visible y del marco CRT.
- La proporción se aplica tanto al canvas del juego como al hub/menú cuando se muestra dentro del marco CRT.

---

## 4. Efectos CRT

### 4.1 Scanlines

**Técnica**: Overlay CSS con `repeating-linear-gradient` semitransparente.

```css
.crt-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.08) 2px,
    rgba(0, 0, 0, 0.08) 4px
  );
  z-index: 2;
}
```

- Intensidad: 8% de opacidad (sutil, no invasivo)
- Se activa/desactiva desde settings (`SettingsManager.crtEffect`)
- Se respeta `reducedMotion` (se desactivan las animaciones pero las scanlines se mantienen estáticas)

### 4.2 Curvatura (Barrel Distortion)

**Técnica**: SVG overlay con `border-radius` + `clip-path` simulado mediante un SVG de deformación radial leve.

```svg
<!-- Efecto de curvatura sutil en los bordes -->
<svg viewBox="0 0 900 540">
  <defs>
    <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
      <stop offset="60%" stop-color="transparent" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.15)" />
    </radialGradient>
  </defs>
  <rect width="900" height="540" fill="url(#vignette)" />
</svg>
```

- No se distorsiona el canvas real del juego — solo se aplica una viñeta sutil en las esquinas y bordes para simular la curvatura.
- Esto evita el costo de barrel distortion real y mantiene el texto legible.

### 4.3 Marco CRT

**Técnica**: Un `div` contenedor alrededor del canvas con:

- Borde superior e inferior más grueso simulando el chasis del monitor.
- Sombra interior (inset box-shadow) para simular el grosor del tubo.
- Esquinas rectas (no redondeadas, según preferencia del desarrollador).
- Color de chasis: gris oscuro / beige según el tema (oscuro/claro).

### 4.4 Glow en barras (muestreo dinámico)

**Técnica**: Muestrear los píxeles del borde del offscreen canvas cada ~250ms (4 fps) y extender ese color como un gradiente hacia las barras.

1. Cada 250ms se toma una muestra de 1px de ancho en los 4 bordes del offscreen canvas.
2. Se calcula el color promedio de cada borde.
3. Se aplica un gradiente CSS radial/lineal desde el borde del canvas hacia las barras usando esos colores.
4. Transición suave (CSS transition de 0.3s) entre muestras para evitar cambios bruscos.

**Implementación**:

```js
function sampleEdges(offscreenCtx, width, height) {
  // Muestrear borde superior
  const topData = offscreenCtx.getImageData(0, 0, width, 1).data;
  // borde inferior, izquierdo, derecho...
  // Calcular color promedio de cada borde
  return { top, bottom, left, right };
}
```

Esto crea un efecto de "bloom" o "reflejo" del contenido del juego hacia los bordes negros, simulando el comportamiento de un CRT real donde la luz del tubo se extiende ligeramente.

### 4.5 Efecto combinado

El orden de renderizado (de abajo arriba):

```
┌─────────────────────────────────────────┐
│  Chasis CRT (borde exterior)            │
│  ┌───────────────────────────────────┐  │
│  │  Barras con glow dinámico         │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Canvas del juego (900×540) │  │  │
│  │  └─────────────────────────────┘  │  │
│  │  │  Efecto viñeta/curvatura    │  │  │
│  │  │  Scanlines overlay           │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│  Botón fullscreen                       │
└─────────────────────────────────────────┘
```

---

## 5. Modo Fullscreen

### 5.1 Activación

- Un botón con icono "⛶" o "⛶ Pantalla completa" en la esquina inferior derecha del marco CRT.
- Al hacer clic: `document.documentElement.requestFullscreen()`.
- Al salir: `document.exitFullscreen()`.
- El botón cambia de icono según el estado (entrar/salir).

### 5.2 Comportamiento

- Al entrar en fullscreen, el canvas + marco CRT ocupan toda la pantalla.
- El fondo es negro sólido (se pierde el fondo del tema, pero el marco CRT lo sustituye).
- El topbar y menú quedan ocultos.
- Al salir (Escape o botón), se restaura la vista normal con topbar/menú.
- El botón fullscreen solo es visible cuando hay un juego cargado.

### 5.3 Fullscreen en el hub

El modo fullscreen no aplica al hub/menú. Solo cuando se está jugando un juego.

---

## 6. Integración en el Hub

### 6.1 Menú con marco CRT

Cuando `crtEffect = true`, incluso el menú de juegos se muestra dentro del marco CRT:

```html
<main class="stage">
  <div class="crt-frame">
    <div class="crt-frame__chassis">
      <div class="crt-frame__screen">
        <div class="crt-scanlines"></div>
        <div class="crt-vignette"></div>

        <!-- Contenido normal (menú o canvas) -->
        <section id="menu">...</section>
        <div id="game-canvas-wrapper">...</div>

      </div>
    </div>
  </div>
</main>
```

El marco CRT se mantiene fijo alrededor del contenido. Cuando se navega entre menú y juego, el contenido cambia pero el marco permanece.

### 6.2 Settings

Se añaden dos nuevas opciones en el modal de settings:

1. **Proporción de aspecto**: Toggle con 3 opciones (4:3 / 5:3 / 16:9)
   - Clave i18n: `settings.aspectRatio`
   - Persiste en `SettingsManager.aspectRatio`
2. **Efecto CRT**: Toggle on/off
   - Clave i18n: `settings.crtEffect`
   - Persiste en `SettingsManager.crtEffect`
   - Al desactivar: desaparecen scanlines, viñeta/curvatura, marco CRT, glow dinámico
   - La proporción de aspecto se mantiene independientemente del efecto CRT

### 6.3 Botón fullscreen

Se renderiza dentro del marco CRT, en la esquina inferior derecha del chasis.

```html
<button id="fullscreen-btn" class="crt-fullscreen-btn" title="Pantalla completa">
  ⛶
</button>
```

- Solo visible cuando hay un juego cargado.
- Texto/i18n: `fullscreen.enter` / `fullscreen.exit`.
- Estilo: pequeño, semitransparente, aparece al hover sobre el chasis.

---

## 7. Archivos Nuevos y Modificados

### 7.1 Nuevos archivos

| Archivo | Líneas est. | Propósito |
|---------|-------------|-----------|
| `src/engine/AspectRatioManager.js` | ~150 | Gestión de proporción, dimensiones, offscreen canvas, escalado |
| `src/engine/CRTEffects.js` | ~120 | Efectos CRT: scanlines, viñeta, glow dinámico, marco |
| `assets/effects/vignette.svg` | — | SVG para el efecto de curvatura/viñeta |

### 7.2 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/main.js` | Reemplazar `fitCanvas()` con `AspectRatioManager`, añadir botón fullscreen, integrar marco CRT en hub |
| `src/engine/GameEngine.js` | Renderizar a offscreen canvas, delegar en `AspectRatioManager` para escalado |
| `src/engine/GameBase.js` | Opcional: ancho/alto virtual (siempre 900×540) |
| `src/engine/SettingsManager.js` | Añadir `aspectRatio` y `crtEffect` a defaults y persistencia |
| `src/engine/i18n.js` | Añadir claves: `settings.aspectRatio`, `settings.crtEffect`, `fullscreen.enter`, `fullscreen.exit` |
| `styles/main.css` | Añadir estilos para `.crt-frame`, `.crt-scanlines`, `.crt-vignette`, `.crt-fullscreen-btn` |
| `index.html` | Añadir estructura del marco CRT, botón fullscreen |

### 7.3 Archivos NO modificados

Ningún juego individual necesita ser modificado. El cambio es completamente transparente para los juegos ya que dibujan sobre un offscreen canvas de 900×540 y el engine se encarga del escalado y los efectos.

---

## 8. Casos Borde y Consideraciones

### 8.1 Ventanas muy pequeñas (< 600px ancho)

- En móvil/tablet, el marco CRT se simplifica (bordes más finos, scanlines más sutiles o desactivadas).
- El botón fullscreen no es relevante en móvil (no hay fullscreen real del navegador en iOS Safari y en Android Chrome se puede pero es confuso). Se oculta en dispositivos táctiles o se muestra con texto alternativo.
- La proporción de aspecto se mantiene pero el canvas se escala al ancho disponible.

### 8.2 Pantallas ultra-wide (21:9)

- El canvas mantiene la proporción seleccionada. Las barras laterales serán más grandes.
- El glow dinámico se extiende para llenar las barras.
- El marco CRT se ajusta al ancho del canvas visible, no al viewport.

### 8.3 Cambio de proporción en caliente

- Al cambiar la proporción en settings, el canvas se reescala al instante.
- El juego en curso NO se reinicia — solo cambia el viewport.
- `handleResize` se llama con las nuevas dimensiones.

### 8.4 Rotación de pantalla

- En dispositivos móviles, al rotar se dispara resize y el canvas se reajusta automáticamente.
- La proporción se respeta independientemente de la orientación.

### 8.5 Rendimiento del glow dinámico

- El muestreo de bordes se limita a 4-5 fps para no impactar el rendimiento.
- En equipos lentos o si `reducedMotion = true`, el glow se desactiva (usar gradiente estático como fallback).
- El offscreen canvas evita el costo de dibujar dos veces — solo se hace `drawImage` al final.

### 8.6 Compatibilidad con gamepad

- El botón fullscreen debe ser accionable con gamepad (mapear a `GamepadStart` o `GamepadSelect`).
- El marco CRT no interfiere con la navegación del menú con gamepad.

### 8.7 OffscreenCanvas API

- Se usa `OffscreenCanvas` si está disponible (Chrome, Edge), con fallback a un canvas oculto regular en otros navegadores.
- Detección: `typeof OffscreenCanvas !== 'undefined'`.

---

## 9. Plan de Implementación

### 🏗️ Paso 1 — AspectRatioManager

| Subpaso | Descripción | Archivo |
|---------|-------------|---------|
| 1.1 | Crear `AspectRatioManager` con soporte para 4:3, 5:3, 16:9 | `src/engine/AspectRatioManager.js` |
| 1.2 | Implementar `getVisibleDimensions(viewportW, viewportH, ratio)` | Mismo archivo |
| 1.3 | Implementar `getBars(destW, destH, internalW, internalH)` | Mismo archivo |
| 1.4 | Gestionar offscreen canvas (creación, redimension, limpieza) | Mismo archivo |

### 🏗️ Paso 2 — CRTEffects

| Subpaso | Descripción | Archivo |
|---------|-------------|---------|
| 2.1 | Crear `CRTEffects` con scanlines, viñeta, glow dinámico | `src/engine/CRTEffects.js` |
| 2.2 | Implementar `sampleEdges()` para glow dinámico | Mismo archivo |
| 2.3 | Implementar `renderGlow(ctx, sampledColors, bars)` | Mismo archivo |
| 2.4 | Crear SVG de viñeta | `assets/effects/vignette.svg` |

### 🏗️ Paso 3 — GameEngine: escalado

| Subpaso | Descripción | Archivo |
|---------|-------------|---------|
| 3.1 | Modificar `GameEngine._loop()` para renderizar a offscreen canvas | `src/engine/GameEngine.js` |
| 3.2 | Aplicar `AspectRatioManager` para escalado final | Mismo archivo |
| 3.3 | Llamar `CRTEffects.renderGlow()` después del drawImage | Mismo archivo |

### 🏗️ Paso 4 — main.js: hub con marco CRT

| Subpaso | Descripción | Archivo |
|---------|-------------|---------|
| 4.1 | Añadir estructura HTML del marco CRT | `index.html` |
| 4.2 | Modificar `fitCanvas()` para usar `AspectRatioManager` | `src/main.js` |
| 4.3 | Añadir botón fullscreen con lógica | `src/main.js` |
| 4.4 | Aplicar marco CRT también al menú | `src/main.js` |

### 🏗️ Paso 5 — Settings

| Subpaso | Descripción | Archivo |
|---------|-------------|---------|
| 5.1 | Añadir defaults `aspectRatio: '5:3'` y `crtEffect: true` | `src/engine/SettingsManager.js` |
| 5.2 | Añadir sección de proporción y efecto CRT en settings modal | `index.html` |
| 5.3 | Conectar toggles en `main.js` | `src/main.js` |

### 🏗️ Paso 6 — i18n + CSS

| Subpaso | Descripción | Archivo |
|---------|-------------|---------|
| 6.1 | Añadir claves i18n | `src/engine/i18n.js` |
| 6.2 | Añadir estilos CRT en CSS | `styles/main.css` |
| 6.3 | Responsive: ocultar botón fullscreen en táctil | `styles/main.css` |

### 🏗️ Paso 7 — Pruebas

| Subpaso | Descripción |
|---------|-------------|
| 7.1 | Smoke test: verificar que canvas se inicializa correctamente con diferentes proporciones |
| 7.2 | Verificar que todos los juegos se renderizan correctamente (sin distorsión) |
| 7.3 | Verificar que el cambio de proporción en caliente funciona |
| 7.4 | Verificar que el toggle CRT on/off funciona sin errores |
| 7.5 | Verificar fullscreen (manual, requiere interacción del usuario) |

---

## 10. Criterios de Aceptación

- [ ] Las 3 proporciones (4:3, 5:3, 16:9) funcionan correctamente.
- [ ] El cambio de proporción en caliente no rompe el juego actual.
- [ ] El efecto CRT se puede activar/desactivar desde settings.
- [ ] El efecto CRT persiste en localStorage (se recuerda al recargar).
- [ ] Las scanlines se muestran sutiles (8% opacidad) sin interferir con la legibilidad.
- [ ] El glow dinámico se actualiza suavemente sin tirones.
- [ ] El botón fullscreen funciona y se ocupa en móvil/táctil.
- [ ] El marco CRT rodea tanto el menú como el juego.
- [ ] Con `reducedMotion = true`, el glow dinámico usa fallback estático.
- [ ] Todos los 25 juegos existentes se renderizan correctamente sin distorsión.
- [ ] Smoke test pasa (smoke_test.mjs).

---

## 11. Estimación

| Componente | Líneas estimadas |
|-----------|------------------|
| `AspectRatioManager.js` | ~150 |
| `CRTEffects.js` | ~120 |
| Modificaciones a `GameEngine.js` | ~30 |
| Modificaciones a `main.js` | ~80 |
| Modificaciones a `index.html` | ~40 |
| Modificaciones a `SettingsManager.js` | ~20 |
| Modificaciones a `i18n.js` | ~10 |
| Estilos CSS nuevos | ~120 |
| SVG viñeta | ~15 |
| **Total estimado** | **~585** |
