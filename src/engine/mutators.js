// Pure game-logic mutators and read-only helpers.
// No DOM calls — rendering is the caller's responsibility.

import { FEATURES, ORDERS, INCH, BOARD_PX, BOARD_IN, ASSET_PROFILES, DROPSITE_BASE, DEPLOYMENTS, APPROACHES } from './constants.js';
import { rollD6, rollDie } from './rng.js';
import { fleetForSide, redFleet, blueFleet, factionName, payloadShips, porterShips, allDefs, getDef, getGroup, assetProfile, fighterRerolls } from './state.js';

const inchToPx = v => v * INCH;

function shipBaseRadiusPx(def) {
  const diameterIn = { 'L': 30/25.4, 'M': 40/25.4, 'H': 50/25.4, 'C': 60/25.4 }[def.tonnage] || 30/25.4;
  return (diameterIn * INCH) / 2;
}

// ── GEOMETRY AND TARGETING ──

export function headingVec(h) {
  const r = h * Math.PI / 180;
  return { x: Math.cos(r), y: Math.sin(r) };
}

/* Heading (deg) from a ship at (sx,sy) toward a point (px,py). */
export function headingToward(sx, sy, px, py) {
  return Math.atan2(py - sy, px - sx) * 180 / Math.PI;
}

/* Smallest signed angle (deg) from a→b, in range (-180, 180]. */
export function angleDelta(a, b) {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/* Clamp a desired heading to within ±limitDeg of an origin heading. */
export function clampHeading(origin, desired, limitDeg) {
  const d = angleDelta(origin, desired);
  const clamped = Math.max(-limitDeg, Math.min(limitDeg, d));
  return origin + clamped;
}

/* Half-widths (deg) of each arc letter relative to the ship's heading centre. */
export function arcWedges(arcStr) {
  // Returns [{centre, half}] offsets relative to heading.
  const out = [];
  arcStr.split('/').map(s => s.trim()).forEach(c => {
    if (c === 'F') out.push({ centre: 0, half: 45 });
    else if (c === 'R') out.push({ centre: 180, half: 45 });
    else if (c === 'S' || c === 'B') { out.push({ centre: 90, half: 45 }); out.push({ centre: -90, half: 45 }); }
    else if (c === 'FN') out.push({ centre: 0, half: 11.25 });
    else if (c === 'RN') out.push({ centre: 180, half: 11.25 });
  });
  return out;
}

/* Is point (px,py) within a weapon's firing arc from the ship? */
export function pointInWeaponArc(ship, w, px, py) {
  const wedges = arcWedges(w.arc);
  if (!wedges.length) return true; // arcless (e.g. LoS) — treat as all-round
  const bearing = headingToward(ship.x, ship.y, px, py);
  return wedges.some(wg => Math.abs(angleDelta(ship.heading + wg.centre, bearing)) <= wg.half + 0.5);
}

/* Effective scan (inches) of a ship — 1" if Scanners Offline crippling. */
export function effectiveScan(def, ship) {
  if (ship && ship.crippling && ship.crippling.includes('scanners')) return 1;
  return def.scan;
}

/* Maximum move distance (PIXELS) for a ship under an order, honouring the
   Navigation Offline crippling effect (total movement → 2", no thrust scaling). */
export function effectiveMaxMovePx(def, ship, order) {
  const o = ORDERS[order] || { moveMax: 0 };
  if (ship && ship.crippling && ship.crippling.includes('navigation')) return 2 * INCH;
  // Arrest-X: this ship's Thrust is reduced by X" during its next activation.
  const thrust = Math.max(0, def.thrust - (ship && ship.arrestNext ? ship.arrestNext : 0));
  return o.moveMax * thrust * INCH;
}

/* Targeting range in PIXELS = attacker Scan + (target Signature + target Spikes×3").
   Scenery on the LoS line can cause the target's Spikes (and, for Debris, Signature)
   to be ignored. */
export function targetingRangePx(attackerDef, targetDef, targetShip, targetGrp, attackerShip, w) {
  // Close Action weapons target only within the attacker's Scan range (Sig & Spikes
  // give the target no extra "visibility" range against Close Action).
  if (w && /Close Action/i.test(w.special || '')) {
    return effectiveScan(attackerDef, attackerShip) * INCH;
  }
  let spikes = (targetGrp ? (targetGrp.spikes || 0) : 0) + (targetShip.spikes || 0);
  let sig = targetShip.sigSilent ? 0 : (targetDef.sig || 0);
  if (attackerShip) {
    const eff = sceneryAttackEffects(attackerShip.x, attackerShip.y, targetShip.x, targetShip.y, attackerShip, targetShip);
    if (eff.ignoreSpikes) spikes = 0;
    if (eff.ignoreSig) sig = 0;
  }
  const sigIn = sig + spikes * 3;
  return (effectiveScan(attackerDef, attackerShip) + sigIn) * INCH;
}

/* Can a weapon legally target a given enemy ship right now?
   Checks: orbital layer rules, weapon arc, Scan+Sig(+spikes) range, and that a
   Large Object does not block Line of Sight. */
export function weaponCanTarget(attackerDef, attackerShip, w, targetDef, targetShip, targetGrp) {
  if (targetShip.destroyed || targetShip.offTable || targetShip.attachedTo) return false;
  const aLayer = attackerShip.layer || 'orbit', tLayer = targetShip.layer || 'orbit';
  if (aLayer !== tLayer) {
    // Orbit → Atmosphere: always allowed (−1 Lock vs non-Descent; 6+ vs Descent — applied at hit resolution).
    // Atmosphere → Orbit: only allowed with Escape Velocity (Close Action).
    const orbitToAtmo = aLayer === 'orbit' && tLayer === 'atmosphere';
    const atmoToOrbit = aLayer === 'atmosphere' && tLayer === 'orbit';
    const escapeVel = /Escape Velocity/i.test(w.special || '');
    if (!orbitToAtmo && !(atmoToOrbit && escapeVel)) return false;
  }
  if (!pointInWeaponArc(attackerShip, w, targetShip.x, targetShip.y)) return false;
  // Large Objects block Line of Sight (unless both ends in atmosphere).
  const eff = sceneryAttackEffects(attackerShip.x, attackerShip.y, targetShip.x, targetShip.y, attackerShip, targetShip);
  if (eff.blocked) return false;
  const range = targetingRangePx(attackerDef, targetDef, targetShip, targetGrp, attackerShip, w);
  if (Math.hypot(targetShip.x - attackerShip.x, targetShip.y - attackerShip.y) > range) return false;
  return true;
}

/* How many weapons a ship may fire this activation, given its effective Order. */
export function fireLimit(order, def) {
  if (!order || !ORDERS[order]) return 0;
  const fr = ORDERS[order].fireRule;
  const total = (def.weapons || []).length;
  // Stealth: this Ship may fire ONE Weapon while on Silent Running.
  if (order === 'SR' && /Stealth/i.test(def.special || '')) return 1;
  if (fr === 'none') return 0;
  if (fr === 'all') return total;
  if (fr === 'half') return Math.ceil(total / 2);
  if (fr === 'one') return 1;
  if (fr === 'one-CA') return 1; // one Close Action weapon
  return 0;
}

/* Fire-slot cost of firing weapon wi: High Power = 2 off Weapons Free, else 1. */
export function weaponSlotCost(def, wi, order) {
  const sp = parseWeaponSpecials(def.weapons[wi]);
  if (sp.highPower && order !== 'WF') return 2;
  return 1;
}

/* Grouping key: Linked-X / Alt-X weapons of the same value count as one Weapon. */
export function weaponGroupKey(def, wi) {
  const sp = parseWeaponSpecials(def.weapons[wi]);
  if (sp.linked) return 'L:' + sp.linked;
  if (sp.alt) return 'A:' + sp.alt;
  return 'W:' + wi;
}

/* All weapon indices that fire together with wi (Linked-X partners share a trigger). */
export function linkedPartners(def, wi) {
  const sp = parseWeaponSpecials(def.weapons[wi]);
  if (!sp.linked) return [wi];
  const out = [];
  def.weapons.forEach((w, i) => { const s = parseWeaponSpecials(w); if (s.linked === sp.linked) out.push(i); });
  return out;
}

/* Total fire-slot cost of a ship's locked weapons: Linked/Alt groups count once,
   High Power double (off WF), Low Power is free when a Close Action weapon also fires. */
export function lockedWeaponCost(def, ship, order) {
  const locked = Object.keys(ship.weaponTargets || {}).map(n => parseInt(n));
  const seen = new Set();
  let cost = 0;
  locked.forEach(wi => {
    const sp = parseWeaponSpecials(def.weapons[wi]);
    const gk = weaponGroupKey(def, wi);
    if (seen.has(gk)) return;
    seen.add(gk);
    if (sp.lowPower) return; // Low Power is a free extra (allowed alongside a CA weapon)
    cost += weaponSlotCost(def, wi, order);
  });
  return cost;
}

/* Is this ship a Capital Ship (Medium tonnage or larger) — subject to Crippling? */
export function isCapital(def) { return ['M', 'H', 'C'].includes(def.tonnage); }

/* Explosion range (inches) by tonnage. */
export function explosionRangeIn(def) { return def.tonnage === 'C' ? 9 : def.tonnage === 'H' ? 6 : 3; }

/* Parse a Lock value like "3+" → 3. */
export function lockVal(w) { return parseInt(String(w.lock).replace('+', '')) || 7; }

/* Parse a save like "4+" → 4, "—" → null (no save). */
export function saveVal(s) { if (!s || s === '—') return null; return parseInt(String(s).replace('+', '')) || null; }

/* Maximum Spikes a Group may hold. Default 4; Cloak-X lowers it to X. */
export function spikeCap(def) {
  const m = (def && def.special || '').match(/Cloak-(\d)/i);
  return m ? parseInt(m[1]) : 4;
}

/* Add n Spikes to a Group, respecting its (possibly Cloak-reduced) cap. */
export function addGroupSpikes(grp, def, n) {
  grp.spikes = Math.min(spikeCap(def), (grp.spikes || 0) + n);
}

export function addShipSpikes(ship, def, n) {
  ship.spikes = Math.min(spikeCap(def), (ship.spikes || 0) + n);
}

export function parseWeaponSpecials(w) {
  const sp = (w.special || '');
  const num = (re) => { const m = sp.match(re); return m ? parseInt(m[1]) : 0; };
  return {
    scald:       num(/Scald-(\d)/i),
    reave:       num(/Reave-(\d)/i),
    burnthrough: num(/Burnthrough-(\d)/i),
    critical:    num(/Critical-(\d)/i),
    flash:       num(/Flash-(\d)/i),
    bloom:       num(/Bloom-(\d)/i),
    fusillade:   num(/Fusillade-(\d)/i),
    penetrator:  /Penetrator/i.test(sp),
    focused:     /Focused/i.test(sp),
    closeAction: /Close Action/i.test(sp),
    mauler:      /Mauler/i.test(sp),
    antiWing:    /Anti.?Wing/i.test(sp),
    crippling:   /Crippling/i.test(sp),
    calibre:     (sp.match(/Calibre-([HMCL/]+)/i) || [])[1] || null,
    status:      /Status/i.test(sp),
    volley:      num(/Volley-(\d)/i),
    overcharge:  /Overcharge/i.test(sp),
    corruptor:   num(/Corruptor-(\d)/i),
    arrest:      num(/Arrest-(\d)/i),
    impel:       num(/Impel-(\d)/i),
    sustained:   /Sustained Fire/i.test(sp),
    highPower:   /High Power/i.test(sp),
    lowPower:    /Low Power/i.test(sp),
    linked:      (sp.match(/Linked-([A-Za-z0-9]+)/i) || [])[1] || null,
    limited:     num(/Limited-(\d)/i),
    alt:         (sp.match(/\bAlt-([A-Za-z0-9]+)/i) || [])[1] || null
  };
}

/* Save value (number) a hit uses against a given damage type for a target.
   When shieldUp, the Shield Save replaces ES/KS and applies to E/K/C alike,
   ignoring modifiers to ES/KS (returns {v, shielded}). Otherwise applies the
   Defence-Systems-Offline crippling (−1 / worse). Returns null v = no save. */
export function baseSaveForType(td, ts, type, shieldUp) {
  // Full Shield-X: a raised Shield replaces ES & KS and saves vs E, K, and Core,
  // ignoring any ES/KS modifiers.
  if (shieldUp && shieldSaveVal(td)) return shieldSaveVal(td);
  let v;
  if (type === 'E') v = saveVal(td.es);
  else if (type === 'K') v = saveVal(td.ks);
  else v = null; // Core has no save without a Shield
  if (v != null && ts.crippling && ts.crippling.includes('defence')) v = v + 1; // worse
  return v;
}

export function hasShields(def) { return /Shield-?\d?/i.test(def.special || ''); }
export function shieldSaveVal(def) { const m = (def.special||'').match(/Shield-?(\d)/i); return m ? parseInt(m[1]) : null; }

/* Find an enemy ship (relative to attackerSide) whose marker contains the point. */
export function enemyShipAtPoint(state, attackerSide, pt) {
  let best = null, bestD = Infinity;
  Object.keys(state.groups).forEach(gid => {
    const def = getDef(state, gid);
    if (!def || def.side === attackerSide) return;
    const grp = state.groups[gid];
    grp.ships.forEach((s, si) => {
      if (s.destroyed || s.offTable || s.attachedTo) return;
      const d = Math.hypot(s.x - pt.x, s.y - pt.y);
      if (d < bestD && d < 16) { bestD = d; best = { gid, si, def, ship: s, grp }; }
    });
  });
  return best;
}

/* Enemy ships within 1" (base contact) of a point, for bomber attacks. */
export function enemyShipsInBaseContact(state, side, x, y) {
  const out = [];
  Object.keys(state.groups).forEach(gid => {
    const def = getDef(state, gid);
    if (!def || def.side === side) return;
    state.groups[gid].ships.forEach((s, si) => {
      if (s.destroyed || s.offTable || s.attachedTo) return;
      // Assets operate in Orbit and cannot attack ships in the Atmosphere layer
      // (e.g. Descent ships that have dropped into atmosphere).
      if ((s.layer || 'orbit') === 'atmosphere') return;
      if (Math.hypot(s.x - x, s.y - y) <= 1 * INCH + shipBaseRadiusPx(def)) out.push({ gid, si, def, ship: s });
    });
  });
  return out;
}

export function targetKey(gid, si) { return gid + '#' + si; }

// ── SCORING AND LOGGING ──

export function shipPoints(def) { return Math.round((def.pts || 0) / (def.groupSize || 1)); }

/* Award Victory Points: mutates the score, records a structured entry in state.scoreLog
   (for the breakdown view), returns a text line (for round/end logs). `vp` may be
   negative (e.g. Protect penalty). */
export function awardVP(state, side, vp, reason, round) {
  if (!vp || !state.score || !state.score[side]) return null;
  state.score[side].vp += vp;
  state.scoreLog = state.scoreLog || [];
  const entry = { round: round != null ? round : (state.round || 0), side, vp, reason };
  state.scoreLog.push(entry);
  logEvent(state, `${factionName(state, side)} ${vp >= 0 ? '+' : ''}${vp} VP — ${reason}`);
  return `${factionName(state, side)} ${vp >= 0 ? '+' : ''}${vp} VP (${reason})`;
}

/* Append a game event to the log (orders, moves, shots, launches, extracts, etc.). */
export function logEvent(state, text) {
  if (!text) return;
  state.eventLog = state.eventLog || [];
  state.eventLog.push({ round: state.round || 0, text, ts: Date.now() });
  // Cap the stored history to keep things light.
  if (state.eventLog.length > 400) state.eventLog.shift();
}

/* Award a destroyed ship's points to the killer's Kill Points (2× if captured). */
export function recordKill(state, def, killerSide, captured, killedShipKey) {
  if (!killerSide || !state.score || !state.score[killerSide]) return;
  state.score[killerSide].kp += shipPoints(def) * (captured ? 2 : 1);
  logEvent(state, `${factionName(state, killerSide)} ${captured ? 'captured' : 'destroyed'} ${def.name} (+${shipPoints(def) * (captured ? 2 : 1)} KP)`);
  if (captured && state.captured) state.captured[killerSide] += shipPoints(def);
  // Extract: +1 VP per enemy Ship destroyed while it was carrying Recon Operatives.
  if (killedShipKey && state.shipReconOps && state.shipReconOps[killedShipKey] > 0) {
    state.reconKills = state.reconKills || { ucm: 0, shal: 0 };
    state.reconKills[killerSide] = (state.reconKills[killerSide] || 0) + 1;
    state.shipReconOps[killedShipKey] = 0; // operatives lost with the ship
  }
  // Decapitate: flag the victim side if this ship carried its admiral.
  if (def.flagship || (def.special && /Command Ship/i.test(def.special)) || (def.admiralLevel)) {
    if (state.admiralKilled) state.admiralKilled[def.side] = true;
  }
}

/* Standard Scoring VP for a dropsite size + control/contest. */
const DROPSITE_VP = { S: { control: 2, contest: 0 }, M: { control: 3, contest: 1 }, L: { control: 4, contest: 2 } };

export function dropsiteSizeKey(ds) {
  const t = String((ds.base && ds.base.size) || ds.size || 'medium').toLowerCase();
  if (t === 's' || t === 'small') return 'S';
  if (t === 'l' || t === 'large') return 'L';
  return 'M';
}

/* Compute Standard Scoring VP gained this scoring round, per side.
   Objective modifiers:
   • Protect: a side's nominated Dropsite scores DOUBLE while intact; if Levelled, that
     side instead takes a penalty equal to the Dropsite's control value.
   • Raze: a Dropsite Levelled or Ruined ≥24" from a side's Zone scores DOUBLE for the
     OPPOSING side that razed/contests it (handled in runScoring's raze block, not here).
   Returns { ucm, shal } VP for this round. */
export function computeStandardScoring(state) {
  const out = { ucm: 0, shal: 0 };
  const rows = []; // per-dropsite breakdown for the scoring modal
  const obj = state.scenario && state.scenario.objective;
  const noms = state.protectNom || {};
  ((state.scenarioData && state.scenarioData.dropsites) || []).forEach(ds => {
    const sz = dropsiteSizeKey(ds);
    const vp = DROPSITE_VP[sz] || DROPSITE_VP.M;
    const ctrl = dropsiteController(ds);
    const isLevelled = !!ds.destroyed;
    let ucmGain = 0, shalGain = 0, statusNote = '';
    if (obj === 'protect') {
      ['ucm','shal'].forEach(s => { if (noms[s] === ds.id && isLevelled) { out[s] -= vp.control; if (s==='ucm') ucmGain -= vp.control; else shalGain -= vp.control; statusNote = 'Protect penalty'; } });
    }
    if (isLevelled) {
      rows.push({ name: ds.base.name, sz, status: 'Levelled' + (statusNote?' · '+statusNote:''), ctrl: null, ucm: ucmGain, shal: shalGain });
      return;
    }
    if (ctrl) {
      let gain = vp.control;
      if (obj === 'protect' && noms[ctrl] === ds.id) { gain *= 2; statusNote = 'Protected ×2'; }
      out[ctrl] += gain;
      if (ctrl === 'ucm') ucmGain += gain; else shalGain += gain;
      rows.push({ name: ds.base.name, sz, status: 'Controlled' + (statusNote?' · '+statusNote:''), ctrl, ucm: ucmGain, shal: shalGain });
    } else if (dropsiteContested(ds)) {
      out.ucm += vp.contest; out.shal += vp.contest;
      rows.push({ name: ds.base.name, sz, status: 'Contested', ctrl: null, ucm: ucmGain + vp.contest, shal: shalGain + vp.contest });
    } else {
      rows.push({ name: ds.base.name, sz, status: 'Uncontrolled', ctrl: null, ucm: ucmGain, shal: shalGain });
    }
  });
  out.rows = rows;
  return out;
}

/* Run end-of-round Victory Point scoring (rounds 4 & 6 for standard scoring),
   plus the scenario's scoring-variant bonuses where computable. */
export function runScoring(state, rng, round) {
  const log = [];
  state.lastScoring = null; // set below for the R4/R6 standard-scoring modal
  if ((round === 4 || round === 6) && !state.scoredRounds.includes(round)) {
    state.scoredRounds.push(round);
    const std = computeStandardScoring(state);
    const l1 = awardVP(state, 'ucm', std.ucm, `Standard Scoring R${round}`, round);
    const l2 = awardVP(state, 'shal', std.shal, `Standard Scoring R${round}`, round);
    if (l1) log.push(l1); if (l2) log.push(l2);
    if (!l1 && !l2) log.push(`Standard Scoring (R${round}): no VP scored`);
    // Stash the per-dropsite breakdown for the scoring modal.
    state.lastScoring = { round, rows: std.rows, ucm: std.ucm, shal: std.shal };
  }
  // Scoring variant bonuses applied at game end (round 6).
  if (round === 6) {
    const obj = state.scenario && state.scenario.objective;
    const objName = (obj && OBJECTIVES[obj]) ? OBJECTIVES[obj].name : '';
    const push = (line) => { if (line) log.push(line); };
    // Attrition: +2 VP per 500 pts destroyed (both sides).
    if (obj === 'attrition') {
      ['ucm','shal'].forEach(s => push(awardVP(state, s, Math.floor(state.score[s].kp / 500) * 2, `${objName}: pts destroyed`, round)));
    }
    // Raze: +2 VP per 500 pts destroyed, PLUS double Standard Scoring value for each
    // Dropsite Levelled or Ruined that lies ≥24" from the scoring side's own Zone.
    if (obj === 'raze') {
      ['ucm','shal'].forEach(s => push(awardVP(state, s, Math.floor(state.score[s].kp / 500) * 2, `${objName}: pts destroyed`, round)));
      const razeVP = { ucm: 0, shal: 0 };
      ((state.scenarioData && state.scenarioData.dropsites) || []).forEach(ds => {
        const remHull = (ds.maxHull || 0) - (ds.damage || 0);
        const levelled = ds.destroyed || remHull <= 0;
        const ruined = !levelled && ds.maxHull && (remHull / ds.maxHull) < 0.5;
        if (!levelled && !ruined) return;
        const vp = (DROPSITE_VP[dropsiteSizeKey(ds)] || DROPSITE_VP.M).control;
        ['ucm','shal'].forEach(s => { if (distFromZoneIn(state, s, inchToPx(ds.y)) >= 24) razeVP[s] += vp; });
      });
      ['ucm','shal'].forEach(s => push(awardVP(state, s, razeVP[s], 'Raze: distant Levelled/Ruined', round)));
    }
    // Breakthrough: Red scores 1 VP per 200 pts flown off; the OTHER side scores kills.
    if (obj === 'breakthrough') {
      const flown = state.breakthroughFlyoff || { ucm: 0, shal: 0 };
      push(awardVP(state, 'ucm', Math.floor((flown.ucm || 0) / 200), `Breakthrough: ${flown.ucm} pts flown off`, round));
      push(awardVP(state, 'shal', Math.floor(state.score.shal.kp / 500) * 2, 'Breakthrough: pts destroyed', round));
    }
    // Survey: +1 VP per Dropsite Surveyed.
    if (obj === 'survey') {
      const surv = { ucm: 0, shal: 0 };
      ((state.scenarioData && state.scenarioData.dropsites) || []).forEach(ds => (ds.surveyedBy || []).forEach(s => surv[s]++));
      ['ucm','shal'].forEach(s => push(awardVP(state, s, surv[s], 'Survey', round)));
    }
    // Extract: 2 VP per Recon Operative still aboard a surviving Ship.
    if (obj === 'extract' && state.shipReconOps) {
      const ex = { ucm: 0, shal: 0 };
      Object.keys(state.shipReconOps).forEach(k => {
        const n = state.shipReconOps[k]; if (!n) return;
        const [gid, si] = k.split('#');
        const ship = state.groups[gid] && state.groups[gid].ships[parseInt(si)];
        if (ship && !ship.destroyed) ex[getDef(state, gid).side] += n * 2;
      });
      ['ucm','shal'].forEach(s => push(awardVP(state, s, ex[s], 'Recon Operatives aboard', round)));
      if (state.reconKills) ['ucm','shal'].forEach(s => push(awardVP(state, s, state.reconKills[s] || 0, 'destroyed operative-carriers', round)));
    }
    // Secondary Objectives (each side scores its one chosen scoring secondary).
    log.push(...scoreSecondaries(state, rng));
  }
  return log;
}

/* Distance (inches) of a board point from `side`'s deployment edge (its Zone).
   UCM deploys on the south edge (y≈BOARD_PX), Shaltari on the north (y≈0). */
export function distFromZoneIn(state, side, yPx) {
  const edgeY = side === 'ucm' ? BOARD_PX : 0;
  return Math.abs(yPx - edgeY) / INCH;
}

/* All valid nomination candidates for a position-based Secondary (for manual choice).
   Returns [{nom, label}]. The default (auto) nomination is the first entry. */
export function secondaryCandidates(state, side, key) {
  const enemy = side === 'ucm' ? 'shal' : 'ucm';
  const dss = (state.scenarioData && state.scenarioData.dropsites) || [];
  const out = [];
  if (key === 'key_site' || key === 'priority_target') {
    let cands = dss.filter(ds => distFromZoneIn(state, side, inchToPx(ds.y)) >= 24);
    if (key === 'priority_target') cands = cands.filter(ds => ['M','L'].includes(dropsiteSizeKey(ds)));
    cands.sort((a,b) => distFromZoneIn(state, enemy, inchToPx(a.y)) - distFromZoneIn(state, enemy, inchToPx(b.y)));
    cands.forEach(ds => out.push({ nom: { dsId: ds.id }, label: `${ds.base.name} (${dropsiteSizeKey(ds)})` }));
  } else if (key === 'long_shot') {
    dss.forEach(ds => {
      if (distFromZoneIn(state, enemy, inchToPx(ds.y)) <= 12) {
        (ds.features || []).forEach((fk, fi) => out.push({ nom: { dsId: ds.id, fi }, label: `${(FEATURES[fk]||{}).name||fk} @ ${ds.base.name}` }));
      }
    });
  } else if (key === 'objectives_beyond') {
    fleetForSide(state, side).forEach(d => { if (['M','H','C'].includes(d.tonnage)) out.push({ nom: { shipId: d.id }, label: `${d.name} (${d.tonnage})` }); });
  }
  return out;
}

/* Auto-nominate a valid target for a position-based Secondary Objective. */
export function nominateForSecondary(state, side, key) {
  const cands = secondaryCandidates(state, side, key);
  return cands.length ? cands[0].nom : null;
}

/* Is this ship the Objectives Beyond nominee, in position to fly off (within 6" of the
   opponent's Zone edge, having moved)? */
export function objectivesBeyondEligible(state, gid, si) {
  const def = getDef(state, gid);
  const side = def.side;
  const noms = state.secondaryNominations && state.secondaryNominations[side];
  const nom = noms && noms.objectives_beyond;
  if (!nom) return false;
  if (def.id.split(':').pop() !== nom.shipId.split(':').pop()) return false;
  const ship = state.groups[gid] && state.groups[gid].ships[si];
  if (!ship || ship.destroyed || ship.offTable || !ship.movedThisRound) return false;
  const enemy = side === 'ucm' ? 'shal' : 'ucm';
  return distFromZoneIn(state, enemy, ship.y) <= 6;
}

/* Breakthrough objective: a Red (UCM-slot) Ship that has moved and reached within 6"
   of the opponent's Zone edge may fly off for 1 VP per 200 pts. */
export function breakthroughFlyoffEligible(state, gid, si) {
  if (!state.scenario || state.scenario.objective !== 'breakthrough') return false;
  const def = getDef(state, gid);
  if (!def || def.side !== 'ucm') return false; // only Red flies off for Breakthrough
  const ship = state.groups[gid] && state.groups[gid].ships[si];
  if (!ship || ship.destroyed || ship.offTable || !ship.movedThisRound) return false;
  return distFromZoneIn(state, 'shal', ship.y) <= 6; // within 6" of the opponent's (north) edge
}

/* Score each side's selected Secondary Objective at game end. Returns log lines. */
export function scoreSecondaries(state, rng) {
  const log = [];
  if (!state.secondaries) return log;
  ['ucm','shal'].forEach(side => {
    const chosen = state.secondaries[side] || [];
    let best = 0, bestName = '';
    chosen.forEach(key => {
      let vp = 0;
      if (key === 'annihilate') vp = Math.min(3, Math.floor(state.score[side].kp / 500));
      else if (key === 'take_prizes') vp = Math.min(3, Math.floor((state.captured && state.captured[side] || 0) / 100));
      else if (key === 'gather_intel') {
        let n = 0; ((state.scenarioData && state.scenarioData.dropsites) || []).forEach(ds => { if (ds.surveyedBy && ds.surveyedBy.includes(side)) n++; });
        vp = Math.min(2, n);
      } else if (key === 'decapitate') {
        const enemy = side === 'ucm' ? 'shal' : 'ucm';
        vp = (state.admiralKilled && state.admiralKilled[enemy]) ? 2 : 0;
      } else if (key === 'key_site' || key === 'priority_target' || key === 'long_shot' || key === 'objectives_beyond') {
        vp = scorePositionSecondary(state, side, key);
      }
      if (vp > best) { best = vp; bestName = SECONDARY_OBJECTIVES[key] ? SECONDARY_OBJECTIVES[key].name : key; }
    });
    if (best > 0) { const l = awardVP(state, side, best, `Secondary: ${bestName}`, 6); if (l) log.push(l); }
  });
  return log;
}

/* Score a position-based Secondary from its nomination. */
export function scorePositionSecondary(state, side, key) {
  const enemy = side === 'ucm' ? 'shal' : 'ucm';
  const nom = state.secondaryNominations && state.secondaryNominations[side] && state.secondaryNominations[side][key];
  if (!nom) return 0;
  const dss = (state.scenarioData && state.scenarioData.dropsites) || [];
  const ds = nom.dsId ? dss.find(d => d.id === nom.dsId) : null;
  if (key === 'key_site' && ds) {
    if (dropsiteController(ds) !== side) return 0;
    return distFromZoneIn(state, enemy, inchToPx(ds.y)) <= 6 ? 3 : 2; // 3 VP if near opponent Zone
  }
  if (key === 'priority_target' && ds) {
    if (!ds.destroyed) return 0; // "Levelled"
    return distFromZoneIn(state, enemy, inchToPx(ds.y)) <= 6 ? 3 : 2;
  }
  if (key === 'long_shot' && ds) {
    const destroyed = (ds.destroyedFeatures || []).includes(nom.fi) || ds.destroyed;
    return destroyed ? 2 : 0;
  }
  if (key === 'objectives_beyond' && nom.shipId) {
    // Find the nominated ship; score if it flew off (offTable) and isn't crippled.
    let res = 0;
    Object.keys(state.groups).forEach(gid => {
      const def = getDef(state, gid);
      if (def.side !== side || def.id.split(':').pop() !== nom.shipId.split(':').pop()) return;
      state.groups[gid].ships.forEach(s => {
        if (s.flewOff && !s.crippledRolled) res = Math.max(res, ['H','C'].includes(def.tonnage) ? 2 : 1);
      });
    });
    return res;
  }
  return 0;
}

// ── TURN MANAGEMENT ──

export function activeGroupIdForSide(state, side) {
  const fleet = fleetForSide(state, side);
  for (const def of fleet) {
    const grp = state.groups[def.id];
    if (!grp || grp.activated) continue;
    if (grp.order || grp.ships.some(s => s.movedThisRound || s.firedThisActivation || (s.launchedThisRound > 0) || s.detectorUsed)) {
      return def.id;
    }
  }
  return null;
}

export function sideHasPendingActivation(state, side) {
  const fleet = fleetForSide(state, side);
  return fleet.some(def => {
    const grp = state.groups[def.id];
    if (!grp || grp.activated) return false;
    const onTable = grp.ships.some(s => !s.destroyed && !s.offTable);
    if (onTable) return true;
    return canActivateOffTable(state, def).eligible;
  });
}

/* Advance the active side after an activation finishes (alternate factions).
   If the other side has nothing left to activate, the same side continues. */
export function advanceActiveSide(state) {
  const other = state.activeSide === 'ucm' ? 'shal' : 'ucm';
  if (sideHasPendingActivation(state, other)) state.activeSide = other;
  else if (sideHasPendingActivation(state, state.activeSide)) { /* same side continues */ }
  else state.activeSide = null;
}

/* Roll initiative for the start of a round: a D6 per faction, reroll ties.
   Stores the result in state.initiative for the modal. */
export function rollInitiative(state, rng) {
  const baseLvl = state.admiralLevel || { ucm: 0, shal: 0 };
  // Command Ship-X raises the assigned Admiral's effective Level by X (we model the
  // Admiral as on the side's best on-table Command Ship).
  const aLvl = {
    ucm: (baseLvl.ucm || 0) + commandShipBonus(state, 'ucm'),
    shal: (baseLvl.shal || 0) + commandShipBonus(state, 'shal')
  };
  const redBonus = (aLvl.ucm >= aLvl.shal && aLvl.ucm > 0) ? 1 : 0;
  const blueBonus = (aLvl.shal >= aLvl.ucm && aLvl.shal > 0) ? 1 : 0;
  let red, blue, rRaw, bRaw;
  do {
    rRaw = 1 + Math.floor(rng() * 6);
    bRaw = 1 + Math.floor(rng() * 6);
    red = rRaw + redBonus; blue = bRaw + blueBonus;
  } while (red === blue);
  // AP generation: 1 + Admiral Level per side.
  const ap = { ucm: 1 + (aLvl.ucm || 0), shal: 1 + (aLvl.shal || 0) };
  // Comms Uplink: +1 AP if you Control a Dropsite with a working Comms Station.
  if (sideHasCommsUplink(state, 'ucm')) ap.ucm += 1;
  if (sideHasCommsUplink(state, 'shal')) ap.shal += 1;
  // Pass Tokens: a side 2+ Groups fewer than the leader gets 1, +1 per further fewer.
  const groupCount = (side) => fleetForSide(state, side).filter(def => {
    const g = state.groups[def.id];
    return g && g.ships.some(s => !s.destroyed && (!s.offTable || canDeployNow(state, def)));
  }).length;
  const gc = { ucm: groupCount('ucm'), shal: groupCount('shal') };
  const most = Math.max(gc.ucm, gc.shal);
  const passTokens = { ucm: Math.max(0, (most - gc.ucm) - 1), shal: Math.max(0, (most - gc.shal) - 1) };
  state.planning = { ap, passTokens, gc, aLvl };
  state.initiative = {
    red, blue, rRaw, bRaw, redBonus, blueBonus,
    winner: red > blue ? 'ucm' : 'shal',
    holder: red > blue ? 'ucm' : 'shal',
    round: state.round
  };
}

// ── SECTION C: ASSET AND DROPSITE LOGIC ──

/* Apply scenery damage to a launched asset (mover) that crossed scenery between
   (origX,origY) and (mover.x,mover.y). Returns the count of removed token(s). */
export function applyAssetScenery(state, rng, mover, origX, origY) {
  const sd = state.scenarioData;
  if (!sd) return 0;
  const thresholds = [];
  (sd.largeObjects||[]).forEach(o => { if (largeObjectAt(state, mover.x, mover.y) || segCrossesCircle(origX, origY, mover.x, mover.y, inchToPx(o.x), inchToPx(o.y), inchToPx(o.diameter/2))) thresholds.push(1); });
  (sd.rings||[]).forEach(r => { if (segCrossesRing(origX, origY, mover.x, mover.y, r)) thresholds.push(2); });
  (sd.placedScenery||[]).forEach(s => { if (segCrossesRect(origX, origY, mover.x, mover.y, inchToPx(s.x), inchToPx(s.y), inchToPx(6), inchToPx(3), s.angle||0)) thresholds.push(s.type==='dense'?5:3); });
  if (!thresholds.length) return 0;
  const need = Math.min(...thresholds);
  let survivors = 0;
  for (let i = 0; i < mover.count; i++) { if (need === 1 || rollDie(rng) < need) { /* removed */ } else survivors++; }
  const removed = mover.count - survivors;
  mover.count = survivors;
  return removed;
}

/* Close Protection: friendly Fighter Wings within Fighter Thrust range of a ship at
   (x,y). Returns [{id, count}] for Wings of `side` with count>0. */
export function friendlyFightersInRange(state, side, x, y) {
  const thrPx = (assetProfile(state, side, 'fighter').thrust || 12) * INCH;
  return (state.launchedAssets || [])
    .filter(a => a.kind === 'fighter' && a.side === side && a.count > 0 &&
                 Math.hypot(a.x - x, a.y - y) <= thrPx)
    .map(a => ({ id: a.id, count: a.count }));
}

/* Battalion storage on a dropsite. Lazily initialised. */
export function dsBattalions(ds) {
  if (!ds.battalions) {
    ds.battalions = { ground: { ucm: 0, shal: 0 } };
    (ds.features || []).forEach((fk, fi) => { ds.battalions['feat' + fi] = { ucm: 0, shal: 0 }; });
  }
  return ds.battalions;
}

/* Total enemy battalions on a dropsite (relative to a given side) across all locations. */
export function dsEnemyBattalions(ds, side) {
  const enemy = side === 'ucm' ? 'shal' : 'ucm';
  const b = dsBattalions(ds);
  return Object.values(b).reduce((sum, loc) => sum + (loc[enemy] || 0), 0);
}

/* All battalions of a side on a dropsite. */
export function dsSideBattalions(ds, side) {
  const b = dsBattalions(ds);
  return Object.values(b).reduce((sum, loc) => sum + (loc[side] || 0), 0);
}

/* Friendly readable location name for a dropsite location key. */
export function locDisplayName(ds, key) {
  if (key === 'ground') return `${ds.base.name} (ground)`;
  const fi = parseInt(key.replace('feat', ''));
  const fk = ds.features[fi];
  const f = FEATURES[fk];
  return `${f.glyph ? f.glyph + ' ' : ''}${f.name}`;
}

/* Resolve Battalion Combat for all dropsites (Asset Phase step 1). */
export function resolveBattalionCombat(state) {
  const log = [];
  if (!state.scenarioData || !state.scenarioData.dropsites) return log;
  state.scenarioData.dropsites.forEach(ds => {
    const b = dsBattalions(ds);
    Object.keys(b).forEach(key => {
      const loc = b[key];
      const u = loc.ucm || 0, s = loc.shal || 0;
      if (u > 0 && s > 0) {
        const removed = Math.min(u, s);
        loc.ucm = u - removed;
        loc.shal = s - removed;
        log.push({ where: locDisplayName(ds, key), removed, u, s, nu: loc.ucm, ns: loc.shal });
      }
    });
  });
  return log;
}

/* Aegis-X: the best Aegis value protecting a target group. */
export function aegisValueForGroup(state, targetGid) {
  const tg = state.groups[targetGid];
  if (!tg) return 0;
  const tdef = getDef(state, targetGid);
  const tside = tdef.side;
  const tShip = tg.ships.find(s => !s.destroyed && !s.offTable);
  if (!tShip) return 0;
  const tLayer = tShip.layer || 'orbit';
  let best = 0;
  Object.keys(state.groups).forEach(gid => {
    const def = getDef(state, gid);
    if (def.side !== tside) return;
    const m = (def.special || '').match(/Aegis-(\d)/i);
    if (!m) return;
    const y = parseInt(m[1]);
    const src = state.groups[gid].ships.find(s => !s.destroyed && !s.offTable && (s.layer||'orbit') === tLayer);
    if (src && Math.hypot(src.x - tShip.x, src.y - tShip.y) <= 6 * INCH) best = Math.max(best, y);
  });
  ((state.scenarioData && state.scenarioData.dropsites) || []).forEach(ds => {
    if (ds.destroyed) return;
    const hasAegis = (ds.features || []).some((fk, fi) => fk === 'aegis_platform' && !(ds.destroyedFeatures||[]).includes(fi));
    if (!hasAegis) return;
    if (dropsiteController(ds) !== tside) return;
    if (tLayer !== 'orbit') return;
    if (Math.hypot(inchToPx(ds.x) - tShip.x, inchToPx(ds.y) - tShip.y) <= 6 * INCH) best = Math.max(best, 4);
  });
  return best;
}

/* A Dropsite within 6" of `ship` that hasn't been surveyed by `side`. Returns it or null. */
export function surveyableDropsite(state, ship, side) {
  const dss = (state.scenarioData && state.scenarioData.dropsites) || [];
  for (const ds of dss) {
    if (ds.destroyed) continue;
    if (ds.surveyedBy && ds.surveyedBy.includes(side)) continue;
    if (Math.hypot(ship.x - inchToPx(ds.x), ship.y - inchToPx(ds.y)) <= 6 * INCH) return ds;
  }
  return null;
}

/* Transport VALUE of a ship — largest launch `n` among ground-transport assets. */
export function transportValue(def) {
  if (!def.launch) return 0;
  let v = 0;
  def.launch.forEach(l => { if (/lander|dropship|drop_pod|boarding_pod|gate_dropship/i.test(l.type)) v = Math.max(v, l.n || 0); });
  return v;
}

/* A Dropsite within 6" of `ship` that still holds Recon Operatives. Returns it or null. */
export function extractableDropsite(state, ship, side) {
  const dss = (state.scenarioData && state.scenarioData.dropsites) || [];
  for (const ds of dss) {
    if (ds.destroyed || !(ds.reconOps > 0)) continue;
    if (Math.hypot(ship.x - inchToPx(ds.x), ship.y - inchToPx(ds.y)) <= 6 * INCH) return ds;
  }
  return null;
}

/* A dropsite is "contested" if both sides have any battalions on it. */
export function dropsiteContested(ds) {
  return dsSideBattalions(ds, 'ucm') > 0 && dsSideBattalions(ds, 'shal') > 0;
}

/* Which side Controls a dropsite. Returns 'ucm' | 'shal' | null. */
export function dropsiteController(ds) {
  const u = dsSideBattalions(ds, 'ucm'), s = dsSideBattalions(ds, 'shal');
  if (u > 0 && s === 0) return 'ucm';
  if (s > 0 && u === 0) return 'shal';
  return null;
}

/* Launchable features on a dropsite (those with a `launch` profile). */
export function dropsiteLaunchFeatures(ds) {
  const out = [];
  (ds.features || []).forEach((fk, fi) => {
    const f = FEATURES[fk];
    if (f && f.launch && f.launch.length && !(ds.destroyedFeatures||[]).includes(fi)) {
      out.push({ fi, fk, f });
    }
  });
  return out;
}

/* Features on a dropsite with a weapon. */
export function dropsiteWeaponFeatures(ds) {
  const out = [];
  (ds.features || []).forEach((fk, fi) => {
    const f = FEATURES[fk];
    if (f && f.weapon && !(ds.destroyedFeatures||[]).includes(fi)) out.push({ fi, fk, f });
  });
  return out;
}

/* An eligible Escort Group for a hit on (gid,si). Returns {gid,name} or null. */
export function eligibleEscort(state, targetGid, targetSi) {
  const tdef = getDef(state, targetGid);
  if (!tdef || !['H','C'].includes(tdef.tonnage)) return null;
  const tShip = state.groups[targetGid] && state.groups[targetGid].ships[targetSi];
  if (!tShip || tShip.destroyed) return null;
  const side = tdef.side, tLayer = tShip.layer || 'orbit';
  let found = null;
  fleetForSide(state, side).forEach(def => {
    if (found || !/Escort/i.test(def.special || '') || def.id === targetGid) return;
    const grp = state.groups[def.id];
    if (!grp) return;
    const src = grp.ships.find(s => !s.destroyed && !s.offTable && (s.layer||'orbit') === tLayer);
    if (src && Math.hypot(src.x - tShip.x, src.y - tShip.y) <= 6 * INCH) found = { gid: def.id, name: def.name };
  });
  return found;
}

/* Highest Command Ship-X among `side`'s on-table, non-destroyed ships (0 if none). */
export function commandShipBonus(state, side) {
  let best = 0;
  fleetForSide(state, side).forEach(def => {
    const m = (def.special || '').match(/Command Ship-(\d)/i);
    if (!m) return;
    const grp = state.groups[def.id];
    if (grp && grp.ships.some(s => !s.destroyed && !s.offTable)) best = Math.max(best, parseInt(m[1]));
  });
  return best;
}

/* Does `side` Control a dropsite with a working Comms Station? */
export function sideHasCommsUplink(state, side) {
  return ((state.scenarioData && state.scenarioData.dropsites) || []).some(ds => {
    if (ds.destroyed || dropsiteController(ds) !== side) return false;
    return (ds.features || []).some((fk, fi) => fk === 'comms_station' && !(ds.destroyedFeatures||[]).includes(fi));
  });
}

/* Remove a feature from a dropsite. Power Plant is Volatile. */
export function destroyFeature(state, rng, ds, fi) {
  ds.destroyedFeatures = ds.destroyedFeatures || [];
  if (ds.destroyedFeatures.includes(fi)) return;
  const fkey = ds.features[fi];
  ds.destroyedFeatures.push(fi);
  if (fkey === 'power_plant') {
    const dsx = inchToPx(ds.x), dsy = inchToPx(ds.y);
    Object.keys(state.groups).forEach(gid => {
      const g = state.groups[gid];
      if (g.ships.some(s => !s.destroyed && !s.offTable && Math.hypot(s.x - dsx, s.y - dsy) <= 3 * INCH)) g.spikes = (g.spikes || 0) + 1;
    });
    const extra = (Math.ceil(rollDie(rng)/2) + Math.ceil(rollDie(rng)/2)); // 2D3
    ds.damage = (ds.damage || 0) + extra;
    if (ds.maxHull && ds.damage >= ds.maxHull) ds.destroyed = true;
  }
}

/* All contested dropsites not yet resolved this combat. */
export function contestedDropsites(state) {
  if (!state.scenarioData || !state.scenarioData.dropsites) return [];
  const done = (state.battalionCombat && state.battalionCombat.done) || [];
  return state.scenarioData.dropsites.filter(ds => dropsiteContested(ds) && !done.includes(ds.id));
}

/* Features on a dropsite that hold ENEMY battalions (relative to `side`). */
export function enemyFeatures(ds, side) {
  const enemy = side === 'ucm' ? 'shal' : 'ucm';
  const b = dsBattalions(ds);
  return Object.keys(b).filter(k => k !== 'ground' && (b[k][enemy] || 0) > 0);
}

/* Stage 1/2: a side's GROUND battalions attack one Feature; 1-for-1 removal. */
export function assignGroundToFeature(ds, side, featKey) {
  const enemy = side === 'ucm' ? 'shal' : 'ucm';
  const b = dsBattalions(ds);
  const removed = Math.min(b.ground[side] || 0, b[featKey][enemy] || 0);
  b.ground[side] -= removed;
  b[featKey][enemy] -= removed;
  return { removed, where: locDisplayName(ds, featKey) };
}

/* Stages 3+4: remaining 1-for-1 on the ground, then each feature locally. */
export function resolveDropsiteRemainder(ds) {
  const b = dsBattalions(ds);
  const log = [];
  Object.keys(b).forEach(key => {
    const loc = b[key];
    const u = loc.ucm || 0, s = loc.shal || 0;
    if (u > 0 && s > 0) {
      const removed = Math.min(u, s);
      loc.ucm = u - removed; loc.shal = s - removed;
      log.push({ where: locDisplayName(ds, key), removed });
    }
  });
  return log;
}

/* Finish a dropsite: resolve remaining combat, mark it done, return to pick stage. */
export function bcResolveDropsite(state, bc, ds) {
  const rem = resolveDropsiteRemainder(ds);
  rem.forEach(r => bc.log.push(`${ds.base.name}: ${r.where} remainder — ${r.removed} each`));
  bc.done = bc.done || [];
  if (!bc.done.includes(ds.id)) bc.done.push(ds.id);
  bc.dsId = null;
  bc.stage = 'pick';
}

/* Features eligible to be destroyed: 4+ friendly battalions, no enemy present. */
export function featureDestroyOptions(state) {
  const opts = [];
  if (!state.scenarioData) return opts;
  state.scenarioData.dropsites.forEach(ds => {
    const b = dsBattalions(ds);
    Object.keys(b).forEach(key => {
      if (key === 'ground') return;
      const loc = b[key];
      ['ucm', 'shal'].forEach(side => {
        const enemy = side === 'ucm' ? 'shal' : 'ucm';
        if ((loc[side] || 0) >= 4 && (loc[enemy] || 0) === 0) {
          opts.push({ dsId: ds.id, key, side, name: locDisplayName(ds, key) });
        }
      });
    });
  });
  return opts;
}

/* Effective signature (inches) for a ship. */
export function effectiveSig(def, ship, grp) {
  const base = ship && ship.sigSilent ? 0 : def.sig;
  const spikes = grp ? (grp.spikes || 0) : 0;
  return base + 3 * spikes;
}

export function launchTargetLabel(target) {
  return {
    dropsite_same_layer: 'target dropsite (same layer)',
    dropsite_via_gate:   'target dropsite via Voidgate chain',
    dropsite_any_layer:  'target dropsite (any layer)',
    city:                'target city',
    ship_or_station:     'target enemy ship / station',
    point:               'place on map'
  }[target] || 'target';
}

export function launchHint(target) {
  return {
    dropsite_same_layer: 'Click a dropsite in range on the SAME orbital layer',
    dropsite_via_gate:   'Click a dropsite within 3" of a chained Voidgate',
    dropsite_any_layer:  'Click any dropsite in range',
    city:                'Click a city in range',
    ship_or_station:     'Click an enemy ship or space station in range',
    point:               'Click a point in range to place the asset'
  }[target] || 'Click a target in range';
}

/* All friendly Voidgates (Gateships) connected to a Mothership via the 18" chain (BFS). */
export function connectedGateships(state, motherSide, motherX, motherY) {
  const CHAIN_IN = 18, CHAIN_PX = CHAIN_IN * INCH;
  const gates = [];
  fleetForSide(state, motherSide).forEach(def => {
    if (!def.openNetwork) return;
    const grp = state.groups[def.id];
    if (!grp) return;
    grp.ships.forEach((s, si) => {
      if (s.destroyed || s.offTable) return;
      gates.push({ ship: s, def, si, x: s.x, y: s.y, layer: s.layer || 'orbit',
                   gateship: def.gateship || 0, connected: false });
    });
  });
  const queue = [];
  gates.forEach(g => {
    if (Math.hypot(g.x - motherX, g.y - motherY) <= CHAIN_PX) { g.connected = true; queue.push(g); }
  });
  while (queue.length) {
    const cur = queue.shift();
    gates.forEach(g => {
      if (!g.connected && Math.hypot(g.x - cur.x, g.y - cur.y) <= CHAIN_PX) {
        g.connected = true; queue.push(g);
      }
    });
  }
  return gates.filter(g => g.connected);
}

/* Remaining Gateship value for a Voidgate ship this round (lazily init). */
export function gateRemaining(gateShip, def) {
  if (gateShip.gateRemaining === undefined) gateShip.gateRemaining = def.gateship || 0;
  return gateShip.gateRemaining;
}

/* Compute effective move range and resulting layer for a ship's move. */
export function layerMove(normalMaxPx, ship, toggle) {
  const layer = ship.layer || 'orbit';
  if (layer === 'orbit') {
    if (toggle) return { maxPx: normalMaxPx, endLayer: 'atmosphere', label: 'Descend to Atmosphere (end of move)' };
    return { maxPx: normalMaxPx, endLayer: 'orbit', label: null };
  } else { // atmosphere
    if (toggle) {
      const reduced = Math.max(0, normalMaxPx - 4 * INCH);
      return { maxPx: reduced, endLayer: 'orbit', label: 'Ascend to Orbit (−4" this move)' };
    }
    return { maxPx: 2 * INCH, endLayer: 'atmosphere', label: 'In Atmosphere (move capped 2")' };
  }
}

/* Are all alive on-table ships in a group in the same layer? Returns split info. */
export function groupLayerSplit(state, def) {
  const grp = getGroup(state, def.id);
  let orbit = 0, atmo = 0;
  grp.ships.forEach(s => {
    if (s.destroyed || s.offTable) return;
    if ((s.layer || 'orbit') === 'atmosphere') atmo++; else orbit++;
  });
  return { split: orbit > 0 && atmo > 0, orbit, atmo };
}

/* All other on-table ships' base circles, excluding (skipGid, skipSi). */
export function otherShipBases(state, skipGid, skipSi) {
  const out = [];
  allDefs(state).forEach(d => {
    const g = state.groups[d.id];
    if (!g) return;
    const r = inchToPx(d.base === 'L' ? 16/25.4 : d.base === 'M' ? 20/25.4 : d.base === 'H' ? 25/25.4 : 16/25.4);
    g.ships.forEach((s, si) => {
      if (s.destroyed || s.offTable) return;
      if (d.id === skipGid && si === skipSi) return;
      out.push({ x: s.x, y: s.y, r });
    });
  });
  if (state.scenarioData && state.scenarioData.dropsites) {
    const stationDiaIn = { small: 30/25.4, medium: 40/25.4, large: 50/25.4 };
    state.scenarioData.dropsites.forEach(ds => {
      if (ds.base.category !== 'station') return;
      const r = (stationDiaIn[ds.base.size] * INCH) / 2;
      out.push({ x: inchToPx(ds.x), y: inchToPx(ds.y), r });
    });
  }
  return out;
}

/* Does a base of radius r at (x,y) overlap any of the given bases? */
export function baseOverlaps(x, y, r, bases) {
  return bases.some(b => Math.hypot(x - b.x, y - b.y) < (r + b.r - 0.01));
}

/* Back a moving ship (radius r) toward origin until its base no longer overlaps any other. */
export function resolveBaseOverlap(ox, oy, tx, ty, r, bases) {
  if (!baseOverlaps(tx, ty, r, bases)) return { x: tx, y: ty };
  const dx = tx - ox, dy = ty - oy;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return { x: tx, y: ty };
  const step = 1; // px
  for (let d = len; d >= 0; d -= step) {
    const t = d / len;
    const x = ox + dx * t, y = oy + dy * t;
    if (!baseOverlaps(x, y, r, bases)) return { x, y };
  }
  return { x: ox, y: oy };
}

// ── SECTION D: GEOMETRY UTILITIES ──

/* Is a point (xIn, yIn) inside the given zone (inch coords)? */
export function isInZone(xIn, yIn, zone) {
  if (zone.polygon) return pointInPolygon(xIn, yIn, zone.polygon);
  if (zone.circle) {
    const c = zone.circle;
    return Math.hypot(xIn - c.cx, yIn - c.cy) <= c.r;
  }
  if (zone.circleQuad) {
    const c = zone.circleQuad;
    const dx = xIn - c.cx, dy = yIn - c.cy;
    if (Math.hypot(dx, dy) > c.r) return false;
    if (c.quad === 'br') return dx >= 0 && dy >= 0;
    if (c.quad === 'tl') return dx <= 0 && dy <= 0;
    if (c.quad === 'tr') return dx >= 0 && dy <= 0;
    if (c.quad === 'bl') return dx <= 0 && dy >= 0;
  }
  if (zone.edgeSemicircle) {
    const c = zone.edgeSemicircle;
    if (Math.hypot(xIn - c.cx, yIn - c.cy) > c.r) return false;
    if (c.edge === 'top')    return yIn >= c.cy;
    if (c.edge === 'bottom') return yIn <= c.cy;
    if (c.edge === 'left')   return xIn >= c.cx;
    if (c.edge === 'right')  return xIn <= c.cx;
  }
  if (zone.corners) return zone.corners.some(cz => isInZone(xIn, yIn, { circleQuad: cz }));
  if (zone.edgeLines) {
    return zone.edgeLines.some(seg => distancePointToSegmentIn(xIn, yIn, seg) <= 0.6);
  }
  return false;
}

/* Distance from point (px,py) in inches to a segment {x1,y1,x2,y2} in inches. */
export function distancePointToSegmentIn(px, py, seg) {
  const vx = seg.x2 - seg.x1, vy = seg.y2 - seg.y1;
  const wx = px - seg.x1,   wy = py - seg.y1;
  const len2 = vx*vx + vy*vy;
  if (len2 === 0) return Math.hypot(wx, wy);
  let t = (wx*vx + wy*vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = seg.x1 + t*vx, cy = seg.y1 + t*vy;
  return Math.hypot(px - cx, py - cy);
}

/* True if a point is inside the Vanguard halo for a given def + base zone. */
export function isInVanguardZone(state, xIn, yIn, def, baseZone) {
  if (!def.vanguard || !state.scenario) return false;
  const X = def.vanguard;
  const depKey = state.scenario.deployment;
  let z = {};
  if (depKey === 'line' && baseZone.edgeLines) {
    z.polygon = stripFromEdgeLine(baseZone.edgeLines[0], X);
  } else if (depKey === 'attacker_defender') {
    if (baseZone.edgeLines) {
      z.polygon = stripFromEdgeLine(baseZone.edgeLines[0], X);
    } else if (baseZone.polygon) {
      z.polygon = expandStripPolygon(baseZone.polygon, X);
    }
  } else if (depKey === 'table_corners' && baseZone.edgeLines) {
    const polys = baseZone.edgeLines.map(seg => stripFromEdgeLine(seg, X));
    return polys.some(p => pointInPolygon(xIn, yIn, p));
  } else if (depKey === 'midboard' && baseZone.edgeSemicircle) {
    z.edgeSemicircle = { ...baseZone.edgeSemicircle, r: baseZone.edgeSemicircle.r + X };
  } else if (depKey === 'from_corners' && baseZone.circleQuad) {
    z.circleQuad = { ...baseZone.circleQuad, r: baseZone.circleQuad.r + X };
  } else if (depKey === 'encirclement') {
    if (baseZone.circle)  z.circle  = { ...baseZone.circle,  r: baseZone.circle.r  + X };
    if (baseZone.corners) z.corners = baseZone.corners.map(c => ({ ...c, r: c.r + X }));
  }
  return isInZone(xIn, yIn, z);
}

/* Build a strip polygon X" deep extending into the board from an edge segment. */
export function stripFromEdgeLine(seg, X) {
  const onTop    = seg.y1 <= 0.5 && seg.y2 <= 0.5;
  const onBottom = seg.y1 >= BOARD_IN - 0.5 && seg.y2 >= BOARD_IN - 0.5;
  const onLeft   = seg.x1 <= 0.5 && seg.x2 <= 0.5;
  const onRight  = seg.x1 >= BOARD_IN - 0.5 && seg.x2 >= BOARD_IN - 0.5;
  if (onTop) {
    const x1 = Math.min(seg.x1, seg.x2), x2 = Math.max(seg.x1, seg.x2);
    return [{x:x1,y:0},{x:x2,y:0},{x:x2,y:X},{x:x1,y:X}];
  } else if (onBottom) {
    const x1 = Math.min(seg.x1, seg.x2), x2 = Math.max(seg.x1, seg.x2);
    return [{x:x1,y:BOARD_IN},{x:x2,y:BOARD_IN},{x:x2,y:BOARD_IN-X},{x:x1,y:BOARD_IN-X}];
  } else if (onLeft) {
    const y1 = Math.min(seg.y1, seg.y2), y2 = Math.max(seg.y1, seg.y2);
    return [{x:0,y:y1},{x:0,y:y2},{x:X,y:y2},{x:X,y:y1}];
  } else if (onRight) {
    const y1 = Math.min(seg.y1, seg.y2), y2 = Math.max(seg.y1, seg.y2);
    return [{x:BOARD_IN,y:y1},{x:BOARD_IN,y:y2},{x:BOARD_IN-X,y:y2},{x:BOARD_IN-X,y:y1}];
  }
  return [];
}

/* Expand an axis-aligned strip polygon's inner edge X" further into the board. */
export function expandStripPolygon(polygon, X) {
  const cxAvg = polygon.reduce((s,p)=>s+p.x,0)/polygon.length;
  const cyAvg = polygon.reduce((s,p)=>s+p.y,0)/polygon.length;
  return polygon.map(p => {
    const onLeft   = p.x <= 1.6;
    const onRight  = p.x >= BOARD_IN - 1.6;
    const onTop    = p.y <= 1.6;
    const onBottom = p.y >= BOARD_IN - 1.6;
    let nx = p.x, ny = p.y;
    if (!onLeft && !onRight)  nx = (cxAvg < BOARD_IN/2) ? p.x + X : p.x - X;
    if (!onTop  && !onBottom) ny = (cyAvg < BOARD_IN/2) ? p.y + X : p.y - X;
    return { x: nx, y: ny };
  });
}

/* Ray-casting point-in-polygon test. Polygon uses inch coordinates. */
export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/* Do two segments (px) intersect? */
export function segsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx-ax)*(dy-cy) - (by-ay)*(dx-cx);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((cx-ax)*(dy-cy) - (cy-ay)*(dx-cx)) / d;
  const u = ((cx-ax)*(by-ay) - (cy-ay)*(bx-ax)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/* Does a segment cross a rotated rectangle (cloud/field), in px? */
export function segCrossesRect(ax, ay, bx, by, cx, cy, wpx, hpx, angleDeg) {
  const rad = -angleDeg * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const tx = (x, y) => ({ x: (x-cx)*cos - (y-cy)*sin, y: (x-cx)*sin + (y-cy)*cos });
  const p = tx(ax, ay), q = tx(bx, by);
  const hw = wpx/2, hh = hpx/2;
  const inside = (pt) => pt.x >= -hw && pt.x <= hw && pt.y >= -hh && pt.y <= hh;
  if (inside(p) || inside(q)) return true;
  const edges = [[-hw,-hh,hw,-hh],[hw,-hh,hw,hh],[hw,hh,-hw,hh],[-hw,hh,-hw,-hh]];
  return edges.some(e => segsIntersect(p.x,p.y,q.x,q.y, e[0],e[1],e[2],e[3]));
}

/* Does a segment cross a planetary ring (a full-board line)? */
export function segCrossesRing(ax, ay, bx, by, ring) {
  if (ring.axis === 'horizontal') { const ry = inchToPx(ring.y); return (ay - ry) * (by - ry) <= 0; }
  const rx = inchToPx(ring.x); return (ax - rx) * (bx - rx) <= 0;
}

/* Does a segment cross/enter a circle (large object), in px? */
export function segCrossesCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx-ax, dy = by-ay; const len2 = dx*dx+dy*dy || 1;
  let t = ((cx-ax)*dx + (cy-ay)*dy) / len2; t = Math.max(0, Math.min(1, t));
  const px = ax + t*dx, py = ay + t*dy;
  return Math.hypot(px-cx, py-cy) <= r;
}

/* Is a point inside any large object? (px) Returns the object, or null. */
export function largeObjectAt(state, xpx, ypx) {
  const objs = (state.scenarioData && state.scenarioData.largeObjects) || [];
  for (const o of objs) { if (Math.hypot(xpx - inchToPx(o.x), ypx - inchToPx(o.y)) <= inchToPx(o.diameter/2)) return o; }
  return null;
}

/* Analyse a LoS line (attacker→target, px). Returns scenery effects: {blocked, ignoreSpikes, ignoreSig}. */
export function sceneryAttackEffects(state, ax, ay, bx, by, attackerShip, targetShip) {
  const res = { blocked: false, ignoreSpikes: false, ignoreSig: false };
  const sd = state.scenarioData; if (!sd) return res;
  const bothAtmo = (attackerShip && attackerShip.layer === 'atmosphere') && (targetShip && targetShip.layer === 'atmosphere');
  if (bothAtmo) return res;
  (sd.largeObjects || []).forEach(o => {
    if (segCrossesCircle(ax, ay, bx, by, inchToPx(o.x), inchToPx(o.y), inchToPx(o.diameter/2))) res.blocked = true;
  });
  (sd.rings || []).forEach(r => { if (segCrossesRing(ax, ay, bx, by, r)) res.ignoreSpikes = true; });
  (sd.placedScenery || []).forEach(s => {
    if (segCrossesRect(ax, ay, bx, by, inchToPx(s.x), inchToPx(s.y), inchToPx(6), inchToPx(3), s.angle||0)) {
      res.ignoreSpikes = true;
      if (s.type === 'dense') res.ignoreSig = true;
    }
  });
  return res;
}

/* Ship move-through hits: returns [{type:'K'|'C', n:2, label}] for each cloud/field crossed (orbit only). */
export function sceneryMoveHits(state, ax, ay, bx, by, ship) {
  const out = []; const sd = state.scenarioData;
  if (!sd || (ship && ship.layer === 'atmosphere')) return out;
  (sd.placedScenery || []).forEach(s => {
    if (segCrossesRect(ax, ay, bx, by, inchToPx(s.x), inchToPx(s.y), inchToPx(6), inchToPx(3), s.angle||0)) {
      if (s.type === 'micrometeor') out.push({ type: 'K', n: 2, label: 'Micrometeor Cloud' });
      else out.push({ type: 'C', n: 2, label: 'Dense Field' });
    }
  });
  return out;
}

/* Distance (inches) from a point to a deployment zone's geometry. 0 if inside. */
export function distToZone(zone, x, y) {
  if (!zone) return Infinity;
  const distToSeg = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx*dx + dy*dy || 1;
    let t = ((px - x1)*dx + (py - y1)*dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t*dx), py - (y1 + t*dy));
  };
  let best = Infinity;
  if (zone.edgeLines) zone.edgeLines.forEach(l => { best = Math.min(best, distToSeg(x, y, l.x1, l.y1, l.x2, l.y2)); });
  if (zone.circle) { const c = zone.circle; best = Math.min(best, Math.max(0, Math.hypot(x-c.cx, y-c.cy) - c.r)); }
  if (zone.circleQuad) { const c = zone.circleQuad; best = Math.min(best, Math.max(0, Math.hypot(x-c.cx, y-c.cy) - c.r)); }
  if (zone.edgeSemicircle) { const c = zone.edgeSemicircle; best = Math.min(best, Math.max(0, Math.hypot(x-c.cx, y-c.cy) - c.r)); }
  if (zone.corners) zone.corners.forEach(c => { best = Math.min(best, Math.max(0, Math.hypot(x-c.cx, y-c.cy) - c.r)); });
  if (zone.polygon) {
    const pts = zone.polygon; let inside = false;
    for (let i = 0, j = pts.length-1; i < pts.length; j = i++) {
      if (((pts[i].y > y) !== (pts[j].y > y)) &&
          (x < (pts[j].x - pts[i].x) * (y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x)) inside = !inside;
    }
    if (inside) best = 0;
    else for (let i = 0, j = pts.length-1; i < pts.length; j = i++)
      best = Math.min(best, distToSeg(x, y, pts[j].x, pts[j].y, pts[i].x, pts[i].y));
  }
  return best;
}

