# Snake

**Nivel 1 — Arcade Clásico**

Snake con sistema de **5 niveles** de dificultad progresiva. Controla una serpiente que crece al comer comida. Aparecen obstáculos en niveles superiores. Debes alcanzar 30 puntos de comida por nivel para avanzar.

## Gameplay

La serpiente se mueve continuamente por una cuadrícula. Debes dirigirla hacia la comida (círculo naranja) evitando chocar con las paredes, tu propio cuerpo y los obstáculos. Cada comida suma 1 punto de nivel y 10 puntos totales.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Completar los 5 niveles |
| **Victoria** | Completar el nivel 5 (30 comidas en nivel 5) |
| **Derrota** | Chocar contra pared, cuerpo u obstáculo |
| **Puntuación** | 10 pts por comida. Se guarda el récord total. |

## Controles

| Tecla | Acción |
|-------|--------|
| ↑↓←→ / WASD | Cambiar dirección |
| Click / Espacio | Avanzar al siguiente nivel / Reiniciar |

## Constantes de balance

| Nivel | Intervalo movimiento | Obstáculos | Dificultad |
|-------|---------------------|------------|------------|
| 1 | 0.11s (9 fps) | 0 | Fácil |
| 2 | 0.10s (10 fps) | 4 | Medio |
| 3 | 0.09s (11 fps) | 6 | Difícil |
| 4 | 0.08s (12.5 fps) | 8 | Experto |
| 5 | 0.07s (14 fps) | 12 | Imposible |

- **Comida necesaria por nivel**: 30 (constante `SCORE_TO_ADVANCE`)
- **Cuadrícula**: 28 columnas, filas proporcionales al aspect ratio
- **Puntuación total**: se acumula entre niveles (10 pts por comida)
- **Récord**: mejor puntuación total persistida en localStorage

## Estructura del código

- **`Snake.js`**: Clase principal
  - `_getLevelConfig()` → configuración del nivel actual
  - `_step()` → lógica de movimiento por turnos (grid-based)
  - `_handleDirectionInput()` → cola de dirección pendiente
  - `_spawnFood()` / `_buildObstacles()` → generación procedural
  - `_nextLevel()` / `_endGame()` / `_restart()` → gestión de estado
- **`i18n.js`**: Traducciones específicas (snake.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD) |
| `StorageManager` | Persistencia de highscore |
| `AudioManager` | SFX de comida, powerup, explosión |
| `HapticManager` | Vibración en eventos |
| `i18n` | Textos traducidos |
| `SeededRandom` | Semilla para posición de comida y obstáculos |
