import { reactive } from 'vue';
import { api } from './api.js';
import { VEHICLE } from './constants.js';

export { toast, toastError, haptic, confirmAction, chooseAction } from './ui.js';

export const settings = reactive({
  shop_name: 'Mon atelier VAE',
  shop_phone: '',
  currency: '€',
  country_code: '33',
  diag_hourly_rate: '0',
  wa_ready_template: '',
});

export async function loadSettings() {
  Object.assign(settings, await api.get('/settings'));
}

// ---------- Numbers & money ----------
const numberFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
export const fmtNum = (n) => numberFmt.format(Number(n) || 0);
export const money = (n) => `${fmtNum(n)} ${settings.currency}`;
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ---------- Dates ----------
const parse = (s) => new Date(String(s).replace(' ', 'T'));

export function fmtDate(s, withTime = false) {
  if (!s) return '';
  const d = parse(s);
  if (Number.isNaN(d.getTime())) return s;
  const opts = { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('fr-FR', opts);
}

export const fmtTime = (s) => (s ? parse(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');

export function fmtRelative(s) {
  if (!s) return '';
  const d = parse(s);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Math.round((start - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days <= 0) return fmtTime(s); // iOS shows only the time for today
  if (days === 1) return 'Hier';
  if (days < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long' }).replace(/^./, (c) => c.toUpperCase());
  return fmtDate(s);
}

/** "Aujourd'hui", "Hier", "Lundi 3 nov." — for day-grouped lists */
export function dayLabel(s) {
  const d = parse(s);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Math.round((start - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export const monthLabel = (s) => parse(s).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

/** Groups an array by a key function, preserving order: [{ key, items }] */
export function groupBy(list, fn) {
  const out = [];
  for (const item of list) {
    const k = fn(item);
    const last = out[out.length - 1];
    if (last && last.key === k) last.items.push(item);
    else out.push({ key: k, items: [item] });
  }
  return out;
}

export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- Vehicles & people ----------
export const vehicleEmoji = (r) => VEHICLE[r?.vehicle_type]?.emoji || '🔧';
export function vehicleName(r) {
  const name = [r.brand, r.model].filter(Boolean).join(' ');
  return name || VEHICLE[r.vehicle_type]?.label || 'Véhicule';
}
/** Kept for prefill texts */
export const vehicleLabel = (r) => vehicleName(r);

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

const AVATAR_COLORS = [
  ['#5e5ce6', '#7d7aff'], ['#0a84ff', '#5ac8fa'], ['#30d158', '#66d4a0'], ['#ff9f0a', '#ffc15e'],
  ['#ff375f', '#ff7a93'], ['#bf5af2', '#d58cff'], ['#64d2ff', '#8be0ff'], ['#8e8e93', '#aeaeb2'],
];
export function avatarGradient(name = '') {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return `linear-gradient(180deg, ${b}, ${a})`;
}

// ---------- WhatsApp / phone ----------
export function waNumber(raw) {
  const d = String(raw || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return d.slice(1);
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0') && settings.country_code) return settings.country_code + d.slice(1);
  return d;
}

export function waLink(raw, text = '') {
  const n = waNumber(raw);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export const telLink = (raw) => (raw ? `tel:${String(raw).replace(/[^\d+]/g, '')}` : null);

export function readyMessage(repair) {
  const tpl = settings.wa_ready_template || 'Bonjour {client}, votre {vehicule} est prêt(e). Reste à payer : {reste}.';
  const vehicle = [VEHICLE[repair.vehicle_type]?.short?.toLowerCase(), repair.brand, repair.model].filter(Boolean).join(' ') || 'véhicule';
  return tpl
    .replaceAll('{client}', repair.client_name || '')
    .replaceAll('{vehicule}', vehicle)
    .replaceAll('{total}', money(repair.total))
    .replaceAll('{reste}', money(Math.max(repair.balance, 0)))
    .replaceAll('{atelier}', settings.shop_name || '');
}
