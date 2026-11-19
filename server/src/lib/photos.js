import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { httpError } from './util.js';
import { compressPhoto } from './image.js';

export const FILE_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

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

/**
 * Reads the multipart "file" field of a request, compresses it and attaches it to an entity.
 * Returns the new photos row.
 */
export async function storeUploadedPhoto(req, refType, refId, { tag = null, caption = null } = {}) {
  const file = await req.file();
  if (!file) throw httpError(400, 'Aucun fichier reçu');
  if (!ACCEPTED.has(file.mimetype)) {
    file.file.resume();
    throw httpError(415, 'Format non supporté (JPEG, PNG, WebP ou GIF)');
  }
  let raw;
  try {
    raw = await file.toBuffer();
  } catch (err) {
    if (err.code === 'FST_REQ_FILE_TOO_LARGE') throw httpError(413, `Photo trop lourde (max ${config.maxUploadMb} Mo)`);
    throw err;
  }
  return storePhoto(raw, refType, refId, req.log, { tag, caption });
}

/** JPEG, PNG, GIF, WebP or AVIF, recognised from the file's first bytes. */
export function isAcceptedImage(buf) {
  const ascii = (from, to) => buf.subarray(from, to).toString('latin1');
  return (
    (buf[0] === 0xff && buf[1] === 0xd8) ||
    ascii(1, 4) === 'PNG' ||
    ascii(0, 3) === 'GIF' ||
    (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') ||
    (ascii(4, 8) === 'ftyp' && /avi[fs]/.test(ascii(8, 12)))
  );
}

/** Compresses an image and attaches it to an entity. Returns the new photos row. */
export async function storePhoto(raw, refType, refId, log, { tag = null, caption = null } = {}) {
  let photo;
  try {
    photo = await compressPhoto(raw);
  } catch (err) {
    log.warn({ err: err.message }, 'Photo illisible');
    throw httpError(415, 'Image illisible ou corrompue');
  }
  const filename = `${crypto.randomUUID()}.${photo.ext}`;
  await fs.promises.writeFile(path.join(config.uploadsDir, filename), photo.buffer);
  log.info({ in: raw.length, out: photo.buffer.length }, 'Photo enregistrée');
  const info = db()
    .prepare('INSERT INTO photos (ref_type, ref_id, filename, tag, caption) VALUES (?, ?, ?, ?, ?)')
    .run(refType, refId, filename, tag, caption);
  return db().prepare('SELECT * FROM photos WHERE id = ?').get(info.lastInsertRowid);
}