/* Validate a candidate scenery position (in inches). Returns {ok, reason}. */
export function sceneryValid(state, type, xIn, yIn) {
  const MIN = 4;
  if (xIn < MIN || yIn < MIN || xIn > BOARD_IN - MIN || yIn > BOARD_IN - MIN)
    return { ok: false, reason: 'too close to board edge (4")' };
  const dep = state.scenario && DEPLOYMENTS[state.scenario.deployment];
  if (dep) {
    for (const z of [dep.zones.red, dep.zones.blue]) {
      if (z && distToZone(z, xIn, yIn) < MIN) return { ok: false, reason: 'too close to a deployment zone (4")' };
    }
  }
  for (const s of (state.scenarioData.placedScenery || [])) {
    if (s.type === type) continue;
    if (Math.hypot(s.x - xIn, s.y - yIn) < MIN) return { ok: false, reason: 'too close to other scenery (4")' };
  }
  for (const obj of (state.scenarioData.largeObjects || [])) {
    if (Math.hypot(obj.x - xIn, obj.y - yIn) < obj.diameter / 2 + MIN) return { ok: false, reason: 'too close to a large object (4")' };
  }
  return { ok: true };
}

// ── SECTION E: DEPLOYMENT LOGIC ──

/* Can a group deploy during the deploy phase right now? */
export function canDeployNow(state, def) {
  if (def.vanguard) return true;
  return approachFor(state, def.side) === 'directly_deploy';
}

