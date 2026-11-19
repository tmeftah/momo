import { extractProduct } from './extractor.js';
import { SITE_RULES } from './site-rules.js';
import { guessCategory, guessSupplier, currencyWarning } from './import-helpers.js';

// Same list as client/src/constants.js (STOCK_CATEGORIES)
const STOCK_CATEGORIES = [
  'Chargeurs', 'Batteries', 'BMS', 'Cellules 18650', 'Cellules 21700', 'Contrôleurs', 'Écrans', 'Moteurs', 'Capteurs Hall', 'Câbles', 'Connecteurs',
  'Accessoires vélo électrique', 'Accessoires trottinette électrique', 'Accessoires scooter électrique', 'Consommables d’atelier',
];
const AVAILABILITY = {
  in_stock: 'En stock',
  limited: 'Stock limité',
  out_of_stock: 'Rupture de stock',
  preorder: 'Précommande',
  backorder: 'Sur commande',
  discontinued: 'Plus fabriqué',
};
const SOURCE_LABEL = { rules: 'règles du site', ld: 'données schema.org (JSON-LD)', microdata: 'microdonnées schema.org', meta: 'balises Open Graph', dom: 'lecture de la page' };
const MAX_UPLOAD = 15 * 1024 * 1024;
const DEFAULT_SELECTED = 8;
const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>';

const el = (id) => document.getElementById(id);
const state = {
  config: null,
  tab: null,
  view: null,
  previousView: null,
  product: null,
  meta: null,
  matches: [],
  target: null, // id of the existing item to update, null = create a new one
  selected: [], // image URLs to upload, in order (the first becomes the main photo)
  priceTarget: 'purchase',
  result: null,
};

// ---------- helpers ----------
const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

function show(view) {
  for (const v of ['settings', 'start', 'product', 'done']) el(`view-${v}`).hidden = v !== view;
  state.view = view;
  el('btn-back').hidden = view !== 'settings' || !state.config;
  el('btn-settings').hidden = view === 'settings';
  window.scrollTo(0, 0);
}

function message(id, text, kind = 'error') {
  const m = el(id);
  m.textContent = text || '';
  m.className = `msg ${kind}`;
  m.hidden = !text;
}

function busy(button, label) {
  if (!button.dataset.label) button.dataset.label = button.textContent.trim();
  button.disabled = !!label;
  if (label) button.textContent = label;
  else if (button.dataset.label) {
    button.textContent = button.dataset.label;
    delete button.dataset.label;
  }
}

function option(value, label) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
}

