# DFC Battlemat — AI Opponent Plan

> **Status (May 2026): PLANNED — not yet implemented.**
> `legalActions(state, side)` and the full intent/apply pipeline exist. The engine runs
> headlessly on the Node server. Prerequisites are satisfied; implementation can begin.

---

## Design Philosophy

The AI runs **server-side** as a first-class room participant, replacing one player slot's
WebSocket connection with an internal trigger loop. The human client receives the same
authoritative state broadcasts it would from a human opponent — the AI is invisible at the
protocol level.

Two decision engines share one common interface:

- **Fallback heuristic AI** — always available, offline-capable, instant, rule-based scoring
- **LLM AI** — calls Anthropic or OpenAI with a compressed state briefing and a short
  options list; picks the best activation-level choice

The LLM is an upgrade on top of a functional baseline, not a hard dependency. If the API
key is absent, the call times out, or the response cannot be parsed, the heuristic scorer
takes over silently. The game never stalls.

---

## File Structure

```
src/ai/
  index.js          — triggerAi(room): entry point; dispatches to sub-phase handlers
  state-parser.js   — compresses game state to a ~500-token text briefing
  options.js        — groups legalActions() into activation-level choices with plain-English labels
  personalities.js  — personality definitions: system prompts + heuristic weight maps
  llm.js            — Anthropic / OpenAI API wrapper with timeout + fallback
  fallback.js       — heuristic option scoring (kill potential, VP position, survival, objectives)
  translator.js     — expands a chosen Option into the exact intent sequence for apply()
  handlers/
    planning.js     — planning phase: give / take initiative
    activation.js   — activation phase: pick group, order, move, fire, finish
    dropsite.js     — dropsite activation phase: activate dropsites, drop battalions
    asset.js        — asset phase: move assets, resolve attacks
    repair.js       — repair/end phase: fire damage rolls, crippling repair
    deploy.js       — deployment phase: place vanguard / direct-deploy ships
```

---

## Room Integration (`src/rooms.js`)

### Room structure additions

```js
room.aiSide        = null;          // 'player1' | 'player2' | null
room.aiPersonality = 'balanced';    // key from PERSONALITIES
room.aiLlm         = true;          // use LLM if available; false = heuristic only
room.aiPending     = false;         // guard against concurrent AI triggers
```

### Trigger hook

Called after every intent application and broadcast:

```js
async function maybeAiTurn(room) {
  if (!room.aiSide || room.aiPending) return;
  if (!shouldAiAct(room.state, room.aiSide)) return;
  room.aiPending = true;
  try {
    await triggerAi(room);
  } catch (err) {
    console.error('[AI] unhandled error:', err);
  } finally {
    room.aiPending = false;
  }
}
```

### `shouldAiAct(state, side)` — when does the AI have a decision to make?

```js
function shouldAiAct(state, side) {
  if (state.phase === 'deploy')
    return deploySideAllowed(state, side) && undeployedDeployableCount(state, side) > 0;
  if (state.phase !== 'play') return false;
  if (state.repairPhase)         return repairPhaseNeedsInput(state, side);
  if (state.assetPhase)          return state.assetActiveSide === side;
  if (state.dropsiteActivation)  return state.dropsiteActivation.side === side;
  if (state.activeSide === side) return true;
  // Planning phase: initiative winner must give/take
  if (state.initiative && state.initiative.winner === side && !state.initiative.holder)
    return true;
  return false;
}
```

### Room creation API

New optional fields on `POST /api/rooms`:

```json
{
  "aiOpponent":    true,
  "aiSide":        "player2",
  "aiPersonality": "aggressive",
  "aiLlm":         true
}
```

When `aiOpponent: true` the server fills the chosen slot permanently. The AI slot never
sends or receives WebSocket messages. The human joins as normal on the other side.

---

## `triggerAi(room)` — Top-Level Entry (`src/ai/index.js`)

Dispatches to the correct sub-phase handler, applies the intent sequence, and broadcasts:

```js
export async function triggerAi(room) {
  const { state, rng, aiSide, aiPersonality, aiLlm } = room;
  const personality = getPersonality(aiPersonality);

  let intentSequence;
  if (state.phase === 'deploy') {
    intentSequence = await handlers.deploy(state, aiSide, personality, aiLlm);
  } else if (state.initiative && !state.activeSide &&
             !state.dropsiteActivation && !state.assetPhase && !state.repairPhase) {
    intentSequence = await handlers.planning(state, aiSide, personality, aiLlm);
  } else if (state.dropsiteActivation) {
    intentSequence = await handlers.dropsite(state, aiSide, personality, aiLlm);
  } else if (state.assetPhase) {
    intentSequence = await handlers.asset(state, aiSide, personality, aiLlm);
  } else if (state.repairPhase) {
    intentSequence = await handlers.repair(state, aiSide, personality, aiLlm);
  } else {
    intentSequence = await handlers.activation(state, aiSide, personality, aiLlm);
  }

  // Apply the sequence; skip any intent that fails isLegal.
  for (const intent of intentSequence) {
    if (!isLegal(state, intent, aiSide)) {
      console.warn('[AI] illegal intent skipped:', intent.type);
      break;
    }
    apply(state, intent, rng);
  }
  broadcast(room, { type: 'full', state });

  // Chain: if the AI still has something to do, trigger again immediately.
  if (shouldAiAct(state, aiSide)) {
    await maybeAiTurn(room);
  }
}
```

The human client receives a single clean state update per AI activation, not a stream of
intermediate states.

---

## State Parser (`src/ai/state-parser.js`)

Converts the full state object into a compact text briefing (~400–600 tokens).

### Example output

```
=== GAME STATE — Round 3 / 6 ===
Objective: Standard Scoring (control dropsites at R4 and R6)
Secondary (AI): Key Site — nominated DS-2 (Medium, 28" from my zone)

SCORE  AI (PHR) VP:3 KP:120   Human (UCM) VP:5 KP:80

DROPSITES
  DS-1 [S] Orbit  18" from AI zone   CONTESTED  AI:2 bat / Human:1 bat
  DS-2 [M] Atmo   24" from AI zone   HUMAN controlled  3 bat   ← Key Site
  DS-3 [L] Orbit  30" from AI zone   UNCONTROLLED
  DS-4 [M] Orbit  36" from AI zone   AI controlled  4 bat

AI FLEET (PHR) — AP:2  Pass tokens:0
  Theseus Cruiser      [M]  8/8 HP   Orbit NW   not activated   order:—
  Ikarus Vanguard      [M]  9/10 HP  Orbit C    ACTIVATED
  Orpheus Troopship    [M]  7/10 HP  Atmo SW    not activated   order:GQ  Spk:1
  Pandora Frigate ×2   [L]  3/4 HP   Orbit NE   not activated   order:—
  Medea Strike ×2      [L]  2/4 HP   Orbit N    not activated   order:—

HUMAN FLEET (UCM)
  Johannesburg BCr     [H]  14/14 HP  Orbit N    ACTIVATED
  Las Vegas CC         [M]  12/12 HP  Orbit NE   not activated
  Rio Cruiser          [M]  8/10 HP   Orbit C    not activated  Spk:2
  San Francisco TP     [M]  10/10 HP  Atmo SE    not activated
  Lima Detector ×2     [L]  4/4 HP    Orbit N    ACTIVATED

ASSETS  PHR Dropships (2) at DS-3, placed by Orpheus
```

### Design rules

- **Quadrant labels** (NW/N/NE/C/SW/S/SE) instead of pixel coordinates — the LLM
  understands directions, not numbers
- **Distance in inches** to each dropsite, rounded to nearest 2"
- Destroyed groups omitted; heavily damaged groups marked
- Enemy info limited to what is visible on the board (no hidden state)
- Target: under 600 tokens; never truncate the ship list

---

## Options Parser (`src/ai/options.js`)

`legalActions()` returns hundreds of granular intents. The options parser groups them into
**activation-level choices** — the unit the AI reasons about.

### Activation-level option structure

```js
{
  id: 'opt_3',
  label: 'Activate Orpheus Troopship [GQ] — advance to DS-2, launch 2 Bulk Landers',
  groupId: 'player2:p3',
  order: 'GQ',
  movePlan: { targetX, targetY, heading },
  targets: [],           // [{gid, si}] weapon targets
  launchPlan: null       // asset launch if applicable
}
```

### Generation algorithm for activation phase

For each un-activated group:
1. Enumerate legal orders (filter ORDERS by what isLegal allows)
2. For each order, compute 2–3 candidate move destinations:
   - Toward the nearest contested / uncontrolled dropsite
   - Toward the nearest enemy group
   - Hold / optimal firing position (maximise weapons in arc)
