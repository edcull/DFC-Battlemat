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
- **No build step, no lint, no test suite.** Runtime deps (Express, ws, fast-json-patch, bcryptjs, better-sqlite3, etc.) are needed only by the Node server; the browser client has none

### Environment variables (online server)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `SESSION_SECRET` | `change-me-in-production` | Signs session cookies — **must** be set in production |

Copy `.env.example` (if present) to `.env`, or set vars in the environment directly. The server warns at startup if `SESSION_SECRET` is the default.

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

### Server (`server.js`, `src/api.js`, `src/rooms.js`, `src/saves.js`, `src/db.js`, `src/auth.js`, `src/admin.js`)

The Node.js server hosts online two-player rooms. It is **optional**: the browser client works without it for hotseat play.

| File | Contents |
|---|---|
| `server.js` | Express + WebSocket entry point. Serves the repo root as static files, mounts the `/api` router, and upgrades `/ws` requests to WebSocket. Initialises the SQLite DB, bootstraps admin roles, and wires session middleware into the WebSocket upgrade path. Listens on `PORT` (default 3000). |
| `src/api.js` | REST routes (`POST /api/rooms`, `GET /api/rooms/:id`, `GET /api/saves`, `GET /api/saves/:id`, `POST /api/rooms/resume`, `GET /api/rooms/:id/replay`) and the WebSocket connection/message handler. |
| `src/rooms.js` | In-memory room lifecycle: create/join/leave, side slots + spectators, broadcast/send helpers, and a 4-hour inactivity TTL. `createRoom(forceId?)` accepts an optional ID so resumed games keep their original room code. |
| `src/saves.js` | Dual-write persistence: SQLite primary (via `upsertSave`) + JSON file backup under `saves/<ROOM_ID>.json`. `saveRoom(room, userId?)` is called after every authoritative action. `loadAllSaves(userId?)` returns per-user saves when authenticated, all saves otherwise. Falls back to file reads if the DB is unavailable. |
| `src/db.js` | SQLite layer (`better-sqlite3`). `initDb()` creates/migrates `data/dfc.db`. Tables: `users`, `saves`, `room_slots`. Exports CRUD helpers for all three. Sessions are stored separately in `data/dfc.db` by `connect-sqlite3`. |
| `src/auth.js` | Auth routes mounted at `/api/auth`: `POST /register`, `POST /login`, `POST /logout`, `GET /me`. Passwords hashed with bcryptjs (cost 12). Sessions are cookie-based (httpOnly, SameSite=lax, 30-day expiry). |
| `src/admin.js` | Admin routes mounted at `/api/admin` (require `role === 'admin'`): `GET /users`, `DELETE /users/:id`, `PATCH /users/:id/role`, `POST /users/:id/reset-password`, `GET /rooms`, `GET /saves`, `DELETE /saves/:id`. |

Each room holds the authoritative `state` and a seeded `rng`. The server runs two paths:
- **Intent path (authoritative):** `{type:'intent', intent}` → `isLegal` → `apply` → broadcast `{type:'full'}`. The client does **not** mutate locally for these.
- **Relay path (legacy):** `{type:'state'}` → store as authoritative → rebroadcast. Used by the few remaining un-migrated action families.

### Authentication & Room Ownership

The server uses session-based authentication (cookie `connect.sid`). `req.user` is set on every `/api` request and on WebSocket upgrades by reading `req.session.userId` and looking up the user in the DB.

**Room slot ownership** — when an authenticated user creates or resumes a room, their user ID is written to `room_slots` for `player1`. When any authenticated user connects to a WebSocket slot, the slot is claimed if free; if already claimed by a different user the connection is rejected. Anonymous users can connect to unclaimed slots freely. This prevents session-hopping in online games.

**`GET /api/saves`** returns only the requesting user's saves (games where they are `owner_user_id` or `player2_user_id`). Unauthenticated requests return all saves (legacy behaviour).

### SQLite schema (`data/dfc.db`)

