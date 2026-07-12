# Pong

**Nivel 1 — Arcade Clásico**

Pong con sistema de **5 niveles** de dificultad progresiva. Enfréntate a una IA que mejora con cada nivel: más rápida, más precisa y con predicción de rebotes. Necesitas ganar por puntos en cada nivel para avanzar.

## Gameplay

Dos paletas (jugador a la izquierda, IA a la derecha) y una bola que rebota. El primero en alcanzar la puntuación objetivo gana el nivel. La IA mejora su velocidad, precisión y capacidad de predicción en cada nivel.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Completar los 5 niveles ganando cada uno por puntos |
| **Victoria** | Ganar el nivel 5 |
| **Derrota** | La IA alcanza la puntuación objetivo antes que tú |
| **Récord** | Mejor nivel alcanzado (bestStreak) |

## Controles

| Tecla | Acción |
|-------|--------|
| ↑↓ / W S | Mover paleta |
| Ratón | Mover paleta (seguimiento vertical) |
| Click / Espacio | Avanzar / Reiniciar |

## Constantes de balance

| Nivel | Velocidad IA | Velocidad bola | Puntos para ganar | Dificultad |
|-------|-------------|---------------|-------------------|------------|
| 1 | 260 px/s | 320 px/s | 5 | Fácil |
| 2 | 300 px/s | 340 px/s | 5 | Medio |
| 3 | 340 px/s | 360 px/s | 6 | Difícil |
| 4 | 380 px/s | 380 px/s | 6 | Experto |
| 5 | 430 px/s | 410 px/s | 7 | Imposible |

- **Paleta**: 12×80 px, margen 24 px del borde
- **Bola**: radio 7 px, velocidad aumenta 2% por rebote
- **IA**: desde nivel 3 predice rebotes con simulación de hasta 60 frames
- **Ángulo de rebote**: ±60° según punto de impacto en la paleta

## Estructura del código

- **`Pong.js`**: Clase principal
  - `_getLevelConfig()` → configuración del nivel actual
  - `_movePlayer()` / `_moveAI()` → movimiento de paletas
  - `_moveBall()` → física de la bola con rebotes
  - `_predictAim()` → IA predictiva (simula trayectoria)
  - `_serve()` / `_afterPoint()` → gestión de puntos
  - `_nextLevel()` / `_restart()` → gestión de estado
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
