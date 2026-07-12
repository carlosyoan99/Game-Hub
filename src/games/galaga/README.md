# Galaga

**Nivel 1 — Disparos / Formaciones**

El clásico juego de disparos con formaciones de enemigos. Los aliens vuelan en formación y atacan en picada. ¡Consigue la nave gemela disparando al enemigo que te haya capturado!

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

## Mecánicas

- **Formación oscilante:** Los enemigos se mueven suavemente en formación
- **Picadas:** Enemigos que atacan en patrones de vuelo
- **Tractor beam:** Captura tu nave para luego obtener la gemela al liberarla
- **Nave gemela:** Triple disparo al tener la nave gemela
- **Oleadas progresivas:** Más enemigos y más picadas por oleada
- **3 vidas:** Respawn tras 1.5 segundos

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD/Espacio) + ratón |
| `StorageManager` | Persistencia de highscore |
| `AudioManager` | SFX de disparo, impacto, explosión, powerup |
| `HapticManager` | Vibración en impactos |
| `ParticleSystem` | Efectos de partículas |
| `i18n` | Textos traducidos |