Three tables managed by `initDb()` in `src/db.js`:
- **`users`** — `id`, `username` (unique, case-insensitive), `password_hash`, `role` (`player`|`admin`), `created_at`
- **`saves`** — one row per `room_id`; mirrors the JSON save format with metadata columns (`phase`, `round`, `factions_json`, etc.) plus `owner_user_id` / `player2_user_id` FKs. Full state blobs stored as JSON text columns.
- **`room_slots`** — `(room_id, side)` → `user_id`; cleared when a room expires or is deleted.

Sessions are stored in the same DB file by `connect-sqlite3` (separate table managed by that library).

Inline migrations in `initDb()` handle schema evolution via `ALTER TABLE … ADD COLUMN` wrapped in try/catch.

### Save / Resume / Replay

Games are auto-saved to SQLite (and `saves/<ROOM_ID>.json` as backup) after every server-side action. Each save contains:
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

### Scenario setup (three tabs)
The scenario chooser in the setup overlay has three tabs. The active tab is `state.setupTab` (relayed; one of `'standard'` | `'expansion'` | `'custom'`); switching tabs resets the scenario selections.
- **Standard Scenarios tab:** a dropdown of bespoke standard scenarios (Take and Hold, Erupting Battlefront, Power Grab, Shock and Yaw, Orbital Support, Entrapmoont) plus a RANDOM button. Selecting/rolling one applies a full preset from `SCEN_PRESETS` (in `client/index.html`) and shows a read-only summary of Deployment Type, Approach and Scoring Objective.
- **Scenario Expansion 1 tab:** behaves like the Standard tab — a dropdown of the 14 Scenario Expansion 1 scenarios (Ready Salted Earth, Erupting Quarters, Latitudinal Lanes, Lagrange Points, When Backfields Meet, Very Important Moon, Moonshot, Moonwreck, Moonbreaker, Moonguard, Moonswipe, Moonskipper, One With (Almost) Nothing, (Almost) Nothing At All) plus a RANDOM button. Selecting/rolling one applies a full preset from `EXPANSION_PRESETS` and shows a read-only summary of Deployment Type, Approach, Scoring Objective, a Scenery & Dropsites row, and a **Special Rules** briefing (`SE1_NOTES`) listing bespoke effects. Each scenario's layout is a bespoke `LAYOUTS` entry (`se1_*`, transcribed from the official maps) with dropsite positions, features, focal point definitions, and `siteRules` tags. The expansion adds three engine-enforced approach types wired into `canActivateOffTable`: **Imminent** (R1 L+M only, R2 also H, R3+ any), **Backline** (R1 H+C only, R2+ any, Vanguard as normal), **Staggered** (X groups per round: 1/2/3/4+ for Skirmish/Clash/Battle/Reconquest, computed from fleet pts). Two bespoke deployment types are added: `defender_edge` (Moonguard — south 12" zone / north edge contact) and `diagonal_corners` (Moonswipe — each side gets two diagonally-opposite corners). Five SE1 scoring objectives are engine-scored: **Normal** (control/contest on R4/R6, same VP table as Standard), **Demolish** (immediate High VP on Level, Low VP on Ruin; no R4/R6 dropsite scoring), **Focal Points** (R4/R6; ship values by tonnage L=1/M=4/H=7/C=11; highest wins 3 VP, ≥half wins 1 VP), **Kill Points** (game-end +2 VP/500 pts destroyed), **Assess** (Capital Ship on GQ within 6" of eligible dropsite, 1 VP each, forfeits attack/launch). Dropsites carry `siteRules` arrays controlling per-site scoring: `assess`/`assess_south`/`assess_north` (Assess eligibility), `double_assess_south`/`double_assess_north` (2 VP for Assessing), `demolish_south`/`demolish_north` (Demolish VP restricted to that zone's player). Focal points fire on R4/R6 whenever `state.scenarioData.focalPoints` is non-empty, regardless of primary objective, so scenarios with both focal points and another scoring method (Moonshot, Moonwreck) both score correctly. The VP breakdown modal (`renderVPBreakdown`) shows Kill Points projections, Assess tracker, and a live Focal Points preview alongside the scoreLog.
- **Custom / Generate tab:** per-row pickers + ↻ rerolls for Deployment Type, Approach, Layout, Variant and Scoring Objective, plus RANDOMISE ALL. Standard-scenario-only and expansion-only `LAYOUTS`/`APPROACHES`/`VARIANTS`/`OBJECTIVES` (flagged `bespoke:true`, `d6:0`) are hidden from these generator dropdowns/rerolls and never produced by `generateScenario`; `No Variant` stays available.
- **Asymmetric scoring:** the Scoring Objective row has an "Asymmetric scoring" toggle. When on, `state.scenario.objectives = { player1, player2 }` overrides the shared `state.scenario.objective`. `objectiveForSide(state, side)` / `objAny(state, key)` (in `mutators.js`) resolve all per-side scoring — Standard Scoring, Raze/Attrition/Survey/Extract bonuses, Protect doubling/penalty/nomination, and Extract seeding. Used by Entrapmoont (attacker Raze / defender Protect).

