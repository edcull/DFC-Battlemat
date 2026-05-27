# DFC Battlemat — Single-Player vs a Scripted / LLM Opponent

> **Status (May 2026): NOT YET IMPLEMENTED — plan document only.**
> The engine/DOM split is now done: pure game logic lives in `src/engine/` and runs headlessly
> on the Node server, so the bot can drive the engine directly. The remaining prerequisite is the
> `legalActions`/`isLegal` API (`src/engine/gating.js`), which has not been extracted yet — the
> rules bot scores candidate actions returned by `legalActions`, so it is blocked on that.
> All game mechanics the bot would need (orders, movement, firing, launches, scoring, asset
> combat, etc.) are fully implemented, and `state.activeSide` alternation, activation locking, and
> group-action tracking are all in place, so the turn-loop integration point is well-defined.


Goal: let one human play against the computer controlling the other side. Two engines proposed —
a **rules-based bot** (reliable, free, fast) and an **LLM-driven commander** (flexible, characterful)
— behind one common interface so they're interchangeable.

---

## 1. Shared prerequisite: a headless engine + action API

Both bots need to *propose legal actions* and *see consequences* without touching the DOM. This is
the **same engine/DOM decoupling** the multiplayer Tier 2 plan calls for — do it once, both features
benefit.

Define a thin **engine API** the bot drives (mirrors what the human's clicks do today):

- `getState()` → the current `state` (read-only snapshot).
- `legalActions(side)` → an array of legal action objects for `side` in the current phase, e.g.
  `{type:'setOrder', gid, order}`, `{type:'move', gid, si, x, y, heading, layer}`,
  `{type:'lockWeapon', gid, si, wi, targetGid, targetSi}`, `{type:'fire', gid, si}`,
  `{type:'launch', …}`, `{type:'survey'|'extract'|'detector'|'antiwing', …}`,
  `{type:'finishActivation', gid}`, `{type:'pass'}`, plus modal responses (saves, brace, etc.).
- `apply(action)` → mutate state via the existing mutators; returns events (damage dealt, kills…).
- `isMyTurn(side)` / `phase()` — control flow.

Crucially, `legalActions` should reuse the **same gating logic the UI already computes** (fire
limits, coherency, range/arc checks, AP availability). That guarantees the bot can only do what a
human could, with zero new rules code.

The game already alternates activations (`state.activeSide`, `advanceActiveSide()`), so the loop is:
while it's the bot's turn, ask the bot for an action, `apply` it, repeat until it passes/finishes;
then hand back to the human.

---

## 2. Engine A — Rules-based bot (recommended default)

A deterministic "good enough" commander built from heuristics over `legalActions`. Phases mirror
the game:

**Planning**: spend AP on high-value reactive abilities (Brace when a capital is below half; Re-roll
on big attacks). Keep a reserve.

**Activation order**: activate the group with the best expected value first (or hold high-Sig groups
for Silent Running if being targeted).

**Per group — choose an Order** by situation:
- Enemy in range & good arc → **Weapons Free** (max damage) unless the Spike gain is dangerous.
- Need to reposition/escape → **Course Change** or **Max Thrust**.
- Overheated (3–4 Spikes) and no good shot → **Silent Running** to shed Spikes.
- Damaged capital, lull in combat → **Damage Control**.

**Movement**: a scoring function over candidate end-positions sampling the legal move cone —
reward: weapons-in-arc on enemies, staying in coherency, nearing un-controlled dropsites, board
control; penalize: enemy weapons-in-arc on me, scenery hazards, edge-of-table, leaving coherency.
Pick the argmax (sample ~12–20 candidate points in the cone).

**Targeting**: for each fireable weapon, choose the target maximizing `P(hit) × damage × value`
(value = points, capital bonus, near-death bonus, objective-carrier bonus). Respect fire limits.

**Battalions/dropsites**: launch ground assets at the nearest contestable/empty dropsite; board
enemy capitals when adjacent and advantageous.

**Difficulty knobs**: search width (candidate count), greediness vs. lookahead, whether it uses AP
optimally, whether it "sees" through Spikes correctly. Easy = narrow + greedy + suboptimal AP.

Pros: instant, free, deterministic, debuggable, never illegal. Cons: predictable; tuning is manual.
**This should be the always-available default opponent.**

---

## 3. Engine B — LLM-driven commander (optional, for flavour)

Use an LLM (Anthropic API) as the *decision-maker*, with the engine as guardrails. The LLM never
emits raw state — it **picks from `legalActions`** (or names an action the engine then validates),
so it can never make an illegal or game-breaking move.

### Loop per bot decision
1. Engine builds a **compact text/JSON briefing**: phase, round, AP, the bot's groups (pos, hull,
   spikes, weapons, orders available), visible enemy groups (pos, hull, Sig+spikes, threat),
   dropsite control, objectives, and the **enumerated legal actions** (each with a short id).
