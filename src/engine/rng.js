// Seeded PRNG (mulberry32). Returns a function that produces uniformly distributed
// floats in [0, 1). Used on the server for authoritative, reproducible dice.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0;
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Used in browser local/hotseat mode — no seed needed, no replay, no server.
export const localRng = () => Math.random();

// Convenience wrappers (pass an rng function from makeRng or localRng).
export const rollD6  = (rng) => Math.floor(rng() * 6) + 1;
export const rollDie = (rng) => Math.floor(rng() * 6) + 1;
