// Auto-lock: logs out after `settings.auto_lock_min` minutes without any touch or key.
// The last-activity time is kept in localStorage so reopening the PWA hours later locks too.
import { api, session } from './api.js';
import { settings } from './store.js';

const KEY = 'vae-last-active';

function touch() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
}

async function check() {
  const min = Number(settings.auto_lock_min) || 0;
  if (!min || !session.authenticated) return;
  let last = 0;
  try {
    last = Number(localStorage.getItem(KEY)) || 0;
  } catch {
    /* private mode */
  }
  if (!last) return touch();
  if (Date.now() - last < min * 60000) return;
  await api.post('/auth/logout').catch(() => {});
  session.authenticated = false; // App.vue redirects to /login
}

export function initAutoLock() {
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, touch, { passive: true });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
  setInterval(check, 30000);
  touch();
}