### Auth overlay & user chip

On page load the client calls `GET /api/auth/me`. If not logged in (or the server is unavailable) a login/register overlay (`showAuthScreen()`) is shown before the mode selector. The overlay toggles between login and register modes. On success, `currentUser` is set and the overlay dismissed.

A **user chip** (`#topbar-user`) in the top-right of the topbar shows the logged-in username and a sign-out button (`⏏`). On first setup, if the player name is still the default (`'Player 1'`), it is pre-filled with the logged-in username.

### Topbar
- **`renderBrand()`** — in play phase renders a clickable button showing `{FACTION1} {P1vp} {P1name} VS {P2name} {P2vp} {FACTION2}` (opens VP breakdown modal). In other phases shows plain faction names.
- Phase breadcrumb nav is always visible.
- Play-phase controls (round counter, END ROUND) remain in `topbar-controls`.
- **User chip** (top-right) — shows `⬡ <username>` when logged in, with a sign-out button.

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
- Activation extras: `surveySite`, `extractRecon`, `breakthroughFlyoff`, `objectivesFlyoff`, `assessDropsite`
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
- Standard-scenario **variant features** (Military Outposts, Orbital Defence Guns, Power Plants, Hangars, Comms Stations) are placed on dropsites, but their in-game effects and any bespoke special rules (e.g. Entrapmoont's Power-Plant blast and the blue team's bonus Military Outpost) are adjudicated manually.
- Multiplayer/team scenarios (e.g. Entrapmoont, Moonswipe, 2–4 players) are modelled as standard 2-player; attacker/defender map to player2/player1, and Red/Blue deployment zones are still assigned randomly at confirm.
- **Scenario Expansion 1** — all 14 scenarios are selectable with faithful dropsite layouts (positions, features, focal point geometry). Engine-scored: Imminent/Backline/Staggered approach gating, Normal/Demolish/Kill Points/Focal Points/Assess scoring, Ruin/Level dropsite lifecycle (`ds.ruined` + `ds.destroyed`), per-zone siteRules for Assess and Demolish eligibility, +1VP per Admiral for One With (Almost) Nothing. Still adjudicated manually and surfaced as Special Rules notes: moving/breaking moons (Moonskipper, Moonbreaker, Moonswipe pre-deployment repositioning), Orbital Decay damage ("(Almost) Nothing" pair), asymmetric colour-city ownership scoring (When Backfields Meet), board-quarter focal value scoring (Erupting Quarters, (Almost) Nothing At All), Very Important Moon end-game crippled-ships-outside-focal-point VP.
- **Dropsite Ruin/Level lifecycle** — `ds.ruined` is set on first hull breach (damage resets to overflow); `ds.destroyed` on second breach. Demolish VP fires immediately on each event. The older `ds.destroyed`-only model has been replaced.
