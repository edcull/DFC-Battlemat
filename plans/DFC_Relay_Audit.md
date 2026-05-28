# DFC Relay Audit — `renderAll()` Call Inventory

Audited 2026-05-29. Every call to `renderAll()` (no argument) in `client/index.html` triggers
`netAfterRender()` and sends the full game state to the opponent over the relay (legacy trusted-
relay path). This document classifies each call and tracks migration status.

`renderAll(true)` skips the relay (local-only). `dispatch(intent)` routes through the server-
authoritative intent path (preferred for shared game state).

---

## 1. Redundant after `dispatch()` — safe to remove `renderAll()`

`_netPendingIntent = true` is set inside `dispatch()`, which causes `netAfterRender()` to no-op.
The extra `renderAll()` is harmless but fires a wasted re-render in hotseat mode and clutters the
code. In online mode `dispatch()` does **not** call `renderAll()` — the server broadcast triggers
the re-render — so the trailing `renderAll()` is the only re-render that happens. Removing it
would break hotseat, so the correct fix is to let `dispatch()` call `renderAll()` itself (it
already does in offline/hotseat mode) and drop the trailing call.

| Handler | Intent dispatched |
|---|---|
| AP edit close | _(none — see §2)_ |
| Unlock weapon | `unlockWeapon` |
| Survey site | `surveySite` |
| Nominate / clear lead | `nominateLead` |
| Apply ship order | `applyShipOrder` |
| Objectives flyoff | `objectivesFlyoff` |
| Breakthrough flyoff | `breakthroughFlyoff` |
| Finish activation | `finishActivation` |
| DA finish dropsite | `daFinishDropsite` |
| DA switch side | `daSwitchSide` |
| DA end | `daEnd` |
| Start battalion combat | `startBattalionCombat` |
| BC pick dropsite | `bcPickDropsite` |
| BC assign ground | `bcAssignGround` |
| BC skip assign | `bcSkipAssign` |
| BC to destroy | `bcToDestroy` |
| BC finish | `bcFinish` |
| Resolve boarding | `resolveBoarding` |
| Start asset move | `startAssetMove` |
| Asset T2T | `assetT2T` |
| Asset lock target | `assetLockTarget` |
| Asset untarget | `assetUntarget` |
| Destroy DA feature | `daDestroyFeature` |
| Advance round | `advanceRound` |
| Extract recon (online) | `extractRecon` |
| Commit scenery | `commitScenery` |
| Begin play | `beginPlay` |
| Asset reset move | `assetResetMove` |
| Lock weapon target (board click) | `lockWeaponTarget` |

---

## 2. Should be `renderAll(true)` — UI / selection state only

No shared game state changes. The relay sends the full state to the opponent for no reason.
Fix: replace `renderAll()` with `renderAll(true)`.

### Modal open / close
| Location | State change |
|---|---|
| Cancel attack modal | `state.attackModal = null` |
| VP breakdown open | `state.vpBreakdownOpen = true` |
| VP breakdown / overlay close | `state.vpBreakdownOpen = false` |
| VP obj toggle | `state.vpObjOpen = !state.vpObjOpen` |
| Scoring modal close | `state.scoringModal = null` |
| Dogfight result dismiss | `state.dogfightResult = null` |
| AP edit open | `state.apEditOpen = side` |
| AP edit close / overlay | `state.apEditOpen = null` |

### Attack modal controls (ephemeral, inside `state.attackModal`)
| Location | State change |
|---|---|
| Reroll count ±  | `M.rerollN = ...` |
| Fighter spend ± | `M.fighterSpend[wingId] = ...` |

### UI mode toggle / cancel
| Location | State change |
|---|---|
| Anti-wing toggle on | `state.antiWing = {...}` |
| Anti-wing toggle off / cancel (escape, invalid) | `state.antiWing = null` |
| Anti-wing hit confirmed | `state.antiWing = null` |
| Detector toggle on | `state.detector = {...}` |
| Detector toggle off / cancel | `state.detector = null` |
| Detector hit confirmed | `state.detector = null` |
| Feature attack mode set | `state.featureAttack = {...}` |
| Feature attack cancel / escape | `state.featureAttack = null` |
| Feature attack mode end | `state.featureAttack = null` |
| Aiming / vectored move cancel | `state.aiming = null; state.vectoredSecondMove = null` |
| Asset move selected | `state.assetMove = {...}` |
| Asset move deselect / cancel | `state.assetMove = null` |
| Asset split count ± | `state.assetMove.count = ...` |
| Extracting cancel (escape) | `state.extracting = null` |
| Launching mode — dropsite feature | `state.launching = {...}` |
| Launching counter ± | `state.launching[which] = next` |
| Launching cancel / null-out | `state.launching = null` |
| Payload reattach cancel | `state.payloadReattach = null` |
| Payload reattach — porter at capacity | `state.payloadReattach = null` |
| Battalion deploy cancel (escape) | `state.battalionDeploy = null` |
| Pending ground launch cancel | `state.pendingGroundLaunch = null` |
| Hover point clear (escape) | `state.hoverPoint = null` |

