# DFC Battlemat — Two-Player Online Play (Node.js + WebSocket + nginx)

> **Status (May 2026): NOT YET IMPLEMENTED — plan document only.**
> The battlemat is now a ~11,500-line single HTML file with a complete rules engine.
> The engine/DOM split described in §3 remains the prerequisite for both this and the AI plan.
> All game mechanics described below have been fully implemented in the HTML engine,
> so the "what the engine does" descriptions are accurate — only the networking layer is missing.


Goal: let two people in different browsers play one shared game, each controlling their own
side, with the board kept in sync in real time.

---

## 1. Why the current architecture makes this tractable

The app is already in the right shape:

- **One global `state` object** holds the entire game (phase, groups, ships, scenario, scores…).
- **`renderAll()` is a pure function of `state`** — it wipes and redraws every panel/SVG from
  state, calling no network or storage. Re-rendering from a replaced `state` "just works".
- **~37 event handlers** follow one pattern: read input → mutate `state` → `renderAll()`.
- Randomness is funnelled through a few helpers (`rollDie()`, scatter) using `Math.random`.

That means multiplayer is fundamentally: **replicate `state` across two clients and gate who may
mutate it.** We do not need to rewrite the game; we wrap it.

The catch: ~31 `Math.random` calls execute **client-side** today. For a shared game, dice must be
authoritative and identical for both players (see §4).

---

## 2. Topology: authoritative server, thin clients

```
Browser A (Red)  ─┐                        ┌─ Node.js process ─┐
                  ├─ WSS (wss://) ─ nginx ─┤  - rooms/sessions  │
Browser B (Blue) ─┘   reverse proxy        │  - authoritative   │
                                           │    game state      │
                                           │  - action validator│
                                           │  - RNG             │
                                           └────────────────────┘
```

**Server owns the truth.** Clients send *intents* ("set order WF on group ucm:u2", "move ship to
(x,y,heading)", "fire"), never raw state. The server validates, applies them against its copy of
the game logic, advances RNG, and broadcasts the new state. This prevents desync and cheating.

### Two implementation tiers (pick based on appetite)

**Tier 1 — State-broadcast (fastest to ship).** The *active* player's browser runs the game logic
exactly as today; after each `renderAll()`-triggering mutation, it serializes `state` and sends it
to the server, which relays it to the opponent, who replaces their `state` and re-renders. The
server is a dumb relay + turn cop. Pros: minimal code change (extract the game logic as-is). Cons:
trusts the active client; RNG happens on whichever client acts. Acceptable for friendly play.

**Tier 2 — Server-authoritative (robust).** The game logic (the entire `<script>`) is extracted to
a shared module that runs **on the server**. Clients send intents; the server is the only place
state mutates and the only place dice roll. Browsers become render-only + intent-emitters. Pros:
cheat-resistant, single RNG source, reconnect-safe. Cons: must decouple the logic from the DOM
(the logic and `renderAll` currently share a file/scope).

Recommended path: **ship Tier 1 first** (a weekend), then refactor toward Tier 2 if it goes public.

---

## 3. Refactor required in the client

Today the `<script>` mixes pure game logic with DOM rendering. To network it cleanly:

1. **Split the file** into three logical units (can stay one bundle, but separate scopes):
   - `engine.js` — pure logic: the `state` shape, all mutators (movement, attack resolution,
     scoring, orders…), `rollDie`. No `document.*` calls. Takes `state` + an `rng` function.
   - `render.js` — `renderAll()` and all `render*` functions. Reads `state`, writes DOM only.
   - `net.js` — WebSocket client: connect, send intents, receive state/patches, call `renderAll`.
2. **Make every mutator take an explicit `rng`** instead of calling `Math.random` directly, so the
   server (Tier 2) or the active client (Tier 1) controls the seed/stream.
3. **Wrap the 37 handlers** so that instead of mutating local state directly they emit an intent
   object `{type, payload}`. In Tier 1 the active client still applies locally then ships state; in
   Tier 2 it only emits and waits for the authoritative state back.
4. **Add a `side` identity** to the client (`myСside = 'ucm' | 'shal'`), and gate the UI:
   buttons/handlers for the side it isn't your turn to control are disabled (the engine already
   tracks `state.activeSide` / `state.activeFleets`, so this is mostly view-layer gating).

