# Missile Command

**Nivel 1 — Defensa / Arcade**

Defiende 6 ciudades de misiles entrantes lanzando interceptores antimisiles. Apunta con el ratón y haz clic para lanzar.

## Gameplay

Los misiles enemigos caen desde la parte superior de la pantalla hacia las ciudades. Debes lanzar interceptores desde tus bases para destruirlos en el aire. Los interceptores explotan al llegar a su destino, creando una onda expansiva que destruye misiles cercanos. Cada oleada trae más misiles y mayor velocidad.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Defender las ciudades el mayor número de oleadas posible |
| **Derrota** | Todas las ciudades destruidas |
| **Puntuación** | Misil interceptado: 25pts |

## Controles

| Acción | Descripción |
|--------|-------------|
| Mover ratón | Apuntar (crosshair) |
| Click izquierdo | Lanzar interceptor al destino |
| Click / Espacio | Reiniciar tras Game Over |

## Mecánicas

- **6 ciudades:** Cada una tiene 1 HP — una vez destruida, se pierde para siempre
- **3 bases:** Cada base tiene munición limitada que se recarga entre oleadas
- **Oleadas progresivas:** 6+ misiles por oleada, más rápidos cuanto más avanzas
- **Explosiones:** Los interceptores explotan con radio 48px, destruyendo misiles cercanos
- **Sin vidas:** El juego termina cuando todas las ciudades son destruidas

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Ratón (posición y clic) |
| `StorageManager` | Persistencia de highscore |
| `CollisionUtils` | `clamp()` |
| `AudioManager` | SFX de disparo, explosión, powerup |
| `HapticManager` | Vibración en explosiones |
| `ParticleSystem` | Efectos de explosiones |
| `i18n` | Textos traducidos |