3. For each (group, order, destination), identify best weapon targets from that position
4. Label each combination in plain English

Cap at **8–10 options total** before calling the LLM. Always include Pass as the last option.

### Options for other phases

| Phase | Options generated |
|---|---|
| Planning | Take initiative / Give initiative to opponent |
| Deploy | 3–4 candidate positions in zone per undeployed group (near dropsites, centred, coherency) |
| Dropsite | Activate each eligible dropsite (labelled by name + battalions) / Skip |
| Asset | Move each asset toward best target / attack if in range / advance stage |
| Repair | Accept each repair roll (usually automatic; AI only needed for Brace/Contain declarations) |

---

## LLM Interface (`src/ai/llm.js`)

### Prompt structure

```
SYSTEM:
You are {personality.label}, a Dropfleet Commander admiral.
{personality.systemPrompt}
Reply with ONLY the option number you choose, followed by one sentence explaining why.
Format: "3 — advancing Orpheus to DS-2 contests the Key Site before the human reinforces."

USER:
{stateBriefing}

OPTIONS:
1. {option[0].label}
2. {option[1].label}
...
N. Pass activation (spend 1 Pass Token if available)

Choose one option (1–N):
```

### API call with timeout + fallback

```js
async function llmChoose(briefing, options, personality, timeoutMs = 8000) {
  const messages = buildPrompt(briefing, options, personality);
  try {
    const result = await Promise.race([
      callProvider(messages),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ]);
    const idx = parseOptionIndex(result, options.length);
    if (idx === null) throw new Error('unparseable');
    return idx;
  } catch (err) {
    console.warn('[AI] LLM fallback:', err.message);
    return null; // caller uses heuristic scorer
  }
}
```

### Provider abstraction

Both Anthropic and OpenAI are supported via a thin wrapper. Selected by env var:

```
AI_PROVIDER=anthropic   AI_API_KEY=sk-ant-...   AI_MODEL=claude-haiku-4-5-20251001
AI_PROVIDER=openai      AI_API_KEY=sk-...        AI_MODEL=gpt-4o-mini
```

**Recommended model**: `claude-haiku-4-5-20251001` or `gpt-4o-mini`. Option selection from
a short list does not require a large model; speed and cost matter more than raw capability.

**Cost estimate**: ~30–40 AI activations per 6-round game. At Haiku pricing ≈ $0.001/call:
negligible per game. Sonnet ≈ $0.05/game — acceptable for higher-quality play.

---

## Fallback Heuristic AI (`src/ai/fallback.js`)

Rule-based scoring used when: no API key, call timeout, unparseable response, or
`aiLlm: false`. Returns the index of the highest-scoring option.

### Scoring function

```js
function scoreOption(option, state, aiSide, weights) {
  return (
    weights.kill      * estimateKillPotential(option, state, aiSide) +
    weights.vp        * estimateVpGain(option, state, aiSide) +
    weights.survival  * estimateSurvival(option, state, aiSide) +
    weights.objective * estimateObjectiveProgress(option, state, aiSide) +
    weights.momentum  * (option.groupId ? 1 : 0)
  );
}
```

### Heuristic implementations

| Heuristic | Method |
|---|---|
| `estimateKillPotential` | Sum `att × hitProbability × dmg` for each weapon that reaches a target from the move destination |
| `estimateVpGain` | Check if the destination puts ships within battalion-drop range of contested / uncontrolled dropsites |
| `estimateSurvival` | Count enemy weapon dice that can reach the destination; negate and normalise |
| `estimateObjectiveProgress` | Bonus if this action directly advances a secondary or protect nomination |

These are intentionally approximate — correct enough to produce sensible play, not a
full simulation.

---

## Personalities (`src/ai/personalities.js`)

Each personality shapes both the LLM system prompt and the heuristic weight map.

```js
export const PERSONALITIES = {

  aggressive: {
    label: 'Aggressive',
    systemPrompt: `You favour closing range and maximising kills.
Prioritise hull damage over positioning. Accept risk. Prefer Weapons Free and General Quarters.
Closing to Close Action range is almost always worth it.`,
    weights: { kill: 2.5, vp: 1.0, survival: 0.3, objective: 0.8, momentum: 0.5 }
  },

  positional: {
    label: 'Positional',
    systemPrompt: `You prioritise dropsite control and objective completion.
