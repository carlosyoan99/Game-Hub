# Snake

**Arcade Clásico**

Snake en modo **endless** con dificultad progresiva. Controla una serpiente que crece al comer comida mientras esquivas obstáculos. La velocidad aumenta gradualmente y aparecen más obstáculos a medida que avanzas. ¿Qué puntuación máxima puedes alcanzar?

## Gameplay

La serpiente se mueve continuamente por una cuadrícula. Debes dirigirla hacia la comida (círculo naranja) evitando chocar con las paredes, tu propio cuerpo y los obstáculos. Cada comida suma 10 puntos. El juego se vuelve más rápido y aparecen más obstáculos con cada 10 comidas.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Máxima puntuación posible |
| **Derrota** | Chocar contra pared, cuerpo u obstáculo |
| **Puntuación** | 10 pts por comida. Récord total. |
| **Dificultad** | Velocidad + obstáculos aumentan cada 10 comidas |

## Controles

| Tecla | Acción |
|-------|--------|
| ↑↓←→ / WASD | Cambiar dirección |
| Click / Espacio | Reiniciar |

**🎮 Gamepad**: D-pad + Stick izq. → cambio de dirección

## Constantes de balance

| Tramo | Intervalo movimiento | Obstáculos | Dificultad |
|-------|---------------------|------------|------------|
| 0-9 comidas | 0.11s (9 fps) | 0 | Fácil |
| 10-19 | 0.10s (10 fps) | 4 | Medio |
| 20-29 | 0.09s (11 fps) | 6 | Difícil |
| 30-39 | 0.08s (12.5 fps) | 8 | Experto |
| 40+ | 0.07s (14 fps) | 12 | Imposible |

- **Cuadrícula**: 28 columnas, filas proporcionales al aspect ratio
- **Puntuación**: 10 pts por comida
- **Récord**: mejor puntuación total persistida en localStorage

## Estructura del código

- **`Snake.js`**: Clase principal
  - `_getLevelConfig()` → configuración según comidas acumuladas
  - `_step()` → lógica de movimiento por turnos (grid-based)
  - `_handleDirectionInput()` → cola de dirección pendiente
  - `_spawnFood()` / `_buildObstacles()` → generación procedural
  - `_endGame()` / `_restart()` → gestión de estado
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
