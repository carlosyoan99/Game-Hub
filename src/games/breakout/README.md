# Breakout

**Arcade Clásico**

Breakout con sistema de **5 niveles** de dificultad progresiva. Rompe todos los ladrillos de cada nivel usando una paleta y una bola que rebota. Cada nivel aumenta el número de ladrillos, la velocidad de la bola y añade ladrillos duros (2 golpes).

## Gameplay

El jugador controla una paleta en la parte inferior de la pantalla. La bola rebota contra los bordes, la paleta y los ladrillos. El objetivo es romper **todos los ladrillos** de cada nivel sin dejar caer la bola. Cada 3 vidas perdidas es Game Over.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Completar los 5 niveles rompiendo todos los ladrillos |
| **Victoria** | Completar el nivel 5 |
| **Derrota** | Perder las 3 vidas (la bola cae al fondo) |
| **Puntuación** | Ladrillo normal: 10 pts. Ladrillo duro: 20 pts. |

## Controles

| Tecla | Acción |
|-------|--------|
| ← → / A D | Mover la paleta |
| Ratón | Mover la paleta (seguimiento) |
| Click / Espacio | Avanzar al siguiente nivel / Reiniciar |

**🎮 Gamepad**: Stick izq. L/R + D-pad L/R → mover paleta · A → saque / avanzar

## Constantes de balance

| Nivel | Filas | Columnas | Velocidad bola | Dificultad |
|-------|-------|----------|---------------|------------|
| 1 | 5 | 8 | 220 px/s | Fácil |
| 2 | 6 | 9 | 240 px/s | Medio |
| 3 | 7 | 10 | 260 px/s | Difícil |
| 4 | 8 | 10 | 280 px/s | Experto |
| 5 | 8 | 12 | 310 px/s | Imposible |

- **Ladrillos duros**: aparecen en fila 0 desde nivel 3 en adelante (requieren 2 golpes)
- **Vidas iniciales**: 3
- **Paleta**: 90×14 px
- **Bola**: radio 7 px, ángulo de rebote ±60° según punto de impacto en la paleta

## Estructura del código

- **`Breakout.js`**: Clase principal con init, update, render, destroy
  - `_getLevelConfig()` → devuelve configuración del nivel actual
  - `_resetPaddleAndBall()` → reposiciona paleta y bola
  - `_buildBricks()` → genera ladrillos según nivel actual
  - `_nextLevel()` / `_endGame()` / `_restart()` → gestión de estado
- **`i18n.js`**: Traducciones específicas del juego (breakout.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD) + ratón |
| `StorageManager` | Persistencia de highscore y nivel guardado |
| `CollisionUtils` | `circleIntersectsAABB()` para bola vs paleta/ladrillos, `clamp()` |
| `AudioManager` | SFX de rebote, rotura, pérdida de vida, nivel completado |
| `HapticManager` | Vibración táctil en impacto y eventos |
| `i18n` | Textos traducidos (nivel, puntuación, vidas) |
| `SeededRandom` | Semilla para ángulo aleatorio de saque |
