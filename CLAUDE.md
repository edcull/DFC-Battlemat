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

The pure game logic has been extracted from the monolith into ES modules. The engine has zero DOM dependencies and runs identically in the browser and on the server:

| File | Contents |
|---|---|
| `src/engine/constants.js` | All fleet defs (6 factions), `FACTIONS`, `ORDERS`, `LAYOUTS`, `DEPLOYMENTS`, `ASSET_PROFILES`, etc. |
| `src/engine/rng.js` | Seeded PRNG (`makeRng(seed)`) + `localRng` (Math.random wrapper for browser play) |
| `src/engine/state.js` | `createState()` factory, `buildSideFleet()`, `rebuildFleets()` |
| `src/engine/mutators.js` | All state-mutating functions (combat, scoring, asset resolution…), the shared crippling/explosion resolvers (`makeCrippleRoll`, `rollCrippleEffect`, `makeExplosionRoll`, `rollExplosionEffect`, `applyExplosionEffect`), plus `apply(state, intent, rng)`, the intent dispatcher. |
| `src/engine/gating.js` | Intent legality: `isLegal(state, intent, side)` + `legalActions(state, side)`. Covers all migrated intent families; un-migrated families fall through to `default: return false`. |

All engine functions take `state` (and `rng` where randomness is needed) as explicit parameters — no globals, safe for concurrent server use.

**Intent layer:** an "intent" is a small serialisable action `{ type, ...payload }`. `gating.js#isLegal` is the single legality gate (run by the server before applying, and by the client before mutating in hotseat); `mutators.js#apply` dispatches an intent to its mutator. Every intent type `apply()` handles must have a matching `isLegal` case. This is the mechanism by which the server becomes authoritative — see Planned Features for the migration status.

### Server (`server.js`, `src/api.js`, `src/rooms.js`)

The Node.js server (Phase 2 of the refactor — complete) hosts online two-player rooms. It is **optional**: the browser clients work without it for hotseat play.

| File | Contents |
|---|---|
| `server.js` | Express + WebSocket entry point. Serves the repo root as static files (so the browser can load `client/` and `src/`), mounts the `/api` router, and upgrades `/ws` requests to WebSocket. Listens on `PORT` (default 3000). |
| `src/api.js` | REST routes (`POST /api/rooms`, `GET /api/rooms/:id`) and the WebSocket connection/message handler. |
| `src/rooms.js` | In-memory room lifecycle: create/join/leave, side slots (`ucm`/`shal`) + spectators, broadcast/send helpers, and a 4-hour inactivity TTL. No persistence. |

Each room holds the authoritative `state` and a seeded `rng` (from `makeRng`). The server is **migrating from trusted relay to server-authoritative**, and currently runs both paths:
- **Intent path (authoritative):** `{type:'intent', intent}` → `isLegal(room.state, intent, side)` (reject + resync if illegal) → `apply(room.state, intent, room.rng)` → broadcast `{type:'full'}` to everyone. Migrated action families use this; the client does **not** mutate locally for these.
- **Relay path (legacy, trusted):** `{type:'state'}` → store as authoritative → rebroadcast `{type:'full'}` to the others. Used by every action family not yet migrated to an intent.

As more families move to intents, the relay path shrinks toward removal.

### Module-based client (`client/`)

| File | Contents |
|---|---|
| `client/index.html` | HTML/CSS + `<script type="module">`. Imports engine modules; defines all render functions, shims, event handlers, **and the inline networking + mode-selector code** (mode screen offers local hotseat, online host, online join). |
| `client/local.js` | Hotseat glue: creates the shared `state` and exports `localRng`. |

**Shim pattern:** `client/index.html` exports state-bound wrapper functions (e.g. `function moveShip(...args) { return _moveShip(state, rng, ...args); }`) so the render/handler code can call engine functions without passing `state` explicitly. The shims live in a block immediately after the import block.

**Online mode:** the originally-planned separate `client/net.js` and `client/render.js` were never created — networking and rendering live inline in `client/index.html` (same pragmatic choice as the shims). In online mode the client opens a WebSocket to `/ws?room=…&side=…` and re-renders on each incoming state. UI gating blocks the non-active side from acting on the opponent's groups.