/* Can an undeployed Group activate (and arrive) THIS round? */
export function canActivateOffTable(state, def) {
  if (!state.scenario) return { eligible: false, reason: 'No scenario' };
  const app = approachFor(state, def.side);
  const r = state.round;
  if (app === 'directly_deploy') {
    if (r >= 2) return { eligible: true };
    return { eligible: false, reason: 'Direct: available from Round 2' };
  }
  if (app === 'close') {
    return { eligible: true };
  }
  if (app === 'distant') {
    if (def.vanguard) return { eligible: true };
    const t = def.tonnage;
    if (r >= 3) return { eligible: true };
    if (r === 2 && (t === 'L' || t === 'M')) return { eligible: true };
    if (r === 1 && t === 'L') return { eligible: true };
    const tName = t === 'L' ? 'Light' : t === 'M' ? 'Medium' : t === 'H' ? 'Heavy' : 'Colossal';
    const arriveR = t === 'M' ? 2 : 3;
    return { eligible: false, reason: `Distant ${tName}: available from Round ${arriveR}` };
  }
  return { eligible: false, reason: 'Unknown approach' };
}

/* Is this Group currently undeployed (no alive ships on-table)? */
export function isGroupUndeployed(state, gid) {
  const grp = state.groups[gid];
  if (!grp) return false;
  return !grp.ships.some(s => !s.destroyed && !s.offTable);
}