Avoid unnecessary engagements. Contest key dropsites. Drop battalions early.
Prefer Course Change and Max Thrust for repositioning.`,
    weights: { kill: 0.8, vp: 2.5, survival: 1.0, objective: 2.0, momentum: 0.5 }
  },

  defensive: {
    label: 'Defensive',
    systemPrompt: `You value fleet preservation above all. Avoid being outgunned.
Use Silent Running to shed spikes. Prioritise Damage Control on crippled ships.
Accept losing VP to avoid losing ships.`,
    weights: { kill: 0.6, vp: 1.0, survival: 2.5, objective: 0.8, momentum: 0.3 }
  },

  balanced: {
    label: 'Balanced',
    systemPrompt: `You balance offensive pressure, positional play, and fleet survival.
Adapt: press advantages when ahead on VP, play conservatively when behind.`,
    weights: { kill: 1.2, vp: 1.5, survival: 1.2, objective: 1.5, momentum: 0.5 }
  },

  opportunist: {
    label: 'Opportunist',
    systemPrompt: `You identify and eliminate high-value targets of opportunity.
Ignore cheap ships. Focus fire on crippled enemies and expensive targets.
Sacrifice positioning to secure kills on heavy assets.`,
    weights: { kill: 3.0, vp: 0.8, survival: 0.5, objective: 0.6, momentum: 0.5 }
  }
};
```

---

## Intent Translator (`src/ai/translator.js`)

Expands an activation-level Option into the exact intent sequence for `apply()`.

### Activation sequence

```
applyOrder            { gid, order }
moveShip              { gid, si, x, y }          — for each ship in the group
aimShip               { gid, x, y }              — set lead ship heading
lockWeaponTarget      { gid, wi, targetGid, targetSi }   — per weapon+target pair
fireWeapons           { gid }
finishActivation      { gid }
```

### Move planner

`movePlan.targetX/Y` is a desired destination. The planner finds the closest legal point
within the move cone (respecting `moveMin`, `moveMax`, turn limits from `moveCone()`):

```js
function planMove(state, gid, si, targetX, targetY, order) {
  // 1. Compute legal move cone for this ship + order
  // 2. Find the point within the cone closest to targetX/Y
  // 3. If target is reachable, move there; else move as far as possible toward it
  // 4. Return { x, y, heading }
}
```

**Multi-ship groups**: each ship moves individually. The translator positions ships using
coherency-aware spacing — ships stay within `coherencyDist` of each other.

---

## Sub-Phase Handlers

### `handlers/activation.js`

```
1. generateActivationOptions(state, aiSide)   — options.js
2. buildStateBriefing(state, aiSide)           — state-parser.js
3. llmChoose or fallback scoreOption           — llm.js / fallback.js
4. log choice + reasoning to room event log
5. translator.buildActivationSequence(option) — intent sequence
```

### `handlers/planning.js`

Binary choice: take initiative (go first) or give it to the opponent. The fallback scores
based on VP delta and whether the AI has higher-priority targets to hit first this round.

### `handlers/deploy.js`

For each un-deployed vanguard/direct group, generate candidate positions:
- Near the closest contested dropsite
- Near the board centre
- Near a friendly group for coherency
- Vanguard groups use the full vanguard halo depth

### `handlers/dropsite.js`

Which dropsites to activate and in what order. Score by expected battalion advantage and
whether a feature weapon fires usefully.

### `handlers/asset.js`

Move assets toward the optimal targets. Score by expected damage or battalion delivery
value per asset type.

### `handlers/repair.js`

Usually fully deterministic (accept repair roll results). AI input needed only for
Brace/Contain AP declarations — decided by checking AP remaining vs crippling severity.

---

## Client-Side Changes

### Mode selector (`client/index.html`)

Add a "SOLO vs AI" option in the mode selector alongside Host / Join:

```
┌────────────────────────────────────┐
│  LOCAL HOTSEAT                      │
│  ONLINE — Host a room               │
│  ONLINE — Join a room               │
│  SOLO vs AI                         │  ← new
└────────────────────────────────────┘
```

"SOLO vs AI" flow:
1. Player sets up the game as normal (full setup overlay, their side only)
2. AI faction + personality selectable (or randomised)
3. `POST /api/rooms { aiOpponent: true, aiSide: 'player2', aiPersonality: '...', aiLlm: true }`
4. Client joins the returned room as `player1`

