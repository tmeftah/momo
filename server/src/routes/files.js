import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { httpError, PHOTO_REFS } from '../lib/util.js';
import { FILE_RE, unlinkFiles, storeUploadedPhoto } from '../lib/photos.js';
import { cropPhoto } from '../lib/image.js';

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
    return storeUploadedPhoto(req, refType, refId, {
      tag: req.query.tag ? String(req.query.tag).slice(0, 40) : null,
      caption: req.query.caption ? String(req.query.caption).slice(0, 200) : null,
    });
  });

  app.put('/photos/:id', async (req) => {
    const { tag, caption } = req.body || {};
    db().prepare('UPDATE photos SET tag = ?, caption = ? WHERE id = ?').run(tag || null, caption || null, Number(req.params.id));
    return db().prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.id));
  });

  // Crop / rotate a stored photo: writes a new file, points the row at it, removes the old one
  // (unless another row still shares it, e.g. a diagnostic photo copied to its repair).
  app.post('/photos/:id/crop', async (req) => {
    const photo = db().prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.id));
    if (!photo) throw httpError(404, 'Photo introuvable');
    const b = req.body || {};
    const rotate = Number(b.rotate) || 0;
    const [x, y, w, h] = [b.x, b.y, b.w, b.h].map(Number);
    const valid =
      [0, 90, 180, 270].includes(rotate) &&
      [x, y, w, h].every(Number.isFinite) &&
      x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.001 && y + h <= 1.001;
    if (!valid) throw httpError(400, 'Recadrage invalide');
    const full = path.join(config.uploadsDir, photo.filename);
    if (!FILE_RE.test(photo.filename) || !fs.existsSync(full)) throw httpError(404, 'Fichier introuvable');
    let out;
    try {
      out = await cropPhoto(await fs.promises.readFile(full), { rotate, x, y, w, h });
    } catch (err) {
      if (err.message === 'animated') throw httpError(400, 'Une image animée ne peut pas être recadrée');
      throw err;
    }
    const filename = `${crypto.randomUUID()}.${out.ext}`;
    await fs.promises.writeFile(path.join(config.uploadsDir, filename), out.buffer);
    db().prepare('UPDATE photos SET filename = ? WHERE id = ?').run(filename, photo.id);
    unlinkFiles([photo.filename]);
    return db().prepare('SELECT * FROM photos WHERE id = ?').get(photo.id);
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