/* Direct deployment 50% status for a side. Returns { eligible, placed, required } or null. */
export function directDeploymentStatus(state, side) {
  if (approachFor(state, side) !== 'directly_deploy') return null;
  const fleet = fleetForSide(state, side);
  const nonVg = fleet.filter(d => !d.vanguard);
  const placed = nonVg.filter(def => {
    const grp = state.groups[def.id];
    if (!grp) return false;
    return grp.ships.some(s => !s.destroyed && !s.offTable);
  }).length;
  const required = Math.ceil(nonVg.length / 2);
  return { eligible: nonVg.length, placed, required };
}

/* Return the approach type for a side given the current scenario. */
export function approachFor(state, side) {
  if (!state.scenario) return 'close';
  const app = APPROACHES[state.scenario.approach];
  return side === 'ucm' ? app.red : app.blue;
}

/* Count of still-undeployed deploy-eligible Groups for a side. */
export function undeployedDeployableCount(state, side) {
  return fleetForSide(state, side).filter(def => {
    if (!canDeployNow(state, def)) return false;
    const grp = state.groups[def.id];
    if (!grp) return false;
    return grp.ships.some(s => !s.destroyed && s.offTable);
  }).length;
}

/* Is a side allowed to deploy right now? Red goes first. */
export function deploySideAllowed(state, side) {
  if (state.phase !== 'deploy') return true;
  if (state.deployDone[side]) return false;
  if (side === 'ucm') return true;
  return state.deployDone.ucm === true;
}

