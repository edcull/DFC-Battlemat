// REST routes and WebSocket connection handler.

import { Router } from 'express';
import { createRoom, getRoom, joinRoom, leaveRoom, broadcast, send, sideOf, recordIntent } from './rooms.js';
import { isLegal } from './engine/gating.js';
import { apply } from './engine/mutators.js';
import { saveRoom, loadSave, loadAllSaves } from './saves.js';
import { APP_VERSION, RULEBOOK_VERSION, ERRATA_VERSION } from './engine/version.js';
import { getRoomSlot, setRoomSlot } from './db.js';

export const router = Router();

// GET /api/meta — app and ruleset version info.
router.get('/meta', (_req, res) => {
  res.json({ appVersion: APP_VERSION, rulebookVersion: RULEBOOK_VERSION, errataVersion: ERRATA_VERSION });
});

// POST /api/rooms — create a new room, return its code.
router.post('/rooms', (req, res) => {
  const room = createRoom();
  console.log(`Room ${room.id} created (seed ${room.seed})`);
  // If the creator is authenticated, claim player1 slot for them.
  if (req.user) setRoomSlot(room.id, 'player1', req.user.id);
  res.json({ roomId: room.id, seed: room.seed });
});

// GET /api/rooms/:id — check whether a room exists and who has joined.
router.get('/rooms/:id', (req, res) => {
  const room = getRoom(req.params.id.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  res.json({
    roomId: room.id,
    sides: { player1: !!room.sockets.player1, player2: !!room.sockets.player2 },
    phase: room.state.phase,
  });
});

// GET /api/saves — list saved games. Authenticated users see only their own saves.
router.get('/saves', async (req, res) => {
  const userId = req.user?.id ?? null;
  const saves = await loadAllSaves(userId);
  res.json(
    saves
      .filter(s => s.phase && s.phase !== 'setup')
      .map(s => ({
        roomId:      s.roomId,
        phase:       s.phase,
        round:       s.round,
        savedAt:     s.savedAt,
        playerNames: s.playerNames ?? {},
        factions:    s.factions    ?? {},
        sideColors:  s.sideColors  ?? null,
        isHotseat:   s.isHotseat || false,
        hasReplay:   !!s.hasReplay,
      }))
  );
});

// POST /api/saves/hotseat — save a hotseat game state snapshot.
router.post('/saves/hotseat', async (req, res) => {
  const { roomId, state } = req.body;
  if (!roomId || !state) return res.status(400).json({ error: 'Missing roomId or state.' });
  const room = {
    id: roomId,
    state,
    seed: null,
    createdAt: state.createdAt || Date.now(),
    rng: { getState: () => null },
    playStartState: null,
    playStartRngState: null,
    intentLog: [],
    isHotseat: true,
  };
  try {
    await saveRoom({ ...room, isHotseat: true }, req.user?.id ?? null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/saves/:id — full save data for resume/replay.
router.get('/saves/:id', async (req, res) => {
  try {
    const save = await loadSave(req.params.id.toUpperCase());
    res.json(save);
  } catch {
    res.status(404).json({ error: 'Save not found.' });
  }
});

// GET /api/rooms/:id/replay — full replay data for a room (from its save file).
router.get('/rooms/:id/replay', async (req, res) => {
  try {
    const save = await loadSave(req.params.id);
    if (!save.playStartState) {
      return res.status(404).json({ error: 'No replay data — game has not started yet.' });
    }
    res.json({
      roomId:            save.roomId,
      seed:              save.seed,
      playerNames:       save.playerNames,
      factions:          save.factions,
      playStartState:    save.playStartState,
      playStartRngState: save.playStartRngState,
      intentLog:         save.intentLog,
    });
  } catch {
    res.status(404).json({ error: 'Save not found.' });
  }
});

// POST /api/rooms/resume — recreate a live room from a saved game.
router.post('/rooms/resume', async (req, res) => {
  const { saveId } = req.body || {};
  if (!saveId) return res.status(400).json({ error: 'saveId required.' });
  let save;
  try {
    save = await loadSave(saveId);
  } catch {
    return res.status(404).json({ error: 'Save not found.' });
  }
  const room = createRoom(save.roomId);
  room.state             = save.currentState;
  room.seed              = save.seed;
  room.rng.setState(save.currentRngState);
  room.intentLog         = save.intentLog        || [];
  room.playStartState    = save.playStartState    || null;
  room.playStartRngState = save.playStartRngState ?? null;
  room.createdAt         = save.createdAt         || room.createdAt;
  // Re-claim player1 slot for the resuming user.
  if (req.user) setRoomSlot(room.id, 'player1', req.user.id);
  console.log(`Room ${room.id} resumed from save ${save.roomId} (round ${save.round})`);
  res.json({ roomId: room.id, seed: room.seed });
});

// ---------------------------------------------------------------------------
// WebSocket connection handler
// ---------------------------------------------------------------------------

export function handleConnection(ws, req) {
  const url = new URL(req.url, 'http://localhost');
  const roomId  = (url.searchParams.get('room') || '').toUpperCase();
  const rawSide = (url.searchParams.get('side')  || 'spectator').toLowerCase();
  const side    = rawSide; // 'player1' | 'player2' | 'spectator'

  const room = getRoom(roomId);
  if (!room) {
    send(ws, { type: 'error', reason: 'Room not found.' });
    ws.close();
    return;
  }

  // Capture the authenticated user id at connection time so message handlers
  // can pass it to saveRoom without holding a reference to req.
  const connectedUserId = req.user?.id ?? null;

  if (side === 'player1' || side === 'player2') {
    // Slot ownership check: if the slot is claimed, only the owning user may connect.
    const slot = getRoomSlot(roomId, side);
    if (slot) {
      if (slot.user_id !== connectedUserId) {
        send(ws, { type: 'error', reason: 'This player slot is reserved for another user.' });
        ws.close();
        return;
      }
    } else if (connectedUserId) {
      // Slot is free — authenticated user claims it.
      setRoomSlot(roomId, side, connectedUserId);
    }

    const result = joinRoom(room, side, ws);
    if (result.error) {
      send(ws, { type: 'error', reason: result.error });
      ws.close();
      return;
    }
  } else {
    room.spectators.push(ws);
  }

  console.log(`[${roomId}] ${side} connected${req.user ? ` (${req.user.username})` : ''}`);

  send(ws, { type: 'joined', side, roomId, state: room.state });
  broadcast(room, { type: 'peerJoined', side }, ws);

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    onMessage(room, ws, side, msg, connectedUserId);
  });

  ws.on('close', () => {
    console.log(`[${roomId}] ${side} disconnected`);
    leaveRoom(room, ws);
    broadcast(room, { type: 'opponentLeft', side });
  });

  ws.on('error', err => console.error(`[${roomId}/${side}] WS error: ${err.message}`));
}

// ---------------------------------------------------------------------------
// Message dispatch
// ---------------------------------------------------------------------------

function onMessage(room, ws, side, msg, userId) {
  room.lastActivity = Date.now();

  switch (msg.type) {

    case 'state': {
      if (!msg.state || typeof msg.state !== 'object') {
        send(ws, { type: 'error', reason: 'Invalid state payload.' });
        return;
      }
      room.state = msg.state;
      saveRoom(room, userId).catch(err => console.error(`[${room.id}] save error:`, err.message));
      broadcast(room, { type: 'full', state: room.state }, ws);
      break;
    }

    case 'resync': {
      send(ws, { type: 'full', state: room.state });
      break;
    }

    case 'intent': {
      const intent = msg.intent;
      if (!intent || typeof intent !== 'object') {
        send(ws, { type: 'error', reason: 'Invalid intent payload.' });
        return;
      }
      if (!isLegal(room.state, intent, side)) {
        send(ws, { type: 'error', reason: `Illegal action: ${intent.type}` });
        send(ws, { type: 'full', state: room.state });
        return;
      }
      if (intent.type === 'endRound') {
        room.endRoundVotes.add(side);
        const connected = Object.values(room.sockets).filter(Boolean).length;
        broadcast(room, { type: 'endRoundVotes', votes: [...room.endRoundVotes] });
        if (room.endRoundVotes.size < Math.max(connected, 2)) return;
        room.endRoundVotes.clear();
      }
      apply(room.state, intent, room.rng);
      if (room.state.phase === 'play' && !room.playStartState) {
        room.playStartState    = structuredClone(room.state);
        room.playStartRngState = room.rng.getState();
      }
      if (room.playStartState) recordIntent(room, side, intent);
      saveRoom(room, userId).catch(err => console.error(`[${room.id}] save error:`, err.message));
      broadcast(room, { type: 'full', state: room.state });
      break;
    }

    case 'peerView': {
      broadcast(room, { type: 'peerView', peerView: msg.peerView }, ws);
      break;
    }

    default:
      send(ws, { type: 'error', reason: `Unknown message type: ${msg.type}` });
  }
}
