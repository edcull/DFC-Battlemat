# DFC Battlemat

A fully self-contained, single-file tactical assistant for **Dropfleet Commander**. No server, no install, no dependencies — open `dfc_battlemat.html` in any modern browser and play.

---

## What it is

An interactive 48"×48" virtual battlemat that implements the full DFC rules engine. It handles the fiddly parts of the game — tracking hull, spikes, crippling effects, weapon arcs, AP, VP, asset launches, battalion landing, and all the rules interactions — so players can focus on tactics rather than administration.

Designed for **two players at the same screen** (hotseat), though the layout is clear enough to use alongside a physical game as a rules/tracking aid.

---

## Quick start

1. Open `dfc_battlemat.html` in Chrome, Firefox, or Edge.
2. **Setup** — choose factions, admirals, secondary objectives for each side, then pick deployment/approach/layout/variant/scoring objective. Hit **⚡ TEST SETUP** for an instant UCM vs Scourge game if you just want to try it.
3. **Scenery** — place or randomise scenery objects.
4. **Deploy** — click a group in the left panel, then click in your deployment zone to place ships. Set facing by clicking after placement. Use **↩ UNDO DEPLOY** to take a group back off-table.
5. **Play** — activate groups, move ships, assign weapon targets, fire, launch assets, and score VP. Click **FINISH ACTIVATION** after each group.

---

## Factions

Six factions are fully modelled with correct stats, weapons, specials, and launch profiles:

| Faction | Ships |
|---------|-------|
| **UCM** | Bruges, Edmonton, San Francisco, Toulon, New Orleans, Lima |
| **Shaltari** | Amber, Onyx, Topaz, Emerald (Mothership), Pearl, Turquoise (Voidgates) |
| **PHR** | Theseus, Ikarus, Orpheus, Pandora, Medea |
| **Resistance** | Battleship, Cruiser, Freerider, Troopship, Gunship |
| **Scourge** | Sphinx, Hydra, Wyvern, Gargoyle, Banshee |
| **Bioficer** | Full Bioficer roster with Payload/Porter mechanics |

---

## Rules implemented

### Core game loop
- Full six-phase round structure (Planning → Activation → Dropsite → Asset → Repair → End)
- All six **Orders**: General Quarters, Silent Running, Weapons Free, Course Change, Max Thrust, Damage Control
- Alternating activation with Pass Tokens
- Initiative roll (Admiral bonus, reversal, tiebreak)
- Coherency and formation benefits (incl. 4+ two-neighbour cluster rule)
- Layer movement (Orbit ↔ Atmosphere), Descent/Ascent costs

### Movement
- Full legal-move cone per order (min/max range, turn limits)
- Vectored thrust (pivot then second move)
- Course Change bonus turn after movement
- Movement-before-firing enforced — group must complete all movement before any ship fires, launches, or uses Detector
- **Hold Position** (CC/DC only) — mark moved-in-place without relocating
- **Undo Move** — reverts last move; disabled once a ship has fired/launched/detected
- Lead-ship measurement — all weapon arcs, range, and scenery effects for group fire measure from the lead ship

### Combat
- Full **attack modal**: hit rolls, critical hits, shield saves (ES/KS/BS), backup saves, Aegis-X, Close Protection (fighter re-rolls), two-phase save/backup sequence
- All weapon specials: Fusillade (per-ship, group fire correctly sums), Volley, Overcharge, Sustained Fire, High/Low Power, Linked, Alt, Limited, Calibre, Mauler, Penetrator, Flash, Bloom, Burnthrough, Scald, Reave, Critical, Arrest, Impel (turn or move choice), Anti-Wing, Crippling-Fire, Saturation
- **Crippling Effects** — abilities declared *before* 2D6 roll; Brace for Impact sets result to 4
- **Explosion AoE** — blast-radius aura shown on map; abilities declared before 1D6 roll; Contain Reactor sets result to 2; all ships on the same layer within range are hit (friend and foe)
- Close Action range uses firer's scan only (target signature/spikes give no extra reach)
- Dropsite feature weapons (Missile Halo, Orbital Defence Gun) fully playable with targeting, arc checks, and right-click cancel

### Ship specials (§15)
Shield-X, Reinforced Armour, Cloak-X, Command Ship-X, Regenerate-X, Stealth, Escort (hit redirect), Detector, Aegis-X, Monitor, Vanguard, Gateship/Mothership (Voidgate BFS network), Open Network (individual orders), Payload/Porter

