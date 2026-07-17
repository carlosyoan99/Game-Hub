/**
 * Street Fighter — Guile (El soldado táctico)
 *
 * Luchador defensivo con un proyectil especial de gran alcance.
 * Especial: Sonic Boom (proyectil)
 * Super: Flash Kick (golpe ascendente)
 */
export const GUILE = {
  id: 'guile', name: 'Guile',
  color: '#4a9eff', pantsColor: '#4a9eff', skinColor: '#d4a574',
  hp: 100, speed: 170, jumpVel: -420,
  attacks: {
    punch: { damage: 5, startup: 3, active: 2, recovery: 3, range: 42, hitstun: 11 },
    kick:  { damage: 9, startup: 5, active: 3, recovery: 5, range: 55, hitstun: 16 },
    special: { damage: 13, startup: 10, active: 5, recovery: 8, range: 80, hitstun: 20, name: 'Sonic Boom' },
    super: { damage: 26, startup: 8, active: 6, recovery: 10, range: 90, hitstun: 30, name: 'Flash Kick' },
  },
  specialKey: '236P',
};
