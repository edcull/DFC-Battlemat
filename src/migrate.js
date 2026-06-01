import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSaveByRoomId, upsertSave } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAVES_DIR = join(__dirname, '..', 'saves');

export async function migrateFileSavesToDb() {
  let files;
  try {
    files = await readdir(SAVES_DIR);
  } catch {
    return; // saves/ directory doesn't exist yet — nothing to migrate
  }

  const jsonFiles = files.filter(f => f.endsWith('.json'));
  if (!jsonFiles.length) return;

  let migrated = 0, skipped = 0;
  for (const file of jsonFiles) {
    try {
      const raw = await readFile(join(SAVES_DIR, file), 'utf8');
      const data = JSON.parse(raw);
      if (!data.roomId || !data.currentState) { skipped++; continue; }
      if (getSaveByRoomId(data.roomId)) { skipped++; continue; }
      upsertSave(data, null); // no owner — pre-auth saves
      migrated++;
    } catch (err) {
      console.error(`[migrate] Failed to migrate ${file}:`, err.message);
    }
  }
  if (migrated) console.log(`[migrate] Migrated ${migrated} file save(s) to SQLite.`);
  if (skipped)  console.log(`[migrate] Skipped ${skipped} save(s) (already in DB or invalid).`);
}
