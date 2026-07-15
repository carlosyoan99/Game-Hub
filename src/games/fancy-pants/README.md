# Fancy Pants

**Plataformas**

Fancy Pants con **5 niveles** de dificultad progresiva. Similar al Platformer base pero con físicas más avanzadas: aceleración/fricción en el movimiento horizontal, deslizamiento por paredes y saltos de pared. La gravedad se reduce cerca del ápice del salto (hang time).

## Gameplay

Corre y salta a través de niveles con mecánicas más avanzadas. Puedes deslizarte por las paredes y saltar desde ellas. La aceleración gradual y el hang time en el ápice del salto dan una sensación más fluida y controlada.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Completar los 5 niveles |
| **Victoria** | Alcanzar la meta del nivel 5 |
| **Derrota** | Perder las 3 vidas |
| **Récord** | Mejor tiempo por run |

## Controles

| Tecla | Acción |
|-------|--------|
| ← → / A D | Movimiento lateral (aceleración progresiva) |
| Espacio / ↑ / W | Saltar (normal o desde pared) |
| Click / Espacio | Avanzar / Reiniciar |

**🎮 Gamepad**: Stick izq. L/R → mover · A → saltar (normal o desde pared) · wall-jump incluido

## Constantes de balance

| Parámetro | Valor |
|-----------|-------|
| Gravedad | 1500 px/s² |
| Aceleración | 1400 px/s² |
| Velocidad máx | 260 px/s |
| Fricción suelo | 1600 px/s² |
| Velocidad salto | -540 px/s |
| Corte de salto | 50% al soltar |
| Coyote time | 0.1s |
| Deslizamiento pared | 110 px/s (caída limitada) |
| Salto de pared | VX: 260 px/s, VY: -500 px/s |
| Lock tras salto pared | 0.15s |
| Umbral ápice | 90 px/s (por debajo: gravedad 50%) |
| Tamaño tile | 32×32 px |

## Estructura del código

- **`FancyPants.js`**: Clase principal
  - `_updatePlayer()` → física con aceleración, fricción, deslizamiento y salto de pared
  - `_columnHasSolid()` → detección de pared para wall-slide
  - `_loseLife()` / `_win()` → gestión de estado
- **`i18n.js`**: Traducciones específicas (fancy-pants.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD/Espacio) |
| `StorageManager` | Persistencia de mejor tiempo y nivel guardado |
| `Tilemap` | `parseAscii()`, `resolveAABB()`, `render()` |
| `Camera` | `follow()` con scroll, `resize()` |
| `CollisionUtils` | `aabbIntersects()` para meta, `clamp()` |
| `AudioManager` | SFX de salto, daño, powerup |
| `HapticManager` | Vibración en salto de pared y eventos |