The AI's own fleet and secondaries are assigned server-side at room creation, driven by the
personality (aggressive personalities lean toward heavier fleets; defensive ones toward
faster ones).

### AI status indicator

A small indicator in the event log header or topbar shows AI state:

```
⏳ AI thinking…          ← during LLM call (replaces room dot)
🤖 "advancing to DS-2"   ← shown briefly after choice, if LLM reasoning is available
```

---

## Server Config

```
AI_PROVIDER=anthropic                  # 'anthropic' | 'openai'
AI_API_KEY=sk-ant-...                  # never sent to client
AI_MODEL=claude-haiku-4-5-20251001    # model override
AI_TIMEOUT_MS=8000                     # LLM call timeout before fallback
AI_FALLBACK_ONLY=false                 # true = always heuristic, skip LLM
```

Loaded in `server.js` via `dotenv`. The AI module reads these at startup and sets
`llmAvailable` accordingly.

---

## Implementation Phases

### Phase A — Foundation (heuristic AI, activation phase only)
1. `personalities.js` — five personality definitions
2. `state-parser.js` — state-to-text briefing
3. `options.js` — activation-level option generation
4. `fallback.js` — heuristic scoring
5. `translator.js` — activation intent sequence from chosen option + move planner
6. `handlers/activation.js` — full activation flow (heuristic only)
7. Room integration — `aiSide`, `shouldAiAct`, `maybeAiTurn`, API endpoint

**Milestone**: playable heuristic AI for the activation phase

### Phase B — Full sub-phase coverage
1. `handlers/planning.js` — initiative give/take
2. `handlers/deploy.js` — vanguard/direct deployment
3. `handlers/dropsite.js` — dropsite activation
4. `handlers/asset.js` — asset phase
5. `handlers/repair.js` — repair/end phase

**Milestone**: AI can complete a full game without stalling

### Phase C — LLM layer
1. `llm.js` — Anthropic + OpenAI wrapper with timeout + fallback
2. Prompt tuning — test each personality across scenarios
3. Client "SOLO vs AI" mode selector
4. AI status indicator in UI
5. AI fleet/secondary selection at room creation

**Milestone**: full LLM-driven AI selectable from the mode screen

### Phase D — Polish
1. Move planner improvements (coherency, layer changes, vanguard halo)
2. Multi-target weapon allocation (spread vs focus fire)
3. Asset phase sophistication (dogfights, torpedo paths)
4. Battalion combat AI
5. Difficulty tiers: Easy (fallback, narrow search) / Medium (LLM Haiku) / Hard (LLM Sonnet)

---

## Known Constraints and Risks

| Constraint | Mitigation |
|---|---|
| **Action space is huge** — `legalActions` returns hundreds of granular intents | Options parser groups to activation level; LLM sees 8–10 choices, not hundreds |
| **Multi-step activations** — partial sequences leave state in an illegal mid-activation condition | Translator always emits a complete sequence; any illegal intent breaks the loop, not the game |
| **LLM hallucination** — response may be out-of-range or unparseable | `parseOptionIndex` is defensive; falls back to heuristic scorer on any parse failure |
| **Async in Node.js** — concurrent AI triggers would corrupt state | `aiPending` flag guards the trigger; only one `triggerAi` runs at a time per room |
| **Latency** — Haiku typically responds in 1–3s | `AI_TIMEOUT_MS` caps the wait; heuristic fires immediately on timeout |
| **API key security** — key must not reach the browser | Key lives in server env; never serialised into room state or broadcast |

---

## AI Fleet Builder (`src/ai/fleet-builder.js`)

Generates a legal, balanced fleet for the AI opponent at a given points level. The output
is compatible with the `importedFleets` format already consumed by `buildSideFleet()`, so
the built fleet slots straight into a room without any additional plumbing.

The builder also emits a **tactics summary** — a short list of strategic recommendations
derived from the fleet's composition. This feeds directly into the AI's personality system
prompt, giving the LLM context about what the fleet is designed to do.

---

### Inputs

```js
buildAiFleet({
  faction:      'ucm',       // faction key from FLEET_DB
  targetPts:    1500,        // match the human's fleet total
  admiralLevel: 2,           // 0 = none, 1–5 = generic admiral level
  personality:  'aggressive',// optional: biases group selection
  rng:          roomRng,     // seeded RNG for reproducibility
})
```

