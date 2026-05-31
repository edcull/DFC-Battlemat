# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DFC Fleet Ops is a browser-based command interface for the **Dropfleet Commander** tabletop miniature wargame. The game UI is pure browser code (SVG/CSS/ES modules, no build step). An optional Node.js server adds online two-player rooms and shares the same engine as the browser.

Two entry points:
- **`client/index.html`** — the module-based client. Imports the engine from `src/engine/` and supports both local hotseat and online play. Requires an HTTP server (ES module CORS rules) — use the Node server below, or any static server (e.g. `python -m http.server`) for hotseat-only.
- **`server.js`** — the Node.js server (Express + WebSocket). Serves the client and hosts online relay rooms. Run with `npm start`.

## Running & Deployment

- **Hotseat:** Serve the repo root with any static server, then open `client/index.html`
- **Online play:** `npm install`, then `npm start` (or `npm run dev` for `node --watch` auto-restart). Serves the client at `http://localhost:3000/client/index.html` and exposes the room REST API + `/ws` WebSocket
- **No build step, no lint, no test suite.** Runtime deps (Express, ws, fast-json-patch) are needed only by the Node server; the browser client has none

## Architecture

### Engine modules (`src/engine/`)

The pure game logic lives in ES modules. The engine has zero DOM dependencies and runs identically in the browser and on the server:

| File | Contents |
|---|---|
| `src/engine/constants.js` | All fleet defs (6 factions), `FACTIONS`, `ORDERS`, `LAYOUTS`, `DEPLOYMENTS`, `ASSET_PROFILES`, `SECONDARY_OBJECTIVES`, `OBJECTIVES`, etc. |
| `src/engine/rng.js` | Seeded PRNG (`makeRng(seed)`) + `localRng` (Math.random wrapper for browser play) |
| `src/engine/state.js` | `createState()` factory, `buildSideFleet()`, `rebuildFleets()` |
| `src/engine/mutators.js` | All state-mutating functions (combat, scoring, asset resolution…), crippling/explosion resolvers, plus `apply(state, intent, rng)`, the intent dispatcher. |
| `src/engine/gating.js` | Intent legality: `isLegal(state, intent, side)` + `legalActions(state, side)`. Covers all migrated intent families; un-migrated families fall through to `default: return false`. |

All engine functions take `state` (and `rng` where randomness is needed) as explicit parameters — no globals, safe for concurrent server use.

**Intent layer:** an "intent" is a small serialisable action `{ type, ...payload }`. `gating.js#isLegal` is the single legality gate (run by the server before applying, and by the client before mutating in hotseat); `mutators.js#apply` dispatches an intent to its mutator. Every intent type `apply()` handles must have a matching `isLegal` case.

### Server (`server.js`, `src/api.js`, `src/rooms.js`, `src/saves.js`)

The Node.js server hosts online two-player rooms. It is **optional**: the browser client works without it for hotseat play.

| File | Contents |
|---|---|
| `server.js` | Express + WebSocket entry point. Serves the repo root as static files, mounts the `/api` router, and upgrades `/ws` requests to WebSocket. Listens on `PORT` (default 3000). |
| `src/api.js` | REST routes (`POST /api/rooms`, `GET /api/rooms/:id`, `GET /api/saves`, `GET /api/saves/:id`, `POST /api/rooms/resume`, `GET /api/rooms/:id/replay`) and the WebSocket connection/message handler. |
| `src/rooms.js` | In-memory room lifecycle: create/join/leave, side slots + spectators, broadcast/send helpers, and a 4-hour inactivity TTL. `createRoom(forceId?)` accepts an optional ID so resumed games keep their original room code. |
| `src/saves.js` | File-based persistence to `saves/<ROOM_ID>.json`. `saveRoom` is called after every authoritative action (both intent and relay paths). |

Each room holds the authoritative `state` and a seeded `rng`. The server runs two paths:
- **Intent path (authoritative):** `{type:'intent', intent}` → `isLegal` → `apply` → broadcast `{type:'full'}`. The client does **not** mutate locally for these.
- **Relay path (legacy):** `{type:'state'}` → store as authoritative → rebroadcast. Used by the few remaining un-migrated action families.

### Save / Resume / Replay

Games are auto-saved to `saves/<ROOM_ID>.json` after every server-side action. Each save contains:
- `currentState` / `currentRngState` — full game snapshot for resume
- `playStartState` / `playStartRngState` — snapshot captured the first time `room.state.phase` transitions to `'play'` (via `deployDone` when both sides finish, or directly via `beginPlay`)
- `intentLog` — ordered list `[{ts, side, intent}]` of every server-authoritative play-phase action

**Resume** (`POST /api/rooms/resume`) recreates a live room using `createRoom(save.roomId)` so the room code is preserved and subsequent saves overwrite the same file. The mode-selector shows a coloured side picker (player name + faction from `sideColors`) and an opponent share link.