### Dropsite / ship selection guards
| Location | Condition |
|---|---|
| Dropsite click (selection only) | `if (hadDropsiteSelected) renderAll()` × 4 |

### Peer network events
| Location | Notes |
|---|---|
| `peerJoined` message | Log event only; no state change |
| `opponentLeft` message | Log event only; no state change |

---

## 3. Legitimately relaying — intent migration needed

These mutate shared game state that the opponent needs to see. No `dispatch()` path exists yet.

### Attack modal opening (3 sites)

`state.attackModal = { ... }; renderAll()` — called when a player initiates a weapon attack,
a bomber attack, or a fireship/torpedo attack. The relay sends the full modal state so the
defender can observe the attack flow.

**Migration path:** The `fireWeapons` intent already applies weapons server-side and broadcasts the
result. The client should open the attack modal from the broadcast state rather than opening it
locally and relaying it. Requires `state.attackModal` to be initialised in `applyFireWeapons` /
a new server-side attack-open intent, and the client to react to `state.attackModal !== null` in
the incoming `full` state.

### `applyCrippling` / `applyExplosion` (called directly, not via intent)

The client calls `_applyCripplingNext(state, M)` / `_applyExplosionNext(state, rng, M)` directly
from the crippling/explosion modal buttons, then relays. These functions are exported from
`mutators.js` but not yet wired through the intent layer.

**Migration path:** Add `cripplingNext` and `explosionNext` intent types; gate on
`state.attackModal.step === 'crippling'` / `'explosion'`; apply server-side.

### Asset board movement (board click during asset phase)

After a board click during the asset phase, `afterAssetMove()` is called which handles
split/dogfight/scenery/mine interactions. The result is relayed. This is the largest remaining
relay block and is flagged in CLAUDE.md as complex.

**Migration path:** New `moveAsset` intent carrying the target position; server resolves all
split/dogfight/scenery logic; broadcasts result.

### Feature deploy (`dropsite` launch target)

`ds.features.push(fkey); renderAll()` — places a carried feature (e.g. Military Outpost) onto a
dropsite. No intent exists.

**Migration path:** New `deployFeature` intent `{ gid, si, li, dsId }`.

### Payload reattach

`best.ship.attachedTo = {...}; best.ship.offTable = true; renderAll()` — reattaches a detached
payload to its porter.

**Migration path:** New `reattachPayload` intent `{ gid, si, porterGid, porterSi }`.

### Repair phase progression

`R.step = 'repair'; renderAll()` etc. — advances through the repair-phase sub-steps. Currently
a client-driven relay.

**Migration path:** Fold into existing `advanceRound` intent or add a `repairStep` intent.

### Manual stat adjusters (debug / GM tools)

Spike ±, hull ±, battalion count ±, dropsite damage ± buttons. These are intentionally direct
mutations for mid-game corrections.

**Recommendation:** Leave as relay for now; these are GM/debug tools that should never be
available in a locked competitive game. Add a `#debug` guard if needed.

### Asset removal (debug)

`state.launchedAssets.splice(ai, 1); renderAll()` — right-click removes a launched asset.

**Recommendation:** Leave as relay (debug tool).

---

## 4. Setup / scenery phase — correct as-is

These call `renderAll()` during `phase === 'setup'` or `phase === 'scenery'`, where `renderAll`
routes through `netRelaySetup()` instead of `netAfterRender()`. No action needed.

- Scenario picker changes (`state.scenario = ...`)
- Fleet / colour / admiral / secondary selection
- Player name edits
- Scenery placement, rotation, commit, delete

---

## Migration priority

| Priority | Work item | Effort |
|---|---|---|
| 1 | Convert all §2 calls to `renderAll(true)` | Low — mechanical find-replace |
| 2 | Strip redundant `renderAll()` after `dispatch()` (§1) | Low — cosmetic |
| 3 | `deployFeature` intent | Small |
| 4 | `reattachPayload` intent | Small |
| 5 | `repairStep` / repair phase intent | Medium |
| 6 | Attack modal open via server state | Medium — changes modal lifecycle |
| 7 | `cripplingNext` / `explosionNext` intents | Medium |
| 8 | Asset board movement intent | Large — noted in CLAUDE.md as most complex remaining relay |