/* Does the current scenario require a manual deploy phase? */
export function anyoneNeedsDeployPhase(state) {
  if (!state.scenario) return true;
  const redApp  = approachFor(state, 'ucm');
  const blueApp = approachFor(state, 'shal');
  if (redApp === 'directly_deploy' || blueApp === 'directly_deploy') return true;
  const _allDefs = allDefs(state);
  if (_allDefs.some(d => d.vanguard)) return true;
  return false;
}

/* Mark every ship as off-table. */
export function initShipsOffTable(state) {
  allDefs(state).forEach(def => {
    const grp = state.groups[def.id];
    if (!grp) return;
    const heading = def.side === 'ucm' ? -90 : 90;
    grp.ships.forEach(ship => {
      ship.offTable = true;
      ship.heading = heading;
      ship.movedThisRound = false;
    });
  });
}

/* Index of the next undeployed (off-table, alive) ship in a group, or -1 if all placed. */
export function nextUndeployedShipIdx(state, gid) {
  const grp = state.groups[gid];
  if (!grp) return -1;
  for (let i = 0; i < grp.ships.length; i++) {
    const s = grp.ships[i];
    if (!s.destroyed && s.offTable && !s.attachedTo) return i;
  }
  return -1;
}

/* All ships in a group are placed (or destroyed). */
export function allShipsDeployed(state, gid) {
  return nextUndeployedShipIdx(state, gid) === -1;
}

// ── SECTION F: ASSET PHASE MANAGEMENT ──

/* Asset kinds belonging to a given stage type. */
export function kindsForAssetType(type) {
  if (type === 'fighter') return ['fighter'];
  if (type === 'bomber') return ['bomber', 'fireship'];
  if (type === 'torpedo') return ['torpedo'];
  return [];
}

/* Does `side` have an unmoved asset of the given stage type still on the table? */
export function sideHasUnmovedOfType(state, side, type) {
  const kinds = kindsForAssetType(type);
  return (state.launchedAssets || []).some(a => a.side === side && !a.moved && kinds.includes(a.kind));
}

/* Ordered list of {type, side} stages for the current round, initiative side first. */
export function assetStageOrder(state) {
  const init = state.initiativeHolder || 'ucm';
  const other = init === 'ucm' ? 'shal' : 'ucm';
  const stages = [];
  ['fighter', 'bomber', 'torpedo'].forEach(type => {
    stages.push({ type, side: init });
    stages.push({ type, side: other });
  });
  return stages;
}

/* Advance to the FIRST stage (from justFinished) that still has a movable asset. */
export function advanceAssetStage(state, justFinished) {
  if (justFinished && (justFinished.type === 'bomber' || justFinished.type === 'torpedo')) {
    if (sideHasPendingAttacks(state, justFinished.side, justFinished.type)) {
      return { resolveAttacksFor: justFinished.side, resolveType: justFinished.type };
    }
  }
  const order = assetStageOrder(state);
  let startIdx = 0;
  if (justFinished) {
    const i = order.findIndex(s => s.type === justFinished.type && s.side === justFinished.side);
    startIdx = i + 1;
  }
  for (let i = startIdx; i < order.length; i++) {
    if (sideHasUnmovedOfType(state, order[i].side, order[i].type)) {
      state.assetPhase.assetType = order[i].type;
      state.assetActiveSide = order[i].side;
      return { stage: order[i] };
    }
  }
  state.assetPhase.assetType = null;
  state.assetActiveSide = null;
  return { done: true };
}

/* Pending locked attacks owned by `side` for a given stage type. */
export function sideHasPendingAttacks(state, side, type) {
  const kinds = kindsForAssetType(type);
  return (state.launchedAssets || []).some(a => a.bomberTarget && a.side === side && kinds.includes(a.kind));
}

/* Called after a single asset finishes moving. Advances to the next stage if needed. */
export function afterAssetMove(state) {
  const ap = state.assetPhase;
  if (!ap) return;
  const cur = { type: ap.assetType, side: state.assetActiveSide };
  if (cur.side && cur.type && sideHasUnmovedOfType(state, cur.side, cur.type)) return;
  advanceAssetStage(state, cur);
}

/* Any on-table ship carrying enemy Battalions (Boarding candidates)? */
export function anyShipBattalions(state) {
  return Object.keys(state.groups).some(gid => {
    const side = getDef(state, gid).side, enemy = side === 'ucm' ? 'shal' : 'ucm';
    return state.groups[gid].ships.some(s => !s.destroyed && !s.offTable && s.battalions && s.battalions[enemy] > 0);
  });
}