Returns:

```js
{
  faction:      'ucm',
  groups:       [{ name, count, pts, options }],   // importedFleets-compatible
  admiralLevel: 2,
  admiralGroupIdx: 3,                               // which group carries the admiral
  totalPts:     1498,
  dropPct:      0.27,                               // fraction of pts with drop capability
  tactics:      [                                   // see Tactics Generation below
    "Heavy battlecruiser presence — open aggressively from Vanguard range",
    "Two troopships — prioritise early dropsite control over engagements",
    "Low fighter count — vulnerable to bomber attack; keep ships spread"
  ]
}
```

---

### Fleet Construction Rules

Extracted from the DFC core rules and modelled from `db.js` `special` / `launch` fields.

#### 1. Points budget
- Total group pts (summed as `def.pts × def.groupSize × repetitions`) must be ≤ `targetPts`
- Accept a fleet within ±3% of target (i.e. ≥97% used) — fleets slightly under budget are legal

#### 2. Tonnage cap — H and C tonnage
- **H (Heavy)**: max 1 H-tonnage group per 500 pts of fleet value, rounded down
  - e.g. 1500 pt fleet → max 3 H groups; 999 pt fleet → max 1 H group
- **C (Capital)**: max 1 C-tonnage group per fleet, regardless of points
- Detected by `def.tonnage === 'H'` or `def.tonnage === 'C'` in db.js

#### 3. Rare groups
- Max **1 group** of each ship whose `special` contains the word `Rare`
- Parsed as: `/\bRare\b/i.test(def.special)`
- A single ship name can only appear once in the fleet at Rare status

#### 4. Unique groups
- Max **1 group** of each ship whose `special` contains `Unique`
- Parsed as: `/\bUnique\b/i.test(def.special)`
- e.g. `Geneva Command Cruiser`, `Las Vegas Command Carrier`

#### 5. Famous Admiral
- If `admiralLevel > 0` and a Famous Admiral ship exists for the faction, the builder may
  substitute one group for the Famous Admiral entry (name matches `/Famous Admiral/i`)
- The Famous Admiral group counts as both a ship group AND the admiral assignment
- Its `pts` is the full ship+admiral cost as listed in db.js
- Can only take a Famous Admiral whose level matches or is below `admiralLevel`

#### 6. Drop requirement — 20–40% of total points
- Drop-capable groups: `def.launch` contains an entry with `type === 'dropship'` or
  `type === 'bulk_lander'`
- `dropPts = sum(pts of all drop-capable groups in fleet)`
- **Constraint**: `0.20 × totalPts ≤ dropPts ≤ 0.40 × totalPts`
- If a faction has no drop-capable ships (e.g. pure Shaltari Gateship list), the constraint
  is relaxed and a warning is emitted; Shaltari use Gateships for ground combat instead

#### 7. Group size
- Each "group" in the fleet is one unit of `def.groupSize` ships
- Points cost per group = `def.pts × def.groupSize` (or just `def.pts` if groupSize = 1)
- Multiple identical groups are allowed unless the ship is Rare or Unique

---

### Builder Algorithm

The builder uses a **constraint-guided random selection** loop:

```
1. SEED required drop groups
   — Randomly select drop-capable groups until dropPts ≥ 0.20 × targetPts
   — Respect Rare/Unique limits
   — Budget: targetPts × 0.40 (cap drop spend to stay under 40%)

2. SEED heavy group (if points allow)
   — If personality is aggressive/opportunist: prefer H-tonnage
   — Check H-tonnage cap; add 0–1 H group at random

3. FILL remaining budget with M and L groups
   — Build a candidate pool: all non-Rare, non-Unique M and L ships for the faction
   — Bias pool by personality weight (aggressive → high att weapons; positional → more carriers)
   — Randomly draw from pool, checking: points fit, Rare/Unique limits, drop% ceiling
   — Stop when budget is within 3% tolerance or no group fits

4. ASSIGN admiral
   — If admiralLevel > 0 and Famous Admiral available: optionally substitute one group
   — Else: assign admiral to the highest-tonnage, non-Rare group
   — Set admiralGroupIdx

5. VALIDATE all constraints
   — If any constraint fails: discard and restart (max 20 retries)
   — On persistent failure: relax the drop ceiling to 0.50 and retry

6. EMIT tactics summary (see below)
```

---

### Tactics Generation

