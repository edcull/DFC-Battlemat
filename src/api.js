// REST routes and WebSocket connection handler.

import { Router } from 'express';
import { createRoom, getRoom, joinRoom, leaveRoom, broadcast, send, sideOf } from './rooms.js';

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
    sides: { ucm: !!room.sockets.ucm, shal: !!room.sockets.shal },
    phase: room.state.phase,
  });
});

// Called by server.js when the WebSocket server emits 'connection'.
export function handleConnection(ws, req) {
  const url = new URL(req.url, 'http://localhost');
  const roomId = (url.searchParams.get('room') || '').toUpperCase();
  const side   = (url.searchParams.get('side')  || 'spectator').toLowerCase();

  const room = getRoom(roomId);
  if (!room) {
    send(ws, { type: 'error', reason: 'Room not found.' });
    ws.close();
    return;
  }

  if (side === 'ucm' || side === 'shal') {
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

    // Placeholder for future server-authority intent dispatch (Phase 2c+).
    case 'intent': {
      send(ws, { type: 'error', reason: 'Intent-based dispatch not yet implemented. Use type:state.' });
      break;
    }

    default:
      send(ws, { type: 'error', reason: `Unknown message type: ${msg.type}` });
  }
}
