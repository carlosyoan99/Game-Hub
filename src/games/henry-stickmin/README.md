# Henry Stickmin (Edición Extendida)

**Rol y Aventura**

Novela visual/árbol de decisiones con más de 40 escenas y 29 finales. Inspirado en la saga de PuffballsUnited, pero con una trama mucho más ramificada, nuevos personajes y giros sorprendentes.

## Gameplay

Henry Stickmin planea robar el "Zafiro Eterno" del museo municipal. Esta vez tienes **5 caminos iniciales** (sigilo, fuerza, disfraz, soborno y tecnología). Cada uno se divide en múltiples ramas, con decisiones que afectan el desarrollo de la historia. Hay **finales de éxito y de fracaso**, con mayor probabilidad de fracaso que de éxito para mantener el tono cómico. Algunas decisiones pueden generar bucles o llevarte a caminos alternativos, y los personajes se reutilizan entre rutas.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Descubrir todos los finales posibles |
| **Victoria** | Llegar a un final exitoso |
| **Derrota** | Llegar a un final cómico de fracaso |
| **Progreso** | Los finales descubiertos se guardan en localStorage |

## Controles

| Entrada | Acción |
|---------|--------|
| Click / Espacio | Avanzar texto (completa texto, no reinicia) |
| Click en opción | Elegir camino |
| Click / Espacio | Continuar tras final |
| Click / Espacio | Reiniciar desde pantalla final |

## Árbol de decisiones

```
intro
├── sneak (sigilo)
│   ├── sneak_duct → sneak_boiler → vault_key / vault_extinguisher / fail_explosion
│   │   → sneak_locker → vault_uniform / sneak_roof
│   ├── sneak_roof → vault_rope / sneak_shadows
│   └── sneak_shadows → vault_code / vault_gas
├── force (fuerza)
│   ├── force_hammer → force_escape_hammer / fail_curtain
│   ├── force_explosives → force_escape_boom / fail_alarm
│   └── force_ram → vault_ram_guard / vault_ram_run
├── disguise (disfraz)
│   ├── disguise_guard → vault_bluff / disguise_clumsy / fail_chase
│   ├── disguise_janitor → vault_janitor_tools / vault_janitor_code
│   ├── disguise_scientist → success_plans / vault_robot
│   └── disguise_director → vault_director_open / vault_director_codes
├── bribe (soborno)
│   ├── bribe_accept → vault_bribe_escape / fail_bribe_fight
│   ├── bribe_threat → fail_chase / fail_hide
│   └── bribe_partner → vault_partner_open / vault_partner_plan
└── tech (tecnología)
    ├── tech_disable → vault_tech_direct / sneak_roof
    ├── tech_open → success_dance / fail_sensor
    └── tech_record → vault_code_fast / fail_alarm
```

## Finales (29 en total)

### ✅ Éxitos (17 variantes)
Baile de la victoria, Café y zafiro, El mejor farol, Plan maestro, Escalada exitosa, Código perfecto, Gas y victoria, Martillo de campeón, Carrera contrarreloj, Limpiador de lujo, Código y huida, Robot aliado, Huyendo de la directora, Códigos y victoria, Fuga sobornada, Moto policial, Socio de confianza, y más.

### ❌ Fracasos (12 variantes)
¡Kaboom!, Cortina fatal, ¡Alarma general!, Persecución fallida, Sensor de peso, Demasiados botones, Radio accidente, Pelea por el soborno, Escondite patético, Selfie arriesgado, Riego inesperado, Siesta eterna, y más.

## Estructura del código

- **`constants.js`**: árbol de escenas (más de 40 nodos) con título, texto, emoji, pose y opciones.
- **`HenryStickmin.js`**: motor de la novela visual (efecto máquina de escribir, renderizado de stickman en 15 poses, detección de clics).
- **`i18n.js`**: traducciones específicas del juego.

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Ratón + teclado (Espacio) |
| `StorageManager` | Persistencia de finales descubiertos |
| `CollisionUtils` | `pointInRect()` para botones |
| `AudioManager` | SFX de selección, powerup, hit |
| `HapticManager` | Vibración en selecciones y finales |
| `i18n` | Textos traducidos |
