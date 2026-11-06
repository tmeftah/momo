import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db.js';
import { config } from '../config.js';

export const FILE_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

/** Deletes photo rows for an entity and returns their filenames (unlink after commit). */
export function collectPhotos(refType, refId) {
  const rows = db().prepare('SELECT filename FROM photos WHERE ref_type = ? AND ref_id = ?').all(refType, refId);
  db().prepare('DELETE FROM photos WHERE ref_type = ? AND ref_id = ?').run(refType, refId);
  return rows.map((r) => r.filename);
}

/** Removes files from disk unless another photo row still references them (e.g. diagnostic → repair copy). */
export function unlinkFiles(files) {
  const stillUsed = db().prepare('SELECT 1 FROM photos WHERE filename = ? LIMIT 1');
  for (const f of files) {
    if (!FILE_RE.test(f) || stillUsed.get(f)) continue;
    fs.rm(path.join(config.uploadsDir, f), { force: true }, () => {});
  }
}
