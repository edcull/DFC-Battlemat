# DFC Battlemat — Foundational Architecture Plan

> **Status (May 2026): PHASE 1 COMPLETE — engine extracted and browser hotseat working via modules.**
> Phase 2 (Node server + WebSocket rooms) and Phase 3 (online client) are not yet implemented.
> See section 3 for what was delivered and how it differs from the original plan.

---

## 1. The problem with the current architecture

Everything — game logic, DOM rendering, constants, event handlers — lives in one 11,500-line
HTML file. The three planned features each require the engine to run in places the DOM is not
present (Node.js server, AI loop, test harness). They share one prerequisite: **decouple the
pure game engine from the DOM**.

This plan delivers that decoupling and wraps it in a Node.js server that becomes the single
authoritative runtime for all three features.

---

## 2. Target architecture

```
DFC-Battlemat/
├── package.json               ← new: Node project config
├── server.js                  ← new: Express + WebSocket entry point
├── src/
│   ├── engine/                ← new: pure game logic, zero DOM
│   │   ├── constants.js       ← fleet defs, ORDERS, LAYOUTS, ASSET_PROFILES, etc.
│   │   ├── state.js           ← state shape + buildSideFleet + initialization
│   │   ├── mutators.js        ← all state-mutating functions (movement, combat, scoring…)
│   │   ├── gating.js          ← legalActions(state, side) built from existing UI gate logic
│   │   └── rng.js             ← injectable seeded PRNG (replaces Math.random)
│   ├── fleet/                 ← new: fleet import feature
│   │   ├── ship-db.js         ← SHIP_DB: all ship stats keyed by faction + display name
│   │   ├── weapon-db.js       ← WEAPON_DB: all weapon stats keyed by display name
│   │   └── parser.js          ← parseNewRecruit(text) → normalized fleet structure
│   ├── ai/                    ← new: AI opponent
│   │   ├── rules-bot.js       ← deterministic heuristics over legalActions
│   │   └── llm-bot.js         ← Anthropic API bot with rules-bot fallback
│   ├── rooms.js               ← new: room lifecycle, player slots, turn enforcement
│   └── api.js                 ← new: Express routes (REST + WebSocket upgrade)
├── client/                    ← refactored client (replaces the inline <script>)
│   ├── index.html             ← shell: imports modules, no inline logic
│   ├── render.js              ← renderAll() + all render* functions (DOM-only, reads state)
│   ├── net.js                 ← WebSocket client: emit intents, receive state, call renderAll
│   └── local.js               ← hotseat play: engine runs in-browser (no server required)
└── web/
    └── index.html             ← legacy standalone: kept intact for GitHub Pages
```

**Three runtime modes, one engine:**

| Mode | Where engine runs | Where render runs | Who calls renderAll |
|---|---|---|---|
| Local / hotseat | Browser (`local.js`) | Browser (`render.js`) | Event handler → local engine → renderAll |
| Online multiplayer | Server (`rooms.js`) | Browser (`render.js`) | net.js receives state → renderAll |
| AI opponent | Server (`ai/*.js`) | Browser (`render.js`) | AI applies action → broadcasts state → renderAll |

---

## 3. Phase 1 — Extract the engine ✅ COMPLETE (with notes)

Phase 1 has been completed. The following describes what was actually delivered and where it
differs from the original plan.

### 3.0 What was delivered (actual vs planned)

**Delivered:**
- `src/engine/constants.js` — all fleet defs + game constants, zero changes ✅
- `src/engine/rng.js` — seeded PRNG + `localRng` wrapper ✅
- `src/engine/state.js` — `createState()`, `buildSideFleet()`, `rebuildFleets()` ✅
- `src/engine/mutators.js` — all state-mutating functions with `(state, rng)` signature ✅
- `client/index.html` — module-based client; imports engine, hosts all render functions and event handlers ✅
- `client/local.js` — hotseat glue: shared `state` + `localRng` ✅
- `web/index.html` — legacy file frozen, still deployed to GitHub Pages ✅

**Deviations from the original plan:**

1. **`client/render.js` was not created.** Render functions and event handlers stayed embedded in `client/index.html` rather than being split into a separate `render.js`. This keeps things simpler for now; the split can happen in Phase 3 when the net.js client is built.

