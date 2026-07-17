/**
 * Space Harrier — Constantes de configuración y datos de niveles/enemigos
 */
export const GROUND_OFFSET = 420;  // Y donde empieza el suelo
export const HORIZON_Y = 180;      // Línea del horizonte
export const PLAYER_Y = GROUND_OFFSET - 30;
export const PLAYER_MARGIN = 20;
export const PLAYER_SPEED = 300;

export const Z_FAR = 1000;   // Distancia máxima (horizonte)
export const Z_NEAR = 40;    // Distancia mínima (justo frente al player)

export const BULLET_SPEED = 600;
export const BULLET_INTERVAL = 0.15;

export const STAGE_LENGTH = 600;  // Unidades de avance por etapa (medida en Z)
export const STAGES_COUNT = 3;

// ─── Temas de escenario ───────────────────────────────────────────────
export const STAGES = [
  {
    name: 'harrier.stage1.name',
    groundColor1: '#3a6a2a', groundColor2: '#4a8a3a', skyTop: '#4a8aff', skyBottom: '#87ceeb',
    enemyInterval: 1.5, enemySpeed: 1.0, bossHp: 20,
  },
  {
    name: 'harrier.stage2.name',
    groundColor1: '#8a5a2a', groundColor2: '#a07030', skyTop: '#ff6b4a', skyBottom: '#ffb454',
    enemyInterval: 1.2, enemySpeed: 1.3, bossHp: 25,
  },
  {
    name: 'harrier.stage3.name',
    groundColor1: '#3a2a4a', groundColor2: '#4a3a5a', skyTop: '#1a0a2a', skyBottom: '#2a0a3a',
    enemyInterval: 0.9, enemySpeed: 1.5, bossHp: 30,
  },
];

// ─── Tipos de enemigos ────────────────────────────────────────────────
export const ENEMY_TYPES = {
  soldier: { hp: 2, damage: 1, score: 100, color: '#c84848', w: 16, h: 20, speedZ: 120 },
  bomber:  { hp: 3, damage: 1, score: 200, color: '#8b3a8b', w: 20, h: 16, speedZ: 90 },
  turret:  { hp: 4, damage: 1, score: 300, color: '#5a7a3a', w: 18, h: 18, speedZ: 60 },
  runner:  { hp: 1, damage: 1, score: 50,  color: '#ff6b4a', w: 14, h: 14, speedZ: 200 },
};
