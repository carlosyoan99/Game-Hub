# Frogger

**Arcade Clásico**

Ayuda a la rana a cruzar la carretera y el río para llegar a casa. Esquiva coches, camiones, y nada sobre troncos y tortugas para no ahogarte. Oleadas infinitas con transición automática a los 5 segundos si no se hace click.

## Gameplay

La rana se mueve en cuadrícula por la pantalla. Debes cruzar 5 carriles de carretera esquivando coches y camiones, luego 4 carriles de río montándote en troncos y tortugas que se mueven. Llega a los 5 slots de meta para completar el nivel. ¡Cuidado con las tortugas que se sumergen!

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Llenar los 5 slots de meta en cada nivel |
| **Derrota** | Perder todas las vidas (3) o que el tiempo se acabe |
| **Puntuación** | Llegar a casa: 10pts + tiempo restante |

## Controles

| Tecla | Acción |
|-------|--------|
| ↑ / W | Saltar arriba |
| ↓ / S | Saltar abajo |
| ← / A | Saltar izquierda |
| → / D | Saltar derecha |
| Click / Espacio | Reiniciar tras Game Over |

## Mecánicas

- **Movimiento en cuadrícula**: 30px por salto, con cooldown
- **5 carriles de coches**: diferentes velocidades y direcciones
- **4 carriles de río**: troncos y tortugas flotantes
- **Tortugas que se sumergen**: aparecen y desaparecen periódicamente
- **Límite de tiempo**: 30 segundos por rana
- **5 slots de meta**: llena todos para avanzar al siguiente nivel
- **3 vidas**: pierde una vida al ser atropellado, ahogado, o por tiempo
- **Oleadas infinitas**: transición automática tras 5 segundos

## Estructura del código

- **`Frogger.js`**: Clase principal

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD) |
| `StorageManager` | Persistencia de highscore |
| `CollisionUtils` | `aabbIntersects` para colisiones |
| `AudioManager` | SFX de salto, moneda, powerup |
| `HapticManager` | Vibración en muerte |
| `ParticleSystem` | Efectos al llegar a casa |
| `i18n` | Textos traducidos |
