# Trivia Trampa

**Puzzle y Gestión**

Primer juego del hub sin física: la interacción es 100% click contra zonas rectangulares. Banco de preguntas ampliable con selección aleatoria y categorías. Algunas preguntas tienen la respuesta correcta en un botón visible, otras en una zona oculta de la pantalla.

## Gameplay

Aparece una pregunta con 4 opciones. Debes seleccionar la respuesta correcta. Pero no es tan simple: algunas preguntas tienen **zonas ocultas** en la pantalla (apenas visibles) donde está la verdadera respuesta, mientras que los 4 botones son señuelos. Tienes 3 vidas. Las preguntas aparecen en orden aleatorio y se pueden enfocar por categorías.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Responder correctamente tantas preguntas como sea posible |
| **Victoria** | Responder todas las preguntas del banco |
| **Derrota** | Perder las 3 vidas |
| **Récord** | Mejor progreso (pregunta más lejana alcanzada) |

## Controles

| Entrada | Acción |
|---------|--------|
| Click | Seleccionar respuesta / zona oculta |
| Click / Espacio | Reiniciar |

## Constantes de balance

| Parámetro | Valor |
|-----------|-------|
| Vidas iniciales | 3 |
| Duración feedback | 0.7s (correcto/incorrecto) |
| Banco de preguntas | Ampliable, selección aleatoria |
| Tipo 'choice' | 1 de 4 botones es correcto |
| Tipo 'hidden' | Zona oculta (fracción del canvas) contiene la respuesta |

## Estructura del código

- **`TrickQuiz.js`**: Clase principal
  - `QUESTIONS[]`: array de preguntas con tipo, opciones, respuesta y zona oculta
  - `_handleClick()` → detecta click en botón o zona oculta
  - `_onCorrect()` / `_onWrong()` → feedback visual y sonoro
  - `_layoutCurrentQuestion()` → posiciona botones y zona oculta según dimensiones
  - `_advanceQuestion()` → avanza o termina el juego
- **`i18n.js`**: Traducciones específicas (trick-quiz.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Ratón (clicks) |
| `StorageManager` | Persistencia de mejor progreso |
| `CollisionUtils` | `pointInRect()` para detección de clicks en zonas |
| `wrapText` | Renderizado de texto multilínea en preguntas y botones |
| `AudioManager` | SFX de acierto, fallo, powerup |
| `HapticManager` | Vibración en aciertos y fallos |
| `SeededRandom` | Semilla para selección aleatoria de preguntas |
