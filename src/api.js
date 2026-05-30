// REST routes and WebSocket connection handler.

import { Router } from 'express';
import { createRoom, getRoom, joinRoom, leaveRoom, broadcast, send, sideOf } from './rooms.js';
import { isLegal } from './engine/gating.js';
import { apply } from './engine/mutators.js';

export const router = Router();

// POST /api/rooms — create a new room, return its code.
router.post('/rooms', (_req, res) => {
  const room = createRoom();
  console.log(`Room ${room.id} created (seed ${room.seed})`);
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

// Called by server.js when the WebSocket server emits 'connection'.
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

  if (side === 'player1' || side === 'player2') {
    const result = joinRoom(room, side, ws);
    if (result.error) {
      send(ws, { type: 'error', reason: result.error });
      ws.close();
      return;
    }
  } else {
    room.spectators.push(ws);
  }

  console.log(`[${roomId}] ${side} connected`);

  // Send the current authoritative state so the client can render immediately.
  send(ws, { type: 'joined', side, roomId, state: room.state });

  // Inform the opponent (if present) that the other side is now connected.
  broadcast(room, { type: 'peerJoined', side }, ws);

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    onMessage(room, ws, side, msg);
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

function onMessage(room, ws, side, msg) {
  room.lastActivity = Date.now();

  switch (msg.type) {

    // Active player pushes their updated state after an action.
    // Server stores it as authoritative and relays to all others.
    case 'state': {
      if (!msg.state || typeof msg.state !== 'object') {
        send(ws, { type: 'error', reason: 'Invalid state payload.' });
        return;
      }
      // Relay-mode trust: in Phase 2 any connected player may push state.
      // Turn enforcement (activeSide check) is added when gating.js is ready.
      room.state = msg.state;
      broadcast(room, { type: 'full', state: room.state }, ws);
      break;
    }

    // Client requests the full current state (reconnect / resync).
    case 'resync': {
      send(ws, { type: 'full', state: room.state });
      break;
    }

    // Server-authoritative intent dispatch. The server validates the action
    // against gating.js and applies it to the authoritative state itself, then
    // broadcasts the result to everyone (including the sender, who did not
    // mutate locally). Migrated action families use this path; everything not
    // yet migrated still uses the trusted-relay `state` path above.
    case 'intent': {
      const intent = msg.intent;
      if (!intent || typeof intent !== 'object') {
        send(ws, { type: 'error', reason: 'Invalid intent payload.' });
        return;
      }
      if (!isLegal(room.state, intent, side)) {
        send(ws, { type: 'error', reason: `Illegal action: ${intent.type}` });
        send(ws, { type: 'full', state: room.state }); // resync the rejected client
        return;
      }
      // endRound requires both connected players to vote before the round advances.
      if (intent.type === 'endRound') {
        room.endRoundVotes.add(side);
        const connected = Object.values(room.sockets).filter(Boolean).length;
        // Broadcast the current vote set so both clients can show who's ready.
        broadcast(room, { type: 'endRoundVotes', votes: [...room.endRoundVotes] });
        if (room.endRoundVotes.size < Math.max(connected, 2)) {
          // Still waiting — don't apply yet.
          return;
        }
        // Both (or all connected players) have voted — apply and reset.
        room.endRoundVotes.clear();
      }
      apply(room.state, intent, room.rng);
      broadcast(room, { type: 'full', state: room.state }); // to all, incl. sender
      break;
    }

    // Client broadcasts its current ship selection so the opponent can show
    // movement cones / overlays without a full state relay.
    case 'peerView': {
      broadcast(room, { type: 'peerView', peerView: msg.peerView }, ws);
      break;
    }

    default:
      send(ws, { type: 'error', reason: `Unknown message type: ${msg.type}` });
  }
}
