// Hotseat (local) entry-point glue.
// Creates and exports the single shared game state for this browser session.
// Server rooms will call createState() themselves and never import from here.

import { createState, rebuildFleets } from '../src/engine/state.js';
import { localRng } from '../src/engine/rng.js';

export const state = createState();
export const rng   = localRng;   // Math.random — no seed, no replay

// Initialise with default factions so the board is ready immediately.
rebuildFleets(state);