/* Resolve Boarding Actions (§9.2). Returns a log array. */
export function resolveBoardingActions(state, rng) {
  const log = [];
  Object.keys(state.groups).forEach(gid => {
    const def = getDef(state, gid);
    const owner = def.side, boarder = owner === 'ucm' ? 'shal' : 'ucm';
    state.groups[gid].ships.forEach((ship, si) => {
      if (ship.destroyed || ship.offTable || !ship.battalions) return;
      let n = ship.battalions[boarder] || 0;
      if (!n) return;
      const marines = (def.special && /Marines-(\d)/i.test(def.special)) ? parseInt(def.special.match(/Marines-(\d)/i)[1]) : 0;
      if (marines) { const rem = Math.min(marines, n); n -= rem; ship.battalions[boarder] -= rem; if (rem) log.push(`${def.name}: Marines repel ${rem} Battalion(s)`); }
      if (n <= 0) return;
      const bv = saveVal(def.bs);
      let unsaved = 0, removed = 0;
      for (let i = 0; i < n; i++) {
        if (bv != null && rollDie(rng) >= bv) { removed++; }
        else unsaved++;
      }
      ship.battalions[boarder] = Math.max(0, (ship.battalions[boarder] || 0) - removed);
      if (unsaved > 0) {
        ship.hull = Math.max(0, ship.hull - unsaved);
        if (ship.hull <= 0) {
          ship.destroyed = true; ship.captured = true;
          recordKill(state, def, boarder, true);
          log.push(`${def.name} CAPTURED by boarding (${unsaved} Core hits)`);
        } else {
          log.push(`${def.name}: ${unsaved} Core hits from boarding${removed?`, ${removed} Battalion(s) repelled`:''} (${ship.hull}/${ship.maxHull})`);
        }
      } else if (removed) {
        log.push(`${def.name}: repelled ${removed} boarding Battalion(s)`);
      }
    });
  });
  return log;
}

/* ── CRIPPLING & EXPLOSION RESOLVERS ──────────────────────────────────────
   Shared rng-driven combat sub-resolvers used by the attack modal, the Repair
   phase, and movement scenery/mine effects. The interactive queue wrappers
   (applyCrippling / applyExplosion / proceedQueues) stay in the client; these
   pure(-ish) resolvers run identically on the server. Rolls are DEFERRED so the
   caller can declare Admiral abilities (Brace / Contain) before rolling. */

const CRIPPLE_TABLE = {
  energy:    { name:'Energy Surge', key:'energy', desc:'Gain a Spike.' },
  structural:{ name:'Structural Damage', key:'structural', desc:'Suffer another point of damage.' },
  fire:      { name:'Fire', key:'fire', desc:'Gain a Fire Token. 1 damage per token each End Phase. Repairable.' },
  defence:   { name:'Defence Systems Offline', key:'defence', desc:'ES/KS/BS/Shield −1; may be targeted as if Focused. Repairable.' },
  scanners:  { name:'Scanners Offline', key:'scanners', desc:'Scan reduced to 1". Repairable.' },
  weapons:   { name:'Weapons Offline', key:'weapons', desc:'Cannot use Weapons or launch Assets. Repairable.' },
  navigation:{ name:'Navigation Offline', key:'navigation', desc:'Movement → 2"; cannot turn or change layer. Repairable.' },
  decay:     { name:'Orbital Decay', key:'decay', desc:'Falls into Atmosphere; cannot move to Orbit. Repairable on 6+.' }
};
export function crippleFor(total) {
  if (total <= 3) return CRIPPLE_TABLE.energy;
  if (total <= 5) return CRIPPLE_TABLE.structural;
  if (total === 6) return CRIPPLE_TABLE.fire;
  if (total === 7) return CRIPPLE_TABLE.defence;
  if (total === 8) return CRIPPLE_TABLE.scanners;
  if (total === 9) return CRIPPLE_TABLE.weapons;
  if (total === 10) return CRIPPLE_TABLE.navigation;
  return CRIPPLE_TABLE.decay;
}
export function makeCrippleRoll(gid, si, def) {
  return { gid, si, name: def.name, rolled: false, braced: false };
}
/* Perform the crippling 2D6 roll (or apply Brace's fixed 4) for queue entry c. */
export function rollCrippleEffect(rng, c, forced) {
  if (forced != null) { c.total = forced; c.d1 = null; c.d2 = null; }
  else { c.d1 = rollDie(rng); c.d2 = rollDie(rng); c.total = c.d1 + c.d2; }
  const eff = crippleFor(c.total);
  c.effectName = eff.name; c.effectKey = eff.key; c.effectDesc = eff.desc;
  c.rolled = true;
}
export function makeExplosionRoll(gid, si, def, ship) {
  const mod = def.tonnage === 'C' ? 2 : def.tonnage === 'H' ? 1 : 0;
  return { gid, si, name: def.name, mod, rolled: false, contained: false,
    rangeIn: explosionRangeIn(def), x: ship.x, y: ship.y, layer: ship.layer || 'orbit', side: def.side };
}
/* Perform the explosion 1D6(+tonnage) roll (or apply Contain's fixed 2) for entry ex. */
export function rollExplosionEffect(rng, ex, forced) {
  const EX = {
    1:{n:'Burn Up', d:'Removed, no further effects.', kind:'none'},
    2:{n:'Reactor Rupture', d:'Groups/Stations within DOUBLE range gain a Spike.', kind:'spike2x'},
    3:{n:'Shredded', d:'All in range suffer 2 Kinetic hits. Assets removed 5+.', kind:'hits', type:'K', assets:5},
    4:{n:'Fuel Detonation', d:'All in range suffer 2 Energy hits. Assets removed 4+.', kind:'hits', type:'E', assets:4},
    5:{n:'Reactor Overload', d:'All in range suffer 2 Core hits. Assets removed 3+.', kind:'hits', type:'C', assets:3}
  };
  if (forced != null) { ex.d1 = forced; ex.mod = 0; ex.total = forced; }
  else { ex.d1 = rollDie(rng); ex.total = ex.d1 + ex.mod; }
  const eff = ex.total >= 6 ? {n:'Foldspace Catastrophe', d:'All in range suffer 2 damage + a Spike. Assets removed 2+.', kind:'dmg2spike', assets:2} : EX[Math.max(1, ex.total)];
  ex.effectName = eff.n; ex.effectDesc = eff.d; ex.effKind = eff.kind; ex.effType = eff.type; ex.effAssets = eff.assets;
  ex.rolled = true;
}
/* Apply an explosion's area effect to all ships/assets on the SAME orbital layer
   within range (double range for the spike effect). Hit-effects roll saves;
   chains may queue further explosions into M.explodeQueue. */
export function applyExplosionEffect(state, rng, ex, M) {
  if (!ex.rolled) rollExplosionEffect(rng, ex); // non-modal callers: roll immediately
  if (ex.effKind === 'none') return;
  const rangePx = ex.rangeIn * INCH * (ex.effKind === 'spike2x' ? 2 : 1);
  // Spikes are awarded once per GROUP (not per ship). Track which groups are already spiked.
  const spikedGroups = new Set();
  // Affected ships (any side), same layer, within range, on-table, alive.
  Object.keys(state.groups).forEach(gid => {
    const def = getDef(state, gid);
    const grp = state.groups[gid];
    grp.ships.forEach((s, si) => {
      if (s.destroyed || s.offTable || s.attachedTo) return;
      if ((s.layer || 'orbit') !== ex.layer) return;
      if (Math.hypot(s.x - ex.x, s.y - ex.y) > rangePx) return;
      if (ex.effKind === 'spike2x') {
        if (!spikedGroups.has(gid)) { spikedGroups.add(gid); grp.spikes = (grp.spikes || 0) + 1; }
      } else if (ex.effKind === 'dmg2spike') {
        s.hull = Math.max(0, s.hull - 2);
        if (s.hull <= 0 && !s.destroyed) { s.destroyed = true; if (M && isCapital(def)) M.explodeQueue.push(makeExplosionRoll(gid, si, def, s)); }
        if (!spikedGroups.has(gid)) { spikedGroups.add(gid); grp.spikes = (grp.spikes || 0) + 1; }
      } else if (ex.effKind === 'hits') {
        const sv = baseSaveForType(def, s, ex.effType, false);
        let unsaved = 0;
        for (let i = 0; i < 2; i++) {
          if (sv == null) { unsaved++; continue; }
          if (rollDie(rng) < sv) {
            const bv = saveVal(def.bs);
            if (bv == null || rollDie(rng) < bv) unsaved++;
          }
        }
        if (unsaved > 0) {
          s.hull = Math.max(0, s.hull - unsaved);
          if (s.hull <= 0 && !s.destroyed) { s.destroyed = true; if (M && isCapital(def)) M.explodeQueue.push(makeExplosionRoll(gid, si, def, s)); }
        }
      }
    });
  });
  // Launch assets on the same conceptual layer (assets count as Orbit) within range.
  if (ex.effAssets && state.launchedAssets) {
    state.launchedAssets = state.launchedAssets.filter(a => {
      if (Math.hypot(a.x - ex.x, a.y - ex.y) > rangePx) return true;
      let remaining = a.count;
      for (let i = 0; i < a.count; i++) { if (rollDie(rng) >= ex.effAssets) remaining--; }
      a.count = remaining;
      return remaining > 0;
    });
  }
}

/* ── COHERENCY ── */
export function coherencyInches(def) { return def.tonnage === 'L' ? 3 : 6; }
/* Set of ship indices OUT of formation (need 1 neighbour, or 2 for groups of 4+). */
export function outOfFormationSet(state, def) {
  if (def.openNetwork || def.payload) return new Set(); // ignore coherency
  const grp = getGroup(state, def.id);
  const alive = grp.ships.map((s, i) => ({ s, i })).filter(o => !o.s.destroyed && !o.s.offTable);
  if (alive.length <= 1) return new Set();
  const cohPx = coherencyInches(def) * INCH;
  const need = alive.length >= 4 ? 2 : 1;
  const out = new Set();
  alive.forEach(({ s, i }) => {
    let neighbours = 0;
    alive.forEach(({ s: o, i: j }) => {
      if (i === j) return;
      if ((s.layer || 'orbit') !== (o.layer || 'orbit')) return;
      if (Math.hypot(s.x - o.x, s.y - o.y) <= cohPx) neighbours++;
    });
    if (neighbours < need) out.add(i);
  });
  return out;
}
export function groupInFormation(state, def) { return outOfFormationSet(state, def).size === 0; }

/* ── ATTACK RESOLUTION (to-hit / saves) ──
   Roll the hit dice / primary save dice for the current shot, setting M.hitResult
   / M.saveResult and applying immediate side-effects (Overcharge self-damage,
   Bloom/Shield spikes, Sustained-Fire bookkeeping). Lifted out of the render so
   the rolls are explicit and can run server-side with the room's seeded rng. */
export function rollHits(state, rng, M) {
  const s = M.shots[M.shotIdx];
  const td = getDef(state, s.targetGid);
  const ts = state.groups[s.targetGid].ships[s.targetSi];
  const sp = parseWeaponSpecials(s.w);
  // Lock: Mauler uses the target's relevant save as Lock; Calibre improves Lock vs listed tonnages.
  let lock = lockVal(s.w);
  if (sp.mauler) {
    const sv = s.w.type === 'K' ? saveVal(td.ks) : s.w.type === 'E' ? saveVal(td.es) : (shieldSaveVal(td) || 6);
    if (sv != null) lock = sv;
  }
  if (sp.calibre && sp.calibre.toUpperCase().includes(td.tonnage)) lock = Math.max(2, lock - 1);
  // Atmosphere attack rules (§4.1.2).
  let forceSix = false;
  if (!M.bomber && M.attackerGid) {
    const ash = state.groups[M.attackerGid].ships[M.attackerSi];
    const aL = ash && (ash.layer || 'orbit'), tL = ts.layer || 'orbit';
    const isCity = td.category === 'city';
    const targetDescent = /Descent/i.test(td.special || '');
    const isBombardment = /Bombardment/i.test(s.w.special || '');
    if (isCity && isBombardment) lock = Math.max(2, lock - 2);
    else if (tL === 'atmosphere' && (isCity || targetDescent)) forceSix = true;
    else if (aL === 'atmosphere' && tL === 'orbit') forceSix = true;
    else if (aL === 'orbit' && tL === 'atmosphere') lock = Math.min(6, lock + 1);
  }
  // Fusillade-X (per-ship; baked for pooled fire). Sustained Fire: ×2 Att vs a Group hit last round.
  let att = s.w.att;
  if (sp.fusillade && !s.fusilladeBaked && !M.bomber && M.attackerGid) {
    const ag = state.groups[M.attackerGid];
    const eo = ag ? effectiveOrder(state, getDef(state, M.attackerGid), ag, M.attackerSi) : null;
    if (eo === 'WF') att += sp.fusillade;
  }
  if (sp.sustained && !M.bomber) {
    const tg = state.groups[s.targetGid];
    if (tg && tg.hitByLastRound && tg.hitByLastRound.includes(M.attackerGid)) att *= 2;
  }
  const dice = [];
  let hits = 0, crits = 0, sixes = 0;
  const critMargin = (td.special && /Reinforced Armour/i.test(td.special)) ? 3 : 2;
  for (let i = 0; i < att; i++) {
    const r = rollDie(rng);
    const isHit = forceSix ? (r === 6) : (r >= lock);
    const isCrit = forceSix ? false : (r >= lock + critMargin);
    if (isHit) hits++;
    if (isCrit) crits++;
    if (r === 6) sixes++;
    dice.push({ r, isHit, isCrit });
  }
  M.hitResult = { dice, hits, crits, lock, forceSix };
  if (hits > 0 && !M.bomber && M.attackerGid) {
    const tg = state.groups[s.targetGid];
    if (tg) { tg.hitByThisRound = tg.hitByThisRound || []; if (!tg.hitByThisRound.includes(M.attackerGid)) tg.hitByThisRound.push(M.attackerGid); }
  }
  // Overcharge: each 6 costs the firing ship this weapon's unmodified Damage in Hull.
  const oc = M.overcharge && M.overcharge[s.wi];
  if (oc && sixes > 0 && !M.bomber && M.attackerGid) {
    const ash = state.groups[M.attackerGid].ships[M.attackerSi];
    if (ash) {
      const self = sixes * (s.w.dmg || 0);
      ash.hull = Math.max(0, ash.hull - self);
      M.log.push(`Overcharge: ${s.w.name} dealt ${self} self-damage (${sixes}×6)`);
      if (ash.hull <= 0 && !ash.destroyed) { ash.destroyed = true; }
    }
  }
  // Bloom-X: attacker gains X spikes when this weapon fires.
  if (sp.bloom && !M.bomber && M.attackerGid) {
    const ag = state.groups[M.attackerGid];
    if (ag) ag.spikes = (ag.spikes || 0) + sp.bloom;
  }
}

