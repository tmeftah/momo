import fs from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { db, getSetting } from '../db.js';
import { config } from '../config.js';
import { httpError, num } from '../lib/util.js';
import { storeUploadedPhoto } from '../lib/photos.js';

/**
 * Routes used by the Chrome extension to add products found on webshops to the stock.
 * They are the only routes the extension API key can reach (see auth.js).
 */

export const AVAILABILITY = ['in_stock', 'limited', 'out_of_stock', 'preorder', 'backorder', 'discontinued'];

const MAX = { name: 200, reference: 100, brand: 100, category: 100, description: 10000, notes: 2000 };

function text(v, max) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function normEan(v) {
  if (v === undefined || v === null || v === '') return null;
  const digits = String(v).replace(/[\s-]/g, '');
  if (!/^\d{8,14}$/.test(digits)) throw httpError(400, 'EAN invalide : 8 à 14 chiffres attendus');
  return digits;
}

function normUrl(v) {
  if (!v) return null;
  let u;
  try {
    u = new URL(String(v));
  } catch {
    throw httpError(400, 'Lien produit invalide');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw httpError(400, 'Lien produit invalide');
  u.hash = '';
  return u.href.slice(0, 2000);
}

/** Validated product fields from the extension. Only keys present in the body are returned. */
function readProduct(body) {
  const out = {};
  for (const k of ['name', 'reference', 'brand', 'category', 'description', 'notes']) if (k in body) out[k] = text(body[k], MAX[k]);
  if ('ean' in body) out.ean = normEan(body.ean);
  if ('source_url' in body) out.source_url = normUrl(body.source_url);
  if ('source_availability' in body) out.source_availability = AVAILABILITY.includes(body.source_availability) ? body.source_availability : null;
  for (const k of ['purchase_price', 'sale_price', 'quantity']) {
    if (body[k] === undefined || body[k] === null || body[k] === '') continue;
    const n = num(body[k], NaN);
    if (!Number.isFinite(n) || n < 0) throw httpError(400, 'Prix ou quantité invalide');
    out[k] = n;
  }
  if (body.supplier_id) {
    const id = Number(body.supplier_id);
    if (!db().prepare('SELECT 1 FROM suppliers WHERE id = ?').get(id)) throw httpError(400, 'Fournisseur introuvable');
    out.supplier_id = id;
  }
  return out;
}

function extensionVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(config.extensionDir, 'manifest.json'), 'utf8')).version || null;
  } catch {
    return null;
  }
}

export default async function importRoutes(app, items) {
  // Download of the extension itself (session only: these paths are outside /api/import/).
  app.get('/extension/info', async () => {
    const version = extensionVersion();
    return { available: !!version, version };
  });

  // The ZIP holds one folder to load with "Load unpacked". defaults.json carries this server's
  // address so the extension only asks for the key.
  app.get('/extension/download.zip', async (req, reply) => {
    const version = extensionVersion();
    if (!version) throw httpError(404, 'Extension introuvable sur le serveur');
    const folder = `vae-manager-extension-${version}`;
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('warning', (err) => req.log.warn(err));
    archive.on('error', (err) => req.log.error(err));
    archive.glob('**/*', { cwd: config.extensionDir, dot: false, ignore: ['defaults.json'] }, { prefix: folder });
    archive.append(JSON.stringify({ server: `${req.protocol}://${req.host}` }, null, 2), { name: `${folder}/defaults.json` });
    archive.finalize();
    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${folder}.zip"`);
    return reply.send(archive);
  });

  app.get('/import/meta', async () => ({
    shop_name: getSetting('shop_name'),
    currency: getSetting('currency') || '€',
    categories: db().prepare('SELECT DISTINCT category FROM items WHERE category IS NOT NULL ORDER BY category').all().map((r) => r.category),
    suppliers: db().prepare('SELECT id, name FROM suppliers ORDER BY name COLLATE NOCASE').all(),
  }));

  // Items that are probably the same product: same shop link, same EAN, or same reference.
  app.get('/import/lookup', async (req) => {
    const q = req.query;
    const p = { url: null, ean: null, ref: null };
    try {
      p.url = q.url ? normUrl(q.url) : null;
      p.ean = q.ean ? normEan(q.ean) : null;
    } catch {
      /* an invalid value just doesn't match anything */
    }
    p.ref = text(q.reference, MAX.reference);
    if (!p.url && !p.ean && !p.ref) return [];
    return db()
      .prepare(
        `SELECT id, name, reference, ean, brand, category, quantity, purchase_price, sale_price, source_url, photo,
           (SELECT COUNT(*) FROM photos ph WHERE ph.ref_type = 'item' AND ph.ref_id = v_items.id) AS photos,
           CASE WHEN source_url = @url THEN 'url' WHEN ean = @ean THEN 'ean' ELSE 'reference' END AS matched_by
         FROM v_items
         WHERE source_url = @url OR ean = @ean OR reference = @ref COLLATE NOCASE
         ORDER BY (source_url = @url) DESC, (ean = @ean) DESC, id DESC
         LIMIT 5`
      )
      .all(p);
  });

  app.post('/import/items', async (req) => {
    const data = readProduct(req.body || {});
    if (!data.name) throw httpError(400, 'Le nom du produit est obligatoire');
    return items.create(data);
  });

  // Updating an existing item from a shop page: price, shop availability and link are refreshed;
  // the other details only fill fields that are still empty, so nothing typed by hand is lost.
  // The quantity is never changed here.
  app.put('/import/items/:id', async (req) => {
    const id = Number(req.params.id);
    const existing = db().prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!existing) throw httpError(404, 'Article introuvable');
    const incoming = readProduct(req.body || {});
    const data = {};
    for (const k of ['purchase_price', 'sale_price']) if (incoming[k] > 0) data[k] = incoming[k];
    for (const k of ['source_availability', 'source_url']) if (k in incoming) data[k] = incoming[k];
    for (const k of ['reference', 'ean', 'brand', 'category', 'description', 'supplier_id']) {
      if (incoming[k] && (existing[k] === null || existing[k] === '')) data[k] = incoming[k];
    }
    return items.update(id, data);
  });

  app.post('/import/items/:id/photos', async (req) => {
    const id = Number(req.params.id);
    if (!db().prepare('SELECT 1 FROM items WHERE id = ?').get(id)) throw httpError(404, 'Article introuvable');
    return storeUploadedPhoto(req, 'item', id, { caption: text(req.query.caption, 200) });
  });
}
