// Intent legality — the authoritative gate the server runs before apply(),
// and the same check the local client runs before mutating in hotseat mode.
//
// An "intent" is a small serialisable action object: { type, ...payload }.
//   isLegal(state, intent, side)  — may `side` perform `intent` right now?
//   legalActions(state, side)     — which intents are currently available to a side?
//
// This is Phase 1d of the foundation refactor. Only turn-flow intents (pass,
// endRound) are modelled so far; further action families are migrated out of
// the inline client handlers incrementally. Keep this in lockstep with the
// apply() dispatcher in mutators.js — every intent type apply() handles must
// have a matching case here.

import { ORDERS } from './constants.js';
import { getDef } from './state.js';
import { nextUndeployedShipIdx, activeGroupIdForSide } from './mutators.js';

const INTENT_TYPES = ['pass', 'endRound'];

export function isLegal(state, intent, side) {
  if (!intent || typeof intent !== 'object') return false;
  switch (intent.type) {
    case 'pass': {
      if (state.phase !== 'play') return false;
      if (state.activeSide !== side) return false;
      const P = state.planning;
      return !!(P && P.passTokens && P.passTokens[side] > 0);
    }
    case 'endRound': {
      if (state.phase !== 'play') return false;
      // The active side ends the round. If no side is active (all activations
      // are done) either player may trigger it.
      return state.activeSide === side || state.activeSide === null;
    }
    case 'applyOrder': {
      const { gid, order } = intent;
      if (!ORDERS[order]) return false;
      const grp = state.groups[gid];
      if (!grp || grp.activated) return false;
      const def = getDef(state, gid);
      if (!def || def.side !== side) return false;            // only order your own Group
      if (nextUndeployedShipIdx(state, gid) >= 0) return false; // all ships must be deployed
      if (state.phase === 'play') {
        if (state.activeSide && state.activeSide !== side) return false; // not your turn
        const activatingGid = activeGroupIdForSide(state, def.side);
        if (activatingGid && activatingGid !== gid) return false;        // another Group mid-activation
      }
      // Order is locked once a ship has moved under the current Order.
      if (grp.order && order !== grp.order && grp.ships.some(s => !s.destroyed && s.movedThisRound)) return false;
      return true;
    }
    default:
      return false;
  }
}

export function legalActions(state, side) {
  const out = [];
  for (const type of INTENT_TYPES) {
    const intent = { type };
    if (isLegal(state, intent, side)) out.push(intent);
  }
  return out;
}
