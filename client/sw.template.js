// VAE Manager service worker.
// Generated at build time by vite.config.js (version + precache list are injected).
//
// - App shell + all JS/CSS chunks are precached → the app opens instantly and offline.
// - API reads are network-first; the last good response is kept so screens still
//   open without network (marked with the x-vae-offline header, the app shows a banner).
// - Photos are immutable (unique names) → cache-first.
// - Logout or an expired session wipes cached data.
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SHELL = `vae-shell-${VERSION}`;
const DATA = 'vae-data';
const PHOTOS = 'vae-photos';
const NO_CACHE_API = ['/api/backup/', '/api/auth/login', '/api/auth/setup'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
  );
  // No skipWaiting here: the app shows « Nouvelle version » and the user chooses when to reload.
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('vae-shell-') && k !== SHELL).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'CLEAR_DATA') e.waitUntil(clearData());
});

const clearData = () => Promise.all([caches.delete(DATA), caches.delete(PHOTOS)]);

async function trimCache(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET') {
      if (url.pathname === '/api/auth/logout' || url.pathname === '/api/backup/restore') e.waitUntil(clearData());
      return;
    }
    if (NO_CACHE_API.some((p) => url.pathname.startsWith(p))) return;
    if (url.pathname.startsWith('/api/files/')) return e.respondWith(photo(req));
    return e.respondWith(apiRead(req));
  }

  if (req.method !== 'GET') return;

  // SPA navigation → precached shell (instant start, works offline)
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('/', { cacheName: SHELL }).then((hit) => hit || fetch(req)));
    return;
  }

  // Static files: cache first, then network (and keep a copy of hashed assets)
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.startsWith('/assets/')) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});

async function apiRead(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const copy = res.clone();
      caches.open(DATA).then((c) => c.put(req, copy).then(() => trimCache(DATA, 400)));
    } else if (res.status === 401) {
      await clearData();
    }
    return res;
  } catch (err) {
    const hit = await caches.match(req, { cacheName: DATA });
    if (!hit) throw err;
    const headers = new Headers(hit.headers);
    headers.set('x-vae-offline', hit.headers.get('date') || '1');
    return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
  }
}

async function photo(req) {
  const c = await caches.open(PHOTOS);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await c.put(req, res.clone());
    trimCache(PHOTOS, 300);
  }
  return res;
}