2. **Shim pattern introduced.** Because render functions call engine mutators heavily (and passing `state` explicitly to ~200 call sites would be disruptive), `client/index.html` defines state-bound wrappers for every exported mutator:
   ```js
   // In client/index.html, immediately after the import block:
   function moveShip(...args) { return _moveShip(state, rng, ...args); }
   ```
   The engine functions use their explicit `(state, rng, ...)` signatures; the shims provide the convenience call form used throughout the render/handler code.

3. **`src/engine/gating.js` not yet extracted.** The `legalActions()` / `isLegal()` API remains the last outstanding Phase 1 deliverable. Gating logic (range checks, arc checks, fire limits, AP balance, coherency) is still inline in `client/index.html` handlers and render functions. **Phase 2 should not start until gating.js is extracted.**

### 3.1 What goes into `src/engine/`

**`constants.js`** — move verbatim from the HTML:
- `UCM_FLEET`, `SHAL_FLEET`, `PHR_FLEET`, `RESISTANCE_FLEET`, `SCOURGE_FLEET`, `BIOFICER_FLEET`
- `FACTIONS`, `ORDERS`, `DROPSITE_BASE`, `FEATURES`, `LAYOUTS`, `DEPLOYMENTS`,
  `APPROACHES`, `VARIANTS`, `SECONDARY_OBJECTIVES`, `ASSET_PROFILES`, `REPAIRABLE`

No changes to these — they are already pure data.

**`rng.js`** — a seeded PRNG replacing `Math.random`:
```js
// mulberry32 — fast, good distribution, no deps
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s |= 0; s = s + 0x6D2B79F5 | 0; /* … */ return (s >>> 0) / 4294967296; };
}
export const localRng = () => Math.random(); // used in browser local-play mode
```

**`mutators.js`** — extract every function that mutates `state` from the HTML `<script>`.
Key functions include: `buildSideFleet`, `advanceActiveSide`, `applyDamage`, `resolveAttack`,
`moveShip`, `applyOrder`, `resolveAssetCombat`, `scoreRound`, `markDropsite`, and ~50 others.

**Signature change:** every mutator that currently calls `Math.random()` must accept `rng` as
a parameter. Pass `localRng` in the browser; pass the room's seeded rng on the server.
```js
// before
function rollDie() { return Math.floor(Math.random() * 6) + 1; }

// after
function rollDie(rng) { return Math.floor(rng() * 6) + 1; }
```

**`gating.js`** — extract the legality-checking logic that currently lives inside render
functions and event handlers (range checks, arc checks, fire limits, coherency, AP balance).
Expose as:
```js
export function legalActions(state, side)  // returns [{type, payload}, …]
export function isLegal(state, action)     // validates a single intent
```

This is the most novel code to write — the gate logic is currently scattered across ~37
handlers and several render functions. Extract it, do not rewrite it.

**`state.js`** — the initial `state` shape and `buildSideFleet`. Nothing else.

### 3.2 What stays in `client/`

**`render.js`** — all `render*` functions and `renderAll()`. These read from `state` and write
to the DOM. They do not move.

**`local.js`** — thin glue for hotseat play in the browser:
```js
import { state, init } from '../src/engine/state.js';
import { apply } from '../src/engine/mutators.js';
import { legalActions } from '../src/engine/gating.js';
import { localRng } from '../src/engine/rng.js';
import { renderAll } from './render.js';

document.addEventListener('click', e => {
  const intent = interpretClick(e, state);
  if (!isLegal(state, intent)) return;
  apply(state, intent, localRng);
  renderAll(state);
});
```

### 3.3 Migration strategy

Do not attempt a big-bang rewrite. Extract one section at a time, keeping `web/index.html`
working throughout (it is the live GitHub Pages version and must not break):

1. Extract `constants.js` — pure data, zero risk.
2. Extract `rng.js` and thread `rng` through `rollDie` and any scatter functions — search for
   all `Math.random` calls (~31 of them) and parameterize each one.
3. Extract `mutators.js` one logical group at a time (movement, combat, scoring, …). Test each
   group by running the original HTML alongside and comparing outcomes.
