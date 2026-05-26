# DFC Battlemat — New Recruit Fleet Import: Implementation Plan

> **Status (May 2026): NOT YET IMPLEMENTED — plan document only.**
> 
> **Current ship roster (built into the engine):**
> - UCM: 6 ships (Bruges cruiser, Edmonton heavy carrier, San Francisco troopship,
>   Toulon frigates, New Orleans strike carriers, Lima detector frigates)
> - Shaltari: 6 ships (Amber battlecruiser, Onyx heavy cruiser, Topaz cruiser,
>   Emerald mothership, Pearl frigates, Turquoise voidgates)
> - PHR: 5 ships (Theseus, Ikarus, Orpheus, Pandora, Medea)
> - Resistance: 5 ships (Resistance Battleship, Cruiser, Freerider, Troopship, gunship)
> - Scourge: 5 ships (Sphinx, Hydra, Wyvern, Gargoyle, Banshee)
> - Bioficer: 8 ships (full Bioficer roster with payload mechanics)
> 
> The plan below remains accurate. The `SHIP_DB`/`WEAPON_DB` approach is still the right
> architecture — the existing engine ships are already in exactly the shape described in §4.
> Building the full stats DB and the New Recruit parser remain the main work items.


Goal: let a player paste a New Recruit fleet export and play with that exact custom list,
chosen **before** scenario selection, for either or both sides.

---

## 1. The core problem (and why it shapes everything)

The New Recruit export is **names + points only**. Example lines:

```
Rio Cruisers [170 pts]:
• 2x Rio Cruiser [85 pts]: UF-6400 Mass Driver Turrets, UF-4200 Mass Driver Turrets
Santiago Corvettes [80 pts]:
• 4x Santiago Corvette [20 pts]: Stingray Missile Bays
```

It contains **no stats** — no Thrust/Scan/Sig/Hull/saves, no weapon Att/Lock/Dmg/Type/Special,
no launch values. The app's renderer needs all of that. Today the app only carries a tiny
curated roster per faction (Bruges, Edmonton, …), so most ships in a real list (Madrid, Rio,
Santiago, Las Vegas, Johannesburg, …) **don't exist in the runtime**.

**Therefore the importer is two things, not one:**
1. A **parser** for the New Recruit text format → a structured list of {ship name, count, weapons, admiral, secondaries}.
2. A **stats database** that resolves each ship name + weapon name to full stats.

The full stats already exist in project knowledge (Combined Fleet Stats PDFs + the
`*_Fleet_Reference.md` files). They are **not** in the running app. So the heart of this feature
is building and embedding that database.

---

## 2. Build a master stats database (the big lift)

Create two embedded lookup tables, keyed by the **exact display names** New Recruit uses.

### 2.1 `SHIP_DB` — every ship class, per faction
```js
const SHIP_DB = {
  ucm: {
    "Rio Cruiser":        { role:'Cruiser', tonnage:'M', pts:85,  groupSize:2, thrust:8, scan:6, sig:6, hull:10, es:'4+', ks:'3+', bs:'—', special:'—' },
    "Madrid Cruiser":     { role:'Cruiser', tonnage:'M', pts:86,  groupSize:2, thrust:8, scan:6, sig:6, hull:10, es:'4+', ks:'3+', bs:'—', special:'—' },
    "Santiago Corvette":  { role:'Corvette', tonnage:'L', pts:20, groupSize:4, thrust:14, scan:6, sig:2, hull:2, es:'5+', ks:'6+', bs:'—', special:'Descent, Rare' },
    "Las Vegas Command Carrier": { …, special:'Command Ship-1, Detector, Unique', launchOptions:[…] },
    // …every UCM hull
  },
  shaltari: { … }, phr:{ … }, resistance:{ … }, scourge:{ … }, bioficer:{ … }
};
```

