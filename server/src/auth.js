import crypto from 'node:crypto';
import { db, getSetting, setSetting } from './db.js';
import { config } from './config.js';
import { httpError } from './lib/util.js';

export const COOKIE = 'vae_sid';
const PIN_RE = /^\d{4,12}$/;

// Brute-force protection (in memory: resets on restart, which is fine for a single instance)
const IP_MAX_FAILS = 5;
const IP_WINDOW_MS = 15 * 60 * 1000;
const GLOBAL_MAX_FAILS = 30;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const ipFails = new Map(); // ip -> { count, first, lockedUntil }
let globalFails = []; // timestamps

const PUBLIC_ROUTES = new Set(['/api/health', '/api/auth/status', '/api/auth/login', '/api/auth/setup', '/api/auth/logout']);

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pin, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function checkPin(pin) {
  const stored = getSetting('pin_hash');
  if (!stored || typeof pin !== 'string') return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(pin, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function isConfigured() {
  return !!getSetting('pin_hash');
}

export function ensureInitialPin(log) {
  if (isConfigured() || !config.initialPin) return;
  if (!PIN_RE.test(config.initialPin)) {
    log.warn('INITIAL_PIN ignoré : il doit contenir 4 à 12 chiffres');
    return;
  }
  setSetting('pin_hash', hashPin(config.initialPin));
  log.info('Code PIN initial configuré depuis INITIAL_PIN');
}

function lockState(ip) {
  const now = Date.now();
  globalFails = globalFails.filter((t) => now - t < GLOBAL_WINDOW_MS);
  if (globalFails.length >= GLOBAL_MAX_FAILS) return Math.ceil((globalFails[0] + GLOBAL_WINDOW_MS - now) / 60000);
  const entry = ipFails.get(ip);
  if (entry?.lockedUntil > now) return Math.ceil((entry.lockedUntil - now) / 60000);
  return 0;
}

function registerFail(ip) {
  const now = Date.now();
  globalFails.push(now);
  let entry = ipFails.get(ip);
  if (!entry || now - entry.first > IP_WINDOW_MS) entry = { count: 0, first: now, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= IP_MAX_FAILS) entry.lockedUntil = now + IP_WINDOW_MS;
  ipFails.set(ip, entry);
  return Math.max(0, IP_MAX_FAILS - entry.count);
}

function startSession(req, reply) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 86400000);
  db().prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  db()
    .prepare('INSERT INTO sessions (token_hash, expires_at, user_agent) VALUES (?, ?, ?)')
    .run(sha256(token), expires.toISOString(), String(req.headers['user-agent'] || '').slice(0, 200));
  reply.setCookie(COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: req.protocol === 'https',
    expires,
  });
}

function sessionValid(token) {
  if (!token) return false;
  const row = db().prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').get(sha256(token));
  return !!row && row.expires_at > new Date().toISOString();
}

export function authHook(req, reply, done) {
  const url = req.url.split('?')[0];
  if (!url.startsWith('/api/') || PUBLIC_ROUTES.has(url)) return done();
  if (sessionValid(req.cookies[COOKIE])) return done();
  reply.code(401).send({ error: 'Non authentifié' });
}

export async function authRoutes(app) {
  app.get('/auth/status', async (req) => ({
    configured: isConfigured(),
    authenticated: sessionValid(req.cookies[COOKIE]),
  }));

  // First-run only, when no INITIAL_PIN was provided.
  app.post('/auth/setup', async (req, reply) => {
    if (isConfigured()) throw httpError(409, 'Le code PIN est déjà configuré');
    const pin = String(req.body?.pin || '');
    if (!PIN_RE.test(pin)) throw httpError(400, 'Le code PIN doit contenir 4 à 12 chiffres');
    setSetting('pin_hash', hashPin(pin));
    startSession(req, reply);
    return { ok: true };
  });

  app.post('/auth/login', async (req, reply) => {
    const locked = lockState(req.ip);
    if (locked) throw httpError(429, `Trop de tentatives. Réessayez dans ${locked} min.`);
    const pin = String(req.body?.pin || '');
    if (!checkPin(pin)) {
      const left = registerFail(req.ip);
      await new Promise((r) => setTimeout(r, 600));
      req.log.warn({ ip: req.ip }, 'PIN incorrect');
      throw httpError(401, left > 0 ? `Code PIN incorrect (${left} essai(s) restant(s))` : 'Code PIN incorrect. Accès bloqué 15 min.');
    }
    ipFails.delete(req.ip);
    startSession(req, reply);
    return { ok: true };
  });

  app.post('/auth/logout', async (req, reply) => {
    const token = req.cookies[COOKIE];
    if (token) db().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  app.post('/auth/change-pin', async (req, reply) => {
    const { current, pin } = req.body || {};
    if (!checkPin(String(current || ''))) throw httpError(400, 'Code PIN actuel incorrect');
    if (!PIN_RE.test(String(pin || ''))) throw httpError(400, 'Le nouveau code PIN doit contenir 4 à 12 chiffres');
    setSetting('pin_hash', hashPin(String(pin)));
    // Revoke every other session, keep this device logged in
    db().prepare('DELETE FROM sessions').run();
    startSession(req, reply);
    return { ok: true };
  });
}