4. Extract `gating.js` — the most invasive step; needs careful extraction from render loops.
5. Wire `local.js` against the extracted modules. Run the browser hotseat mode end-to-end.
6. Delete the now-duplicated code from `web/index.html` (replace with `<script type="module">`
   imports from `client/`). At this point the monolith is gone.

---

## 4. Phase 2 — Node server

### 4.1 Dependencies

```json
{
  "dependencies": {
    "express": "^4",
    "ws": "^8",
    "fast-json-patch": "^3"
  }
}
```

No framework beyond Express. `ws` for WebSocket (lighter than socket.io; reconnect handled by
the client). `fast-json-patch` for state diffs if full-state broadcast proves too large.

### 4.2 Server structure (`server.js` + `src/api.js`)

```
POST /api/rooms              → create room, return { roomId, token }
GET  /api/rooms/:id          → room status (exists, sides joined, state)
WS   /ws?room=:id&side=:side → WebSocket upgrade, join/rejoin room
POST /api/ai-move            → internal: AI picks action, returns intent (used by rooms.js)
```

The WebSocket protocol (all JSON):

| Direction | Message | Meaning |
|---|---|---|
| C→S | `{type:'join', room, side, token}` | Join or rejoin a room |
| C→S | `{type:'intent', action}` | Player submits an action |
| C→S | `{type:'resync'}` | Client requests full state re-send |
| S→C | `{type:'joined', side, state}` | Confirmed; full initial state |
| S→C | `{type:'state', patch}` | JSON Patch diff after each action |
| S→C | `{type:'full', state}` | Full state (on resync or reconnect) |
| S→C | `{type:'error', reason}` | Rejected intent or room error |
| S→C | `{type:'opponentLeft'}` | Other player disconnected |

### 4.3 Room lifecycle (`src/rooms.js`)

A room has:
- `id` — short random code (e.g. `"KFHQ"`)
- `state` — the authoritative game state
- `rng` — seeded PRNG instance for this match (seed generated at room creation)
- `sockets` — `{ucm: ws|null, shal: ws|null}`
- `spectators` — array of `ws` connections (no write access)

On `intent` received from the active side:
1. `isLegal(room.state, action)` — reject if false, send `error` back.
2. `apply(room.state, action, room.rng)` — mutate authoritative state.
3. Compute JSON Patch diff; broadcast `{type:'state', patch}` to both sides + spectators.
4. If the new `state.activeSide` differs from the actor, the turn has passed (send `{type:'turn'}`).

On reconnect: send `{type:'full', state: room.state}`.

**In-memory only** for now — rooms live in a `Map`. Add Redis persistence later if needed.

### 4.4 Turn enforcement

The server rejects intents from the side that is not `state.activeSide`. Exception: reactive
actions (saves, Brace for Impact) during the opponent's attack modal are driven by the acting
client's modal flow — the server applies them as part of the same attack sequence rather than
gating on `activeSide`.

---

## 5. Phase 3 — Client refactor

### 5.1 `client/net.js`

Replaces the event-handler-direct-mutate pattern with intent emission:

```js
const ws = new WebSocket(`wss://${host}/ws?room=${roomId}&side=${mySide}`);
ws.onmessage = ({data}) => {
  const msg = JSON.parse(data);
  if (msg.type === 'state') applyPatch(localState, msg.patch);
  if (msg.type === 'full')  localState = msg.state;
  renderAll(localState);
};

