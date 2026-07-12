# Tetris

**Nivel 3 — Puzzle / Arcade**

El clásico juego de puzzle donde las piezas caen y debes completar líneas horizontales para sumar puntos.

## Gameplay

Siete tipos de tetrominós caen desde la parte superior del tablero (10x20). Debes rotarlos y moverlos para encajarlos sin dejar huecos. Cada línea completa se elimina y suma puntos. El juego se acelera a medida que avanzas de nivel.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Máxima puntuación posible |
| **Derrota** | Las piezas se apilan hasta arriba |
| **Puntuación** | 1 línea: 100×nivel; 2: 300×nivel; 3: 500×nivel; 4 (Tetris): 800×nivel |

## Controles

| Tecla | Acción |
|-------|--------|
| ← / A | Mover izquierda |
| → / D | Mover derecha |
| ↑ / W | Rotar |
| ↓ / S | Soft drop (caída rápida) |
| Espacio | Hard drop (caída instantánea) |
| P / Escape | Pausa |
| Click / Espacio | Reiniciar tras Game Over |

## Mecánicas

- **7-bag randomizer:** Las 7 piezas aparecen en lotes aleatorios (sin sequías extremas)
- **Ghost piece:** Sombra que muestra dónde caerá la pieza
- **Wall kick:** Las piezas se desplazan lateralmente al rotar cerca de los bordes
- **Lock delay:** La pieza tarda 0.5s en fijarse al tocar el suelo
- **Niveles:** Cada 10 líneas se sube de nivel (mayor velocidad)
- **Pausa:** P o Escape para pausar

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD/Espacio/P/Escape) |
| `StorageManager` | Persistencia de highscore |
| `AudioManager` | SFX de movimiento, impacto, powerup |
| `HapticManager` | Vibración en líneas |
| `ParticleSystem` | Efectos al limpiar líneas |
| `i18n` | Textos traducidos |