async function api(path, { method = 'GET', body, form } = {}) {
  const { server, key } = state.config;
  const opts = { method, headers: { Authorization: `Bearer ${key}` } };
  if (form) opts.body = form;
  else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${server}/api${path}`, opts);
  } catch {
    throw new Error('Serveur injoignable. Vérifiez l’adresse et la connexion.');
  }
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json().catch(() => null) : null;
  if (res.status === 401) throw new Error('Clé refusée. Créez une nouvelle clé dans VAE Manager : Réglages › Import de produits.');
  if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
  return data;
}

// Per-shop choices remembered between imports
async function prefsFor(host) {
  return (await chrome.storage.local.get(`prefs:${host}`))[`prefs:${host}`] || {};
}
function savePrefs(host, prefs) {
  return chrome.storage.local.set({ [`prefs:${host}`]: prefs });
}

// The review form survives closing the popup (until the browser closes)
const draftKey = () => `draft:${state.tab?.url}`;
let draftTimer = null;
function saveDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    if (!state.product) return;
    chrome.storage.session.set({
      [draftKey()]: { product: state.product, meta: state.meta, matches: state.matches, target: state.target, selected: state.selected, priceTarget: state.priceTarget, form: readForm() },
    });
  }, 250);
}
async function loadDraft() {
  return (await chrome.storage.session.get(draftKey()))[draftKey()] || null;
}
function clearDraft() {
  clearTimeout(draftTimer);
  return chrome.storage.session.remove(draftKey());
}

async function currentTab() {
  // ?tab=<id> lets the popup be opened as a normal page on a given tab
  const id = Number(new URLSearchParams(location.search).get('tab'));
  if (id) return chrome.tabs.get(id);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ---------- settings ----------
// defaults.json is added by the server when the extension is downloaded from Réglages
async function defaultServer() {
  try {
    const res = await fetch(chrome.runtime.getURL('defaults.json'));
    return res.ok ? (await res.json()).server || '' : '';
  } catch {
    return '';
  }
}

async function openSettings() {
  state.previousView = state.view && state.view !== 'settings' ? state.view : 'start';
  el('cfg-server').value = state.config?.server || (await defaultServer());
  el('cfg-key').value = state.config?.key || '';
  message('settings-msg', '');
  show('settings');
  (el('cfg-server').value ? el('cfg-key') : el('cfg-server')).focus();
}

async function saveSettings(e) {
  e.preventDefault();
  let server = el('cfg-server').value.trim().replace(/\/+$/, '').replace(/\/api$/, '');
  const key = el('cfg-key').value.trim();
  if (!/^https?:\/\/[^/]+/.test(server)) return message('settings-msg', 'Adresse invalide : elle commence par https://');
  server = new URL(server).origin + new URL(server).pathname.replace(/\/+$/, '');
  const button = el('btn-save-settings');
  busy(button, 'Connexion…');
  const previous = state.config;
  state.config = { server, key };
  try {
    const meta = await api('/import/meta');
    await chrome.storage.local.set({ config: state.config });
    message('settings-msg', `Connecté à ${meta.shop_name || 'VAE Manager'}`, 'ok');
    setTimeout(() => show(state.previousView || 'start'), 700);
  } catch (err) {
    state.config = previous;
    message('settings-msg', err.message);
  } finally {
    busy(button, null);
  }
}

// ---------- extraction ----------
async function extract() {
  const button = state.view === 'product' ? el('btn-reextract') : el('btn-extract');
  const msgId = state.view === 'product' ? 'send-msg' : 'start-msg';
  message(msgId, '');
  if (!/^https?:/.test(state.tab?.url || '')) {
    return message(msgId, 'Ouvrez la page d’un produit sur le site du fournisseur, puis recommencez.');
  }
  busy(button, 'Lecture de la page…');
  try {
    let product;
    try {
      const [injection] = await chrome.scripting.executeScript({ target: { tabId: state.tab.id }, func: extractProduct, args: [SITE_RULES] });
      product = injection?.result;
    } catch {
      throw new Error('Cette page ne peut pas être lue (page interne du navigateur ou site protégé).');
    }
    if (!product || (!product.name && product.price === null && !product.images.length)) {
      throw new Error('Aucun produit reconnu sur cette page. Ouvrez la fiche d’un produit.');
    }
    state.product = product;

    let serverError = '';
    try {
      const params = new URLSearchParams({ url: product.url });
      if (product.ean) params.set('ean', product.ean);
      if (product.sku) params.set('reference', product.sku);
      [state.meta, state.matches] = await Promise.all([api('/import/meta'), api(`/import/lookup?${params}`)]);
    } catch (err) {
      serverError = err.message;
      state.meta = state.meta || { currency: '', categories: [], suppliers: [] };
      state.matches = [];
    }

    // An item with the same link or EAN is the same product; a reference alone may be a coincidence
    const sure = state.matches.find((m) => m.matched_by !== 'reference');
    state.target = sure ? sure.id : null;
    const prefs = await prefsFor(product.site);
    state.priceTarget = prefs.priceTarget || 'purchase';
    const existing = state.matches.find((m) => m.id === state.target);
    state.selected = existing?.photos ? [] : product.images.slice(0, DEFAULT_SELECTED);

    fillForm(product, prefs);
    renderAll();
    show('product');
    message('send-msg', serverError);
    saveDraft();
  } catch (err) {
    message(msgId, err.message);
  } finally {
    busy(button, null);
  }
}

function fillForm(p, prefs) {
  const meta = state.meta;
  el('f-name').value = p.name || '';
  el('f-brand').value = p.brand || '';
  el('f-sku').value = p.sku || '';
  el('f-ean').value = p.ean || '';
  el('f-description').value = p.description || '';
  el('f-quantity').value = '0';
  el('f-other-price').value = '';

  const categories = [...new Set([...STOCK_CATEGORIES, ...(meta.categories || [])])];
  const cat = el('f-category');
  cat.replaceChildren(option('', 'Sans catégorie'), ...categories.map((c) => option(c, c)));
  cat.value = guessCategory(p, categories);

  const sup = el('f-supplier');
  sup.replaceChildren(option('', 'Aucun'), ...(meta.suppliers || []).map((s) => option(String(s.id), s.name)));
  const supplierId = prefs.supplier_id && meta.suppliers?.some((s) => s.id === prefs.supplier_id) ? prefs.supplier_id : guessSupplier(p.site, meta.suppliers || []);
  sup.value = supplierId ? String(supplierId) : '';

  el('f-price').value = p.price ?? '';
}

function applyForm(f) {
  for (const [id, v] of Object.entries(f)) if (el(id)) el(id).value = v;
}

function readForm() {
  const ids = ['f-name', 'f-brand', 'f-sku', 'f-ean', 'f-category', 'f-price', 'f-other-price', 'f-quantity', 'f-supplier', 'f-description'];
  return Object.fromEntries(ids.map((id) => [id, el(id).value]));
}

// ---------- rendering ----------
function renderAll() {
  renderHeaderInfo();
  renderImages();
  renderMatches();
  renderPrice();
  renderMode();
}

function renderHeaderInfo() {
  const p = state.product;
  const crumbs = p.breadcrumbs?.length ? p.breadcrumbs.join(' › ') : p.category;
  el('category-footer').textContent = crumbs ? `Sur le site : ${crumbs}` : '';

  const avail = el('availability');
  avail.textContent = AVAILABILITY[p.availability] || p.availability_text || 'Non indiquée';
  avail.className = `cell-value${p.availability === 'out_of_stock' || p.availability === 'discontinued' ? ' c-orange' : ''}`;

  const link = el('source-link');
  link.href = p.url;
  link.textContent = p.site;
  link.title = p.url;

  const used = [...new Set(Object.values(p.sources || {}))].map((s) => (s === 'platform' ? `données ${p.platform}` : SOURCE_LABEL[s])).filter(Boolean);
  el('sources-footer').textContent = used.length ? `Lu depuis : ${used.join(', ')}.` : '';
}

function renderImages() {
  const box = el('images');
  const images = state.product.images;
  box.replaceChildren();
  el('images-empty').hidden = images.length > 0;
  box.hidden = !images.length;
  for (const url of images) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = url;
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => b.classList.add('broken'));
    const check = document.createElement('span');
    check.className = 'check';
    check.innerHTML = CHECK_SVG;
    b.append(img, check);
    const i = state.selected.indexOf(url);
    b.classList.toggle('on', i > -1);
    b.setAttribute('aria-pressed', String(i > -1));
    if (i === 0) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'Principale';
      b.append(badge);
    }
    b.addEventListener('click', () => {
      const at = state.selected.indexOf(url);
      if (at > -1) state.selected.splice(at, 1);
      else state.selected.push(url);
      renderImages();
      saveDraft();
    });
    box.append(b);
  }
  el('images-header').textContent = images.length ? `Photos · ${state.selected.length} sur ${images.length}` : 'Photos';
  el('images-footer').textContent = images.length ? 'Touchez une photo pour l’ajouter ou la retirer. La première sélectionnée devient la photo principale.' : '';
}

const MATCH_REASON = { url: 'même page produit', ean: 'même EAN', reference: 'même référence' };

function renderMatches() {
  const box = el('matches');
  box.replaceChildren();
  el('matches-block').hidden = !state.matches.length;
  if (!state.matches.length) return;
  const currency = state.meta?.currency || '';
  const row = (id, title, sub) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cell choice';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(state.target === id));
    const radio = document.createElement('span');
    radio.className = 'radio';
    radio.innerHTML = CHECK_SVG;
    const main = document.createElement('span');
    main.className = 'grow';
    const t = document.createElement('div');
    t.className = 'cell-title';
    t.textContent = title;
    main.append(t);
    if (sub) {
      const s = document.createElement('div');
      s.className = 'cell-sub';
      s.textContent = sub;
      main.append(s);
    }
    b.append(radio, main);
    b.addEventListener('click', () => {
      const before = state.target;
      state.target = id;
      // Updating an item that already has photos: don't add the same photos again by default
      const existing = state.matches.find((m) => m.id === id);
      if (before !== id) state.selected = existing?.photos ? [] : state.product.images.slice(0, DEFAULT_SELECTED);
      renderAll();
      saveDraft();
    });
    return b;
  };
  for (const m of state.matches) {
    const price = m.purchase_price ? ` · achat ${m.purchase_price} ${currency}` : '';
    box.append(row(m.id, m.name, `${MATCH_REASON[m.matched_by]} · ${m.quantity} en stock${price} · ${m.photos} photo${m.photos > 1 ? 's' : ''}`));
  }
  box.append(row(null, 'Créer un nouvel article', ''));
  el('matches-footer').textContent = state.target
    ? 'La mise à jour actualise le prix, la disponibilité et le lien, et complète les champs vides. Le nom et la quantité ne changent pas.'
    : '';
}

function renderPrice() {
  const purchase = state.priceTarget === 'purchase';
  for (const b of el('price-target').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.value === state.priceTarget));
  el('price-label').textContent = purchase ? "Prix d'achat" : 'Prix de vente';
  el('other-price-label').textContent = purchase ? 'Prix de vente' : "Prix d'achat";
  const unit = state.meta?.currency || '';
  el('price-unit').textContent = unit;
  el('other-price-unit').textContent = unit;

  const p = state.product;
  const notes = [];
  if (p.price === null) notes.push('Prix non trouvé sur la page.');
  const warning = currencyWarning(p.currency, unit);
  if (warning) notes.push(warning);
  if (state.target) notes.push('Laissez un prix vide pour ne pas le modifier.');
  el('price-footer').textContent = notes.join(' ');
}

function renderMode() {
  const updating = !!state.target;
  el('stock-block').hidden = updating;
  el('btn-send').textContent = updating ? 'Mettre à jour l’article' : 'Ajouter au stock';
}

// ---------- sending ----------
async function sniffImageType(blob) {
  const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 3) === 'GIF') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && /avi[fs]/.test(ascii(8, 12))) return 'image/avif';
  return null;
}

// Fallback for images the shop only serves to its own pages
async function fetchFromPage(url) {
  try {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: state.tab.id },
      args: [url, MAX_UPLOAD],
      func: async (u, max) => {
        try {
          const res = await fetch(u);
          if (!res.ok) return null;
          const blob = await res.blob();
          if (blob.size > max) return null;
          return await new Promise((done) => {
            const reader = new FileReader();
            reader.onload = () => done(reader.result);
            reader.onerror = () => done(null);
            reader.readAsDataURL(blob);
          });
        } catch {
          return null;
        }
      },
    });
    return r?.result ? await (await fetch(r.result)).blob() : null;
  } catch {
    return null;
  }
}

async function downloadImage(url) {
  let blob = null;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (res.ok) blob = await res.blob();
  } catch {
    blob = null;
  }
  if (!blob) blob = await fetchFromPage(url);
  if (!blob || blob.size > MAX_UPLOAD) return null;
  const type = await sniffImageType(blob);
  return type ? new Blob([blob], { type }) : null;
}

async function send(e) {
  e.preventDefault();
  const f = readForm();
  const p = state.product;
  message('send-msg', '');
  el('f-ean').closest('.field').classList.remove('invalid');

  if (!f['f-name'].trim()) return message('send-msg', 'Le nom est obligatoire.');
  const ean = f['f-ean'].replace(/[\s-]/g, '');
  if (ean && !/^\d{8,14}$/.test(ean)) {
    el('f-ean').closest('.field').classList.add('invalid');
    return message('send-msg', 'EAN invalide : 8 à 14 chiffres, ou laissez vide.');
  }

  const priceField = state.priceTarget === 'purchase' ? 'purchase_price' : 'sale_price';
  const otherField = state.priceTarget === 'purchase' ? 'sale_price' : 'purchase_price';
  const body = {
    name: f['f-name'].replace(/\s+/g, ' ').trim(),
    brand: f['f-brand'],
    reference: f['f-sku'],
    ean,
    category: f['f-category'],
    description: f['f-description'],
    source_url: p.url,
    source_availability: p.availability || null,
  };
  if (f['f-price'] !== '') body[priceField] = f['f-price'];
  if (f['f-other-price'] !== '') body[otherField] = f['f-other-price'];
  if (!state.target) {
    body.quantity = f['f-quantity'] || 0;
    body.supplier_id = f['f-supplier'] ? Number(f['f-supplier']) : null;
  }

  const button = el('btn-send');
  busy(button, state.target ? 'Mise à jour…' : 'Création de l’article…');
  try {
    const item = state.target
      ? await api(`/import/items/${state.target}`, { method: 'PUT', body })
      : await api('/import/items', { method: 'POST', body });
    await savePrefs(p.site, { priceTarget: state.priceTarget, supplier_id: body.supplier_id ?? (await prefsFor(p.site)).supplier_id ?? null });

    let added = 0;
    let failed = 0;
    for (const [i, url] of state.selected.entries()) {
      busy(button, `Envoi des photos ${i + 1} sur ${state.selected.length}…`);
      try {
        const blob = await downloadImage(url);
        if (!blob) throw new Error('image');
        const form = new FormData();
        form.append('file', blob, `photo-${i + 1}.${blob.type.split('/')[1]}`);
        await api(`/import/items/${item.id}/photos`, { method: 'POST', form });
        added++;
      } catch {
        failed++;
      }
    }
    state.result = { item, created: !state.target, added, failed };
    await clearDraft();
    showDone();
  } catch (err) {
    message('send-msg', err.message);
  } finally {
    busy(button, null);
    renderMode();
  }
}

function showDone() {
  const { item, created, added, failed } = state.result;
  el('done-title').textContent = created ? 'Article ajouté au stock' : 'Article mis à jour';
  const photos = added ? ` · ${added} photo${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}` : '';
  el('done-sub').textContent = `${item.name}${photos}`;
  const missed =
    failed === 1
      ? '1 photo n’a pas pu être récupérée. Ajoutez-la depuis l’application si besoin.'
      : `${failed} photos n’ont pas pu être récupérées. Ajoutez-les depuis l’application si besoin.`;
  message('done-msg', failed ? missed : '', 'warn');
  show('done');
}

// ---------- wiring ----------
el('btn-settings').addEventListener('click', openSettings);
el('btn-back').addEventListener('click', () => show(state.previousView || 'start'));
el('settings-form').addEventListener('submit', saveSettings);
el('btn-extract').addEventListener('click', extract);
el('btn-reextract').addEventListener('click', extract);
el('product-form').addEventListener('submit', send);
el('product-form').addEventListener('input', saveDraft);
el('product-form').addEventListener('change', saveDraft);
el('price-target').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.value;
  if (!v) return;
  state.priceTarget = v;
  renderPrice();
  saveDraft();
});
el('btn-open').addEventListener('click', () => {
  chrome.tabs.create({ url: `${state.config.server}/stock/${state.result.item.id}` });
  window.close();
});
el('btn-close').addEventListener('click', () => window.close());

(async function init() {
  state.config = (await chrome.storage.local.get('config')).config || null;
  state.tab = await currentTab();
  el('bar-sub').textContent = hostOf(state.tab?.url) || '';
  if (!state.config) return openSettings();
  const draft = await loadDraft();
  if (draft) {
    Object.assign(state, { product: draft.product, meta: draft.meta, matches: draft.matches, target: draft.target, selected: draft.selected, priceTarget: draft.priceTarget });
    fillForm(state.product, {});
    applyForm(draft.form);
    renderAll();
    return show('product');
  }
  show('start');
})();
