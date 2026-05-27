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
import { nextUndeployedShipIdx, activeGroupIdForSide, moveCone, headingVec } from './mutators.js';

const INTENT_TYPES = ['pass', 'endRound'];

// True when it is `side`'s turn to act in the play phase (or there is no active
// side yet). Pre-play phases impose no active-side restriction.
function playTurnOk(state, side) {
  return !(state.phase === 'play' && state.activeSide && state.activeSide !== side);
}

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
    case 'moveShip': {
      const { gid, si } = intent;
      const grp = state.groups[gid];
      if (!grp || grp.activated) return false;
      const def = getDef(state, gid);
      if (!def || def.side !== side) return false;
      if (!playTurnOk(state, side)) return false;
      const ship = grp.ships[si];
      if (!ship || ship.destroyed || ship.offTable || ship.movedThisRound) return false;
      const { o, maxR, minR, turnDeg } = moveCone(state, gid, si, intent.layerToggle);
      if (!o || o.moveMax <= 0) return false;
      const dx = intent.x - ship.x, dy = intent.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (dist < minR - 0.5 || dist > maxR + 0.5) return false;
      const fwd = headingVec(ship.heading);
      const cosA = (fwd.x * dx + fwd.y * dy) / Math.max(0.0001, dist);
      const ang = Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI;
      return ang <= turnDeg + 0.5;
    }
    case 'aimShip': {
      const a = state.aiming;
      if (!a || (a.mode !== 'vectored' && a.mode !== 'course_change')) return false;
      const def = getDef(state, a.gid);
      if (!def || def.side !== side) return false;
      return playTurnOk(state, side);
    }
    case 'vectoredMove': {
      const v = state.vectoredSecondMove;
      if (!v) return false;
      const def = getDef(state, v.gid);
      if (!def || def.side !== side) return false;
      if (!playTurnOk(state, side)) return false;
      const vship = state.groups[v.gid] && state.groups[v.gid].ships[v.si];
      if (!vship) return false;
      const dx = intent.x - vship.x, dy = intent.y - vship.y;
      const dist = Math.hypot(dx, dy);
      const fwd = headingVec(vship.heading);
      const cos = (fwd.x * dx + fwd.y * dy) / Math.max(0.0001, dist);
      const angOff = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
      return dist <= v.remaining + 0.5 && angOff <= 20;
    }
    case 'attackStep':
    case 'attackReroll':
    case 'attackFighterReroll':
    case 'finishAttack':
    case 'attackDeclare': {
      if (state.phase !== 'play' || !state.attackModal) return false;
      // Attacker-drives-all: whoever's activation is in progress drives the modal
      // (the asset-phase driver during Asset Combat, otherwise the active side).
      const driver = state.assetActiveSide || state.activeSide;
      return side === driver;
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