export function rollSaves(state, rng, M) {
  const s = M.shots[M.shotIdx];
  const td = getDef(state, s.targetGid);
  const ts = state.groups[s.targetGid].ships[s.targetSi];
  const sp = parseWeaponSpecials(s.w);
  const hr = M.hitResult;
  const k = targetKey(s.targetGid, s.targetSi);
  const shieldUp = !!M.shieldsUp[k];
  const sat = M.saturation || 0;
  // Build a per-hit list. Penetrator: criticals become Core hits. Burnthrough: each
  // crit worsens this weapon's ES/KS for all its hits.
  const burnReduce = sp.burnthrough * hr.crits;
  const hitsList = [];
  let critsRemaining = hr.crits;
  for (let i = 0; i < hr.hits; i++) {
    const isCrit = critsRemaining > 0; if (isCrit) critsRemaining--;
    let type = s.w.type;
    if (isCrit && sp.penetrator) type = 'C';
    let sv = baseSaveForType(td, ts, type, shieldUp);
    if (sv != null && type !== 'C' && !shieldUp) {
      const red = sp.scald + burnReduce + (isCrit ? sp.reave : 0);
      if (red) sv = Math.min(6, sv + red);
    }
    const ocOn = M.overcharge && M.overcharge[s.wi];
    const baseDmg = ocOn ? (s.w.dmg * 2) : s.w.dmg;
    const dmg = baseDmg + (isCrit ? sp.critical : 0);
    hitsList.push({ isCrit, type, sv, dmg, saved: false, savedBy: null });
  }
  // Primary saves, honouring Saturation (skips `sat` save dice).
  const primDice = [];
  let skipSaves = sat;
  hitsList.forEach(h => {
    if (h.sv == null) return;
    if (skipSaves > 0) { skipSaves--; h.noSaveDie = true; return; }
    const r = rollDie(rng); const ok = r >= h.sv;
    primDice.push({ r, ok, sv: h.sv, crit: h.isCrit });
    if (ok) { h.saved = true; h.savedBy = 'primary'; }
  });
  // Shield-X: the Group gains 1 Spike when it uses Shield Saves (once per attack).
  if (shieldUp && !M.shieldSpiked) {
    M.shieldSpiked = M.shieldSpiked || {};
    if (!M.shieldSpiked[k]) { M.shieldSpiked[k] = true; ts.spikes = (ts.spikes || 0) + 1; }
  }
  // Backup save value (Formation gives a 6+ backup to grouped ships); rolled later.
  let backupVal = saveVal(td.bs);
  const tgrp = state.groups[s.targetGid];
  if (tgrp && tgrp.ships.length > 1 && groupInFormation(state, td)) {
    backupVal = (backupVal == null) ? 6 : Math.min(backupVal, 6);
  }
  const isBomberAtk = M.bomber && (M.bomberKind === 'bomber' || M.bomberKind === 'fireship');
  const isCloseAction = /Close Action/i.test(s.w.special || '');
  const dmg = hitsList.filter(h => !h.saved).reduce((a, h) => a + h.dmg, 0);
  const unsaved = hitsList.filter(h => !h.saved).length;
  M.saveResult = { hitsList, primDice, backDice: [], backupVal, aegisDice: [], aegisY: 0, unsaved, dmg,
    backupRolled: false, targetGid: s.targetGid, isBomberAtk, isCloseAction,
    flash: sp.flash, crippling: sp.crippling, penetrator: sp.penetrator,
    status: sp.status && hitsList.length > 0, corruptor: (sp.corruptor && dmg > 0) ? sp.corruptor : 0,
    critDamaged: hitsList.some(h => h.isCrit && !h.saved) };
}

/* ── ATTACK RESOLUTION (post-save) ──
   Pure resolution helpers operating on the attack-modal object `M` plus `state`;
   dice use the injected `rng`. Rendering stays with the caller. As combat migrates
   to intents these run on the server with the room's seeded rng. */

/* Apply M.pendingDamage to targets (Focused/spillover rules), record kills, build
   the crippling / explosion / impel queues, then set the next sub-step. */
export function resolveAttackDamage(state, M) {
  M.crippleQueue = [];
  M.explodeQueue = [];
  Object.keys(M.pendingDamage).forEach(k => {
    const [gid, si] = k.split('#');
    const grp = state.groups[gid];
    const ship = grp && grp.ships[parseInt(si)];
    if (!ship || ship.destroyed) return;
    const def = getDef(state, gid);
    const dmg = M.pendingDamage[k];
    const wasAboveHalf = ship.hull > ship.maxHull / 2;
    const before = ship.hull;
    ship.hull = Math.max(0, ship.hull - dmg);
    // Damage spillover: excess beyond destroying the targeted ship spills to the
    // group (lowest-hull first), unless ALL damage was Focused.
    let excess = dmg - before;
    if (ship.hull <= 0 && excess > 0 && M.spillEligible && M.spillEligible[k]) {
      const mates = grp.ships
        .map((sh, idx) => ({ sh, idx }))
        .filter(o => !o.sh.destroyed && !o.sh.offTable && o.idx !== parseInt(si))
        .sort((a, b) => a.sh.hull - b.sh.hull);
      for (const o of mates) {
        if (excess <= 0) break;
        const take = Math.min(excess, o.sh.hull);
        const wasHalf = o.sh.hull > o.sh.maxHull / 2;
        o.sh.hull = Math.max(0, o.sh.hull - take);
        excess -= take;
        M.log.push(`Spillover: ${take} → ${def.name} #${o.idx + 1}`);
        if (o.sh.hull <= 0) {
          o.sh.destroyed = true;
          recordKill(state, def, M.bomber ? M.bomberSide : (M.attackerGid ? getDef(state, M.attackerGid).side : null), false, targetKey(gid, o.idx));
          if (isCapital(def)) M.explodeQueue.push(makeExplosionRoll(gid, o.idx, def, o.sh));
        } else if (isCapital(def) && !o.sh.crippledRolled && o.sh.hull <= o.sh.maxHull / 2 && wasHalf) {
          o.sh.crippledRolled = true;
          M.crippleQueue.push(makeCrippleRoll(gid, o.idx, def));
        }
      }
    }
    if (M.pendingFlash && M.pendingFlash[k]) ship.spikes = (ship.spikes || 0) + M.pendingFlash[k];
    if (M.pendingArrest && M.pendingArrest[k] && !ship.arrestedThisRound) {
      ship.arrestNext = M.pendingArrest[k];
      ship.arrestedThisRound = true;
    }
    if (M.forcedCripple && M.forcedCripple[k] && ship.hull > 0) {
      M.crippleQueue.push(makeCrippleRoll(gid, parseInt(si), def));
    }
    if (isCapital(def) && !ship.crippledRolled && ship.hull > 0 && ship.hull <= ship.maxHull / 2 && wasAboveHalf) {
      ship.crippledRolled = true;
      M.crippleQueue.push(makeCrippleRoll(gid, parseInt(si), def));
    }
    if (ship.hull <= 0) {
      ship.destroyed = true;
      recordKill(state, def, M.bomber ? M.bomberSide : (M.attackerGid ? getDef(state, M.attackerGid).side : null), false, targetKey(gid, parseInt(si)));
      if (isCapital(def)) M.explodeQueue.push(makeExplosionRoll(gid, parseInt(si), def, ship));
    } else {
      if (M.pendingStatus && M.pendingStatus[k]) {
        ship.crippling = ship.crippling || [];
        if (!ship.crippling.includes('scanners')) ship.crippling.push('scanners');
        ship.statusToken = true;
      }
      if (M.pendingCorruptor && M.pendingCorruptor[k]) {
        const atkSide = M.bomber ? M.bomberSide : (M.attackerGid ? getDef(state, M.attackerGid).side : null);
        if (atkSide) { ship.battalions = ship.battalions || { ucm: 0, shal: 0 }; ship.battalions[atkSide] += M.pendingCorruptor[k]; }
      }
    }
  });
  // Impel-X: queue affected groups for a player choice (turn vs move forward).
  if (M.pendingImpel) {
    M.impelQueue = M.impelQueue || [];
    Object.keys(M.pendingImpel).forEach(gid => {
      const grp = state.groups[gid];
      if (!grp) return;
      if (!M.impelQueue.find(q => q.gid === gid)) M.impelQueue.push({ gid, x: M.pendingImpel[gid].x, big: M.pendingImpel[gid].big });
    });
  }
  proceedQueues(M);
  return state;
}

/* Advance the modal to the next pending sub-step (crippling → explosion → impel → done). */
export function proceedQueues(M) {
  if (M.crippleQueue.length) { M.step = 'crippling'; return; }
  if (M.explodeQueue.length) { M.step = 'explosion'; return; }
  if (M.impelQueue && M.impelQueue.length) { M.step = 'impel'; return; }
  M.step = 'done';
}

/* Roll Backup + Aegis save dice on hits still unsaved after primary saves/re-rolls.
   Mutates M.saveResult in place and recomputes damage. */
export function rollDeferredBackupSaves(state, rng, M) {
  const sr = M.saveResult;
  if (!sr || sr.backupRolled) return;
  if (sr.backupVal != null) {
    sr.hitsList.forEach(h => {
      if (h.saved || h.sv == null) return;
      const r = rollDie(rng); const ok = r >= sr.backupVal;
      sr.backDice.push({ r, ok });
      if (ok) { h.saved = true; h.savedBy = 'backup'; }
    });
  }
  // Aegis-X (§15.1): vs Bomber/Close Action, Y extra save dice (on Backup, or 4+).
  if ((sr.isBomberAtk || sr.isCloseAction) && !M.aegisUsed) {
    const aegisY = aegisValueForGroup(state, sr.targetGid);
    sr.aegisY = aegisY;
    if (aegisY > 0) {
      const av = sr.backupVal != null ? sr.backupVal : 4;
      for (let i = 0; i < aegisY; i++) {
        const unsavedHit = sr.hitsList.find(h => !h.saved);
        if (!unsavedHit) break;
        const r = rollDie(rng); const ok = r >= av;
        sr.aegisDice.push({ r, ok });
        if (ok) { unsavedHit.saved = true; unsavedHit.savedBy = 'aegis'; }
      }
      M.aegisUsed = true;
    }
  }
  sr.dmg = sr.hitsList.filter(h => !h.saved).reduce((a, h) => a + h.dmg, 0);
  sr.unsaved = sr.hitsList.filter(h => !h.saved).length;
  sr.critDamaged = sr.hitsList.some(h => h.isCrit && !h.saved);
  sr.backupRolled = true;
}

/* ── ATTACK STEP MACHINE ──
   Drives the attack modal through its sub-steps. `to` names the transition the
   player requested (the modal buttons). Mutates M (and state); dice use `rng`.
   Rendering is the caller's job. Server-driven combat dispatches these as intents. */
export function advanceAttack(state, rng, M, to) {
  if (!M) return state;
  if (to === 'hit') { M.step = 'hit'; M.shotIdx = 0; M.hitResult = null; M.rerollN = null; rollHits(state, rng, M); }
  else if (to === 'save') {
    M.rerollN = null; M.fighterSpend = {};
    if (M.hitResult.hits > 0) { M.step = 'save'; M.saveResult = null; rollSaves(state, rng, M); }
    else { nextShotOrResolve(state, rng, M); }
  }
  else if (to === 'rollbackup') {
    rollDeferredBackupSaves(state, rng, M);
  }
  else if (to === 'apply') {
    if (M.saveResult && !M.saveResult.backupRolled) rollDeferredBackupSaves(state, rng, M);
    const s = M.shots[M.shotIdx];
    const k = targetKey(s.targetGid, s.targetSi);
    const sr = M.saveResult;
    M.pendingDamage[k] = (M.pendingDamage[k] || 0) + sr.dmg;
    if (sr.dmg > 0 && !parseWeaponSpecials(s.w).focused) {
      M.spillEligible = M.spillEligible || {};
      M.spillEligible[k] = true;
    }
    if (sr.flash && sr.dmg > 0) {
      M.pendingFlash = M.pendingFlash || {};
      M.pendingFlash[k] = (M.pendingFlash[k] || 0) + sr.flash;
    }
    if (sr.crippling && sr.critDamaged && sr.dmg > 0) {
      M.forcedCripple = M.forcedCripple || {};
      M.forcedCripple[k] = true;
    }
    if (sr.status) { M.pendingStatus = M.pendingStatus || {}; M.pendingStatus[k] = true; }
    if (sr.corruptor) { M.pendingCorruptor = M.pendingCorruptor || {}; M.pendingCorruptor[k] = (M.pendingCorruptor[k] || 0) + sr.corruptor; }
    const spA = parseWeaponSpecials(s.w);
    if (spA.arrest && sr.dmg > 0) {
      M.pendingArrest = M.pendingArrest || {};
      M.pendingArrest[k] = Math.max(M.pendingArrest[k] || 0, spA.arrest);
    }
    if (spA.impel && M.hitResult && M.hitResult.crits >= spA.impel) {
      M.pendingImpel = M.pendingImpel || {};
      const big = M.hitResult.crits >= spA.impel * 2;
      M.pendingImpel[s.targetGid] = { x: spA.impel, big };
    }
    const td = getDef(state, s.targetGid);
    M.log.push(`${s.w.name} ▶ ${td.name}: ${sr.dmg} dmg${sr.flash && sr.dmg > 0 ? ` (+${sr.flash} spike)` : ''}`);
    nextShotOrResolve(state, rng, M);
  }
  else if (to === 'crippling-roll') {
    const c = M.crippleQueue[0];
    rollCrippleEffect(rng, c, c.braced ? 4 : null);
  }
  else if (to === 'explosion-roll') {
    const ex = M.explodeQueue[0];
    rollExplosionEffect(rng, ex, ex.contained ? 2 : null);
  }
  else if (to === 'crippling-next') { applyCripplingNext(state, M); }
  else if (to === 'explosion-next') { applyExplosionNext(state, rng, M); }
  return state;
}

/* Move to the next shot (rolling its hits), or once all shots are done apply
   damage & queue effects. */
export function nextShotOrResolve(state, rng, M) {
  if (M.shotIdx < M.shots.length - 1) {
    M.shotIdx++; M.hitResult = null; M.saveResult = null; M.step = 'hit';
    rollHits(state, rng, M);
    return;
  }
  resolveAttackDamage(state, M);
}

/* Apply the next queued crippling effect to its ship, then advance the queues. */
export function applyCripplingNext(state, M) {
  const c = M.crippleQueue.shift();
  const ship = state.groups[c.gid].ships[c.si];
  const def = getDef(state, c.gid);
  ship.crippling = ship.crippling || [];
  if (c.effectKey === 'fire') { ship.fireTokens = (ship.fireTokens || 0) + 1; ship.crippling.push('fire'); }
  else if (c.effectKey === 'energy') { ship.spikes = (ship.spikes || 0) + 1; }
  else if (c.effectKey === 'structural') {
    ship.hull = Math.max(0, ship.hull - 1);
    if (ship.hull <= 0 && !ship.destroyed) { ship.destroyed = true; if (isCapital(def)) M.explodeQueue.push(makeExplosionRoll(c.gid, c.si, def, ship)); }
  }
  else if (!ship.crippling.includes(c.effectKey)) ship.crippling.push(c.effectKey);
  M.log.push(`${c.name} crippled: ${c.effectName}`);
  proceedQueues(M);
}

