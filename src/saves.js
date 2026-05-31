// File-based game save persistence. Each room gets a JSON file at saves/<roomId>.json.
// All writes are fire-and-forget — callers should .catch() errors but never await.

import { readdir, readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { APP_VERSION, RULEBOOK_VERSION, ERRATA_VERSION } from './engine/version.js';

const SAVES_DIR = join(process.cwd(), 'saves');

export async function ensureSavesDir() {
  await mkdir(SAVES_DIR, { recursive: true });
}

export async function saveRoom(room) {
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
    playStartState:    room.playStartState,
    playStartRngState: room.playStartRngState,
    currentState:      structuredClone(room.state),
    currentRngState:   room.rng.getState(),
    intentLog:         room.intentLog,
  };
  await writeFile(join(SAVES_DIR, `${room.id}.json`), JSON.stringify(data));
}

export async function loadSave(roomId) {
  const raw = await readFile(join(SAVES_DIR, `${roomId.toUpperCase()}.json`), 'utf8');
  return JSON.parse(raw);
}

export async function loadAllSaves() {
  let files;
  try {
    files = await readdir(SAVES_DIR);
  } catch {
    return [];
  }
  const saves = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await readFile(join(SAVES_DIR, f), 'utf8');
      saves.push(JSON.parse(raw));
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
    // File may not exist if game never reached beginPlay — ignore
  }
}
