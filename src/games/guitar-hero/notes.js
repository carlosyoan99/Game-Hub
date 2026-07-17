/**
 * Guitar Hero — Notas, canciones y configuración de carriles
 *
 * Extraído de GuitarHero.js. Contiene las definiciones de canciones,
 * generación procedural, y constantes de carriles/notas.
 */

export const LANE_COUNT = 5;
export const LANE_KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'Space'];
export const LANE_NAMES = ['A', 'S', 'D', 'F', '␣'];
export const LANE_COLORS = ['#e74c3c', '#4a9eff', '#3a9a5a', '#ffb454', '#c848d8'];
export const HIT_ZONE_Y_RATIO = 0.85;
export const NOTE_SPEED = 250;
export const NOTE_HEIGHT = 24;

export const SONG_DEFS = [
  { id: 'easy-rider',    name: 'Easy Rider',    labelKey: 'guitarhero.easy',   difficulty: 0, bpm: 100, length: 30, density: 0.30, useChords: false, useFast: false, color: '#3a9a5a', desc: '♪♪♫',     style: 'Rock' },
  { id: 'midnight-road', name: 'Midnight Road', labelKey: 'guitarhero.medium', difficulty: 1, bpm: 120, length: 35, density: 0.45, useChords: true,  useFast: false, color: '#ffb454', desc: '♪♪♪♫',   style: 'Blues' },
  { id: 'inferno-blaze', name: 'Inferno Blaze', labelKey: 'guitarhero.hard',   difficulty: 2, bpm: 140, length: 40, density: 0.60, useChords: true,  useFast: true,  color: '#e74c3c', desc: '♪♪♪♪♫', style: 'Metal' },
  { id: 'neon-nights',   name: 'Neon Nights',   labelKey: 'guitarhero.neon',   difficulty: 0, bpm: 110, length: 32, density: 0.35, useChords: false, useFast: false, color: '#38b8e8', desc: '♫♪♪♫',   style: 'Funk' },
  { id: 'ocean-waves',   name: 'Ocean Waves',   labelKey: 'guitarhero.ocean',  difficulty: 0, bpm: 80,  length: 28, density: 0.25, useChords: false, useFast: false, color: '#48a848', desc: '♪ ♪ ♪ ♫', style: 'Ballad' },
  { id: 'pixel-storm',   name: 'Pixel Storm',   labelKey: 'guitarhero.pixel',  difficulty: 1, bpm: 130, length: 36, density: 0.50, useChords: true,  useFast: true,  color: '#c848d8', desc: '♪♪♪♫♪♪', style: 'Chiptune' },
  { id: 'thunder-strike',name: 'Thunder Strike',labelKey: 'guitarhero.thunder',difficulty: 2, bpm: 160, length: 38, density: 0.65, useChords: true,  useFast: true,  color: '#ff4d4d', desc: '♪♪♪♪♫♪♪',style: 'Thrash' },
];

const _rn = (rng) => rng ? rng.next() : Math.random();

/**
 * Genera una secuencia de notas procedural para una canción
 */
export function generateSongFromDef(def, rng) {
  const { bpm, length, density, useChords, useFast } = def;
  const beatsPerSecond = bpm / 60;
  const totalBeats = Math.floor(length * beatsPerSecond);
  const notes = [];
  let lastBeat = -2;

  for (let beat = 0; beat < totalBeats; beat++) {
    if (_rn(rng) > density) continue;
    if (beat - lastBeat < 0.5) continue;

    if (useChords && _rn(rng) < 0.2 + def.difficulty * 0.05) {
      const lane1 = Math.floor(_rn(rng) * LANE_COUNT);
      let lane2;
      do { lane2 = Math.floor(_rn(rng) * LANE_COUNT); } while (lane2 === lane1);
      notes.push({ lane: lane1, beat, chord: false });
      notes.push({ lane: lane2, beat, chord: true });
      lastBeat = beat;
    } else {
      notes.push({ lane: Math.floor(_rn(rng) * LANE_COUNT), beat, chord: false });
      lastBeat = beat;
    }

    if (useFast && _rn(rng) < 0.15 && beat + 0.5 < totalBeats) {
      notes.push({ lane: Math.floor(_rn(rng) * LANE_COUNT), beat: beat + 0.5, chord: false });
    }
  }

  notes.sort((a, b) => a.beat - b.beat);
  return { ...def, notes, totalNotes: notes.length };
}

/**
 * Calcula la X de un carril en pantalla
 */
export function getLaneX(lane, width) {
  const laneW = width / (LANE_COUNT + 1);
  return laneW * (lane + 1);
}
