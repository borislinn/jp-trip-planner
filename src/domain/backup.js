import { STORES } from "../data/db.js";

// Single source of truth for the backup file shape. Bump VERSION only on
// a breaking change to the structure (restore stays backward tolerant).
export const BACKUP_FORMAT = "go-go-osaka-backup";
export const BACKUP_VERSION = 1;

// Reads every store and returns a plain, JSON-serialisable snapshot.
export async function buildBackup(repo) {
  const stores = {};
  for (const name of STORES) {
    stores[name] = await repo.getAll(name);
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores
  };
}

export function isValidBackup(data) {
  return !!data
    && data.format === BACKUP_FORMAT
    && typeof data.version === "number"
    && !!data.stores
    && typeof data.stores === "object";
}

export function backupFileName(date = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `go-go-osaka-backup-${date.getFullYear()}${p(date.getMonth() + 1)}` +
    `${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.json`;
}

// Upserts every backed-up record by id (put overwrites same id), so a
// restore into an empty install brings the data back without wiping
// anything already present. Returns how many rows were written per store.
export async function restoreBackup(repo, data) {
  if (!isValidBackup(data)) {
    throw new Error("This file is not a Go Go Osaka backup.");
  }
  const counts = {};
  for (const name of STORES) {
    const rows = Array.isArray(data.stores[name]) ? data.stores[name] : [];
    let written = 0;
    for (const row of rows) {
      if (row && typeof row === "object" && row.id != null) {
        await repo.put(name, row);
        written++;
      }
    }
    counts[name] = written;
  }
  return counts;
}