---

## 4. Determinism & dice (the one real gotcha)

For a shared game, both clients must agree on every die. Options:

- **Tier 1**: only the active client rolls; the resulting state (including roll outcomes already
  applied) is what's broadcast, so the opponent never re-rolls — they receive results. Simplest.
- **Tier 2**: the server owns a seeded PRNG (e.g. `mulberry32(seed)`); replace `Math.random` in the
  engine with `rng()`. The seed is set per match. Fully reproducible; supports replay/spectate.

Either way: **route all randomness through one injected `rng`** so it has a single home.

---

## 5. Server design (Node.js)

- **Runtime**: Node 20+, `ws` library (lightweight) or `socket.io` (auto-reconnect, rooms,
  fallbacks — recommended for robustness).
- **Rooms**: a match = a room with ≤2 players + N spectators. `POST /create` → room code; players
  join `wss://host/ws?room=ABCD&side=red`.
- **Messages** (JSON):
  - client→server: `join`, `intent` (Tier 2) or `stateUpdate` (Tier 1), `chat`, `requestResync`.
  - server→client: `joined {side}`, `state {full}` or `patch {jsonpatch}`, `turn {activeSide}`,
    `opponentLeft`, `error`.
- **Turn enforcement**: server rejects intents/updates from the side that is not `state.activeSide`
  (except always-allowed actions like reactive saves, which the engine already models as part of
  the active attack flow — those are driven by the acting client within the modal).
- **Persistence**: in-memory `Map<roomId, game>` is enough for casual play; add Redis only if you
  need horizontal scaling or crash-recovery. Snapshot `state` to disk/Redis every action for
  reconnect.
- **Reconnect**: on `join` with an existing room+side token, send the full current `state`.
- **Payload size**: full `state` is modest (a few hundred KB worst case). Tier 1 can send full
  state per action; if that's too chatty, send **JSON Patch** diffs (`fast-json-patch`).

---

## 6. nginx (reverse proxy + TLS + WS upgrade)

nginx terminates TLS and upgrades the WebSocket to the Node process:

```nginx
server {
  listen 443 ssl http2;
  server_name dfc.example.com;
  ssl_certificate     /etc/letsencrypt/live/dfc.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/dfc.example.com/privkey.pem;

  # Static client (the HTML/JS bundle)
  root /var/www/dfc;
  location / { try_files $uri /index.html; }

  # WebSocket endpoint → Node on :3000
  location /ws {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;   # long-lived sockets
  }

  # Match-management REST (create/join) → same Node
  location /api/ { proxy_pass http://127.0.0.1:3000; }
}
```

- TLS via certbot/Let's Encrypt (WSS is mandatory on HTTPS pages).
- Run Node under **systemd** or **pm2** for restart-on-crash; nginx stays up independently.
- Set `proxy_read_timeout` high so idle turns don't drop the socket; add WS ping/pong heartbeats
  in the app (socket.io does this automatically).

---

## 7. Build/deploy steps

1. Extract the `<script>` into `engine.js` / `render.js` / `net.js`; keep `index.html` as the shell.
2. Write the Node server (`server.js`): rooms, turn cop, broadcast.
3. Local test with two browser tabs against `ws://localhost:3000`.
4. Provision a small VPS; install Node + nginx + certbot.
5. `rsync` the static bundle to `/var/www/dfc`; run Node via systemd; drop in the nginx config.
6. Add a lobby screen (create/join by code, pick side) ahead of the existing setup overlay.

---

## 8. Effort & risk summary

- **Tier 1 (relay)**: ~2–4 days. Main work = lobby UI + send/replace-state plumbing + turn gating.
  Risk: trusts active client; fine for friends.
- **Tier 2 (authoritative)**: ~1–2 weeks. Main work = decoupling engine from DOM + injected RNG +
  intent protocol. Risk: the engine/DOM split is the bulk of the effort, but it also unlocks the
  AI opponent below (the AI needs a headless engine too).

**Strong recommendation:** do the engine/DOM decoupling once. It is the shared prerequisite for
*both* robust multiplayer (Tier 2) *and* the scripted/LLM opponent — so it's the highest-leverage
refactor in the whole project.