export function emitIntent(action) {
  ws.send(JSON.stringify({type:'intent', action}));
}
```

Event handlers in multiplayer mode call `emitIntent(action)` instead of directly mutating
state. The local `localState` is only written by incoming server messages.

### 5.2 Side gating

Handlers check `mySide === localState.activeSide` before emitting intents; UI buttons for
the opponent's side are disabled (the engine already tracks `activeSide`, so this is a
one-line guard in each handler).

### 5.3 Mode selection

`client/index.html` has a mode screen before the existing setup overlay:
- **Local (hotseat)** → loads `local.js`, no server connection
- **Online (host)** → `POST /api/rooms`, get room code, show invite link
- **Online (join)** → enter room code, connect as the available side

---

## 6. How the three features sit on the foundation

### Fleet import (`src/fleet/`)

- `parser.js` and the DBs live server-side (keeps the client thin; avoids shipping a large DB
  to every browser load).
- `POST /api/rooms` accepts an optional `fleets: {ucm: text, shal: text}` body; the server
  parses them before creating the room and rejects with errors if any names are unresolved.
- In local mode, the parser + DB are also bundled client-side (same modules, different load path).
- See `DFC_Fleet_Import_Plan.md` for parser and DB details.

### AI opponent (`src/ai/`)

- `rules-bot.js` calls `legalActions(state, side)` and scores each action via heuristics.
  Runs synchronously in the room's event loop — no latency.
- `llm-bot.js` calls the Anthropic API via `POST /api/ai-move`. The API key never leaves
  the server. Falls back to `rules-bot` if the LLM times out or returns an invalid action.
- Room creation with `{p2: 'ai-rules' | 'ai-llm'}` sets the bot for `shal` (or whichever side
  has no human). After each human action, `rooms.js` checks `isAiTurn()` and drives the bot
  turn automatically, broadcasting each sub-action as it applies.
- See `DFC_AI_Opponent_Plan.md` for bot heuristics and LLM prompt details.

### Multiplayer (`src/rooms.js`)

- Directly implemented by the server as described in Phase 2.
- See `DFC_Multiplayer_Plan.md` for nginx/TLS/deployment details.

---

## 7. What does NOT change

- `web/index.html` — the standalone legacy file is kept intact and continues to be deployed
  to GitHub Pages. It is not part of the refactor target. Users without access to the server
  can still use it for offline hotseat play.
- The visual design, CSS, SVG board, all render functions, all game mechanics — none of these
  change as part of the foundation work. The refactor is purely structural.

---

## 8. Phasing and sequence

| Phase | Work | Delivers | Status |
|---|---|---|---|
| **1a** | Extract `constants.js` | Pure data module, zero risk | ✅ Done |
| **1b** | Parameterize RNG; extract `rng.js` | Deterministic randomness | ✅ Done |
| **1c** | Extract `mutators.js` (grouped by area) | Headless engine | ✅ Done |
| **1d** | Extract `gating.js`; expose `legalActions` / `isLegal` | Engine API | ⏳ Pending |
| **1e** | Wire `client/local.js`; browser hotseat via modules | Browser hotseat via modules | ✅ Done |
| **2a** | `package.json`, Express skeleton, WebSocket rooms | Server running locally | ✅ Done |
| **2b** | Intent protocol end-to-end; two tabs in sync | Local two-player networking | ✅ Done |
| **2c** | Reconnect, turn enforcement, spectator broadcast | Robust rooms | ✅ Done (relay model; server-authority deferred to gating.js) |
| **3a** | Mode selector screen (hotseat / host / join) | Online client | ✅ Done |
| **3b** | Side gating in UI | Player can only act on their turn | ✅ Done |
| **4a** | `src/fleet/parser.js` + UCM `SHIP_DB`/`WEAPON_DB`; import UI | Fleet import (UCM) | ⏳ Pending |
| **4b** | Remaining faction DBs | Fleet import (all factions) | ⏳ Pending |
| **4c** | `src/ai/rules-bot.js` end-to-end | Local AI opponent | ⏳ Pending |
| **4d** | `src/ai/llm-bot.js` via `/api/ai-move` | LLM commander | ⏳ Pending |
| **5** | nginx + TLS + systemd; production deploy | Live online play | ⏳ Pending |

**Do not start Phase 2 until Phase 1d (gating.js) is complete** — the server needs
`legalActions()` / `isLegal()` to enforce turn rules, and extracting gating before building
the server ensures the API contract is correct.

---

## 9. Key risks

| Risk | Mitigation |
|---|---|
| Gating logic scattered and hard to extract | Extract incrementally; test each piece against the original HTML in parallel |
| `Math.random` calls missed during RNG parameterization | Grep for `Math.random` after extraction; zero hits = done |
| State serialization size (full state over WS) | Start with full state; add JSON Patch diff if >50KB in practice |
| LLM API latency stalls the game | `llm-bot` always has a synchronous `rules-bot` fallback ready |
| `web/index.html` drifting from the new modules | Freeze the legacy file once modules are extracted; it does not need updates |
