# Henry Stickmin (Edición Extendida)

**Nivel 5 — RPG y Acción Compleja**

Novela visual/árbol de decisiones con más de 40 escenas y 29 finales. Inspirado en la saga de PuffballsUnited, pero con una trama mucho más ramificada, nuevos personajes y giros sorprendentes.

## Gameplay

Henry Stickmin planea robar el "Zafiro Eterno" del museo municipal. Esta vez tienes **5 caminos iniciales** (sigilo, fuerza, disfraz, soborno y tecnología). Cada uno se divide en múltiples ramas, con decisiones que afectan el desarrollo de la historia. Hay **17 finales de éxito** y **12 finales de fracaso**, lo que garantiza una alta rejugabilidad.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Descubrir todos los finales posibles |
| **Victoria** | Llegar a un final exitoso (17 variantes) |
| **Derrota** | Llegar a un final cómico de fracaso (12 variantes) |
| **Progreso** | Los finales descubiertos se guardan en localStorage |

## Controles

| Entrada | Acción |
|---------|--------|
| Click / Espacio | Avanzar texto (skip typewriter) |
| Click en opción | Elegir camino |
| Click / Espacio | Continuar tras final |
| Click / Espacio | Reiniciar desde pantalla final |

## Árbol de decisiones (resumen)
intro
├── sneak (sigilo)
│ ├── sneak_duct → sneak_boiler → vault_key / vault_extinguisher / fail_explosion
│ │ → sneak_locker → vault_uniform / sneak_roof
│ ├── sneak_roof → vault_rope / sneak_shadows
│ └── sneak_shadows → vault_code / vault_gas
├── force (fuerza)
│ ├── force_hammer → force_escape_hammer / fail_curtain
│ ├── force_explosives → force_escape_boom / fail_alarm
│ └── force_ram → vault_ram_guard / vault_ram_run
├── disguise (disfraz)
│ ├── disguise_guard → vault_bluff / disguise_clumsy / fail_chase
│ ├── disguise_janitor → vault_janitor_tools / vault_janitor_code
│ ├── disguise_scientist → success_plans / vault_robot
│ └── disguise_director → vault_director_open / vault_director_codes
├── bribe (soborno)
│ ├── bribe_accept → vault_bribe_escape / fail_bribe_fight
│ ├── bribe_threat → fail_chase / fail_hide
│ └── bribe_partner → vault_partner_open / vault_partner_plan
└── tech (tecnología)
├── tech_disable → vault_tech_direct / sneak_roof
├── tech_open → success_dance / fail_sensor
└── tech_record → vault_code_fast / fail_alarm


## Finales (29 en total)

### ✅ Éxitos (17)

1. 💃 Baile de la victoria
2. ☕ Café y zafiro
3. 🎭 El mejor farol
4. 📸 Plan maestro
5. 🧗 Escalada exitosa
6. 🔢 Código perfecto
7. 💤 Gas y victoria
8. 🔨 Martillo de campeón
9. 🏃 Carrera contrarreloj
10. 🧹 Limpiador de lujo
11. 👀 Código y huida
12. 🤖 Robot aliado
13. 👩‍💼 Huyendo de la directora
14. 📋 Códigos y victoria
15. 💨 Fuga sobornada
16. 🏍️ Moto policial
17. 🤝 Socio de confianza
18. 🗺️ Plan de escape
19. 🚗 Coche de Mike
20. 🛸 Tecnología imparable
21. ⏱️ Rápido y furioso
22. ⚖️ Peso y victoria
23. 🔑 Llave y huida

### ❌ Fracasos (12)

1. 💥 ¡Kaboom!
2. 🎪 Cortina fatal
3. 🚨 ¡Alarma general!
4. 🏃 Persecución fallida
5. 🔒 Sensor de peso
6. 🎮 Demasiados botones
7. 📻 Radio accidente
8. 🔫 Pelea por el soborno
9. 🕵️ Escondite patético
10. 📸 Selfie arriesgado
11. 🚿 Riego inesperado
12. 💤 Siesta eterna
13. 💉 Dardo de sueño
14. 📖 Cartel trampa
15. 😇 Explicación fallida
16. 🎥 Selfie en el caos
17. 👩‍💼 Enfrentamiento con la directora
18. 📝 Nota de agradecimiento
19. 🗡️ Traición de socio
20. 🔢 Combinación fallida
21. ⏱️ Tiempo agotado
22. 🎭 Pose triunfal
23. 😈 Burla costosa

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
