<script setup>
import { ref, computed, watch, onActivated } from 'vue';
import { useRoute } from 'vue-router';
import { Plus, PackagePlus, Package } from 'lucide-vue-next';
import { api } from '../api.js';
import { STOCK_CATEGORIES } from '../constants.js';
import { money, fmtNum } from '../store.js';
import { toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import ChipSelect from '../components/ChipSelect.vue';
import Segmented from '../components/Segmented.vue';
import SearchField from '../components/SearchField.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';

const route = useRoute();
const q = ref('');
const category = ref(null);
const filter = ref(route.query.low === '1' ? 'low' : 'all');
const items = ref(null);
const counts = ref([]);
let timer;

const catOptions = computed(() => {
  const map = Object.fromEntries(counts.value.map((c) => [c.category, c.n]));
  const extra = counts.value.map((c) => c.category).filter((c) => c && !STOCK_CATEGORIES.includes(c));
  return [...STOCK_CATEGORIES, ...extra].filter((c) => map[c]).map((c) => ({ value: c, label: c, count: map[c] }));
});
const totalValue = computed(() => (items.value || []).reduce((s, i) => s + Math.max(i.quantity, 0) * i.purchase_price, 0));

async function load() {
  try {
    const [list, cats] = await Promise.all([
      api.get('/items', { q: q.value, category: category.value, low: filter.value === 'low' ? 1 : '', limit: 3000 }),
      api.get('/items-categories'),
    ]);
    items.value = list;
    counts.value = cats;
  } catch (e) {
    toastError(e);
  }
}
onActivated(() => {
  if (route.query.low === '1' && filter.value !== 'low') filter.value = 'low';
  else load();
});
watch([q, category, filter], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 160);
});

const qtyColor = (i) => (i.quantity <= 0 ? 'red' : i.low ? 'orange' : 'gray');
</script>

<template>
  <div class="page">
    <NavBar title="Stock" large :refresh="load">
      <router-link to="/stock/ajout" class="nav-icon" aria-label="Entrée de stock"><PackagePlus :size="18" :stroke-width="2.2" /></router-link>
      <router-link to="/stock/nouveau" class="nav-icon filled" aria-label="Nouvel article"><Plus :size="20" :stroke-width="2.6" /></router-link>
    </NavBar>
    <div class="vstack" style="gap: 10px">
      <SearchField v-model="q" placeholder="Nom, référence, tension, emplacement" />
      <Segmented v-model="filter" :options="[{ value: 'all', label: 'Tous les articles' }, { value: 'low', label: 'Stock faible' }]" />
      <ChipSelect v-if="catOptions.length" v-model="category" :options="catOptions" allow-empty scroll />
    </div>

    <Skeleton v-if="!items" :rows="7" />
    <template v-else>
      <ListGroup v-if="items.length" :footer="`${items.length} article(s) · valeur d'achat ${money(totalValue)}`">
        <ListRow v-for="i in items" :key="i.id" :to="`/stock/${i.id}`" :thumb="i.photo || null" :chevron="false">
          <div class="cell-title">{{ i.name }}</div>
          <div class="cell-sub">{{ [i.reference, i.voltage, i.power, i.location].filter(Boolean).join(' · ') || i.category }}</div>
          <template #trailing>
            <div class="cell-trail">
              <span class="subhead bold num">{{ money(i.sale_price) }}</span>
              <span class="pill num" :class="qtyColor(i)">{{ fmtNum(i.quantity) }} en stock</span>
            </div>
          </template>
        </ListRow>
      </ListGroup>
      <EmptyState v-else :icon="Package" :title="filter === 'low' ? 'Tout est en stock' : 'Aucun article'" :text="filter === 'low' ? 'Aucun article sous son stock minimum.' : 'Ajoutez vos chargeurs, BMS, cellules, contrôleurs…'">
        <router-link v-if="filter !== 'low'" to="/stock/nouveau" class="btn filled">Nouvel article</router-link>
      </EmptyState>
    </template>
  </div>
</template>
