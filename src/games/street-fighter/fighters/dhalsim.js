/**
 * Street Fighter — Dhalsim (El yogui de largo alcance)
 *
 * Luchador con el mayor alcance del juego y alta resistencia.
 * Especial: Yoga Flame (llamarada)
 * Super: Yoga Inferno (llamarada potente)
 */
export const DHALSIM = {
  id: 'dhalsim', name: 'Dhalsim',
  color: '#d4a574', pantsColor: '#e74c3c', skinColor: '#6b3a2a',
  hp: 105, speed: 140, jumpVel: -400,
  attacks: {
    punch: { damage: 7, startup: 5, active: 4, recovery: 6, range: 55, hitstun: 14 },
    kick:  { damage: 10, startup: 7, active: 5, recovery: 8, range: 65, hitstun: 18 },
    special: { damage: 15, startup: 10, active: 6, recovery: 12, range: 90, hitstun: 22, name: 'Yoga Flame' },
    super: { damage: 28, startup: 12, active: 8, recovery: 14, range: 100, hitstun: 32, name: 'Yoga Inferno' },
  },
  specialKey: '214P',
};
