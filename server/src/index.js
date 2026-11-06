import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { openDb, closeDb } from './db.js';
import { authHook, authRoutes, ensureInitialPin } from './auth.js';
import coreRoutes from './routes/core.js';
import workshopRoutes from './routes/workshop.js';
import salesRoutes from './routes/sales.js';
import libraryRoutes from './routes/library.js';
import fileRoutes from './routes/files.js';
import systemRoutes, { startAutoBackup } from './routes/system.js';

const app = Fastify({
  logger: { level: config.logLevel },
  trustProxy: true, // behind Traefik: honour X-Forwarded-For / -Proto
  bodyLimit: 5 * 1024 * 1024,
});

openDb();
ensureInitialPin(app.log);

await app.register(cookie);
await app.register(multipart, { limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 } });

app.addHook('onRequest', authHook);
app.addHook('onSend', async (req, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'same-origin');
  if (req.url.startsWith('/api/') && !reply.getHeader('Cache-Control')) reply.header('Cache-Control', 'no-store');
  return payload;
});

app.setErrorHandler((err, req, reply) => {
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return reply.code(409).send({ error: 'Suppression impossible : cet élément est lié à un historique (réparations, ventes, paiements…).' });
  }
  if (typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    return reply.code(400).send({ error: 'Données invalides' });
  }
  const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  if (status >= 500) req.log.error(err);
  return reply.code(status).send({ error: status >= 500 ? 'Erreur serveur' : err.message });
});

app.get('/api/health', async () => ({ ok: true }));

await app.register(
  async (api) => {
    await api.register(authRoutes);
    await api.register(coreRoutes);
    await api.register(workshopRoutes);
    await api.register(salesRoutes);
    await api.register(libraryRoutes);
    await api.register(fileRoutes);
    await api.register(systemRoutes);
  },
  { prefix: '/api' }
);

// Serve the built Vue app (single container); SPA fallback to index.html
const hasClient = fs.existsSync(path.join(config.publicDir, 'index.html'));
if (hasClient) {
  await app.register(fastifyStatic, {
    root: config.publicDir,
    wildcard: false,
    // @fastify/static ≥10 passes the Fastify reply (older versions passed the raw response)
    setHeaders: (res, filePath) => {
      const set = (k, v) => (typeof res.header === 'function' ? res.header(k, v) : res.setHeader(k, v));
      if (filePath.includes(`${path.sep}assets${path.sep}`)) set('Cache-Control', 'public, max-age=31536000, immutable');
      else set('Cache-Control', 'no-cache');
    },
  });
}

app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith('/api/') || req.method !== 'GET' || !hasClient) {
    return reply.code(404).send({ error: 'Introuvable' });
  }
  reply.header('Cache-Control', 'no-cache');
  return reply.sendFile('index.html');
});

startAutoBackup(app.log);

const shutdown = async (signal) => {
  app.log.info(`${signal} reçu, arrêt…`);
  await app.close();
  closeDb();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.port, host: config.host });
