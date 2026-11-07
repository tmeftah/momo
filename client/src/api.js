import { reactive } from 'vue';
import { markResponse, clearOfflineData } from './pwa.js';

export const session = reactive({ checked: false, configured: true, authenticated: false });

async function request(method, url, body) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch('/api' + url, opts);
  } catch {
    throw new Error(method === 'GET' ? 'Serveur injoignable. Vérifiez la connexion.' : 'Hors ligne — modification impossible pour le moment.');
  }
  markResponse(res);
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (res.status === 401 && !url.startsWith('/auth/')) {
    session.authenticated = false;
    clearOfflineData();
    throw new Error('Session expirée');
  }
  if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
  return data;
}

/** Builds "?a=1&b=2" while skipping empty values. */
export function qs(params = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const api = {
  get: (url, params) => request('GET', url + qs(params)),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
  upload: (url, formData) => request('POST', url, formData),
};

export const fileUrl = (name) => (name ? `/api/files/${name}` : null);

export async function checkSession() {
  const s = await request('GET', '/auth/status');
  session.configured = s.configured;
  session.authenticated = s.authenticated;
  session.checked = true;
  return s;
}
