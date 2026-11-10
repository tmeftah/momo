// UI services: toasts, action sheets (iOS-style confirm), haptics, theme.
import { reactive, ref } from 'vue';

// ---------- Haptics (Android vibrates; iOS ignores silently) ----------
export function haptic(kind = 'light') {
  const pattern = { light: 8, medium: 14, success: [10, 40, 14], error: [24, 40, 24] }[kind] ?? 8;
  try {
    // Browsers block vibration before the first tap (and log an error)
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

// ---------- Toasts (top banner) ----------
export const toasts = reactive([]);
let toastId = 0;
export function toast(message, type = 'ok') {
  const id = ++toastId;
  toasts.push({ id, message, type });
  haptic(type === 'error' ? 'error' : 'light');
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id);
    if (i >= 0) toasts.splice(i, 1);
  }, type === 'error' ? 4500 : 2200);
}
export const toastError = (e) => toast(e?.message || String(e), 'error');

// ---------- Action sheet ----------
// await chooseAction({ title, message, actions: [{ label, value, destructive }] }) → value | null
export const actionSheet = ref(null);
export function chooseAction({ title = '', message = '', actions = [], cancel = 'Annuler' }) {
  return new Promise((resolve) => {
    actionSheet.value = { title, message, actions, cancel, resolve };
    haptic('light');
  });
}
export function closeActionSheet(value = null) {
  const s = actionSheet.value;
  actionSheet.value = null;
  s?.resolve(value);
}

/** Destructive confirmation: resolves true when confirmed. */
export async function confirmAction(message, { confirm = 'Supprimer', title = '', destructive = true } = {}) {
  const v = await chooseAction({ title, message, actions: [{ label: confirm, value: true, destructive }] });
  return v === true;
}

// ---------- Page scroll lock ----------
// Counted, so nested overlays (viewer + sheet) don't unlock each other.
// Each overlay must call this with false when it closes or unmounts.
let scrollLocks = 0;
export function lockScroll(on) {
  scrollLocks = Math.max(scrollLocks + (on ? 1 : -1), 0);
  document.body.dataset.sheets = scrollLocks;
  document.documentElement.style.overflow = scrollLocks > 0 ? 'hidden' : '';
}

// ---------- Theme ----------
export const theme = ref('dark');
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

function applyTheme() {
  const dark = theme.value === 'dark' || (theme.value === 'auto' && media?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#000000' : '#f2f2f7');
}

export function initTheme() {
  try {
    theme.value = localStorage.getItem('vae-theme') || 'dark';
  } catch {
    theme.value = 'dark';
  }
  applyTheme();
  media?.addEventListener?.('change', applyTheme);
}

export function setTheme(value) {
  theme.value = value;
  try {
    localStorage.setItem('vae-theme', value);
  } catch {
    /* private mode */
  }
  applyTheme();
}
