import { reactive } from 'vue';
import { api } from './api.js';
import { VEHICLE } from './constants.js';

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

// ---------- Toasts ----------
export const toasts = reactive([]);
let toastId = 0;
export function toast(message, type = 'ok') {
  const id = ++toastId;
  toasts.push({ id, message, type });
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id);
    if (i >= 0) toasts.splice(i, 1);
  }, type === 'error' ? 5000 : 2500);
}
export const toastError = (e) => toast(e?.message || String(e), 'error');

// ---------- Formatting ----------
const numberFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
export const fmtNum = (n) => numberFmt.format(Number(n) || 0);
export const money = (n) => `${fmtNum(n)} ${settings.currency}`;

export function fmtDate(s, withTime = false) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  const opts = { day: '2-digit', month: '2-digit', year: '2-digit' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('fr-FR', opts);
}

export function fmtRelative(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} j`;
  return fmtDate(s);
}

export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function vehicleLabel(r) {
  const v = VEHICLE[r.vehicle_type];
  const name = [r.brand, r.model].filter(Boolean).join(' ');
  return `${v ? v.icon + ' ' : ''}${name || v?.short || 'Véhicule'}`;
}

// ---------- WhatsApp / phone ----------
export function waNumber(raw) {
  let d = String(raw || '').replace(/[^\d+]/g, '');
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
