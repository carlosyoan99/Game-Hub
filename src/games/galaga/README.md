# Galaga

**Arcade Clásico**

El clásico juego de disparos con formaciones de enemigos. Los aliens vuelan en formación y atacan en picada. ¡Consigue la nave gemela disparando al enemigo que te haya capturado! Oleadas infinitas con transición automática a los 5 segundos si no se hace click.

## Gameplay

Los enemigos están organizados en una formación de 5x8. Periódicamente, algunos se separan y atacan en picada, disparando hacia abajo. Algunos tienen un tractor beam que puede capturar tu nave. Si destruyes al enemigo que te capturó, obtienes una nave gemela que duplica tu poder de fuego.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Sobrevivir el mayor número de oleadas posible |
| **Derrota** | Perder todas las vidas (3) |
| **Puntuación** | Abeja: 50pts; Escorpión: 80pts; Galaga: 150pts; Jefe: 300pts |

## Controles

| Tecla | Acción |
|-------|--------|
| ← → / A D | Mover nave |
| Espacio / Click | Disparar |
| Click / Espacio | Reiniciar tras Game Over |

**🎮 Gamepad**: Stick izq. L/R → mover nave · A → disparar

## Mecánicas

- **Formación oscilante**: los enemigos se mueven suavemente en formación
- **Picadas**: enemigos que atacan en patrones de vuelo
- **Tractor beam**: captura tu nave para luego obtener la gemela al liberarla
- **Nave gemela**: disparo doble/doble al tener la nave gemela
- **Oleadas infinitas**: progresión continua mientras tengas vidas
- **Transición automática**: 5 segundos entre oleadas si no se hace click
- **3 vidas**: respawn tras 1.5 segundos

## Estructura del código

- **`Galaga.js`**: Clase principal
  - `_startWave()` → configura enemigos en formación
  - `_updateFormation()` → movimiento oscilante de la formación
  - `_updateDivers()` → enemigos en picada
  - `_startDive()` → selecciona enemigos para atacar
  - `_checkCollisions()` → balas, tractor beam, muertes
  - `_nextWave()` → transición con timer automático

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD/Espacio) + ratón |
| `StorageManager` | Persistencia de highscore |
| `AudioManager` | SFX de disparo, impacto, explosión, powerup |
| `HapticManager` | Vibración en impactos |
| `ParticleSystem` | Efectos de partículas |
| `i18n` | Textos traducidos |