After the fleet is built, the builder analyses its composition and emits 3–6 tactical
observations as plain-English strings. These are appended to the AI personality's system
prompt when the LLM is used, giving it fleet-specific strategic context.

#### Rule categories

| Category | Detection | Tactic string |
|---|---|---|
| **Vanguard presence** | Any group has `def.vanguard` set | `"Vanguard ships available — consider early board presence and applying pressure before the opponent settles"` |
| **Heavy/Capital flagship** | H or C tonnage group present | `"Heavy flagship — protect it; its points value makes it a prime focus-fire target"` |
| **High drop count** | dropPct > 0.35 | `"Drop-heavy roster — prioritise landing battalions early; fleet is built around ground control"` |
| **Low drop count** | dropPct < 0.25 | `"Limited drop capacity — choose dropsites carefully; cannot afford to contest all objectives"` |
| **Fighter/bomber wings** | `launch.type === 'fighter_bomber'` present | `"Fighter/bomber wings available — use them to screen against incoming bombers and to threaten crippled targets"` |
| **Silent Running synergy** | Multiple L-tonnage groups with low sig | `"Low-signature light elements — Silent Running can effectively neutralise targeting; use approach lanes"` |
| **Command ship present** | `special` contains `Command Ship` | `"Command Ship in fleet — maintain AP generation; prioritise its survival above most other groups"` |
| **Detector present** | `special` contains `Detector` | `"Detector available — use it early to spike high-value enemy targets and open them to long-range fire"` |
| **Bombardment weapons** | `special` of a weapon contains `Bombardment` | `"Bombardment capable — engage dropsites from distance; deny enemy battalion build-up without close approach"` |
| **Close Action focus** | Majority of weapons have `Close Action` | `"Close-Action-heavy weapons — close range is essential; plan approaches that survive the initial long-range exchange"` |
| **Torpedo complement** | `launch.type === 'torpedo'` present | `"Torpedo complement — use them to threaten or finish off crippled heavy targets"` |
| **Aegis coverage** | `special` contains `Aegis` | `"Aegis ships present — cluster near carriers and Capitals to provide anti-wing screening"` |

Tactics are de-duplicated and the most relevant 3–6 are selected. If the LLM is enabled,
the tactics list is included in the planning-phase prompt as `Fleet Tactics Guidance:`.

---

### Integration with AI Decision Making

The `tactics` array returned by the builder is stored on the room:

```js
room.aiTactics = fleet.tactics;
```

It is injected into every LLM prompt after the personality system prompt:

```
You are {personality.label}.
{personality.systemPrompt}

Fleet Tactics Guidance (specific to your current fleet):
- {tactics[0]}
- {tactics[1]}
- {tactics[2]}
```

This grounds the LLM's decisions in what the fleet is actually capable of, rather than
relying solely on the generic personality description.

The fallback heuristic also reads `tactics` to adjust its scoring weights at runtime:
- `"High drop count"` → boost `vp` weight by 0.5 (prioritise dropsite control)
- `"Close-Action-heavy"` → boost `kill` weight when within 12" of enemies
- `"Command Ship present"` → boost `survival` weight for that group's options

---

### Validation Report

The builder returns a `validation` object alongside the fleet for logging/debugging:

```js
{
  valid: true,
  totalPts: 1498,
  targetPts: 1500,
  pctUsed: 0.999,
  dropPts: 405,
  dropPct: 0.270,   // ✓ within 0.20–0.40
  hGroups: 1,       // ✓ ≤ floor(1500/500) = 3
  cGroups: 0,       // ✓ ≤ 1
  rareNames: ['Lima Detector Frigate'],   // ✓ each appears once
  uniqueNames: [],
  warnings: []
}
```

If `valid: false`, the caller falls back to the pre-built quickplay fleet for the faction.

---

### Fleet Builder Phase (Implementation)

Add to **Phase A** of the implementation plan:

1. `src/ai/fleet-builder.js` — full builder with constraint validation
2. Integration in room creation: when `aiOpponent: true`, call `buildAiFleet` and store
   result as `room.state.importedFleets[aiSlot]` and `room.aiTactics`
3. Unit tests for each constraint (tonnage cap, Rare limit, drop % range)
4. Fallback: if builder fails after 20 retries, use the faction's first 10 cheapest groups
   that satisfy the drop requirement (guaranteed to produce a valid list)
