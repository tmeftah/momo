<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Package, Minus, Plus } from 'lucide-vue-next';
import { api } from '../api.js';
import { VEHICLE } from '../constants.js';
import { money, fmtNum, fmtDate } from '../store.js';
import { toast, toastError, confirmAction, haptic } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import PhotoGallery from '../components/PhotoGallery.vue';
import Stepper from '../components/Stepper.vue';
import Skeleton from '../components/Skeleton.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const item = ref(null);
const delta = ref(1);
const note = ref('');

const REASONS = { vente: 'Vente', reparation: 'Réparation', achat: 'Achat fournisseur', entree: 'Entrée', sortie: 'Sortie', ajustement: 'Ajustement', annulation: 'Annulation' };
const REF_ROUTE = { sale: '/ventes/', repair: '/reparations/', purchase: '/achats/' };

const margin = computed(() => (item.value ? item.value.sale_price - item.value.purchase_price : 0));
const marginPct = computed(() => (item.value?.purchase_price > 0 ? Math.round((margin.value / item.value.purchase_price) * 100) : null));
const qtyColor = computed(() => (!item.value ? '' : item.value.quantity <= 0 ? 'var(--red)' : item.value.low ? 'var(--orange)' : 'var(--green)'));

onMounted(async () => {
  try {
    item.value = await api.get(`/items/${id}`);
  } catch (e) {
    toastError(e);
  }
});

async function adjust(sign) {
  const d = sign * Math.abs(Number(delta.value) || 0);
  if (!d) return;
  try {
    item.value = await api.post(`/items/${id}/adjust`, { delta: d, note: note.value });
    note.value = '';
    haptic('success');
    toast(`${d > 0 ? 'Entrée' : 'Sortie'} de ${fmtNum(Math.abs(d))} · stock ${fmtNum(item.value.quantity)}`);
  } catch (e) {
    toastError(e);
  }
}

async function remove() {
  if (!(await confirmAction("L'historique des ventes et réparations est conservé.", { title: `Supprimer « ${item.value.name} » ?`, confirm: "Supprimer l'article" }))) return;
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
    <NavBar :reveal-at="160" :title="item?.name || ''" back="/stock">
      <router-link :to="`/stock/${id}/modifier`" class="nav-btn">Modifier</router-link>
    </NavBar>
    <Skeleton v-if="!item" :rows="4" />
    <template v-else>
      <div class="hero">
        <span class="tile xl soft"><Package :size="36" :stroke-width="1.6" /></span>
        <div class="hero-title">{{ item.name }}</div>
        <div class="hero-sub">{{ [item.category, item.reference].filter(Boolean).join(' · ') || 'Article' }}</div>
      </div>

      <div class="widgets mt">
        <div class="widget" style="min-height: 96px">
          <div class="w-head" :style="{ color: qtyColor }">En stock</div>
          <div class="w-value" :style="{ color: qtyColor }">{{ fmtNum(item.quantity) }}</div>
          <div class="w-sub">minimum {{ fmtNum(item.min_stock) }}</div>
        </div>
        <div class="widget" style="min-height: 96px">
          <div class="w-head" style="color: color-mix(in srgb, var(--yellow) 85%, var(--label))">Prix de vente</div>
          <div class="w-value" style="font-size: 26px">{{ money(item.sale_price) }}</div>
          <div class="w-sub">marge {{ money(margin) }}<template v-if="marginPct !== null"> · {{ marginPct }} %</template></div>
        </div>
      </div>

      <ListGroup header="Mouvement rapide">
        <div class="cell"><span class="cell-main cell-title">Quantité</span><Stepper v-model="delta" /></div>
        <label class="cell field"><span class="field-label">Motif</span><input v-model="note" placeholder="Inventaire, casse…" /></label>
        <div class="cell" style="gap: 10px">
          <button class="btn red grow" @click="adjust(-1)"><Minus :size="18" :stroke-width="2.6" />Sortie</button>
          <button class="btn tinted grow" style="--tint: var(--green)" @click="adjust(1)"><Plus :size="18" :stroke-width="2.6" />Entrée</button>
        </div>
      </ListGroup>

      <PhotoGallery ref-type="item" :ref-id="id" />

      <ListGroup header="Détails">
        <ListRow v-if="item.voltage" title="Tension" :value="item.voltage" />
        <ListRow v-if="item.power" title="Puissance" :value="item.power" />
        <ListRow v-if="item.location" title="Emplacement" :value="item.location" />
        <ListRow title="Prix d'achat" :value="money(item.purchase_price)" />
        <ListRow v-if="item.vehicle_types" title="Compatible" :value="item.vehicle_types.split(',').map((v) => VEHICLE[v]?.emoji + ' ' + (VEHICLE[v]?.short || v)).join('  ')" />
        <ListRow v-if="item.supplier_name" :to="`/fournisseurs/${item.supplier_id}`" title="Fournisseur" :value="item.supplier_name" />
        <div v-if="item.notes" class="cell text-cell" style="display: block"><span class="t-label">Notes techniques</span>{{ item.notes }}</div>
      </ListGroup>

      <ListGroup header="Historique des mouvements">
        <ListRow
          v-for="m in item.movements" :key="m.id" :to="m.ref_type && REF_ROUTE[m.ref_type] ? REF_ROUTE[m.ref_type] + m.ref_id : undefined"
          :title="`${REASONS[m.reason] || m.reason}${m.ref_id ? ' #' + m.ref_id : ''}`" :subtitle="[fmtDate(m.created_at, true), m.note].filter(Boolean).join(' · ')" :chevron="false"
        >
          <template #trailing><span class="bold num" :class="m.delta > 0 ? 'c-green' : 'c-red'">{{ m.delta > 0 ? '+' : '' }}{{ fmtNum(m.delta) }}</span></template>
        </ListRow>
        <div v-if="!item.movements.length" class="cell secondary">Aucun mouvement</div>
      </ListGroup>

      <ListGroup>
        <ListRow title="Supprimer l'article" destructive @click="remove" />
      </ListGroup>
    </template>
  </div>
</template>
