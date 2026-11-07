<script setup>
import { ref, computed, watch, onActivated } from 'vue';
import { Plus, Receipt, ShoppingCart } from 'lucide-vue-next';
import { api } from '../api.js';
import { money, fmtTime, dayLabel, groupBy, localToday } from '../store.js';
import { toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import Segmented from '../components/Segmented.vue';
import SearchField from '../components/SearchField.vue';
import ChipSelect from '../components/ChipSelect.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';

const period = ref('month');
const q = ref('');
const unpaid = ref(null);
const sales = ref(null);
let timer;

const total = computed(() => (sales.value || []).reduce((s, x) => s + x.total, 0));
const days = computed(() => groupBy(sales.value || [], (s) => s.created_at.slice(0, 10)));

function range() {
  const today = localToday();
  if (period.value === 'today') return { from: today, to: today };
  if (period.value === 'month') return { from: today.slice(0, 8) + '01', to: today };
  return {};
}

async function load() {
  try {
    sales.value = await api.get('/sales', { ...range(), q: q.value, unpaid: unpaid.value ? 1 : '' });
  } catch (e) {
    toastError(e);
  }
}
onActivated(load);
watch([period, q, unpaid], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 180);
});
</script>

<template>
  <div class="page">
    <NavBar title="Ventes" large back="/vente" :refresh="load" :subtitle="sales ? `${sales.length} vente(s) · ${money(total)}` : ''">
      <router-link to="/vente" class="nav-icon filled" aria-label="Nouvelle vente"><Plus :size="20" :stroke-width="2.6" /></router-link>
    </NavBar>
    <div class="vstack" style="gap: 10px">
      <SearchField v-model="q" placeholder="Article, client, n° de vente" />
      <Segmented v-model="period" :options="[{ value: 'today', label: 'Aujourd’hui' }, { value: 'month', label: 'Ce mois' }, { value: 'all', label: 'Tout' }]" />
      <ChipSelect v-model="unpaid" :options="[{ value: true, label: 'Impayées seulement' }]" allow-empty />
    </div>

    <Skeleton v-if="!sales" :rows="5" />
    <template v-else>
      <ListGroup v-for="d in days" :key="d.key" :header="dayLabel(d.items[0].created_at)">
        <template #header-right><span class="num" style="text-transform: none">{{ money(d.items.reduce((s, x) => s + x.total, 0)) }}</span></template>
        <ListRow v-for="s in d.items" :key="s.id" :to="`/ventes/${s.id}`" :icon="ShoppingCart" tile="soft" :title="s.summary" :subtitle="`${s.client_name || 'Client de passage'} · ${fmtTime(s.created_at)}`" :chevron="false">
          <template #trailing>
            <div class="cell-trail">
              <span class="bold num">{{ money(s.total) }}</span>
              <span v-if="s.balance > 0.009" class="pill orange">reste {{ money(s.balance) }}</span>
            </div>
          </template>
        </ListRow>
      </ListGroup>
      <EmptyState v-if="!sales.length" :icon="Receipt" title="Aucune vente" text="Aucune vente sur cette période." />
    </template>
  </div>
</template>
