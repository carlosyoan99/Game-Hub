# Pong

**Arcade Clásico**

Pong con selector de **dificultad** (Fácil, Normal, Difícil) al iniciar la partida. Enfréntate a una IA que mejora con cada dificultad: más rápida, más precisa y con predicción de rebotes. La victoria se alcanza a los 5 puntos.

## Gameplay

Dos paletas (jugador a la izquierda, IA a la derecha) y una bola que rebota. El primero en alcanzar 5 puntos gana la partida. La IA mejora su velocidad, precisión y capacidad de predicción según la dificultad seleccionada.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Ganar la partida alcanzando 5 puntos |
| **Victoria** | Alcanzar 5 puntos antes que la IA |
| **Derrota** | La IA alcanza 5 puntos primero |
| **Récord** | Mejor racha de victorias (bestStreak) |

## Controles

| Tecla | Acción |
|-------|--------|
| ↑↓ / W S | Mover paleta |
| Ratón | Mover paleta (seguimiento vertical) |
| Click / Espacio | Seleccionar dificultad / Reiniciar |

## Selector de dificultad

Al iniciar la partida, se presenta un selector con 3 niveles:

| Dificultad | Velocidad IA | Velocidad bola | Predicción | Puntos para ganar |
|------------|-------------|---------------|------------|-------------------|
| Fácil | 260 px/s | 320 px/s | No | 5 |
| Normal | 340 px/s | 360 px/s | Sí (30 frames) | 5 |
| Difícil | 430 px/s | 410 px/s | Sí (60 frames) | 5 |

- **Paleta**: 12×80 px, margen 24 px del borde
- **Bola**: radio 7 px, velocidad aumenta 2% por rebote
- **IA Difícil**: predice rebotes simulando trayectoria hasta 60 frames
- **Ángulo de rebote**: ±60° según punto de impacto en la paleta

## Estructura del código

- **`Pong.js`**: Clase principal
  - `_showDifficultySelector()` → pantalla de selección de dificultad
  - `_movePlayer()` / `_moveAI()` → movimiento de paletas
  - `_moveBall()` → física de la bola con rebotes
  - `_predictAim()` → IA predictiva (simula trayectoria)
  - `_serve()` / `_afterPoint()` → gestión de puntos
  - `_restart()` → gestión de estado
- **`i18n.js`**: Traducciones específicas (pong.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD) + ratón |
| `StorageManager` | Persistencia de bestStreak |
| `CollisionUtils` | `circleIntersectsAABB()` para bola vs paletas, `clamp()` |
| `AudioManager` | SFX de rebote, punto, powerup |
| `HapticManager` | Vibración en eventos |
| `i18n` | Textos traducidos |
| `SeededRandom` | Semilla para ángulo de saque |