### 2.2 `WEAPON_DB` — every weapon system, keyed by name
```js
const WEAPON_DB = {
  "UF-6400 Mass Driver Twin Turrets": { arc:'F/S', att:4, lock:'3+', dmg:1, type:'K', special:'Critical-1, Volley-2' },
  "UF-4200 Mass Driver Turrets":      { arc:'F/S', att:4, lock:'4+', dmg:1, type:'K', special:'Fusillade-2' },
  "Stingray Missile Bays":            { arc:'F/S/R', att:4, lock:'3+', dmg:1, type:'K', special:'Air to Air, Close Action' },
  "Fighters & Bombers":               { launch:true, n:2, type:'fighter_bomber' },   // launch entries
  "Bulk Landers":                     { launch:true, n:4, type:'bulk_lander' },
  "Dropships":                        { launch:true, n:1, type:'dropship' },
  // …every weapon + launch load across all factions
};
```

**How to populate:** transcribe from the Combined Fleet Stats PDFs / `*_Fleet_Reference.md`
(both in project knowledge). This is mechanical but large — ~150–250 ship entries and ~150
weapon entries across six factions. Worth generating with a script that parses the `.md`
reference tables (they're already in clean Markdown table form) into the two objects, then
embedding the result as a JS literal in the file.

**Scope decision:** start with **UCM complete** (the example, and the existing curated set), then
add factions one at a time. Importer gracefully reports any name it can't resolve rather than
failing the whole import (see §5).

---

## 3. The parser (`parseNewRecruit(text)`)

New Recruit's format is regular and line-oriented. Parse top-down:

- **Header line**: `Faction - List Name - [991 pts]` → faction (map "United Colonies of Mankind"→`ucm`,
  "Post Human Republic"→`phr`, "The Scourge"→`scourge`, "Shaltari Tribes"→`shaltari`,
  "The Resistance"→`resistance`, "Bioficers"→`bioficer`), list name, total points.
- **`## Admirals`**: `Lvl N: <Title> [pts]: <Ability>` → `{ level:N, title, ability }`.
- **`## Heavy/Medium/Light Groups`**: section headers — note tonnage but rely on the ship DB for truth.
- **Group entries**, two shapes:
  - Single-line: `Las Vegas Command Carrier [145 pts]: <weapons csv>`
  - Multi-line with bullets:
    ```
    Rio Cruisers [170 pts]:
    • 2x Rio Cruiser [85 pts]: <weapons csv>
    ```
    → count = `2`, unit name = `Rio Cruiser`, weapons = csv after the colon.
- **Weapons CSV**: split on commas; each token is a `WEAPON_DB` key or a launch load
  ("Fighters & Bombers", "Bulk Landers", "Dropships"…). Order is preserved.
- **`## Reference` / `## Game`**: `Secondary Objectives: Key Site, Gather Intel` → map to the
  secondary keys already in the app (Gather Intel, Annihilate, etc.; ignore unsupported ones with a note).

Output a normalized structure:
```js
{ faction:'ucm', name:'UCMF Taskforce 991', pts:991,
  admiral:{ level:1, title:'Captain', ability:'Mass Driver Volley' },
  groups:[ { unitName:'Rio Cruiser', displayName:'Rio Cruisers', count:2, weapons:['UF-6400 …','UF-4200 …'] }, … ],
  secondaries:['gather_intel'] /* mapped subset */, warnings:[…] }
```

**Parser robustness:** tolerate the `•`/`*`/`-` bullet variants, optional leading whitespace,
"1x" being implicit on single-line entries, and stray blank lines. Ignore `Game Size`, points
subtotals in section headers, and the `## Configuration` block.

---

## 4. Assemble a runtime fleet (`buildImportedFleet(parsed)`)

For each parsed group, produce a ship def in the **exact shape the app already uses**
(`{id,name,role,pts,tonnage,side,thrust,scan,sig,hull,es,ks,bs,groupSize,weapons:[…],launch:[…],special}`):

1. Look up the unit in `SHIP_DB[faction][unitName]` → base stats.
2. Resolve each weapon token via `WEAPON_DB`. Launch loads become `launch:[…]` entries
   (with the right `type`), combat weapons become `weapons:[…]` entries.
3. `groupSize` = the parsed `count` (New Recruit fixes the squadron size in the list).
4. Assign a unique `id` (e.g. `imp1`, `imp2`, …) — `buildSideFleet` already side-prefixes and
   deep-clones, so imported defs flow through the existing pipeline unchanged.
5. Map launch loads that share a hardpoint (Bulk Landers / Fire Ships) to the existing `link` convention.

The resulting array is a drop-in replacement for a `*_FLEET` constant.

---

## 5. Wiring it into the app

### 5.1 Registry & state
- Add an `imported` faction slot dynamically: `state.importedFleets = { f1:null, f2:null }`
  holding `{name, fleet, admiralLevel, secondaries}` per fleet slot.
- `buildSideFleet(side)` already reads `FACTIONS[fk].fleet`. Extend it: if the slot is flagged
  imported, use `state.importedFleets[slot].fleet` instead of the static constant. Minimal change.

### 5.2 Setup UI (before scenario selection — the requested gate)
- Under each FLEET dropdown, add an **"⊕ IMPORT FROM NEW RECRUIT"** button → opens a modal with a
  `<textarea>` to paste the export and an **Import** button.
- On import: run `parseNewRecruit` → `buildImportedFleet`. On success, the fleet slot shows
  "✓ Imported: <list name> (<pts>)" and the faction dropdown locks to the parsed faction (for
  faction-specific assets/abilities). Admiral level + secondaries auto-fill from the import
  (overriding the manual pickers for that slot).
- The existing **scenario grid stays locked** until both slots are ready — imported fleets count
  as ready, exactly like the current `bothFleetsSelected()` gate, so import naturally happens
  before scenario selection.

### 5.3 Validation & feedback (critical for trust)
- The parser collects `warnings`: unknown ship name, unknown weapon name, points mismatch
  (sum of parsed group pts ≠ header pts), unsupported secondary objective.
- The import modal shows a **preview**: parsed groups with resolved stats, plus a warnings panel.
  Import is allowed only if every ship + weapon resolved; unknown names are highlighted so the user
  can correct the DB or edit the text. (A points-mismatch is a soft warning, not a block.)
- Round-trip sanity check: recomputed total vs header total.

---

## 6. Phasing (each step independently shippable + node-validated)

1. **Parser only** — `parseNewRecruit` + a debug "Preview parse" dump (no stats yet). Validates the
   text format against the example and a couple of other faction exports.
2. **UCM stats DB** — `SHIP_DB.ucm` + the `WEAPON_DB` entries UCM needs; `buildImportedFleet`;
   import the example fleet end-to-end and play it. (Highest value: covers the example.)
3. **Setup UI + registry wiring** — import button, modal, preview, slot-ready gating, faction lock,
   admiral/secondary auto-fill.
4. **Remaining factions** — populate `SHIP_DB`/`WEAPON_DB` for PHR, Scourge, Shaltari, Resistance,
   Bioficer (one faction per increment, each validated against a real export).
5. **Polish** — points-mismatch warnings, unknown-name highlighting, persistence of the last import,
   and handling Payload/Porter ships (Bioficer) + linked launches in imports.

---

## 7. Known hard spots / honest caveats

- **DB completeness is the whole game.** The feature is only as good as the embedded stats; every
  ship/weapon a user might field must be in the DB or the import reports it unresolved. Generating
  the DB from the `.md` reference tables (script-assisted) is the reliable path.
- **Faction-specific launch profiles** (fighters/bombers/torpedoes) already exist in
  `ASSET_PROFILES`; imported ships just need their `launch[].type` set correctly so they hook in.
- **Custom/“ship-by-ship” weapon loadouts** (Resistance Hardpoints, Bioficer Payloads, alt weapons)
  vary per ship in a group — New Recruit lists them per unit, so the parser must keep weapons
  attached to the specific unit line, not the group header. The app currently assumes one weapon
  set per group; mixed-loadout groups would need the group split into per-ship defs (doable, since
  `groupSize` + per-ship weapon arrays are supported, but it's the trickiest case).
- **Named/Famous flagships and Admirals-on-a-ship**: the admiral is a list-level entity in the
  export; map it to `state.admiralLevel` (already wired) and, if it names a flagship, match that
  ship in the DB. Command Ship-X interaction with AP is already implemented.
- **Unsupported content** (features bought in list, secondary objectives the app doesn't score)
  should import with a visible note rather than silently dropping.

---

## 8. Bottom line

The parser and UI are modest, well-scoped work. The real investment is the **embedded stats
database** transcribed from the fleet references. Recommended order: **parser → UCM DB + end-to-end
import of the example → setup UI → remaining factions**. That sequence gets the pasted example list
playable as early as step 2, then broadens coverage faction by faction.
