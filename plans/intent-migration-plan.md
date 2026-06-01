# Intent Migration Plan — Remaining Relay → Server-Authoritative

## Principle

Everything that mutates shared game state (affects both clients or must appear in the intent log for replay) needs an intent. Pure local UI state (targeting mode entry, selection, view toggles) is fine staying local — it already syncs via relay and doesn't need server validation.

---

## What does NOT need migration (stay local)

These are UI-mode indicators that lead to a server-authoritative intent later, or are purely visual:

| State | Why local is fine |
|---|---|
| `state.selectedGroupId/ShipIdx/DropsiteId` | View state; resets each render |
| `state.targeting`, `state.antiWing`, `state.detector`, `state.extracting` | Mode flags; the resulting action (fireWeapons, launchAsset etc.) is already an intent |
| `state.launching.fighters/bombers/fireships` | Counter UI feeding into `launchAsset` intent |
| `state.payloadDetach/Reattach` | Mode entry; the actual detach/attach is already an intent |
| `state.featureAttack` | Targeting mode; the fire itself uses `fireFeatureWeapon` intent |
| `state.layerToggle`, `arcViewMode`, `_view3dTrails` | Local view preferences |
| `state.scoringModal`, `state.dogfightResult` (close) | Dismissing display-only modals |
| `state.sceneryPlace` | In-progress placement UI; `placeScenery` intent already handles the commit |
| `state.vpObjOpen/vpSecOpen` | VP breakdown accordion toggle |

---

## Phase 1 — Attack modal sub-state (replay correctness)

**Problem:** `M.rerollN` (reroll count) and `M.fighterSpend` (fighters spent on Close Protection) are mutated directly by UI buttons during the attack modal. These don't get into the intent log, breaking replay.

**New intents:**
- `attackSetReroll { rerollN }` — set reroll count for current shot
- `attackSetFighterSpend { gid, n }` — set fighter spend allocation

**Gating:** `state.attackModal` present, correct step (`'save'` or `'hit'`), correct side.

**Mutators:** update `M.rerollN` / `M.fighterSpend[k]` on the modal object.

**Client:** replace `M.rerollN = ...; renderAll()` with `dispatch({ type: 'attackSetReroll', rerollN })` etc.

---

## Phase 2 — Dropsite damage manual adjustment

**Problem:** The `[data-ds-damage-u/d]` buttons directly mutate `ds.damage` without going through an intent. If a dropsite is Ruined/Levelled by this, Demolish VP and debris events don't fire.

**New intent:** `adjustDropsiteDamage { dsId, delta }` (+1 / -1)

**Gating:** play or DA phase; `dsId` exists; delta ±1.

**Mutator:** apply delta to `ds.damage`; run the same Ruin/Level overflow logic as the bombardment path (including Demolish VP, RSE debris, etc.).

**Client:** replace direct `ds.damage++` with `dispatch({ type: 'adjustDropsiteDamage', dsId, delta: 1 })`.

---

## Phase 3 — Battalion count manual adjustment

**Problem:** `[data-bat-adj]` directly mutates `ds.battalions[key][side]` without an intent. No server validation, no replay entry.

**New intent:** `adjustBattalion { dsId, loc, side, delta }` 

**Gating:** play or DA phase; `dsId` + `loc` valid; delta ±1; result ≥ 0.

**Mutator:** clamp to 0, apply delta.

**Client:** replace direct mutation with dispatch.

---

## Phase 4 — DA feature attack modal open

**Problem:** `[data-da-feat]` sets `state.featureAttack = { dsId, fi, side }` directly. This is the wrong-side-click vulnerability: any client can open the feature attack modal regardless of whose DA turn it is.

**New intent:** `openDAFeatureAttack { dsId, fi }` — or fold into `fireFeatureWeapon` by making it a two-step click (select then target) both dispatched.

**Gating:** DA phase, `state.daActiveSide === side`, feature exists, not already fired, has weapon.

**Mutator:** set `state.featureAttack = { dsId, fi, side }`.

**Client:** replace direct mutation with dispatch; `fireFeatureWeapon` already handles the actual shot.

---

## Phase 5 — DA pick / dropsite selection during activation

**Problem:** `[data-da-pick]` sets `state.dropsiteActivation.dsId` directly, bypassing server validation. Should confirm the active side is picking and the dropsite is theirs to activate.

**New intent:** `daPickDropsite { dsId }`

**Gating:** DA phase, correct active side, dropsite controlled by that side.

**Mutator:** `state.dropsiteActivation.dsId = dsId`.

**Client:** replace direct mutation with dispatch.

---

## Phase 6 — Relay path battalion deploy

**Problem:** The relay-path branch of battalion deployment (when it falls through the DA phase for non-intent-migrated flows) directly mutates `ds.battalions` and selection state without an intent. This is the last significant relay-mode game mutation.

**Action:** Migrate to the intent path (`bcPickDropsite`, `bcAssignGround` etc. already exist). Audit which branch still uses the relay path and wire it to the existing intents.

---

## What stays on relay (intentional)

- Pre-game setup overlay (fleet choices, scenario, names, colours) — collaborative config, no legality needed.

---

## Summary table

| Phase | Intent(s) | State affected | Priority |
|---|---|---|---|
| 1 | `attackSetReroll`, `attackSetFighterSpend` | `attackModal.rerollN/fighterSpend` | High — breaks replay |
| 2 | `adjustDropsiteDamage` | `ds.damage`, Demolish VP, RSE events | High — game state |
| 3 | `adjustBattalion` | `ds.battalions` | Medium — game state |
| 4 | `openDAFeatureAttack` | `state.featureAttack` | Medium — wrong-side vulnerability |
| 5 | `daPickDropsite` | `state.dropsiteActivation.dsId` | Low — DA side already checked |
| 6 | Relay-path battalion deploy audit | `ds.battalions`, selection | Low — uncommon path |
