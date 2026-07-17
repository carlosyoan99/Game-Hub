/**
 * Swords and Souls — Minijuegos de entrenamiento
 *
 * Extraído de SwordsAndSouls.js. Maneja los 3 tipos de
 * entrenamiento: arquería, sparring y resistencia.
 */

import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { SeededRandom } from '../../engine/SeededRandom.js';

/**
 * Inicia un entrenamiento según su tipo
 */
export function startTraining(state, type) {
  state.subScene = type;
  state.trainClicks = 0;
  state.trainPhase = 'waiting';
  state.trainTimer = 0;

  switch (type) {
    case 'train-archery':
      state.trainMax = 5 + state.player.arch;
      spawnArcheryTarget(state);
      break;
    case 'train-spar':
      state.trainMax = 8 + state.player.str;
      state.trainTimer = 3;
      state.trainPhase = 'active';
      break;
    case 'train-endurance':
      state.trainMax = 6 + state.player.end;
      state.trainTimer = 2.5;
      state.trainPhase = 'active';
      break;
  }
}

/**
 * Genera un nuevo blanco de arquería
 */
export function spawnArcheryTarget(state) {
  if (!state.rng) state.rng = new SeededRandom();
  const margin = 60;
  state.trainTarget = {
    x: margin + state.rng.next() * (state.width - margin * 2),
    y: margin + state.rng.next() * (state.height - margin * 2 - 100),
    radius: 18 + state.rng.next() * 8,
    vx: (state.rng.next() - 0.5) * 100,
    vy: (state.rng.next() - 0.5) * 80,
    life: 2,
  };
  state.trainPhase = 'active';
  state.trainTimer = 2;
}

/**
 * Actualiza el entrenamiento activo
 */
export function updateTraining(state, dt) {
  if (state.trainPhase === 'done') return;

  if (state.trainTimer > 0) {
    state.trainTimer -= dt;
    if (state.trainTimer <= 0) {
      if (state.subScene === 'train-archery' || state.subScene === 'train-endurance') {
        finishTraining(state);
        return;
      }
    }
  }

  // Mover blanco de arquería
  if (state.subScene === 'train-archery' && state.trainTarget) {
    state.trainTarget.x += state.trainTarget.vx * dt;
    state.trainTarget.y += state.trainTarget.vy * dt;
    if (state.trainTarget.x < 60 || state.trainTarget.x > state.width - 60) state.trainTarget.vx *= -1;
    if (state.trainTarget.y < 60 || state.trainTarget.y > state.height - 160) state.trainTarget.vy *= -1;
  }
}

/**
 * Maneja un clic/tap durante el entrenamiento
 */
export function handleTrainingClick(state, mx, my) {
  if (state.trainPhase === 'done') return false;

  if (state.subScene === 'train-archery' && state.trainTarget) {
    const dx = mx - state.trainTarget.x;
    const dy = my - state.trainTarget.y;
    if (Math.hypot(dx, dy) < state.trainTarget.radius) {
      state.trainClicks++;
      if (state.onParticles) state.onParticles(state.trainTarget.x, state.trainTarget.y, '#ffb454', 8, { vyOffset: -20 });
      AudioManager.sfx({ type: 'swords_attack', volume: 0.25 });
      HapticManager.vibrate('shoot');
      spawnArcheryTarget(state);
      if (state.trainClicks >= state.trainMax) { finishTraining(state); return true; }
      return true;
    }
  } else if (state.subScene === 'train-spar' && state.trainPhase === 'active') {
    const sparBtn = getSparButton(state);
    if (mx >= sparBtn.x && mx <= sparBtn.x + sparBtn.width && my >= sparBtn.y && my <= sparBtn.y + sparBtn.height) {
      state.trainClicks++;
      AudioManager.sfx({ type: 'swords_hit', volume: 0.2 });
      if (state.onParticles) state.onParticles(mx, my, '#e7edf3', 4, { vyOffset: -15 });
      if (state.trainClicks >= state.trainMax) { finishTraining(state); return true; }
      return true;
    }
  } else if (state.subScene === 'train-endurance') {
    state.trainClicks++;
    if (state.trainClicks >= state.trainMax) { finishTraining(state); return true; }
    state.trainTimer = Math.min(state.trainTimer + 0.3, 2.5);
    return true;
  }
  return false;
}

/**
 * Maneja input de gamepad durante entrenamiento
 */
export function handleGamepadTrainingAction(state) {
  if (state.subScene === 'train-spar' && state.trainPhase === 'active') {
    state.trainClicks++;
    AudioManager.sfx({ type: 'swords_hit', volume: 0.2 });
    if (state.onParticles) state.onParticles(state.width / 2, state.height / 2, '#e7edf3', 4, { vyOffset: -15 });
    if (state.trainClicks >= state.trainMax) { finishTraining(state); return true; }
  } else if (state.subScene === 'train-endurance') {
    state.trainClicks++;
    if (state.trainClicks >= state.trainMax) { finishTraining(state); return true; }
    state.trainTimer = Math.min(state.trainTimer + 0.3, 2.5);
  } else if (state.subScene === 'train-archery' && state.trainTarget && state.trainPhase === 'active') {
    state.trainClicks++;
    if (state.onParticles) state.onParticles(state.trainTarget.x, state.trainTarget.y, '#ffb454', 8, { vyOffset: -20 });
    AudioManager.sfx({ type: 'swords_attack', volume: 0.25 });
    HapticManager.vibrate('shoot');
    spawnArcheryTarget(state);
    if (state.trainClicks >= state.trainMax) { finishTraining(state); return true; }
  }
}

/**
 * Finaliza el entrenamiento y otorga recompensas
 */
export function finishTraining(state) {
  state.trainPhase = 'done';

  let stat = 'str';
  let statLabel = 'Fuerza';
  const xpGain = 5 + state.trainClicks;

  switch (state.subScene) {
    case 'train-archery':
      stat = 'arch'; statLabel = 'Arquería';
      state.player.arch += Math.ceil(state.trainClicks / 3);
      break;
    case 'train-spar':
      stat = 'str'; statLabel = 'Fuerza';
      state.player.str += Math.ceil(state.trainClicks / 3);
      break;
    case 'train-endurance':
      stat = 'end'; statLabel = 'Resistencia';
      state.player.end += Math.ceil(state.trainClicks / 3);
      break;
  }

  if (state.onTrainingComplete) {
    state.onTrainingComplete(xpGain, statLabel);
  }
  state.subScene = null;
}

/**
 * Devuelve el rectángulo del botón de sparring
 */
export function getSparButton(state) {
  return { x: state.width / 2 - 40, y: state.height / 2 - 40, width: 80, height: 80 };
}
