// File-based game save persistence. Each room gets a JSON file at saves/<roomId>.json.
// SQLite is the primary store; files are kept as a backup via dual-write.

import { readdir, readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { APP_VERSION, RULEBOOK_VERSION, ERRATA_VERSION } from './engine/version.js';
import { upsertSave, getSaveByRoomId, getAllSaves as dbGetAllSaves, getAllSavesForUser } from './db.js';

const SAVES_DIR = join(process.cwd(), 'saves');

export async function ensureSavesDir() {
  await mkdir(SAVES_DIR, { recursive: true });
}

export async function saveRoom(room, userId = null) {
  const data = {
    appVersion:        APP_VERSION,
    rulebookVersion:   RULEBOOK_VERSION,
    errataVersion:     ERRATA_VERSION,
    roomId:            room.id,
    seed:              room.seed,
    createdAt:         room.createdAt,
    savedAt:           Date.now(),
    phase:             room.state.phase,
    round:             room.state.round,
    playerNames:       room.state.playerNames,
    factions:          room.state.factions,
    sideColors:        room.state.sideColors || null,
    isHotseat:         room.isHotseat || false,
    playStartState:    room.playStartState,
    playStartRngState: room.playStartRngState,
    currentState:      structuredClone(room.state),
    currentRngState:   room.rng.getState(),
    intentLog:         room.intentLog,
  };
  // Primary: SQLite (synchronous, wrapped so DB errors never break gameplay)
  try {
    upsertSave(data, userId);
  } catch (err) {
    console.error(`[${room.id}] SQLite save error:`, err.message);
  }
  // Backup: file write (fire-and-forget)
  await writeFile(join(SAVES_DIR, `${room.id}.json`), JSON.stringify(data));
}

export async function loadSave(roomId) {
  // Try SQLite first, fall back to file
  const row = getSaveByRoomId(roomId.toUpperCase());
  if (row) return row;
  const raw = await readFile(join(SAVES_DIR, `${roomId.toUpperCase()}.json`), 'utf8');
  return JSON.parse(raw);
}

export async function loadAllSaves(userId = null) {
  try {
    return userId ? getAllSavesForUser(userId) : dbGetAllSaves();
  } catch (err) {
    // DB not ready yet — fall back to file reads
    console.error('[saves] DB unavailable, falling back to files:', err.message);
    return _loadAllSavesFromFiles();
  }
}

async function _loadAllSavesFromFiles() {
  let files;
  try { files = await readdir(SAVES_DIR); } catch { return []; }
  const saves = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await readFile(join(SAVES_DIR, f), 'utf8');
      const s = JSON.parse(raw);
      saves.push({
        roomId: s.roomId, phase: s.phase, round: s.round,
        isHotseat: s.isHotseat || false, savedAt: s.savedAt,
        hasReplay: !!s.playStartState,
        playerNames: s.playerNames ?? {}, factions: s.factions ?? {}, sideColors: null,
      });
    } catch (err) {
      console.error(`Failed to load save ${f}:`, err.message);
    }
  }
  return saves;
}

export async function deleteSave(roomId) {
  try {
    await unlink(join(SAVES_DIR, `${roomId}.json`));
  } catch {
    // File may not exist — ignore
  }
}
