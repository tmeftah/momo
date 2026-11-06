<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { VEHICLE } from '../constants.js';
import { money, fmtNum, fmtDate, toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import PhotoGallery from '../components/PhotoGallery.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const item = ref(null);
const delta = ref(1);
const note = ref('');

const REASONS = { vente: '🛒 Vente', reparation: '🔧 Réparation', achat: '📇 Achat fournisseur', entree: '➕ Entrée', sortie: '➖ Sortie', ajustement: '✏️ Ajustement', annulation: '↩️ Annulation' };
const REF_ROUTE = { sale: '/ventes/', repair: '/reparations/', purchase: '/achats/' };

const margin = computed(() => (item.value ? item.value.sale_price - item.value.purchase_price : 0));
const marginPct = computed(() => (item.value?.purchase_price > 0 ? Math.round((margin.value / item.value.purchase_price) * 100) : null));

async function load() {
  try {
    item.value = await api.get(`/items/${id}`);
  } catch (e) {
    toastError(e);
  }
}
onMounted(load);

async function adjust(sign) {
  const d = sign * Math.abs(Number(delta.value) || 0);
  if (!d) return;
  try {
    item.value = await api.post(`/items/${id}/adjust`, { delta: d, note: note.value });
    note.value = '';
    toast(`Stock ${d > 0 ? '+' : ''}${fmtNum(d)} → ${fmtNum(item.value.quantity)}`);
  } catch (e) {
    toastError(e);
  }
}

async function remove() {
  if (!confirm(`Supprimer « ${item.value.name} » du stock ? L'historique des ventes est conservé.`)) return;
  try {
    await api.del(`/items/${id}`);
    toast('Article supprimé');
    router.replace('/stock');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="item?.name || 'Article'" back="/stock">
      <router-link :to="`/stock/${id}/modifier`" class="btn btn-sm">✏️</router-link>
    </PageHeader>
    <div v-if="item" class="stack">
      <PhotoGallery ref-type="item" :ref-id="id" />

      <div class="stats">
        <div class="stat" :class="item.quantity <= 0 ? 'red' : item.low ? 'orange' : 'green'">
          <span class="stat-label">En stock</span><span class="stat-value">{{ fmtNum(item.quantity) }}</span>
          <span class="stat-sub">minimum {{ fmtNum(item.min_stock) }}</span>
        </div>
        <div class="stat yellow">
          <span class="stat-label">Prix de vente</span><span class="stat-value">{{ money(item.sale_price) }}</span>
          <span class="stat-sub">achat {{ money(item.purchase_price) }} · marge {{ money(margin) }}<template v-if="marginPct !== null"> ({{ marginPct }} %)</template></span>
        </div>
      </div>

      <div class="card stack">
        <div class="card-title">Mouvement de stock rapide</div>
        <div class="row">
          <button class="btn btn-icon btn-danger" @click="adjust(-1)">−</button>
          <input v-model.number="delta" class="grow center" type="number" min="0" step="any" inputmode="decimal" />
          <button class="btn btn-icon btn-success" @click="adjust(1)">+</button>
        </div>
        <input v-model="note" placeholder="Motif (facultatif) — ex : inventaire, casse…" />
      </div>

      <div class="card">
        <dl class="kv" style="margin: 0">
          <template v-if="item.category"><dt>Catégorie</dt><dd>{{ item.category }}</dd></template>
          <template v-if="item.reference"><dt>Référence</dt><dd>{{ item.reference }}</dd></template>
          <template v-if="item.voltage"><dt>Tension</dt><dd>{{ item.voltage }}</dd></template>
          <template v-if="item.power"><dt>Puissance</dt><dd>{{ item.power }}</dd></template>
          <template v-if="item.location"><dt>Emplacement</dt><dd>📍 {{ item.location }}</dd></template>
          <template v-if="item.vehicle_types"><dt>Compatible</dt><dd>{{ item.vehicle_types.split(',').map((v) => VEHICLE[v]?.icon + ' ' + (VEHICLE[v]?.short || v)).join(', ') }}</dd></template>
          <template v-if="item.supplier_name"><dt>Fournisseur</dt><dd><router-link :to="`/fournisseurs/${item.supplier_id}`">{{ item.supplier_name }}</router-link></dd></template>
        </dl>
        <div v-if="item.notes" class="block-text small" style="margin-top: 10px">{{ item.notes }}</div>
      </div>

      <div class="section-title">Historique des mouvements</div>
      <div class="card">
        <div v-for="m in item.movements" :key="m.id" class="row" style="padding: 8px 0; border-bottom: 1px solid var(--border)">
          <div class="grow">
            <div class="small strong">
              <router-link v-if="m.ref_type && REF_ROUTE[m.ref_type]" :to="REF_ROUTE[m.ref_type] + m.ref_id">{{ REASONS[m.reason] || m.reason }} #{{ m.ref_id }}</router-link>
              <template v-else>{{ REASONS[m.reason] || m.reason }}</template>
            </div>
            <div class="tiny muted">{{ fmtDate(m.created_at, true) }}<template v-if="m.note"> · {{ m.note }}</template></div>
          </div>
          <span class="strong" :class="m.delta > 0 ? 'text-green' : 'text-red'">{{ m.delta > 0 ? '+' : '' }}{{ fmtNum(m.delta) }}</span>
        </div>
        <div v-if="!item.movements.length" class="muted small">Aucun mouvement</div>
      </div>

      <button class="btn btn-danger" style="margin-top: 16px" @click="remove">Supprimer l'article</button>
    </div>
  </div>
</template>
