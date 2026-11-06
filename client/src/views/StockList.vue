<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api, fileUrl } from '../api.js';
import { STOCK_CATEGORIES } from '../constants.js';
import { money, fmtNum, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ChipSelect from '../components/ChipSelect.vue';
import EmptyState from '../components/EmptyState.vue';

const route = useRoute();
const q = ref('');
const category = ref(null);
const low = ref(route.query.low === '1');
const items = ref(null);
const counts = ref([]);
let timer;

const catOptions = computed(() => {
  const map = Object.fromEntries(counts.value.map((c) => [c.category, c.n]));
  const extra = counts.value.map((c) => c.category).filter((c) => c && !STOCK_CATEGORIES.includes(c));
  return [...STOCK_CATEGORIES, ...extra].map((c) => ({ value: c, label: c, count: map[c] || 0 }));
});
const totalValue = computed(() => (items.value || []).reduce((s, i) => s + Math.max(i.quantity, 0) * i.purchase_price, 0));

async function load() {
  try {
    items.value = await api.get('/items', { q: q.value, category: category.value, low: low.value ? 1 : '', limit: 2000 });
  } catch (e) {
    toastError(e);
  }
}
onMounted(async () => {
  load();
  counts.value = await api.get('/items-categories').catch(() => []);
});
watch([q, category, low], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 200);
});
</script>

<template>
  <div class="page">
    <PageHeader title="📦 Stock">
      <router-link to="/stock/ajout" class="btn btn-sm">➕ Entrée</router-link>
    </PageHeader>
    <div class="stack">
      <input v-model="q" type="search" placeholder="🔍 Nom, référence, tension, emplacement…" />
      <div class="chips">
        <button class="chip" :class="{ active: !low }" @click="low = false">Tous</button>
        <button class="chip" :class="{ active: low }" @click="low = true">⚠️ Stock faible</button>
      </div>
      <ChipSelect v-model="category" :options="catOptions" allow-empty scroll />
      <div v-if="items" class="row between small muted">
        <span>{{ items.length }} article(s)</span>
        <span>Valeur d'achat : {{ money(totalValue) }}</span>
      </div>
      <div v-if="items" class="list">
        <router-link v-for="i in items" :key="i.id" :to="`/stock/${i.id}`" class="list-item">
          <img v-if="i.photo" class="thumb" :src="fileUrl(i.photo)" alt="" loading="lazy" />
          <div v-else class="thumb">📦</div>
          <div class="grow">
            <div class="title ellipsis">{{ i.name }}</div>
            <div class="sub ellipsis">{{ [i.reference, i.voltage, i.power, i.location && '📍 ' + i.location].filter(Boolean).join(' · ') || i.category }}</div>
          </div>
          <div class="right">
            <div class="strong">{{ money(i.sale_price) }}</div>
            <span class="badge" :class="i.quantity <= 0 ? 'red' : i.low ? 'orange' : 'green'">{{ fmtNum(i.quantity) }}</span>
          </div>
        </router-link>
        <EmptyState v-if="!items.length" icon="📦" text="Aucun article" />
      </div>
    </div>
    <router-link to="/stock/nouveau" class="fab">➕ Article</router-link>
  </div>
</template>
