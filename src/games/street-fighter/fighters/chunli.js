/**
 * Street Fighter — Chun-Li (La luchadora rápida)
 *
 * La más rápida del roster, con menor HP pero ataques rápidos.
 * Especial: Lightning Kick (ráfaga de patadas)
 * Super: Spinning Bird (golpe giratorio)
 */
export const CHUNLI = {
  id: 'chunli', name: 'Chun-Li',
  color: '#4a9eff', pantsColor: '#4a9eff', skinColor: '#e8c898',
  hp: 90, speed: 210, jumpVel: -440,
  attacks: {
    punch: { damage: 4, startup: 2, active: 3, recovery: 3, range: 36, hitstun: 10 },
    kick:  { damage: 7, startup: 3, active: 4, recovery: 4, range: 52, hitstun: 14 },
    special: { damage: 10, startup: 5, active: 5, recovery: 7, range: 60, hitstun: 16, name: 'Lightning Kick' },
    super: { damage: 20, startup: 7, active: 8, recovery: 9, range: 70, hitstun: 26, name: 'Spinning Bird' },
  },
  specialKey: '236K',
};
