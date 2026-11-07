import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import Database from 'better-sqlite3';
import AdmZip from 'adm-zip';
import { ZipArchive } from 'archiver';
import { db, openDb, closeDb, getSetting, setSetting, todayLocal } from '../db.js';
import { config } from '../config.js';
import { httpError } from '../lib/util.js';
import { FILE_RE } from '../lib/photos.js';

const SETTINGS_KEYS = ['shop_name', 'shop_phone', 'currency', 'country_code', 'diag_hourly_rate', 'wa_ready_template'];
const SETTINGS_DEFAULTS = {
  shop_name: 'Mon atelier VAE',
  shop_phone: '',
  currency: '€',
  country_code: '33',
  diag_hourly_rate: '0',
  wa_ready_template: 'Bonjour {client}, votre {vehicule} est prêt(e) ✅. Montant à régler : {reste}. À bientôt ! — {atelier}',
};
const AUTO_RE = /^vae-\d{4}-\d{2}-\d{2}\.db$/;
const EXPORT_TABLES = ['clients', 'suppliers', 'items', 'stock_movements', 'repairs', 'diagnostics', 'sales', 'purchases', 'lines', 'payments', 'photos', 'connectors', 'adaptations', 'solutions', 'tasks', 'repair_tasks'];

const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);

export default async function systemRoutes(app) {
  app.get('/settings', async () => {
    const out = {};
    for (const k of SETTINGS_KEYS) out[k] = getSetting(k, SETTINGS_DEFAULTS[k]);
    return out;
  });

  app.put('/settings', async (req) => {
    for (const k of SETTINGS_KEYS) {
      if (req.body && k in req.body) setSetting(k, String(req.body[k] ?? '').slice(0, 1000));
    }
    const out = {};
    for (const k of SETTINGS_KEYS) out[k] = getSetting(k, SETTINGS_DEFAULTS[k]);
    return out;
  });

  // Full backup: database snapshot + photos, as a ZIP
  app.get('/backup/export.zip', async (req, reply) => {
    const snapshot = path.join(config.tmpDir, `export-${stamp()}.db`);
    await db().backup(snapshot);
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('warning', (err) => req.log.warn(err));
    archive.on('error', (err) => req.log.error(err));
    archive.on('end', () => fs.rm(snapshot, { force: true }, () => {}));
    archive.append(JSON.stringify({ app: 'vae-manager', format: 1, created_at: new Date().toISOString() }, null, 2), { name: 'manifest.json' });
    archive.file(snapshot, { name: 'vae.db' });
    archive.directory(config.uploadsDir, 'uploads');
    archive.finalize();
    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="vae-manager-${todayLocal()}.zip"`);
    return reply.send(archive);
  });

  // Readable data export (no photos)
  app.get('/backup/export.json', async (req, reply) => {
    const data = { app: 'vae-manager', exported_at: new Date().toISOString(), tables: {} };
    for (const t of EXPORT_TABLES) data.tables[t] = db().prepare(`SELECT * FROM ${t}`).all();
    reply.header('Content-Disposition', `attachment; filename="vae-manager-${todayLocal()}.json"`);
    return data;
  });

  // Restore from a ZIP produced by /backup/export.zip. Current data is kept aside first.
  app.post('/backup/restore', async (req) => {
    const file = await req.file({ limits: { fileSize: 4 * 1024 ** 3, files: 1 } });
    if (!file) throw httpError(400, 'Aucun fichier reçu');
    const id = stamp();
    const zipPath = path.join(config.tmpDir, `restore-${id}.zip`);
    const stage = path.join(config.tmpDir, `restore-${id}`);
    const cleanup = () => {
      fs.rmSync(zipPath, { force: true });
      fs.rmSync(stage, { recursive: true, force: true });
    };
    await pipeline(file.file, fs.createWriteStream(zipPath));

    try {
      let zip;
      try {
        zip = new AdmZip(zipPath);
      } catch {
        throw httpError(400, 'Fichier ZIP invalide');
      }
      const dbEntry = zip.getEntry('vae.db');
      if (!dbEntry) throw httpError(400, 'Sauvegarde invalide : vae.db absent');
      fs.mkdirSync(path.join(stage, 'uploads'), { recursive: true });
      const stagedDb = path.join(stage, 'vae.db');
      fs.writeFileSync(stagedDb, dbEntry.getData());
      let photos = 0;
      for (const e of zip.getEntries()) {
        const m = /^uploads\/([^/]+)$/.exec(e.entryName);
        if (!m || e.isDirectory || !FILE_RE.test(m[1])) continue;
        fs.writeFileSync(path.join(stage, 'uploads', m[1]), e.getData());
        photos += 1;
      }
      try {
        const test = new Database(stagedDb, { readonly: true, fileMustExist: true });
        const ok = test.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'clients'").get();
        test.close();
        if (!ok) throw new Error('missing tables');
      } catch {
        throw httpError(400, "Sauvegarde invalide : ce n'est pas une base VAE Manager");
      }

      const safety = path.join(config.dataDir, `avant-restauration-${id}`);
      fs.mkdirSync(safety, { recursive: true });
      closeDb();
      try {
        for (const suffix of ['', '-wal', '-shm']) {
          if (fs.existsSync(config.dbPath + suffix)) fs.renameSync(config.dbPath + suffix, path.join(safety, 'vae.db' + suffix));
        }
        if (fs.existsSync(config.uploadsDir)) fs.renameSync(config.uploadsDir, path.join(safety, 'uploads'));
        fs.renameSync(stagedDb, config.dbPath);
        fs.renameSync(path.join(stage, 'uploads'), config.uploadsDir);
      } finally {
        fs.mkdirSync(config.uploadsDir, { recursive: true });
        openDb();
      }
      req.log.info({ photos, safety }, 'Sauvegarde restaurée');
      return { ok: true, photos, previous_data: path.basename(safety) };
    } finally {
      cleanup();
    }
  });

  app.get('/backup/auto', async () =>
    fs
      .readdirSync(config.backupsDir)
      .filter((f) => AUTO_RE.test(f))
      .sort()
      .reverse()
      .map((name) => ({ name, size: fs.statSync(path.join(config.backupsDir, name)).size }))
  );

  app.get('/backup/auto/:name', async (req, reply) => {
    const name = String(req.params.name);
    if (!AUTO_RE.test(name) || !fs.existsSync(path.join(config.backupsDir, name))) throw httpError(404, 'Sauvegarde introuvable');
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${name}"`);
    return reply.send(fs.createReadStream(path.join(config.backupsDir, name)));
  });
}

/** Daily database snapshot in DATA_DIR/backups, keeping the last BACKUP_KEEP days. */
export function startAutoBackup(log) {
  const run = async () => {
    try {
      const target = path.join(config.backupsDir, `vae-${todayLocal()}.db`);
      if (!fs.existsSync(target)) {
        await db().backup(target);
        log.info({ target }, 'Sauvegarde automatique créée');
      }
      const files = fs.readdirSync(config.backupsDir).filter((f) => AUTO_RE.test(f)).sort().reverse();
      for (const old of files.slice(config.backupKeep)) fs.rmSync(path.join(config.backupsDir, old), { force: true });
    } catch (err) {
      log.error(err, 'Sauvegarde automatique échouée');
    }
  };
  setTimeout(run, 15000).unref();
  setInterval(run, 3600000).unref();
}
