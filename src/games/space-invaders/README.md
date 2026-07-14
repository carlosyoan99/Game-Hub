# Space Invaders

**Arcade Clásico**

El clásico juego de disparos verticales. Controlas una nave que se mueve lateralmente en la parte inferior de la pantalla y debes eliminar oleadas de aliens que descienden progresivamente.

## Gameplay

Los aliens se mueven en formación de izquierda a derecha, descendiendo una fila cada vez que alcanzan un borde. A medida que eliminas aliens, los que quedan se mueven más rápido. Los aliens de las filas inferiores disparan hacia abajo. Una nave misteriosa aparece ocasionalmente en la parte superior y otorga puntuación bonus al ser destruida.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Sobrevivir el mayor número de oleadas posible |
| **Derrota** | Perder todas las vidas (3) |
| **Puntuación** | Fila superior: 30pts; filas medias: 20pts; fila inferior: 10pts; nave misteriosa: 50-300pts |

## Controles

| Tecla | Acción |
|-------|--------|
| ← → / A D | Mover nave |
| Espacio / Click | Disparar |
| Click / Espacio | Reiniciar tras Game Over |

## Mecánicas

- **Oleadas progresivas**: cada oleada aumenta la velocidad de los aliens y añade más aliens que disparan
- **Escudos**: 4 escudos destructibles en la parte inferior que protegen al jugador
- **Nave misteriosa**: aparece aleatoriamente en la parte superior, otorga puntuación variable
- **3 vidas**: al perder una vida, la nave reaparece tras 1.5 segundos

## Estructura del código

- **`SpaceInvaders.js`**: Clase principal con toda la lógica
  - `_spawnWave()` → genera aliens en formación de 5×11
  - `_updateAliens()` → movimiento lateral, descenso, disparos
  - `_checkCollisions()` → balas vs aliens, escudos, jugador
  - `_updateMysteryShip()` → aparición y movimiento de nave misteriosa
  - `_initShields()` → genera escudos con bloque hueco en el centro
- **`i18n.js`**: Traducciones específicas (space.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD/Espacio) + ratón |
| `StorageManager` | Persistencia de highscore |
| `CollisionUtils` | `rectIntersects()` para colisiones |
| `AudioManager` | SFX de disparo, impacto, explosión, powerup |
| `HapticManager` | Vibración en impactos |
| `ParticleSystem` | `burst()` para explosiones de aliens y nave |
| `i18n` | Textos traducidos |