**Replay** (`GET /api/rooms/:id/replay`) returns `{seed, playStartState, playStartRngState, intentLog}`. `loadReplay(data)` in the client seeds a fresh RNG, sets state to `playStartState`, and replays intents via `replayGoTo(step)`. The URL becomes `?replay=<ROOM_ID>` via `history.pushState`. Saves without `playStartState` (pre-intent or relay-only games) show ↺ REPLAY disabled in the UI. Exiting replay navigates to `location.pathname` (full reload → mode selector).

### Fleet database (`src/fleet/`)

| File | Contents |
|---|---|
| `src/fleet/db.js` | Full ship/weapon DB for all 6 factions, keyed by ship name. Exports `findShipDef`, `applyHardpointOptions`, `FLEET_DB`, `ADMIRAL_FACTION_ABILITIES`, `FAMOUS_ADMIRAL_ABILITIES`, `FACTION_ADMIRAL_TITLES`, `FACTION_ADMIRAL_PERSONAL`, `SHIP_SPECIAL_RULES`. |
| `src/fleet/parser.js` | `parseNewRecruit(text)` — parses New Recruit army builder export format. Returns `{ faction, admiralLevel, admirals, groups, secondaries, valid }`. Handles famous admirals, multiple non-famous admirals with abilities, hardpoint options (Drive Refit, Laser Refit, etc.), and secondary objectives. |

DB entries use `{ role, pts, tonnage, thrust, scan, sig, hull, es, ks, bs, weapons, launch, special }`. `W(name, arc, att, lock, dmg, type, special)` and `L(name, n, type)` are helpers. The `special` field lists rule tags; named unique rules (e.g. `'Stressful Manoeuvre'`, `'UCMF Battlenet'`) are mapped to descriptions in `SHIP_SPECIAL_RULES`.

Admiral data exports:
- `ADMIRAL_FACTION_ABILITIES` — per-faction pool of abilities famous/faction admirals pick from (6 per faction)
- `FAMOUS_ADMIRAL_ABILITIES` — per-famous-admiral personal abilities (keyed by admiral name)
- `FACTION_ADMIRAL_TITLES` — title keywords identifying named faction admirals (e.g. `'captain'`, `'rear admiral'`)
- `FACTION_ADMIRAL_PERSONAL` — personal abilities for each named faction admiral type

### Module-based client (`client/`)

| File | Contents |
|---|---|
| `client/index.html` | HTML/CSS + `<script type="module">`. Imports engine modules and fleet modules; defines all render functions, shims, event handlers, networking, and mode-selector code. |
| `client/local.js` | Hotseat glue: creates the shared `state` and exports `localRng`. |

**Shim pattern:** `client/index.html` exports state-bound wrapper functions (e.g. `function moveShip(...args) { return _moveShip(state, rng, ...args); }`) so render/handler code can call engine functions without passing `state` explicitly.

**Online mode:** networking lives inline in `client/index.html`. The client opens a WebSocket to `/ws?room=…&side=…` and re-renders on each incoming state. UI gating blocks the non-active side from acting on the opponent's groups.

**`dispatch(intent)`** is the migration seam toward server authority. Migrated handlers call `dispatch(intent)` instead of mutating directly: in hotseat it validates with `isLegal` then applies locally; online it emits `{type:'intent'}` and waits for the server's authoritative broadcast. Un-migrated handlers still mutate `state` directly and rely on `netAfterRender()` pushing the full state via the relay path.

### State & Rendering Pattern

**Single global `state` object** is the sole source of truth. Every user interaction:

1. Event handler validates legality (gating via `state.phase`, `state.activeSide`, etc.)
2. Calls a mutator (engine function via shim) to update `state`
3. Calls `renderAll()` — re-renders the entire UI from scratch

`renderAll()` calls ~20 specialised render functions, all pure reads from `state`.

## Fleet & Faction Data

Six factions: UCM, Scourge, PHR, Shaltari, Resistance, Bioficer. Each has a quickplay roster in `src/engine/constants.js` and a complete ship/weapon DB in `src/fleet/db.js`.

Quickplay ships are cloned with side-prefixed IDs (`'ucm:u1'`, `'shal:s1'`) into `state.groups` at game start. Imported fleet ships use `'imp0'`, `'imp1'`, etc. as base IDs.

Custom fleet import (`⊕ IMPORT LIST` in setup overlay): `parseNewRecruit` parses the New Recruit export text into groups + admiral entries; `buildSideFleet` then uses `findShipDef` to look up each ship from `db.js`, applying hardpoint options via `applyHardpointOptions`.

## Client UI

### Setup overlay
- Faction/colour pickers start unassigned; auto-set to faction defaults when a quickplay fleet is chosen or a list is imported.
- `⊕ IMPORT LIST` opens a fleet import modal; parsed fleet is stored in `state.importedFleets[slot]`.
- `SETUP / VIEW FLEET` (shown when an imported fleet or Bioficer quickplay is selected) opens `openFleetView(slot)` — a table showing ADMIRALS, PAYLOADS (Bioficer), GROUPS / SHIPS, and SECONDARY OBJECTIVES sections.
- Admiral assignments: famous admirals are auto-slotted; non-famous (faction) admirals show a flagship dropdown + faction ability dropdown (only for named faction types like Captain, Rear Admiral). `state.importedFleets[slot].admiralAssignments` holds `[{ level, groupIdx, shipIdx, isFamous, admiralIdx, abilities }]`.
- `fleetAssignmentsReady(slot)` checks Bioficer payload links and admiral assignments before allowing game start.

