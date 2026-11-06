import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(here, '..', 'data'));

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  dataDir,
  dbPath: path.join(dataDir, 'vae.db'),
  uploadsDir: path.join(dataDir, 'uploads'),
  backupsDir: path.join(dataDir, 'backups'),
  tmpDir: path.join(dataDir, 'tmp'),
  publicDir: path.resolve(process.env.PUBLIC_DIR || path.join(here, '..', 'public')),
  initialPin: process.env.INITIAL_PIN || '',
  sessionDays: Number(process.env.SESSION_DAYS) || 30,
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 15,
  backupKeep: Number(process.env.BACKUP_KEEP) || 14,
  logLevel: process.env.LOG_LEVEL || 'info',
};

for (const dir of [config.dataDir, config.uploadsDir, config.backupsDir, config.tmpDir]) {
  fs.mkdirSync(dir, { recursive: true });
}
