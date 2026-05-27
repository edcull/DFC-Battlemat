# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DFC-Battlemat is a zero-dependency, browser-based virtual battlemat for the **Dropfleet Commander** tabletop miniature wargame. There is no build system, no package manager, and no backend.

There are two entry points:
- **`web/index.html`** — the legacy standalone file (~11,400 lines, everything inline). Deployed to GitHub Pages. Open directly in any browser.
- **`client/index.html`** — the module-based client. Imports from `src/engine/`. Requires a local HTTP server (e.g. `python -m http.server`) due to ES module CORS rules, or open via a dev server.

## Running & Deployment

- **Legacy (simplest):** Open `web/index.html` directly in Chrome, Firefox, or Edge — no server needed
- **Module client:** Serve the repo root with any static server, then open `client/index.html`
- **Deploy:** Push to `main` → GitHub Actions (`.github/workflows/static.yml`) auto-deploys the `web/` directory to GitHub Pages
- **No build step, no lint, no test suite**

## Architecture

### Engine modules (`src/engine/`)

Phase 1 of the foundation refactor has been completed. The pure game logic has been extracted from the monolith into four ES modules:

| File | Contents |
|---|---|
| `src/engine/constants.js` | All fleet defs (6 factions), `FACTIONS`, `ORDERS`, `LAYOUTS`, `DEPLOYMENTS`, `ASSET_PROFILES`, etc. |
| `src/engine/rng.js` | Seeded PRNG (`makeRng(seed)`) + `localRng` (Math.random wrapper for browser play) |
| `src/engine/state.js` | `createState()` factory, `buildSideFleet()`, `rebuildFleets()` |
| `src/engine/mutators.js` | All state-mutating functions: movement, combat, scoring, asset resolution, etc. |

All engine functions take `state` (and `rng` where randomness is needed) as explicit parameters — no globals, safe for concurrent server use.

### Module-based client (`client/`)

| File | Contents |
|---|---|
| `client/index.html` | HTML/CSS + `<script type="module">`. Imports engine modules, defines all render functions, shims, and event handlers. |
| `client/local.js` | Hotseat glue: creates the shared `state` and exports `localRng`. |

**Shim pattern:** `client/index.html` exports state-bound wrapper functions (e.g. `function moveShip(...args) { return _moveShip(state, rng, ...args); }`) so the render/handler code can call engine functions without passing `state` explicitly. The shims live in a block immediately after the import block.

### Legacy monolith (`web/index.html`)

The original single-file app, kept intact and frozen. It continues to be deployed to GitHub Pages and does not receive new features. The internal structure:

| Approximate lines | Section |
|---|---|
| 1–955 | HTML head + CSS |
| 964–1303 | Fleet constants |
| 1450–2015 | Game constants (`ORDERS`, `LAYOUTS`, etc.) |
| ~1894–1953 | Global `state` object |
| ~2017–8704 | ~50+ render functions + `renderAll()` |
| ~9178+ | Event handlers |

### State & Rendering Pattern

**Single global `state` object** is the sole source of truth in both the legacy and module client. Every user interaction:

1. Event handler validates legality (gating via `state.phase`, `state.activeSide`, etc.)
2. Calls a mutator (engine function via shim) to update `state`
3. Calls `renderAll()` — re-renders the entire UI from scratch

`renderAll()` calls ~20 specialized render functions, all pure reads from `state`.

## Fleet & Faction Data

Each faction fleet is a constant array of ship class definitions in `src/engine/constants.js`:
```javascript
const UCM_FLEET = [{ id, name, role, pts, tonnage, thrust, scan, sig, hull,
                      es, ks, bs, weapons, launch, special }, ...]
```

Ships are cloned with side-prefixed IDs (`'ucm:u1'`, `'shal:s1'`) into `state.groups` at game start, preventing ID collisions in mirror matches.

## Planned Features

Architecture plans live in `plans/`:

- **Foundation** (`DFC_Foundation_Architecture_Plan.md`) — Phase 1 (engine extraction) **COMPLETE**. Phase 2 (Node server + WebSocket rooms) and Phase 3 (online client) pending.
- **Custom Fleet Import** (`DFC_Fleet_Import_Plan.md`) — parse New Recruit export format; depends on Phase 2
- **Two-Player Online** (`DFC_Multiplayer_Plan.md`) — WebSocket relay; depends on Phase 2
- **AI Opponent** (`DFC_AI_Opponent_Plan.md`) — rules-based heuristics + LLM; depends on Phase 2

`src/engine/gating.js` (the `legalActions()` / `isLegal()` API) is the remaining Phase 1 deliverable — gating logic currently lives in `client/index.html` handlers/render functions.

## Known Limitations

- Named admirals not implemented (uses generic admiral stats)
- No custom fleet import yet (only built-in faction rosters)
- No automated multiplayer or AI opponent
- Single-player hotseat only (two players share one screen)
- `src/engine/gating.js` not yet extracted — gating logic is still inline in `client/index.html`
