<script setup>
// Import a product from a supplier's webshop on the phone: the link arrives from the share
// sheet (manifest share_target) or is pasted, the server fetches the page, and the Chrome
// extension's extractor reads it here. Same review form and rules as the extension.
import { ref, reactive, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Check, ClipboardPaste, ExternalLink } from 'lucide-vue-next';
import { extractProduct } from '../../../extension/extractor.js';
import { SITE_RULES } from '../../../extension/site-rules.js';
import { guessCategory, guessSupplier, currencyWarning } from '../../../extension/import-helpers.js';
import { api } from '../api.js';
import { STOCK_CATEGORIES, SHOP_AVAILABILITY } from '../constants.js';
import { settings } from '../store.js';
import { toast, toastError, haptic } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import PickerRow from '../components/PickerRow.vue';
import Segmented from '../components/Segmented.vue';

const DEFAULT_SELECTED = 8;
const MATCH_REASON = { url: 'même page produit', ean: 'même EAN', reference: 'même référence' };
const SOURCE_LABEL = { rules: 'règles du site', ld: 'données schema.org', microdata: 'microdonnées schema.org', meta: 'balises Open Graph', dom: 'lecture de la page' };

const route = useRoute();
const router = useRouter();

const link = ref('');
const reading = ref(false);
const sending = ref('');
const product = ref(null);
const meta = ref({ categories: [], suppliers: [] });
const matches = ref([]);
const target = ref(null); // existing item to update, null = new item
const selected = ref([]); // image URLs, in upload order
const broken = reactive(new Set());
const priceTarget = ref('purchase');
const form = reactive({ name: '', brand: '', reference: '', ean: '', category: null, price: '', otherPrice: '', quantity: 0, supplier_id: null, description: '' });

const categories = computed(() => [...new Set([...STOCK_CATEGORIES, ...(meta.value.categories || [])])]);
const supplierOptions = computed(() => (meta.value.suppliers || []).map((s) => ({ value: s.id, label: s.name })));
const eanInvalid = computed(() => !!form.ean && !/^\d{8,14}$/.test(form.ean.replace(/[\s-]/g, '')));
const crumbs = computed(() => (product.value?.breadcrumbs?.length ? product.value.breadcrumbs.join(' › ') : product.value?.category || ''));
const priceLabel = (purchase) => (purchase ? "Prix d'achat" : 'Prix de vente');
const priceFooter = computed(() => {
  const p = product.value;
  if (!p) return '';
  const notes = [];
  if (p.price === null) notes.push('Prix non trouvé sur la page.');
  const warning = currencyWarning(p.currency, settings.currency);
  if (warning) notes.push(warning);
  if (target.value) notes.push('Laissez un prix vide pour ne pas le modifier.');
  return notes.join(' ');
});
const sourcesFooter = computed(() => {
  const p = product.value;
  if (!p) return '';
  const used = [...new Set(Object.values(p.sources || {}))].map((s) => (s === 'platform' ? `données ${p.platform}` : SOURCE_LABEL[s])).filter(Boolean);
  return used.length ? `Lu depuis : ${used.join(', ')}.` : '';
});

// Per-shop choices, remembered on this phone
const prefsKey = (site) => `vae-import:${site}`;
function loadPrefs(site) {
  try {
    return JSON.parse(localStorage.getItem(prefsKey(site)) || '{}');
  } catch {
    return {};
  }
}
function savePrefs(site, prefs) {
  try {
    localStorage.setItem(prefsKey(site), JSON.stringify(prefs));
  } catch {
    /* private mode: not remembered */
  }
}

