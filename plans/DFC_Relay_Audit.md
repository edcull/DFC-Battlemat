# DFC Relay Audit — Eliminating Client-to-Client State Relay

**Goal:** No client should ever send game state to another client. All state changes must go to
the server via `dispatch(intent)`, be validated by `isLegal`, applied by `apply`, and broadcast
as a `full` state update. The relay path (`netAfterRender` / `netRelaySetup`) must be removed.

Last updated: 2026-05-31.

---

## How the relay works today

- `renderAll()` (no arg) → calls `netAfterRender()` → sends full state to opponent (trusted relay).
- `renderAll(true)` → local only, no network send. Correct for UI-only changes.
- `dispatch(intent)` → server validates + applies + broadcasts. Correct path for all game state.

---

## 1. UI-only calls leaking over relay — fix: `renderAll()` → `renderAll(true)`

These change ephemeral UI state only (modal open/close, selection, toggles). The opponent has no
use for them. Sending them wastes bandwidth and can overwrite opponent-side UI state.

| Location | State change |
|---|---|
| Cancel attack modal | `state.attackModal = null` |
| VP breakdown open | `state.vpBreakdownOpen = true` |
| VP breakdown / overlay close | `state.vpBreakdownOpen = false` |
| VP obj / sec toggles | `state.vpObjOpen`, `state.vpSecOpen` |
| Scoring modal close | `state.scoringModal = null` |
| Dogfight result dismiss | `state.dogfightResult = null` |
| AP edit open (~line 1848) | `state.apEditOpen = side` |
| AP edit close (~lines 6537–6538) | `state.apEditOpen = null` |
| Anti-wing toggle on/off/cancel | `state.antiWing = {...}` / `null` |
| Detector toggle on/off/cancel | `state.detector = {...}` / `null` |
| Feature attack mode set/cancel | `state.featureAttack = {...}` / `null` |
| Aiming / vectored move cancel | `state.aiming = null; state.vectoredSecondMove = null` |
| Asset move select/deselect/cancel | `state.assetMove = {...}` / `null` |
| Asset split count ± | `state.assetMove.count = ...` |
| Extracting cancel | `state.extracting = null` |
| Launching mode — dropsite feature | `state.launching = {...}` |
| Launching counter ± | `state.launching[which] = next` |
| Launching cancel | `state.launching = null` |
| Payload reattach cancel | `state.payloadReattach = null` |
| Battalion deploy cancel | `state.battalionDeploy = null` |
| Pending ground launch cancel | `state.pendingGroundLaunch = null` |
| Hover point clear | `state.hoverPoint = null` |
| Dropsite click — selection only | `if (hadDropsiteSelected) renderAll()` × 4 |
| Peer join / opponent left events | Log only, no state change |

---

## 2. Redundant `renderAll()` after `dispatch()` — fix: remove the trailing call

`dispatch()` already calls `renderAll()` in hotseat mode and triggers a re-render via server
broadcast in online mode. The trailing `renderAll()` is dead in online mode and wasteful in
hotseat. If `dispatch()` doesn't already call `renderAll()` internally in all code paths, fix
that there — don't add trailing calls at each call site.

| Location | Intent dispatched |
|---|---|
| ~line 6768 | `giveInitiative` |
| ~line 6773 | `beginActivation` |
| ~line 8007 | `aimShip` |
| ~line 11682/11686 | `setNomination` |

---

## 3. Remaining relay calls — intent migration needed

These mutate shared game state that the opponent must see, but have no `dispatch()` path yet.
Each needs a new intent type, an `isLegal` case, and an `apply` handler.

### 3a. Attack modal open (3 sites, ~lines 4540 area)

`state.attackModal = { ... }; renderAll()` — fires when a player initiates a weapon, bomber, or
fireship/torpedo attack. The relay sends the full modal state so the defender sees the attack.

**Migration:** `fireWeapons` already applies server-side and broadcasts. Server should initialise
`state.attackModal` inside `applyFireWeapons` (or a new `openAttackModal` intent) so the client
reacts to `state.attackModal !== null` in the incoming broadcast rather than setting it locally.

### 3b. `cripplingNext` / `explosionNext`

`_applyCripplingNext(state, M)` / `_applyExplosionNext(state, rng, M)` are called directly from
modal buttons. The resolver functions exist in `mutators.js` but aren't wired through `apply()`.

**Migration:** Add `cripplingNext` and `explosionNext` intent types; gate on
`state.attackModal.step === 'crippling'` / `'explosion'`; roll server-side.

### 3c. Asset board movement (~line 1637)

After a board click during the asset phase, `afterAssetMove()` resolves split / dogfight /
scenery / mine interactions and calls `renderAll()`. This is the largest remaining relay block.

**Migration:** New `moveAsset` intent `{ assetIdx, x, y }`. Server resolves all interaction
logic; broadcasts result.

### 3d. Feature deploy — `deployFeature` (~line 1640 area)

`ds.features.push(fkey); renderAll()` — places a carried feature (e.g. Military Outpost) onto a
dropsite when launching to a `dropsite` target.

**Migration:** New `deployFeature` intent `{ gid, si, li, dsId }`.

### 3e. Payload reattach

`best.ship.attachedTo = {...}; best.ship.offTable = true; renderAll()` — reattaches a detached
payload to its porter.

**Migration:** New `reattachPayload` intent `{ gid, si, porterGid, porterSi }`.

### 3f. Repair phase progression

`R.step = 'repair'; renderAll()` etc. — advances through repair-phase sub-steps.

**Migration:** Fold into `advanceRound` or add a `repairStep` intent.

---

## 4. Debug / GM tools — leave as relay or gate behind a flag

These are intentional direct mutations for mid-game corrections. They should never be available
in a locked competitive game. Leave on relay for now; add a `#debug` URL guard if needed.

| Tool | Mutation |
|---|---|
| Spike ± (~lines 10617, 10623) | `grp.spikes++/--` |
| Hull ± (~lines 10649, 10666) | `ship.hull++/--` |
| Dropsite damage ± (~lines 10630, 10636) | `ds.damage++/--` |
| Asset removal (right-click) | `state.launchedAssets.splice(ai, 1)` |
| Battalion count ± | direct mutation |

---

## 5. Setup / scenery phase — correct as-is

`renderAll()` during `phase === 'setup'` or `phase === 'scenery'` routes through
`netRelaySetup()`, not `netAfterRender()`. Pre-game config (fleet, colour, admiral, secondary,
scenario, player names, scenery placement) is acceptable as setup-phase relay and is low priority
for intent migration.

---

## Migration priority

| Priority | Work item | Effort |
|---|---|---|
| 1 | §1 — convert UI-only calls to `renderAll(true)` | Low — mechanical sweep |
| 2 | §2 — remove redundant `renderAll()` after `dispatch()` | Low — find and delete |
| 3 | `deployFeature` intent | Small |
| 4 | `reattachPayload` intent | Small |
| 5 | `repairStep` intent | Medium |
| 6 | Attack modal open via server state (§3a) | Medium — changes modal lifecycle |
| 7 | `cripplingNext` / `explosionNext` intents | Medium |
| 8 | `moveAsset` intent — asset board movement | Large — most complex remaining relay |
