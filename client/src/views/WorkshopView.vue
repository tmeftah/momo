<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';
import { REPAIR_STATUSES, REPAIR_CATEGORIES } from '../constants.js';
import { toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ChipSelect from '../components/ChipSelect.vue';
import RepairCard from '../components/RepairCard.vue';
import EmptyState from '../components/EmptyState.vue';

const props = defineProps({ category: String });
const route = useRoute();

const status = ref(route.query.status || 'actives');
const cat = ref(props.category || route.query.category || null);
const q = ref('');
const repairs = ref(null);
const open = ref([]);
let timer;

const isBattery = computed(() => props.category === 'batterie');
const counts = computed(() => {
  const c = {};
  for (const r of open.value) c[r.status] = (c[r.status] || 0) + 1;
  return c;
});
const statusOptions = computed(() => [
  { value: 'actives', label: 'Actives', count: open.value.length },
  ...REPAIR_STATUSES.filter((s) => s.value !== 'livree').map((s) => ({ ...s, count: counts.value[s.value] || 0 })),
  { value: 'livree', label: 'Livrées', icon: '🏁' },
  { value: 'toutes', label: 'Toutes' },
]);

async function load() {
  try {
    const params = { q: q.value, category: cat.value };
    if (status.value === 'actives') params.open = 1;
    else if (status.value !== 'toutes') params.status = status.value;
    repairs.value = await api.get('/repairs', params);
  } catch (e) {
    toastError(e);
  }
}
async function loadCounts() {
  open.value = await api.get('/repairs', { open: 1, category: cat.value }).catch(() => []);
}
onMounted(() => {
  load();
  loadCounts();
});
watch([status, cat, q], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 200);
});
watch(cat, loadCounts);
</script>

<template>
  <div class="page">
    <PageHeader :title="isBattery ? '🔋 Batteries lithium' : '🔧 Atelier'" :back="isBattery ? '/plus' : false">
      <router-link v-if="!isBattery" to="/diagnostics" class="btn btn-sm">⚡ Diagnostics</router-link>
      <router-link to="/planning" class="btn btn-sm">📅</router-link>
    </PageHeader>
    <div class="stack">
      <p v-if="isBattery" class="small muted" style="margin: 0">Packs de vélos, trottinettes, scooters et batteries d'outils / visseuses : diagnostic, équilibrage, reconstruction, BMS, tests.</p>
      <input v-model="q" type="search" placeholder="🔍 Client, marque, modèle, n° de série, #…" />
      <ChipSelect v-model="status" :options="statusOptions" scroll />
      <ChipSelect v-if="!isBattery" v-model="cat" :options="REPAIR_CATEGORIES" allow-empty scroll yellow />
      <div v-if="repairs" class="list">
        <RepairCard v-for="r in repairs" :key="r.id" :repair="r" />
        <EmptyState v-if="!repairs.length" :icon="isBattery ? '🔋' : '🔧'" text="Aucune intervention" />
      </div>
    </div>
    <router-link :to="`/reparations/nouvelle${cat ? '?category=' + cat : ''}`" class="fab">➕ {{ isBattery ? 'Batterie' : 'Réparation' }}</router-link>
  </div>
</template>
