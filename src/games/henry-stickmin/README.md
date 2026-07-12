# Henry Stickmin

**Nivel 5 — RPG y Acción Compleja**

Novela visual/árbol de decisiones inspirado en la saga de PuffballsUnited. Cada escena presenta una situación con 2-3 opciones. Según la elección, la historia avanza a una nueva escena o termina en un final (éxito o fracaso cómico). Animaciones secuenciales con efecto máquina de escribir.

## Gameplay

Henry Stickmin planea robar el "Zafiro Eterno" del museo municipal. Tú eliges cómo: sigilo, fuerza bruta o disfraz. Cada decisión abre nuevas ramas, llevando a diferentes rutas y finales. Hay **17 escenas** en total, con múltiples finales exitosos y cómicos.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Descubrir todos los finales posibles |
| **Victoria** | Llegar a un final exitoso (5 posibles) |
| **Derrota** | Llegar a un final cómico de fracaso (7 posibles) |
| **Progreso** | Finales descubiertos se guardan en localStorage |

## Controles

| Entrada | Acción |
|---------|--------|
| Click / Espacio | Avanzar texto (skip typewriter) |
| Click en opción | Elegir camino |
| Click / Espacio | Continuar tras final |
| Click / Espacio | Reiniciar desde pantalla final |

## Árbol de decisiones

```
intro
├── sneak (sigilo)
│   ├── sneak_left → vault → success_dance ✅ / fail_sensor ❌
│   │   └── fail_explosion ❌
│   ├── sneak_right → vault_coffee → success_coffee ✅ / fail_buttons ❌
│   │   └── fail_guard_fight ❌
│   └── sneak_vent → vault_office → vault (loop) / success_plans ✅
├── force (fuerza)
│   └── vault_wall → success_wall ✅ / fail_curtain ❌
│       └── fail_alarm ❌
└── disguise (disfraz)
    ├── vault_bluff → success_bluff ✅ / fail_radio ❌
    ├── fail_chase ❌
    └── disguise_clumsy → vault_bluff / fail_chase ❌
```

### Finales

| Final | Tipo | Ruta |
|-------|------|------|
| 💃 Baile de la victoria | ✅ Éxito | sneak → sneak_left → vault |
| ☕ Café letal | ✅ Éxito | sneak → sneak_right → vault_coffee |
| 🚐 Huida épica | ✅ Éxito | force → vault_wall |
| 🎭 Mejor actor | ✅ Éxito | disguise → vault_bluff |
| 📸 Plan perfecto | ✅ Éxito | sneak → sneak_vent → vault_office |
| 💥 Kaboom | ❌ Fracaso | sneak → sneak_left |
| 😵 Pelea desigual | ❌ Fracaso | sneak → sneak_right |
| 🚨¡Alarma! | ❌ Fracaso | force |
| 🏃 Persecución | ❌ Fracaso | disguise / disguise_clumsy |
| 🔒 Alarma sísmica | ❌ Fracaso | sneak → sneak_left → vault |
| 🎮 Demasiados botones | ❌ Fracaso | sneak → sneak_right → vault_coffee |
| 🎪 Cortina traicionera | ❌ Fracaso | force → vault_wall |
| 📻 Radio accidente | ❌ Fracaso | disguise → vault_bluff |

## Estructura del código

- **`HenryStickmin.js`**: Clase principal (~905 líneas)
  - `SCENES{}`: 17 escenas con título, texto narrativo, emoji, pose y opciones
  - `_loadScene()` → carga escena y detecta si es final
  - `_layoutButtons()` → posiciona botones de opciones
  - `_renderStickman()` → dibuja a Henry en 15 poses diferentes (thinking, dancing, flying, KO, etc.)
  - `_renderText()` → efecto máquina de escribir carácter por carácter
  - `_drawWrappedText()` → texto multilínea con word-wrap
- **`i18n.js`**: Traducciones específicas (henry.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Ratón + teclado (Espacio) |
| `StorageManager` | Persistencia de finales descubiertos y bestEndings |
| `CollisionUtils` | `pointInRect()` para detección de clicks en opciones |
| `AudioManager` | SFX de selección, powerup (éxito), hit (fracaso) |
| `HapticManager` | Vibración en selecciones y finales |
| `i18n` | Textos traducidos |
