import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { httpError, PHOTO_REFS } from '../lib/util.js';
import { FILE_RE, unlinkFiles } from '../lib/photos.js';
import { compressPhoto } from '../lib/image.js';

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

export default async function fileRoutes(app) {
  app.get('/photos', async (req) => {
    const { ref_type, ref_id } = req.query;
    return db().prepare('SELECT * FROM photos WHERE ref_type = ? AND ref_id = ? ORDER BY id').all(ref_type, Number(ref_id));
  });

  // POST /photos?ref_type=repair&ref_id=12&tag=avant  (multipart, field "file")
  app.post('/photos', async (req) => {
    const refType = String(req.query.ref_type || '');
    const refId = Number(req.query.ref_id);
    if (!PHOTO_REFS.includes(refType) || !refId) throw httpError(400, 'Référence photo invalide');
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
    let photo;
    try {
      photo = await compressPhoto(raw);
    } catch (err) {
      req.log.warn({ err: err.message }, 'Photo illisible');
      throw httpError(415, 'Image illisible ou corrompue');
    }
    const filename = `${crypto.randomUUID()}.${photo.ext}`;
    await fs.promises.writeFile(path.join(config.uploadsDir, filename), photo.buffer);
    req.log.info({ in: raw.length, out: photo.buffer.length }, 'Photo enregistrée');
    const tag = req.query.tag ? String(req.query.tag).slice(0, 40) : null;
    const caption = req.query.caption ? String(req.query.caption).slice(0, 200) : null;
    const info = db()
      .prepare('INSERT INTO photos (ref_type, ref_id, filename, tag, caption) VALUES (?, ?, ?, ?, ?)')
      .run(refType, refId, filename, tag, caption);
    return db().prepare('SELECT * FROM photos WHERE id = ?').get(info.lastInsertRowid);
  });

  app.put('/photos/:id', async (req) => {
    const { tag, caption } = req.body || {};
    db().prepare('UPDATE photos SET tag = ?, caption = ? WHERE id = ?').run(tag || null, caption || null, Number(req.params.id));
    return db().prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.id));
  });

  app.delete('/photos/:id', async (req) => {
    const photo = db().prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.id));
    if (!photo) throw httpError(404, 'Photo introuvable');
    db().prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
    unlinkFiles([photo.filename]);
    return { ok: true };
  });

  // Authenticated file access (the global auth hook covers /api/*)
  app.get('/files/:name', async (req, reply) => {
    const name = String(req.params.name);
    if (!FILE_RE.test(name)) throw httpError(404, 'Fichier introuvable');
    const full = path.join(config.uploadsDir, name);
    if (!fs.existsSync(full)) throw httpError(404, 'Fichier introuvable');
    reply.header('Cache-Control', 'private, max-age=31536000, immutable');
    reply.type(MIME[name.split('.').pop()]);
    return reply.send(fs.createReadStream(full));
  });
}