### Assets
- Fighters, Bombers, Fire Ships, Torpedoes, Mines, Drop Pods, Dropships, Bulk Landers, Boarding Pods, Gate Dropships (Shaltari Voidgate teleport)
- Full asset combat phase (dogfights, bomber/torpedo/fire ship attacks, Close Protection)
- **Time to Target** ability (2 AP — second 6" move for fighters/bombers)
- Ground asset launch exhaustion — each ship can only launch once per activation
- Shaltari **Extract** — per-ship transport-value-limited extraction from Dropsites; carried count shown as ⬆N on ship markers

### Scoring
- **Standard** — control/contest at Rounds 4 & 6, with a per-Dropsite breakdown modal
- **Attrition** — +2 VP / 500 Kill Points at game end
- **Survey** — +1 VP per surveyed Dropsite at game end
- **Extract** — 2 VP per operative aboard a surviving ship; +1 VP per operative-carrier destroyed
- **Protect** — nominated Dropsite scores double while intact; penalty if Levelled; 🛡 marker on map
- **Breakthrough** — Red flies off for 1 VP/200 pts; Blue scores pts-destroyed
- **Raze** — double standard scoring for Levelled/Ruined Dropsites ≥24" from own zone; pts-destroyed
- All seven **secondary objectives** with manual nomination and ★ markers
- VP toasts on every award; clickable VP counter in topbar opens full breakdown with objective description

### Admiral abilities (core four)
| Cost | Ability |
|------|---------|
| 1 AP/die | **AP Re-roll** — after any roll, re-roll any dice (once per activation) |
| 2 AP | **Brace for Impact** — declare *before* Crippling roll; set result to 4 |
| 2 AP | **Contain Reactor** — declare *before* Explosion roll; set result to 2 |
| 2 AP | **Time to Target** — move a Fighter/Bomber Wing a second time up to 6" |

### Scenarios
- 7 **Deployment types**: Line, Table Corners, Midboard, From Corners, Attacker/Defender, Encirclement + more
- 6 **Approaches**: Standoff, Close Enough, Column, Counterattack, Delayed Response, Home Fleet Disadvantage
- 6 **Layouts**: Diagonal, Edge Case, Eruption, Gatecrash, Moonlight, Moonstruck
- 7 **Variants**: None, Guarded Sectors, Secure Comms Array, Battlescarred, Gridlocked, Expansive Atmosphere, Orbital Complex
- 7 **Scoring objectives** (see above)

---

## Interface

### Left panel — Fleet lists
- Group cards for each side; click to select a group
- AP chip at top of each fleet list — click to open AP adjuster
- Cards dim when it's not your side's turn; **LOCKED** when another group is mid-activation (one activation per side per turn)
- ✓ ACTIVATED badge after a group finishes

### Board (centre)
- 48"×48" SVG with 1" grid
- Ships shown with hull bar, crippling badges (🔥 fire, Nav/Wep/Scan/Def/Decay), spike indicators, carried-operative count (⬆N)
- Lead ship marked with ✦ for group fire
- Move cone shown when a ship is selected and has an order
- Weapon targeting highlights valid targets from the lead ship; right-click cancels
- Range auras: scan/sig/launch/extract/explosion radius as appropriate
- Deployment zones shown during deploy phase and reserve arrival

### Right panel — Detail + Event Log
- Top section: full ship/dropsite detail, weapon cards, launch cards, move stats, ability buttons
- **Event Log** docked at the bottom — last 3 events collapsed; click header to expand full scrollable history. Logs: orders, movement (distance + turn angle), weapon locks, hit/save results, AP use, Brace/Contain, crippling, explosions, launches (all types), detector, anti-wing, extracts, kills/captures, VP awards, round markers

### Topbar
- Phase breadcrumb (Setup → Scenery → Deploy → Play)
- During play: **VP counter** (click for full breakdown with objective description)
- Round indicator, End Round, Pass Activation, Reset

---

## Activation flow

1. Select a group (left panel or click a ship on board)
2. Pick an **Order** — all other same-side groups lock immediately
3. Move each ship in the group (in any order)
4. Assign weapon targets (click weapon card → click enemy ship)
5. Click **🔥 ENGAGE** to open the attack modal and resolve shooting
6. Launch assets, use Detector, or Extract as appropriate
7. Click **FINISH ACTIVATION ▸** — AP is spent, side flips to opponent

---

## Deployment

- **Deploy phase**: click a group, click in your DZ to place each ship, click again to set facing. Reposition by clicking a placed ship then clicking a new spot. **↩ UNDO DEPLOY** returns the whole group off-table.
- **Reserve arrival (play phase)**: off-table groups show DEPLOY NOW when eligible. Click in DZ to place, then pick an order. Ships can be redeployed (in-zone clicks) until the group acts.

---

## Known limitations

- **Named / Famous Admiral abilities** are not implemented (generic Admiral Level + Command Ship-X are).
- **Custom fleet import** is not implemented — the six built-in rosters cover the included ships only. A full New Recruit import system is designed and documented (`DFC_Fleet_Import_Plan.md`).
- **Multiplayer** is single-screen hotseat only. A WebSocket two-player plan exists (`DFC_Multiplayer_Plan.md`).
- **Single-player AI** is not implemented. A rules-bot + LLM-commander design is documented (`DFC_AI_Opponent_Plan.md`).
- A few §12 Dropsite interactions (Collateral Damage, attack-damage → feature removal) are partially implemented and worth confirming in play.

---

## File structure

```
web/index.html                  — Legacy self-contained app (~11,400 lines); deployed to GitHub Pages
client/
  index.html                    — Module-based client (imports from src/engine/)
  local.js                      — Hotseat glue: shared state + localRng
src/engine/
  constants.js                  — All fleet defs, ORDERS, LAYOUTS, ASSET_PROFILES, etc.
  rng.js                        — Seeded PRNG + Math.random wrapper for local play
  state.js                      — createState() factory, buildSideFleet(), rebuildFleets()
  mutators.js                   — All state-mutating functions (movement, combat, scoring…)
plans/
  DFC_Foundation_Architecture_Plan.md  — Engine extraction + server + online client (Phase 1 done)
  DFC_Fleet_Import_Plan.md             — New Recruit custom fleet import design
  DFC_Multiplayer_Plan.md              — WebSocket two-player design
  DFC_AI_Opponent_Plan.md              — Rules bot + LLM commander design
```

---

## Browser compatibility

Chrome, Firefox, and Edge (current versions). SVG, CSS Grid, and ES2020 are required — any browser from 2020+ will work. No internet connection required after the file is downloaded.

The module-based client (`client/index.html`) requires ES modules to be served over HTTP — use any static file server (e.g. `python -m http.server`) rather than opening the file directly.