### Topbar
- **`renderBrand()`** — in play phase renders a clickable button showing `{FACTION1} {P1vp} {P1name} VS {P2name} {P2vp} {FACTION2}` (opens VP breakdown modal). In other phases shows plain faction names.
- Phase breadcrumb nav is always visible.
- Play-phase controls (round counter, END ROUND) remain in `topbar-controls`.

### Fleet panels (left)
- **`makeGroupCard()`** — group cards show name, role, tonnage. Admiral flagship marked with ⭐. Deployment/reserve/activation badges as appropriate.
- Clicking the player name title opens a fleet view modal: `openFleetViewForSide(side)` handles both imported and pre-generated fleets.
- AP chip at top of each fleet during play — click to open AP adjuster modal. In online mode, only own side's chip is interactive.

### AP adjuster modal
- Shows current AP with +/− controls (own side only in online mode; opponent side is view-only).
- AP changes dispatch `adjustAP` intent — server-authoritative in online play, logged in event log.
- Shows ability reference: Core 4 always (AP Re-roll, Brace, Contain, TTT), then famous admiral personal abilities, faction admiral personal abilities (for named faction types), and chosen faction pool ability.
- AP formula: `1 (base) + max(level_i + CommandShip-X_of_flagship_i) for each alive admiral`. An admiral's contribution drops to zero if their specific assigned ship is destroyed.

### Ship detail panel
- Selected ship shows stat grid (Thrust/Scan/Sig/Hull/ES/KS/BS), then a **SPECIAL RULES** section for any named/unique rules in `def.special` that have descriptions in `SHIP_SPECIAL_RULES`. Standard stat-tags (Aegis-X, Vanguard-X, etc.) are shown without descriptions; unique rules (Jink, UCMF Battlenet, Energy Siphon, etc.) show full rule text.

### Deploy phase
- **Two-click + confirm flow:** first click places the ship locally; second click sets the heading and stores `_pendingDeploy`. `renderDeployHint()` shows **CONFIRM PLACEMENT** and **CANCEL**. Only CONFIRM dispatches `deployShip`.
- **`sideNeedsDeployPhase(state, side)`** — export in `mutators.js`. Determines whether a side has anything to deploy (vanguard ships or directly-deploy approach).

### 3D view
- **Auto-switch:** `renderAll()` auto-calls `toggle3d()` when the scenery phase ends or the protect nomination phase completes.

## Intent Migration Status

**Fully server-authoritative (all dispatched via `dispatch(intent)`):**
- Turn flow: `pass`, `endRound`, `finishActivation`, `adjustAP`
- Orders: `applyOrder`, `applyShipOrder`
- Movement: `moveShip`, `aimShip`, `vectoredMove`, `holdPosition`, `undoMove`, `nominateLead`
- Deploy: `deployShip`, `deployDone`, `beginPlay`, `advanceFromScenery`
- Weapons: `fireWeapons`, `lockWeaponTarget`, `unlockWeapon`
- Combat modal: `attackStep`, `attackReroll`, `attackFighterReroll`, `finishAttack`, `attackDeclare`
- Launches: `launchAsset`, `cancelLaunch`
- Scoring / round: `advanceRound`
- Activation extras: `surveySite`, `extractRecon`, `breakthroughFlyoff`, `objectivesFlyoff`
- Asset phase: `resolveBoarding`, `startAssetMove`, `assetT2T`, `assetLockTarget`, `assetUntarget`, `assetResetMove`
- Battalion combat: `startBattalionCombat`, `bcPickDropsite`, `bcAssignGround`, `bcSkipAssign`, `bcToDestroy`, `bcFinish`, `daDestroyFeature`
- DA transitions: `daFinishDropsite`, `daSwitchSide`, `daEnd`

**Still on relay (remaining work):**
- Asset board movement (board click during asset step); asset stage-advance buttons
- DA feature attack modal opening
- Undo deploy
- Scenery placement board click
- Pre-game setup overlay (fleet/admiral/colour/secondary/scenario/player-name changes)

## Known Limitations

- Online play requires running the Node server.
- Wrong-side online clicks silently no-op + resync rather than having buttons visually disabled.
- Asset board movement, undo deploy, scenery placement, and pre-game config still relay full state rather than using server-validated intents.
- No AI opponent.
- Faction admiral personal abilities and famous admiral abilities are defined in `db.js` and shown in the AP modal, but are informational only — the abilities themselves (e.g. Mass Driver Volley, Dedicated Survey Teams) must be adjudicated manually by players.