2. Send to the model with a **system prompt** = the commander persona + DFC doctrine + "respond
   with the chosen action id(s) and a one-line rationale, as JSON."
3. Parse the JSON; **validate against `legalActions`**; if invalid/missing, fall back to Engine A's
   pick (never block the game).
4. `apply` the action; append the outcome to a running **memory log** so the next prompt has
   continuity ("you committed cruisers to the east dropsite last turn").

### Prompt/cost shape
- One activation can involve several decisions (order, move, target, fire). Batch them: ask the
  model for a **whole-activation plan** for one group at a time, not per click — fewer round-trips.
- Keep the briefing terse (IDs + numbers, not prose) to control token cost. Cache the static rules
  doctrine as a system prompt.
- Expect ~1 call per group activation. A 6-round game ≈ a few dozen calls per side — modest.

### In-browser vs server
- The API key must **not** ship to the browser. Route LLM calls through the **Node server** (the
  same one from the multiplayer plan): browser → `/api/ai-move` → server adds key → Anthropic →
  validated action back. This is also where the headless engine can live for authoritative play.
- Optionally use the in-artifact Anthropic API path for a pure-client demo, but server-side is the
  correct production design.

### Persona/difficulty
- System-prompt personas: "aggressive Scourge raider", "cautious PHR line admiral", "objective-
  focused UCM commander". Difficulty via doctrine hints + whether you reveal full vs. fogged enemy
  info to the model.

Pros: surprising, characterful, explains its reasoning, easy to re-flavour. Cons: latency (seconds
per call), cost, occasional bad picks (mitigated by the validate-or-fallback guard), needs the
server.

---

## 4. Hybrid (best of both)

Run **Engine A as the floor**: it always produces a legal, reasonable action. Use **Engine B to
override** when available and confident. If the LLM is slow, errors, or returns junk, the rules bot
already has a move ready — the game never stalls. This also lets the LLM handle the *interesting*
strategic choices (which dropsite to commit to, when to retreat) while the rules bot handles the
fiddly optimal targeting math.

---

## 5. UI / UX

- Setup: a "Player 2 = Human / Computer (Rules) / Computer (LLM persona)" selector on the existing
  fleet-slot picker.
- During the bot's turn: show a "Opponent is thinking…" banner; **animate its actions through the
  same render path** (move the ship, open the attack modal, roll) so the human sees what happened,
  rather than teleporting state. A short delay between bot sub-actions makes it readable.
- An optional **action log / "commander's intent"** panel showing the bot's one-line rationales
  (especially fun with the LLM).
- Reactive moments (the human's saves, Brace/Contain when the bot attacks) still prompt the human
  via the existing modal — the bot only drives its own activations and its own reactive choices.

---

## 6. Phasing

1. **Engine/DOM decouple + `legalActions`/`apply` API** (shared with multiplayer Tier 2). Biggest
   piece; unlocks everything.
2. **Engine A (rules bot)** end-to-end for one faction; the activation loop + "thinking" animation.
3. Generalize Engine A across phases (battalions, dropsites, asset combat, reactive saves/AP).
4. **Engine B (LLM)** via the Node `/api/ai-move` route, with validate-or-fallback to Engine A.
5. Personas, difficulty knobs, and the commander-intent log.

---

## 7. Effort & risk

- **Engine A**: ~1 week after the API exists. Low risk; pure heuristics over existing legality.
- **Engine B**: ~3–5 days on top of A + the Node server. Risk = latency/cost/parsing, all contained
  by the fallback. Needs the server (so it pairs naturally with multiplayer hosting).
- **Shared `legalActions`/`apply` refactor**: ~1–2 weeks, but it is the **same work** as
  multiplayer Tier 2. Do it once, get robust online play *and* an AI opponent from it.

**Bottom line:** the single highest-leverage step for the whole project is extracting a headless,
DOM-free engine that exposes `legalActions(side)` and `apply(action)` driven by the existing
mutators. From that one foundation you get cheat-resistant two-player WebSocket play, a free
deterministic rules bot, and an optional LLM commander — all sharing the same core.
