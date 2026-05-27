// Room lifecycle. Rooms live in memory; no persistence required for Phase 2.
// Each room holds the authoritative game state and two player WebSocket slots.

import { createState, rebuildFleets } from './engine/state.js';
import { makeRng } from './engine/rng.js';

const ROOM_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours of inactivity
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit 0/O/1/I

const rooms = new Map();

function randomId(len = 4) {
  let id = '';
  for (let i = 0; i < len; i++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return id;
}

export function createRoom() {
  let id;
  do { id = randomId(); } while (rooms.has(id));

  const seed = Math.floor(Math.random() * 0xFFFFFFFF);
  const state = createState();
  rebuildFleets(state);

  const room = {
    id,
    seed,
    rng: makeRng(seed),
    state,
    sockets: { ucm: null, shal: null },
    spectators: [],
    lastActivity: Date.now(),
  };

  rooms.set(id, room);
  scheduleExpiry(id);
  return room;
}

export function getRoom(id) {
  return rooms.get(id) || null;
}

// Returns { ok: true } or { error: string }.
export function joinRoom(room, side, ws) {
  if (side !== 'ucm' && side !== 'shal') return { error: 'Invalid side — use ucm or shal.' };
  const existing = room.sockets[side];
  if (existing && existing.readyState === 1 /* OPEN */) {
    return { error: `Side ${side} is already connected.` };
  }
  room.sockets[side] = ws;
  room.lastActivity = Date.now();
  return { ok: true };
}

export function leaveRoom(room, ws) {
  for (const side of ['ucm', 'shal']) {
    if (room.sockets[side] === ws) room.sockets[side] = null;
  }
  room.spectators = room.spectators.filter(s => s !== ws);
}

// Returns the side ('ucm' | 'shal' | 'spectator') this ws is connected as.
export function sideOf(room, ws) {
  if (room.sockets.ucm === ws) return 'ucm';
  if (room.sockets.shal === ws) return 'shal';
  return 'spectator';
}

// Broadcast a message to all room participants, optionally excluding one socket.
export function broadcast(room, msg, exclude = null) {
  const data = JSON.stringify(msg);
  for (const side of ['ucm', 'shal']) {
    const ws = room.sockets[side];
    if (ws && ws !== exclude && ws.readyState === 1) ws.send(data);
  }
  for (const ws of room.spectators) {
    if (ws !== exclude && ws.readyState === 1) ws.send(data);
  }
}

// Send a message to a single socket.
export function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function scheduleExpiry(id) {
  setTimeout(() => {
    const room = rooms.get(id);
    if (!room) return;
    if (Date.now() - room.lastActivity < ROOM_TTL_MS) {
      scheduleExpiry(id); // still active — check again later
      return;
    }
    for (const side of ['ucm', 'shal']) {
      if (room.sockets[side]) try { room.sockets[side].close(); } catch {}
    }
    for (const ws of room.spectators) try { ws.close(); } catch {}
    rooms.delete(id);
    console.log(`Room ${id} expired and removed.`);
  }, ROOM_TTL_MS);
}
