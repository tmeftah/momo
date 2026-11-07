// PWA runtime: service worker registration, « new version » prompt,
// install prompt (Android) / instructions (iOS), offline state and app badge.
import { reactive } from 'vue';

const ua = navigator.userAgent;
export const pwa = reactive({
  standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  ios: /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  android: /android/i.test(ua),
  canPrompt: false, // Android/Chrome: native install dialog available
  updateReady: false,
  offline: !navigator.onLine,
  offlineSince: null, // date of the cached data being shown
});

let installEvent = null;
let waiting = null;

// Phones/tablets get the how-to sheet even when the browser offers no native install dialog
export const canInstall = () => !pwa.standalone && (pwa.canPrompt || pwa.ios || pwa.android);

export async function promptInstall() {
  if (!installEvent) return false;
  installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  pwa.canPrompt = false;
  return outcome === 'accepted';
}

export function applyUpdate() {
  if (!waiting) return window.location.reload();
  waiting.postMessage('SKIP_WAITING');
}

/** Called by api.js on every response: tells whether it came from the offline cache. */
export function markResponse(res) {
  const stamp = res.headers.get('x-vae-offline');
  if (stamp) {
    pwa.offline = true;
    const d = new Date(stamp);
    if (!Number.isNaN(d.getTime()) && (!pwa.offlineSince || d < pwa.offlineSince)) pwa.offlineSince = d;
  } else if (pwa.offline && navigator.onLine) {
    pwa.offline = false;
    pwa.offlineSince = null;
  }
}

export function clearOfflineData() {
  navigator.serviceWorker?.controller?.postMessage('CLEAR_DATA');
}

/** Home-screen icon badge (installed app): vehicles ready to hand back. */
export function setBadge(n) {
  try {
    if (!('setAppBadge' in navigator)) return;
    if (n > 0) navigator.setAppBadge(n).catch(() => {});
    else navigator.clearAppBadge().catch(() => {});
  } catch {
    /* unsupported */
  }
}

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    pwa.canPrompt = true;
  });
  window.addEventListener('appinstalled', () => {
    pwa.canPrompt = false;
    installEvent = null;
  });
  matchMedia('(display-mode: standalone)').addEventListener?.('change', (e) => (pwa.standalone = e.matches));
  window.addEventListener('online', () => (pwa.offline = false, pwa.offlineSince = null));
  window.addEventListener('offline', () => (pwa.offline = true));

  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      const track = (sw) => {
        if (!sw) return;
        const ready = () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            waiting = sw;
            pwa.updateReady = true;
          }
        };
        ready();
        sw.addEventListener('statechange', ready);
      };
      track(reg.waiting);
      reg.addEventListener('updatefound', () => track(reg.installing));
      // An installed app can stay open for days: look for a new version when it comes back to the foreground
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}));
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    } catch {
      /* SW unsupported (e.g. private mode) — the app still works online */
    }
  });
}

/** « Installer l'application »: native dialog when the browser offers one, otherwise the how-to sheet. */
export async function openInstall() {
  if (pwa.canPrompt) return promptInstall();
  pwa.showInstall = true;
}
pwa.showInstall = false;