/* Apply the next queued explosion's area effect, then advance the queues. */
export function applyExplosionNext(state, rng, M) {
  const ex = M.explodeQueue.shift();
  M.log.push(`${ex.name} exploded: ${ex.effectName}`);
  applyExplosionEffect(state, rng, ex, M);
  proceedQueues(M);
}

/* ── INTENT LAYER (Phase 1d) ──────────────────────────────────────────────
   An "intent" is a small serialisable action object { type, ...payload }.
   `apply(state, intent, rng)` is the single entry point the server runs after
   `isLegal` (see gating.js) and that the local client runs in hotseat mode.
   Only turn-flow intents are modelled so far; more families migrate over from
   the inline client handlers incrementally. Each intent maps to one mutator. */

/* Active side spends a Pass Token and hands activation to the opponent
   (mirrors the alternation done after a finished activation). */
export function passActivation(state) {
  const P = state.planning;
  if (!P || !state.activeSide || !(P.passTokens[state.activeSide] > 0)) return state;
  const passer = state.activeSide;
  P.passTokens[passer]--;
  const other = passer === 'ucm' ? 'shal' : 'ucm';
  if (sideHasPendingActivation(state, other)) state.activeSide = other;
  else if (!sideHasPendingActivation(state, passer)) state.activeSide = null;
  return state;
}

/* End the Activation Phase: open the end-of-round Dropsite Activation step. */
export function beginEndRound(state) {
  state.dropsiteActivation = { side: state.initiativeHolder || 'ucm', done: [], dsId: null };
  return state;
}

/* Assign an Order to a Group, applying its immediate effects (Spike changes and
   Damage Control hull recovery). Legality is checked by gating.js#isLegal — this
   only mutates. The DC hull roll uses `rng`, so it resolves on whichever runtime
   applies the intent (seeded server rng online, localRng in hotseat). */
export function applyOrder(state, rng, gid, order) {
  const grp = state.groups[gid];
  if (!grp) return state;
  const def = getDef(state, gid);
  grp.order = order;
  logEvent(state, `${def.name} → ${ORDERS[order].label}`);
  // Re-activating ends any prior deploy-adjust window and Silent Running reduction.
  grp.ships.forEach(s => { s.justArrived = false; s.sigSilent = false; });
  // Immediate Spike effects.
  if (order === 'GQ') grp.spikes = Math.max(0, grp.spikes - 2);
  if (order === 'SR') grp.spikes = 0;
  // Damage Control: each ship recovers Hull once (1, or D3 for H/C tonnage) and
  // is flagged to roll crippling-repair in the Repair step.
  if (order === 'DC') {
    grp.ships.forEach(s => {
      if (s.destroyed || s.offTable) return;
      s.dcThisRound = true;
      if (!s.dcRepaired) {
        s.dcRepaired = true;
        const rec = (def.tonnage === 'H' || def.tonnage === 'C') ? Math.ceil(rollDie(rng) / 2) : 1;
        s.hull = Math.min(s.maxHull, s.hull + rec);
        logEvent(state, `${def.name} Damage Control: +${rec} Hull`);
      }
    });
  }
  // Auto-select a ship so its move cone shows immediately (view convenience).
  if (state.selectedShipIdx === null && ORDERS[order] && ORDERS[order].moveMax > 0) {
    const leadIdx = grp.leadShipIdx || 0;
    const pick = (i) => { const s = grp.ships[i]; return s && !s.destroyed && !s.offTable && !s.movedThisRound; };
    const idx = pick(leadIdx) ? leadIdx : grp.ships.findIndex((s, i) => pick(i));
    if (idx >= 0) state.selectedShipIdx = idx;
  }
  return state;
}

/* ── INDIVIDUAL-ORDER HELPERS (Open Network / Payload) ── */
export function shipInNetwork(state, def, ship) {
  if (!def.openNetwork || !ship) return false;
  if (ship.offTable || ship.destroyed) return false;
  return (ship.deployedRound != null) && (ship.deployedRound < state.round);
}
export function onIndividualOrders(state, def, grp) {
  if (def.openNetwork) return grp && grp.ships.some(s => shipInNetwork(state, def, s));
  if (def.payload) return state.round >= 2;
  return false;
}
/* Effective Order for a ship: its own Order if on individual orders (networked
   Voidgate / detached Payload), otherwise the Group Order. */
export function effectiveOrder(state, def, grp, shipIdx) {
  const s = grp.ships[shipIdx];
  if (def.openNetwork) return shipInNetwork(state, def, s) ? (s ? s.order : null) : grp.order;
  if (onIndividualOrders(state, def, grp)) return s ? s.order : null;
  return grp.order;
}

/* The legal move cone for a ship under its effective Order. Shared by isLegal
   and commitMove so server validation and application never disagree. */
export function moveCone(state, gid, si, layerToggle) {
  const grp = state.groups[gid];
  const def = getDef(state, gid);
  const ship = grp.ships[si];
  const selOrderKey = effectiveOrder(state, def, grp, si);
  const o = ORDERS[selOrderKey];
  const navOff = ship.crippling && ship.crippling.includes('navigation');
  const normalMaxR = effectiveMaxMovePx(def, ship, selOrderKey);
  const lm = layerMove(normalMaxR, ship, layerToggle);
  const maxR = lm.maxPx;
  let minR = navOff ? 0 : (o ? o.moveMin * def.thrust * INCH : 0);
  if (minR > maxR) minR = 0;
  const turnDeg = navOff ? 0 : (o ? (o.turnLimit || 0) : 0);
  return { selOrderKey, o, navOff, lm, maxR, minR, turnDeg };
}

/* Commit a ship's primary move to (tx,ty): validate the cone, resolve base
   overlap, set position/heading/layer, then resolve scenery + mine effects, and
   set up the vectored / Course-Change follow-up aim where applicable. */
export function commitMove(state, rng, gid, si, tx, ty, layerToggle) {
  const grp = state.groups[gid];
  const def = getDef(state, gid);
  const ship = grp && grp.ships[si];
  if (!ship || ship.destroyed || ship.offTable || grp.activated || ship.movedThisRound) return state;
  const { selOrderKey, o, lm, maxR, minR, turnDeg } = moveCone(state, gid, si, layerToggle);
  if (!o || o.moveMax <= 0) return state;

  const dx = tx - ship.x, dy = ty - ship.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < minR - 0.5 || dist > maxR + 0.5) return state;
  const fwd = headingVec(ship.heading);
  const cosAngle = (fwd.x * dx + fwd.y * dy) / Math.max(0.0001, dist);
  const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;
  if (angleDeg > turnDeg + 0.5) return state;

  grp.moveTrail = grp.moveTrail || [];
  grp.moveTrail.push({ si, x: ship.x, y: ship.y, heading: ship.heading, layer: ship.layer });

  const originX = ship.x, originY = ship.y;
  const bases = otherShipBases(state, gid, si);
  const resolved = resolveBaseOverlap(originX, originY, tx, ty, shipBaseRadiusPx(def), bases);
  ship.x = resolved.x;
  ship.y = resolved.y;
  ship.heading = Math.atan2(dy, dx) * 180 / Math.PI;
  ship.movedThisRound = true;
  ship.arrestNext = 0;
  ship.layer = lm.endLayer;
  state.layerToggle = false;
  state.hoverPoint = null;
  {
    const inches = (dist / INCH).toFixed(1);
    const cross = fwd.x * dy - fwd.y * dx;
    const turnTxt = angleDeg < 1 ? 'straight' : `${Math.round(angleDeg)}° ${cross >= 0 ? 'right' : 'left'}`;
    const layerTxt = lm.endLayer !== (grp.moveTrail[grp.moveTrail.length - 1] || {}).layer ? ` · ${lm.endLayer === 'orbit' ? 'ascend' : 'descend'}` : '';
    const nm = def.name + (grp.ships.length > 1 ? ` #${si + 1}` : '');
    logEvent(state, `${nm} moved ${inches}" (${turnTxt})${layerTxt}`);
  }

  // ── SCENERY MOVEMENT EFFECTS (orbit only) ──
  if (ship.layer !== 'atmosphere') {
    let destroyedByObj = false;
    ((state.scenarioData && state.scenarioData.largeObjects) || []).forEach(obj => {
      const ocx = inchToPx(obj.x), ocy = inchToPx(obj.y), orr = inchToPx(obj.diameter / 2);
      if (largeObjectAt(state, ship.x, ship.y) || segCrossesCircle(originX, originY, ship.x, ship.y, ocx, ocy, orr)) destroyedByObj = true;
    });
    if (destroyedByObj) {
      ship.destroyed = true;
      logEvent(state, `${def.name} destroyed — flew into a Large Object`);
      if (isCapital(def)) { const ex = makeExplosionRoll(gid, si, def, ship); applyExplosionEffect(state, rng, ex, { explodeQueue: [] }); }
      return state;
    }
    const hits = sceneryMoveHits(state, rng, originX, originY, ship.x, ship.y, ship);
    if (hits.length) {
      let total = 0; const labels = [];
      hits.forEach(h => {
        const sv = baseSaveForType(def, ship, h.type, false);
        let unsaved = 0;
        for (let i = 0; i < h.n; i++) {
          if (sv == null) { unsaved++; continue; }
          if (rollDie(rng) < sv) { const bv = saveVal(def.bs); if (bv == null || rollDie(rng) < bv) unsaved++; }
        }
        if (unsaved) { total += unsaved; labels.push(`${h.label} (${unsaved} ${h.type})`); }
      });
      if (total > 0) {
        const wasAboveHalf = ship.hull > ship.maxHull / 2;
        ship.hull = Math.max(0, ship.hull - total);
        logEvent(state, `${def.name}: ${labels.join(', ')} → ${total} dmg`);
        if (isCapital(def) && !ship.crippledRolled && ship.hull > 0 && ship.hull <= ship.maxHull / 2 && wasAboveHalf) {
          ship.crippledRolled = true;
          const c = makeCrippleRoll(gid, si, def);
          rollCrippleEffect(rng, c);
          ship.crippling = ship.crippling || [];
          if (c.effectKey === 'fire') { ship.fireTokens = (ship.fireTokens || 0) + 1; if (!ship.crippling.includes('fire')) ship.crippling.push('fire'); }
          else if (c.effectKey === 'energy') ship.spikes = (ship.spikes || 0) + 1;
          else if (c.effectKey === 'structural') ship.hull = Math.max(0, ship.hull - 1);
          else if (!ship.crippling.includes(c.effectKey)) ship.crippling.push(c.effectKey);
          logEvent(state, `${def.name} crippled: ${c.effectName}`);
        }
        if (ship.hull <= 0 && !ship.destroyed) {
          ship.destroyed = true;
          if (isCapital(def)) { const ex = makeExplosionRoll(gid, si, def, ship); applyExplosionEffect(state, rng, ex, { explodeQueue: [] }); }
        }
      }
    }
  }

  // ── MINES ── enemy ship in Orbit moving through a Mine's Thrust range triggers it.
  if (!ship.destroyed && ship.layer !== 'atmosphere') {
    const enemySide = def.side === 'ucm' ? 'shal' : 'ucm';
    const mine = (state.launchedAssets || []).find(a => {
      if (a.kind !== 'mine' || a.side !== enemySide) return false;
      const rPx = assetProfile(state, a.side, 'mine').thrust * INCH;
      return segCrossesCircle(originX, originY, ship.x, ship.y, a.x, a.y, rPx) ||
             Math.hypot(ship.x - a.x, ship.y - a.y) <= rPx;
    });
    if (mine) {
      const prof = assetProfile(state, mine.side, 'mine');
      const dice = mine.count * (prof.att || 1);
      const w = { name: `Mine ×${mine.count}`, arc: '—', att: dice, lock: prof.lock, dmg: prof.dmg, type: prof.type, special: prof.special || '' };
      state.attackModal = {
        bomber: true, bomberKind: 'mine', bomberAssetIds: [mine.id], bomberSide: mine.side, saturation: 0, cripplingFire: 0,
        attackerGid: null, attackerSi: null,
        shots: [{ wi: 0, w, targetGid: gid, targetSi: si }],
        step: 'intro', shotIdx: 0, shieldsUp: {}, log: [], pendingDamage: {},
        hitResult: null, saveResult: null, crippleQueue: [], explodeQueue: []
      };
      logEvent(state, `Mine detonates on ${def.name}`);
      return state;
    }
  }

  if (def.vectored) {
    state.aiming = { gid, si, mode: 'vectored', originHeading: ship.heading, remainingMove: maxR - dist };
  } else if (selOrderKey === 'CC') {
    state.aiming = { gid, si, mode: 'course_change', originHeading: ship.heading, remainingMove: 0 };
  }
  return state;
}

/* Set a ship's facing during a vectored pivot or Course-Change bonus turn
   (±45° clamp). A vectored pivot with move left opens the second-move step. */
export function aimShip(state, tx, ty) {
  const a = state.aiming;
  if (!a) return state;
  const grp = state.groups[a.gid];
  const aship = grp && grp.ships[a.si];
  if (aship) {
    const desired = headingToward(aship.x, aship.y, tx, ty);
    aship.heading = clampHeading(a.originHeading, desired, 45);
    if (a.mode === 'vectored' && a.remainingMove > 1) {
      state.vectoredSecondMove = { gid: a.gid, si: a.si, remaining: a.remainingMove };
    }
  }
  state.aiming = null;
  state.hoverPoint = null;
  return state;
}

/* Commit the second leg of a Vectored move (≤ remaining distance, ≤20° off-axis). */
export function commitVectoredSecondMove(state, tx, ty) {
  const v = state.vectoredSecondMove;
  if (!v) return state;
  const grp = state.groups[v.gid];
  const vship = grp && grp.ships[v.si];
  if (vship) {
    const dx = tx - vship.x, dy = ty - vship.y;
    const dist = Math.hypot(dx, dy);
    const fwd = headingVec(vship.heading);
    const cos = (fwd.x * dx + fwd.y * dy) / Math.max(0.0001, dist);
    const angOff = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
    if (dist <= v.remaining + 0.5 && angOff <= 20) {
      grp.moveTrail = grp.moveTrail || [];
      grp.moveTrail.push({ si: v.si, x: vship.x, y: vship.y, heading: vship.heading });
      const vBases = otherShipBases(state, v.gid, v.si);
      const vres = resolveBaseOverlap(vship.x, vship.y, tx, ty, shipBaseRadiusPx(getDef(state, v.gid)), vBases);
      vship.x = vres.x; vship.y = vres.y;
      vship.usedVectoredSecondMove = true;
    }
  }
  state.vectoredSecondMove = null;
  state.hoverPoint = null;
  return state;
}

/* Dispatch an intent to its mutator. Mutates `state` in place; returns it. */
export function apply(state, intent, rng) {
  switch (intent && intent.type) {
    case 'pass':         return passActivation(state);
    case 'endRound':     return beginEndRound(state);
    case 'applyOrder':   return applyOrder(state, rng, intent.gid, intent.order);
    case 'moveShip':     return commitMove(state, rng, intent.gid, intent.si, intent.x, intent.y, intent.layerToggle);
    case 'aimShip':      return aimShip(state, intent.x, intent.y);
    case 'vectoredMove': return commitVectoredSecondMove(state, intent.x, intent.y);
    default: throw new Error(`apply: unknown intent type "${intent && intent.type}"`);
  }
}
