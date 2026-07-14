# Flappy Bird

**Arcade Clásico**

Flappy Bird en modo **endless** con dificultad progresiva. Controla un pájaro que debe atravesar tuberías sin chocar. La velocidad aumenta gradualmente y los huecos se reducen a medida que avanzas. ¿Cuántas tuberías puedes superar?

## Gameplay

El pájaro cae constantemente por gravedad. Cada click/espacio le da un impulso hacia arriba. Debes pasar por los huecos de las tuberías para sumar puntos. La velocidad de scroll y la dificultad aumentan con cada 5 tuberías superadas.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Máxima puntuación posible |
| **Derrota** | Chocar contra tubería, techo o suelo |
| **Puntuación** | 10 pts por tubería superada. Récord total. |

## Controles

| Tecla | Acción |
|-------|--------|
| Espacio / Click / ↑ | Aleteo (impulso hacia arriba) |
| Click / Espacio | Reiniciar |

## Constantes de balance

| Tramo | Velocidad tuberías | Ratio hueco | Intervalo spawn |
|-------|-------------------|-------------|-----------------|
| 0-4 tuberías | 180 px/s | 1.00 | 1.4s |
| 5-9 | 200 px/s | 0.93 | 1.3s |
| 10-14 | 220 px/s | 0.86 | 1.2s |
| 15-19 | 245 px/s | 0.79 | 1.1s |
| 20+ | 270 px/s | 0.72 | 1.0s |

- **Gravedad**: 900 px/s²
- **Impulso aleteo**: -320 px/s (hacia arriba)
- **Hueco base**: min(150, max(70, altura×0.4))
- **Tubería**: 60 px de ancho
- **Pájaro**: radio 12 px, posición X fija al 30% del ancho
- **Margen tubería**: min(60, altura×0.15)
- **Inclinación**: el pájaro rota según su velocidad vertical (máx ±45°)

## Estructura del código

- **`FlappyBird.js`**: Clase principal
  - `_getLevelConfig()` → configuración según puntuación acumulada
  - `_updatePipes()` → spawn, movimiento y colisión de tuberías
  - `_spawnPipe()` → generación con hueco aleatorio
  - `_checkCollisions()` → bird vs tuberías, techo, suelo
  - `_endGame()` / `_restart()` → gestión de estado
- **`i18n.js`**: Traducciones específicas (flappy.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (Espacio/↑) + ratón |
| `StorageManager` | Persistencia de highscore |
| `CollisionUtils` | `circleIntersectsAABB()` para colisiones pájaro vs tuberías |
| `AudioManager` | SFX de aleteo, comida, powerup, explosión |
| `HapticManager` | Vibración en eventos |
| `i18n` | Textos traducidos |
| `SeededRandom` | Semilla para posición de huecos |
