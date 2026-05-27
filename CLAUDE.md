# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DFC-Battlemat is a browser-based virtual battlemat for the **Dropfleet Commander** tabletop miniature wargame. The game UI is pure browser code (SVG/CSS/ES modules, no build step). An optional Node.js server adds online two-player rooms and shares the same engine as the browser.

There are three entry points:
- **`web/index.html`** — the legacy standalone file (~11,400 lines, everything inline). Zero dependencies, deployed to GitHub Pages. Open directly in any browser.
- **`client/index.html`** — the module-based client. Imports the engine from `src/engine/` and supports both local hotseat and online play. Requires an HTTP server (ES module CORS rules) — use the Node server below, or any static server (e.g. `python -m http.server`) for hotseat-only.
- **`server.js`** — the Node.js server (Express + WebSocket). Serves the client and hosts online relay rooms. Run with `npm start`.

## Running & Deployment

- **Legacy (simplest):** Open `web/index.html` directly in Chrome, Firefox, or Edge — no server, no install
- **Module client (hotseat):** Serve the repo root with any static server, then open `client/index.html`
- **Node server (online play):** `npm install`, then `npm start` (or `npm run dev` for `node --watch` auto-restart). Serves the client at `http://localhost:3000/client/index.html` and exposes the room REST API + `/ws` WebSocket
- **Deploy:** Push to `main` → GitHub Actions (`.github/workflows/static.yml`) auto-deploys the `web/` directory to GitHub Pages. Only the static legacy file is deployed; the Node server is not hosted by Pages
- **No build step, no lint, no test suite.** Runtime deps (Express, ws, fast-json-patch) are needed only by the Node server; both browser clients have none

## Architecture

### Engine modules (`src/engine/`)

The pure game logic has been extracted from the monolith into four ES modules (Phase 1 of the foundation refactor — complete except `gating.js`, see Planned Features). The engine has zero DOM dependencies and runs identically in the browser and on the server:

| File | Contents |
|---|---|
| `src/engine/constants.js` | All fleet defs (6 factions), `FACTIONS`, `ORDERS`, `LAYOUTS`, `DEPLOYMENTS`, `ASSET_PROFILES`, etc. |
| `src/engine/rng.js` | Seeded PRNG (`makeRng(seed)`) + `localRng` (Math.random wrapper for browser play) |
| `src/engine/state.js` | `createState()` factory, `buildSideFleet()`, `rebuildFleets()` |
| `src/engine/mutators.js` | All state-mutating functions: movement, combat, scoring, asset resolution, etc. |

All engine functions take `state` (and `rng` where randomness is needed) as explicit parameters — no globals, safe for concurrent server use.

### Server (`server.js`, `src/api.js`, `src/rooms.js`)

The Node.js server (Phase 2 of the refactor — complete) hosts online two-player rooms. It is **optional**: the browser clients work without it for hotseat play.

| File | Contents |
|---|---|
| `server.js` | Express + WebSocket entry point. Serves the repo root as static files (so the browser can load `client/` and `src/`), mounts the `/api` router, and upgrades `/ws` requests to WebSocket. Listens on `PORT` (default 3000). |
| `src/api.js` | REST routes (`POST /api/rooms`, `GET /api/rooms/:id`) and the WebSocket connection/message handler. |
| `src/rooms.js` | In-memory room lifecycle: create/join/leave, side slots (`ucm`/`shal`) + spectators, broadcast/send helpers, and a 4-hour inactivity TTL. No persistence. |

Each room holds the authoritative `state` and a seeded `rng` (from `makeRng`). **The current model is a trusted relay:** the active client mutates its own `state` and pushes the full object (`{type:'state'}`); the server stores it and rebroadcasts (`{type:'full'}`) to the other side and spectators. Server-side legality/turn enforcement is intentionally deferred until `gating.js` exists — `api.js` carries an `intent` message stub that currently returns "not yet implemented".

### Module-based client (`client/`)

| File | Contents |
|---|---|
| `client/index.html` | HTML/CSS + `<script type="module">`. Imports engine modules; defines all render functions, shims, event handlers, **and the inline networking + mode-selector code** (mode screen offers local hotseat, online host, online join). |
| `client/local.js` | Hotseat glue: creates the shared `state` and exports `localRng`. |

**Shim pattern:** `client/index.html` exports state-bound wrapper functions (e.g. `function moveShip(...args) { return _moveShip(state, rng, ...args); }`) so the render/handler code can call engine functions without passing `state` explicitly. The shims live in a block immediately after the import block.

**Online mode:** the originally-planned separate `client/net.js` and `client/render.js` were never created — networking and rendering live inline in `client/index.html` (same pragmatic choice as the shims). In online mode the client opens a WebSocket to `/ws?room=…&side=…`, pushes full state after each local action, and re-renders on each incoming state. UI gating blocks the non-active side from acting on the opponent's groups.

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

Architecture plans live in `plans/`. The Foundation plan's section 8 holds the authoritative phase-by-phase status table.

**Done:**
- **Foundation Phase 1** (`DFC_Foundation_Architecture_Plan.md`) — engine extraction (`constants`, `rng`, `state`, `mutators`). Complete *except* `gating.js`.
- **Foundation Phase 2** — Node server + WebSocket rooms (`server.js`, `src/api.js`, `src/rooms.js`), trusted-relay model.
- **Foundation Phase 3** — online client: mode selector (hotseat / host / join), WebSocket networking, and UI side-gating in `client/index.html`.

**Pending:**
- **`src/engine/gating.js`** — the `legalActions()` / `isLegal()` API (Foundation Phase 1d). Gating logic still lives inline in `client/index.html` handlers/render functions. This is the key blocker: extracting it lets the server move from trusted relay to authoritative intent dispatch with real turn enforcement.
- **Custom Fleet Import** (`DFC_Fleet_Import_Plan.md`) — `src/fleet/` parser + ship/weapon DBs for the New Recruit export format.
- **AI Opponent** (`DFC_AI_Opponent_Plan.md`) — `src/ai/` rules-based heuristics + optional LLM commander; depends on `gating.js` (`legalActions`).
- **Production deploy** (`DFC_Multiplayer_Plan.md`) — nginx/TLS/systemd hosting for live online play.

## Known Limitations

- Named admirals not implemented (uses generic admiral stats)
- No custom fleet import yet (only built-in faction rosters)
- No AI opponent yet
- Online multiplayer is a **trusted relay** — no server-side legality/turn enforcement (deferred until `gating.js`); the client UI does the gating. Online play also requires running the Node server (the GitHub Pages deploy is hotseat-only)
- `src/engine/gating.js` not yet extracted — gating logic is still inline in `client/index.html`