**`dispatch(intent)`** is the migration seam toward server authority. Handlers that have been migrated call `dispatch(intent)` instead of mutating directly: in hotseat it validates with `isLegal` then applies locally and re-renders; online it emits `{type:'intent'}` and waits for the server's authoritative broadcast (no local mutation). Un-migrated handlers still mutate `state` directly and rely on `netAfterRender()` pushing the full state via the relay path.

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
- **Foundation Phase 1** (`DFC_Foundation_Architecture_Plan.md`) — engine extraction (`constants`, `rng`, `state`, `mutators`).
- **Foundation Phase 2** — Node server + WebSocket rooms (`server.js`, `src/api.js`, `src/rooms.js`).
- **Foundation Phase 3** — online client: mode selector (hotseat / host / join), WebSocket networking, and UI side-gating in `client/index.html`.

**In progress — Phase 1d / server authority (intent migration):**
- `src/engine/gating.js` (`isLegal`/`legalActions`) and `mutators.js#apply` exist; the server's intent path validates and applies authoritatively.
- **Migrated (complete families):**
  - Turn flow: `pass`, `endRound`, `finishActivation`
  - Orders: `applyOrder`, `applyShipOrder`
  - Movement: `moveShip` (full geometric cone validation), `aimShip`, `vectoredMove`, `holdPosition`, `undoMove`, `nominateLead`
  - Deploy: `deployShip`, `deployDone` (server-enforced side check), `beginPlay` (rolls initiative server-side), `advanceFromScenery` (scenery→deploy or play; rolls initiative when no deploy phase)
  - Weapons: `fireWeapons`, `lockWeaponTarget`, `unlockWeapon`
  - Combat modal: `attackStep`, `attackReroll`, `attackFighterReroll`, `finishAttack`, `attackDeclare` (shields/overcharge/escort/brace/contain/impel). Every die rolls server-side; attacker and defender each drive only their own decisions.
  - Launches: `launchAsset`, `cancelLaunch`
  - Scoring / round: `advanceRound` (runs `runScoring` + `rollInitiative` with seeded rng)
  - Activation extras: `surveySite`, `extractRecon`, `breakthroughFlyoff`, `objectivesFlyoff`
  - Asset phase: `resolveBoarding`, `startAssetMove`, `assetT2T`, `assetLockTarget`, `assetUntarget`, `assetResetMove`
  - Battalion combat: `startBattalionCombat`, `bcPickDropsite`, `bcAssignGround`, `bcSkipAssign`, `bcToDestroy`, `bcFinish`, `daDestroyFeature`
  - DA transitions: `daFinishDropsite`, `daSwitchSide`, `daEnd`
- **Still on relay (remaining work):**
  - Asset board movement (board click during asset step) — complex split/dogfight/scenery logic; asset stage-advance buttons (`#asset-finish-stage`, `#asset-move-done`)
  - DA feature attack modal opening (`openFeatureAttackModal` sets `state.attackModal` client-side; subsequent modal steps are already server-authoritative)
  - Undo deploy (`data-undo-deploy`)
  - Scenery placement board click
  - Pre-game setup overlay (fleet/admiral/colour/secondary/scenario/player-name changes) — acceptable relay for pre-game config
- **UX gap (no-op instead of disabled):** wrong-side online clicks silently no-op + resync rather than having their buttons visually disabled.

**Pending (later phases):**
- **Custom Fleet Import** (`DFC_Fleet_Import_Plan.md`) — `src/fleet/` parser + ship/weapon DBs for the New Recruit export format.
- **AI Opponent** (`DFC_AI_Opponent_Plan.md`) — `src/ai/` rules-based heuristics + optional LLM commander; consumes `legalActions`/`apply`.
- **Production deploy** (`DFC_Multiplayer_Plan.md`) — nginx/TLS/systemd hosting for live online play.

## Known Limitations

- Named admirals not implemented (uses generic admiral stats)
- No custom fleet import yet (only built-in faction rosters)
- No AI opponent yet
- Online multiplayer is **mostly server-authoritative**: the vast majority of play actions (movement, combat, scoring, asset phase, battalion combat, deploy) route through server-validated intents. Remaining relay items: asset board movement, DA feature attack opening, undo deploy, scenery placement, pre-game setup.
- Wrong-side online clicks silently no-op + resync rather than having their buttons visually disabled
- No custom fleet import yet (only built-in faction rosters)
- No AI opponent yet
- Named admirals not implemented (uses generic admiral stats)
- Online play requires running the Node server (the GitHub Pages deploy is hotseat-only)
