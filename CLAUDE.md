# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DFC-Battlemat is a zero-dependency, browser-based virtual battlemat for the **Dropfleet Commander** tabletop miniature wargame. The entire application is a single self-contained HTML file (`web/index.html`, ~11,400 lines). There is no build system, no package manager, and no backend — open the file in a browser to run it.

## Running & Deployment

- **Run locally:** Open `web/index.html` directly in Chrome, Firefox, or Edge (no server needed)
- **Deploy:** Push to `main` → GitHub Actions (`.github/workflows/static.yml`) auto-deploys the `web/` directory to GitHub Pages
- **No build step, no lint, no test suite** — changes to `web/index.html` are the full change

## Architecture: Monolithic Single-File

All game logic, rendering, styling, and state live in one file. The internal structure of `web/index.html`:

| Approximate lines | Section |
|---|---|
| 1–955 | HTML head + CSS (dark theme, grid layout) |
| 964–1303 | Fleet constants (6 factions: UCM, Shaltari, PHR, Resistance, Scourge, Bioficer) |
| 1305 | `FACTIONS` registry mapping faction keys to fleet arrays |
| 1450–2015 | Game constants: `ORDERS`, `LAYOUTS`, `DEPLOYMENTS`, `VARIANTS`, objectives, etc. |
| ~1894–1953 | Global `state` object (~50+ top-level properties) |
| ~2017–8704 | ~50+ render functions, all called by `renderAll()` |
| ~6098–6141 | `ASSET_PROFILES` (faction asset stats) |
| ~9178+ | Event handlers (~37 click/hover/drag listeners) |

## State & Rendering Pattern

**Single global `state` object** is the sole source of truth. Every user interaction follows this pattern:

1. Event handler identifies target and validates legality (gating via `state.phase`, `state.activeSide`, etc.)
2. Mutates `state`
3. Calls `renderAll()` — which re-renders the entire UI from scratch

`renderAll()` calls ~20 specialized render functions, all pure reads from `state`. No side effects in render logic.

## Fleet & Faction Data

Each faction fleet is a constant array of ship class definitions:
```javascript
const UCM_FLEET = [{ id, name, role, pts, tonnage, thrust, scan, sig, hull,
                      es, ks, bs, weapons, launch, special }, ...]
```

When a game starts, ships are cloned with side-prefixed IDs (`'ucm:u1'`, `'shal:s1'`) and placed into `state.groups`. This prevents ID collision, including mirror matches.

## Planned Features (Not Yet Implemented)

Three architectural plans exist in `plans/`:

- **Custom Fleet Import** (`DFC_Fleet_Import_Plan.md`) — parse New Recruit export format into a `SHIP_DB`/`WEAPON_DB`
- **Two-Player Online** (`DFC_Multiplayer_Plan.md`) — WebSocket relay or server-authoritative; requires engine/DOM decoupling first
- **AI Opponent** (`DFC_AI_Opponent_Plan.md`) — rules-based heuristics and/or LLM-driven; requires a headless engine API (`legalActions()`, `apply()`)

All three share the prerequisite of **decoupling the rules engine from DOM rendering**, which would require splitting the monolith.

## Known Limitations

- Named admirals not implemented (uses generic admiral stats)
- No custom fleet import yet (only built-in faction rosters)
- No automated multiplayer or AI opponent
- Single-player hotseat only (two players share one screen)
