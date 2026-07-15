# Centipede

**Arcade Clásico**

El clásico juego de arcade donde un ciempiés serpentea por la pantalla atravesando hongos. El jugador debe disparar al ciempiés mientras esquiva arañas y otros peligros. Oleadas infinitas con transición automática a los 5 segundos si no se hace click.

## Gameplay

El ciempiés se mueve horizontalmente por la pantalla. Cuando encuentra un hongo o llega al borde, desciende una fila y cambia de dirección. Disparar un segmento del ciempiés crea un hongo en esa posición. Las arañas rebotan por la parte superior de la pantalla y pueden destruir hongos. Cada oleada trae más segmentos y mayor velocidad.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Sobrevivir el mayor número de oleadas posible |
| **Derrota** | Perder todas las vidas (3) |
| **Puntuación** | Segmento: 10pts; Hongo: 5pts; Araña: 50pts |

## Controles

| Tecla | Acción |
|-------|--------|
| ← → / A D | Mover nave |
| Espacio / Click | Disparar |
| Click / Espacio | Reiniciar tras Game Over |

**🎮 Gamepad**: Stick izq. → mover nave · A → disparar

## Mecánicas

- **Ciempiés segmentado**: 12+ segmentos que siguen a la cabeza
- **Hongos**: aparecen aleatoriamente y al destruir segmentos; tienen 3 HP
- **Arañas**: aparecen periódicamente y destruyen hongos; tienen 2+ HP
- **Oleadas infinitas**: progresión continua mientras tengas vidas
- **Transición automática**: 5 segundos entre oleadas si no se hace click
- **3 vidas**: al perder una vida, la nave reaparece tras 1.5 segundos

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD/Espacio) + ratón |
| `StorageManager` | Persistencia de highscore |
| `CollisionUtils` | Colisiones AABB |
| `AudioManager` | SFX de disparo, impacto, explosión |
| `HapticManager` | Vibración en impactos |
| `ParticleSystem` | Efectos de partículas |
| `i18n` | Textos traducidos |