/** Shared text often holds a title and the link together: keep the link. */
function firstLink(text) {
  return String(text || '').match(/https?:\/\/[^\s<>"]+/)?.[0] || '';
}

async function paste() {
  try {
    const found = firstLink(await navigator.clipboard.readText());
    if (!found) return toastError(new Error('Aucun lien dans le presse-papiers'));
    link.value = found;
    read();
  } catch {
    toastError(new Error('Accès au presse-papiers refusé : collez le lien dans le champ'));
  }
}

async function read() {
  const url = firstLink(link.value) || (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(link.value.trim()) ? `https://${link.value.trim()}` : '');
  if (!url || reading.value) {
    if (!url) toastError(new Error('Collez le lien de la page du produit'));
    return;
  }
  reading.value = true;
  try {
    const page = await api.post('/import/page', { url });
    const p = await extractProduct(SITE_RULES, {
      html: page.body,
      url: page.url,
      fetchText: async (u) => (await api.post('/import/page', { url: u, kind: 'json' })).body,
    });
    if (!p.name && p.price === null && !p.images.length) throw new Error('Aucun produit reconnu sur cette page. Partagez la page d’un produit.');

    const params = { url: p.url };
    if (p.ean) params.ean = p.ean;
    if (p.sku) params.reference = p.sku;
    const [m, found] = await Promise.all([api.get('/import/meta'), api.get('/import/lookup', params)]);
    meta.value = m;
    matches.value = found;
    product.value = p;
    broken.clear();

    // Same link or EAN: same product. A reference alone may be a coincidence.
    const sure = found.find((x) => x.matched_by !== 'reference');
    target.value = sure ? sure.id : null;
    selected.value = sure?.photos ? [] : p.images.slice(0, DEFAULT_SELECTED);

    const prefs = loadPrefs(p.site);
    priceTarget.value = prefs.priceTarget || 'purchase';
    const supplierKnown = prefs.supplier_id && m.suppliers.some((s) => s.id === prefs.supplier_id);
    Object.assign(form, {
      name: p.name,
      brand: p.brand,
      reference: p.sku,
      ean: p.ean,
      category: guessCategory(p, categories.value) || null,
      price: p.price ?? '',
      otherPrice: '',
      quantity: 0,
      supplier_id: (supplierKnown ? prefs.supplier_id : guessSupplier(p.site, m.suppliers)) || null,
      description: p.description,
    });
    haptic('success');
  } catch (e) {
    toastError(e);
  } finally {
    reading.value = false;
  }
}

function chooseTarget(id) {
  if (target.value === id) return;
  target.value = id;
  const existing = matches.value.find((m) => m.id === id);
  selected.value = existing?.photos ? [] : product.value.images.slice(0, DEFAULT_SELECTED);
  haptic('light');
}

function toggleImage(url) {
  const i = selected.value.indexOf(url);
  if (i > -1) selected.value.splice(i, 1);
  else selected.value.push(url);
  haptic('light');
}

function onImageError(url) {
  broken.add(url);
  selected.value = selected.value.filter((u) => u !== url);
}

async function send() {
  const p = product.value;
  if (!form.name.trim() || sending.value) return;
  if (eanInvalid.value) return toastError(new Error('EAN invalide : 8 à 14 chiffres, ou laissez vide'));
  const priceField = priceTarget.value === 'purchase' ? 'purchase_price' : 'sale_price';
  const otherField = priceTarget.value === 'purchase' ? 'sale_price' : 'purchase_price';
  const body = {
    name: form.name.replace(/\s+/g, ' ').trim(),
    brand: form.brand,
    reference: form.reference,
    ean: form.ean.replace(/[\s-]/g, ''),
    category: form.category,
    description: form.description,
    source_url: p.url,
    source_availability: p.availability || null,
  };
  if (form.price !== '' && form.price !== null) body[priceField] = form.price;
  if (form.otherPrice !== '' && form.otherPrice !== null) body[otherField] = form.otherPrice;
  if (!target.value) Object.assign(body, { quantity: form.quantity || 0, supplier_id: form.supplier_id });

  sending.value = target.value ? 'Mise à jour…' : 'Création de l’article…';
  try {
    const item = target.value ? await api.put(`/import/items/${target.value}`, body) : await api.post('/import/items', body);
    savePrefs(p.site, { priceTarget: priceTarget.value, supplier_id: target.value ? loadPrefs(p.site).supplier_id ?? null : form.supplier_id });
    let failed = 0;
    for (const [i, url] of selected.value.entries()) {
      sending.value = `Photos ${i + 1} sur ${selected.value.length}…`;
      try {
        await api.post(`/import/items/${item.id}/photos-from-url`, { url });
      } catch {
        failed++;
      }
    }
    const done = target.value ? 'Article mis à jour' : 'Article ajouté au stock';
    toast(failed ? `${done} · ${failed} photo${failed > 1 ? 's' : ''} non récupérée${failed > 1 ? 's' : ''}` : done);
    router.replace(`/stock/${item.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    sending.value = '';
  }
}

// Opened from the share sheet: /stock/importer?url=… (Android may put the link in "text")
watch(
  () => route.query,
  (q) => {
    const shared = firstLink(q.url) || firstLink(q.text) || firstLink(q.title);
    if (shared && shared !== link.value) {
      link.value = shared;
      product.value = null;
      read();
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="page">
    <NavBar :reveal-at="44" title="Importer un produit" back="/stock" />
    <h1 class="title1" style="margin: 4px 0 2px">Importer un produit</h1>

    <form @submit.prevent="read">
      <ListGroup :footer="product ? '' : 'Sur la page du produit, touchez Partager puis VAE Manager. Vous pouvez aussi copier le lien et le coller ici.'">
        <label class="cell field stacked">
          <span class="field-label">Lien de la page produit</span>
          <input v-model="link" type="url" inputmode="url" enterkeyhint="go" autocomplete="off" placeholder="https://…" />
        </label>
        <ListRow :icon="ClipboardPaste" tile="accent" title="Coller le lien" @click="paste" />
      </ListGroup>
      <button class="btn filled lg block mt" :disabled="reading || !link.trim()">{{ reading ? 'Lecture de la page…' : product ? 'Relire la page' : 'Lire la page' }}</button>
    </form>

    <template v-if="product && !reading">
      <section class="lg">
        <div class="lg-header">Photos · {{ selected.length }} sur {{ product.images.length }}</div>
        <div v-if="product.images.length" class="pick-grid">
          <button
            v-for="url in product.images" :key="url" type="button" class="pick" :class="{ on: selected.includes(url), broken: broken.has(url) }"
            :aria-pressed="selected.includes(url)" @click="toggleImage(url)"
          >
            <img :src="url" alt="" referrerpolicy="no-referrer" loading="lazy" @error="onImageError(url)" />
            <span class="pick-check"><Check :size="14" :stroke-width="3" /></span>
            <span v-if="selected[0] === url" class="pick-main">Principale</span>
          </button>
        </div>
        <div v-else class="cell secondary" style="border-radius: var(--radius)">Aucune photo trouvée sur la page</div>
        <div v-if="product.images.length" class="lg-footer">Touchez une photo pour l’ajouter ou la retirer. La première sélectionnée devient la photo principale.</div>
      </section>

      <ListGroup
        v-if="matches.length" header="Déjà dans le stock ?"
        :footer="target ? 'La mise à jour actualise le prix, la disponibilité et le lien, et complète les champs vides. Le nom et la quantité ne changent pas.' : ''"
      >
        <ListRow
          v-for="m in matches" :key="m.id" :thumb="m.photo || null" :title="m.name" :selected="target === m.id" :chevron="false"
          :subtitle="`${MATCH_REASON[m.matched_by]} · ${m.quantity} en stock · ${m.photos} photo${m.photos > 1 ? 's' : ''}`"
          @click="chooseTarget(m.id)"
        />
        <ListRow title="Créer un nouvel article" :selected="target === null" :chevron="false" @click="chooseTarget(null)" />
      </ListGroup>

      <ListGroup header="Article" :footer="crumbs ? `Sur le site : ${crumbs}` : ''">
        <label class="cell field stacked"><span class="field-label">Nom</span><textarea v-model="form.name" rows="2" /></label>
        <label class="cell field"><span class="field-label">Marque</span><input v-model="form.brand" placeholder="—" /></label>
        <label class="cell field"><span class="field-label">Référence</span><input v-model="form.reference" placeholder="—" /></label>
        <label class="cell field"><span class="field-label">EAN</span><input v-model="form.ean" class="num" :class="{ 'c-red': eanInvalid }" inputmode="numeric" placeholder="—" /></label>
        <PickerRow v-model="form.category" label="Catégorie" :options="categories" allow-empty empty-label="Sans catégorie" />
      </ListGroup>

      <ListGroup header="Prix" :footer="priceFooter">
        <div class="cell"><Segmented v-model="priceTarget" :options="[{ value: 'purchase', label: 'Prix du site = achat' }, { value: 'sale', label: 'Prix du site = vente' }]" style="flex: 1" /></div>
        <label class="cell field"><span class="field-label">{{ priceLabel(priceTarget === 'purchase') }}</span><input v-model="form.price" class="num" type="number" step="0.001" min="0" inputmode="decimal" placeholder="0" /><span class="unit">{{ settings.currency }}</span></label>
        <label class="cell field"><span class="field-label">{{ priceLabel(priceTarget !== 'purchase') }}</span><input v-model="form.otherPrice" class="num" type="number" step="0.001" min="0" inputmode="decimal" placeholder="0" /><span class="unit">{{ settings.currency }}</span></label>
      </ListGroup>

      <ListGroup v-if="!target" header="Stock">
        <label class="cell field"><span class="field-label">Quantité</span><input v-model="form.quantity" class="num" type="number" step="any" min="0" inputmode="decimal" /></label>
        <PickerRow v-model="form.supplier_id" label="Fournisseur" :options="supplierOptions" allow-empty empty-label="Aucun" />
      </ListGroup>

      <ListGroup header="Chez le fournisseur">
        <ListRow title="Disponibilité" :value="SHOP_AVAILABILITY[product.availability] || product.availability_text || 'Non indiquée'" />
        <ListRow :href="product.url" external :icon="ExternalLink" tile="accent" title="Page produit" :value="product.site" />
      </ListGroup>

      <ListGroup header="Description" :footer="sourcesFooter">
        <label class="cell field stacked"><textarea v-model="form.description" rows="5" placeholder="Aucune description trouvée" /></label>
      </ListGroup>

      <button class="btn filled lg block mt" :disabled="!form.name.trim() || !!sending" @click="send">
        {{ sending || (target ? 'Mettre à jour l’article' : 'Ajouter au stock') }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.pick-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; border-radius: var(--radius); overflow: hidden; }
@media (min-width: 640px) { .pick-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
.pick { position: relative; aspect-ratio: 1; padding: 0; border: 0; background: var(--cell); cursor: pointer; overflow: hidden; }
.pick img { width: 100%; height: 100%; object-fit: contain; display: block; }
.pick:not(.on) img { opacity: 0.35; }
.pick.broken img { visibility: hidden; }
.pick.broken::after { content: 'Illisible'; position: absolute; inset: 0; display: grid; place-items: center; font-size: 13px; color: var(--label-2); }
.pick-check {
  position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 50%;
  display: grid; place-items: center; color: #fff;
  border: 1.5px solid rgba(255, 255, 255, 0.9); background: rgba(0, 0, 0, 0.25);
}
.pick-check svg { opacity: 0; }
.pick.on .pick-check { background: var(--tint); border-color: var(--tint); }
.pick.on .pick-check svg { opacity: 1; }
.pick-main { position: absolute; left: 6px; bottom: 6px; padding: 2px 8px; border-radius: 8px; background: rgba(0, 0, 0, 0.6); color: #fff; font-size: 12px; font-weight: 600; }
</style>
