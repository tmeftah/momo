<script setup>
import { ref, computed, watch, onActivated } from 'vue';
import { useRoute } from 'vue-router';
import { Plus, CalendarDays, Activity, Wrench, BatteryCharging } from 'lucide-vue-next';
import { api } from '../api.js';
import { REPAIR_STATUSES, REPAIR_CATEGORIES } from '../constants.js';
import { toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ChipSelect from '../components/ChipSelect.vue';
import RepairRow from '../components/RepairRow.vue';
import SearchField from '../components/SearchField.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';

const props = defineProps({ category: String });
const route = useRoute();

const status = ref('actives');
const cat = ref(props.category || null);
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
  ...REPAIR_STATUSES.filter((s) => s.value !== 'livree').map((s) => ({ value: s.value, label: s.label, count: counts.value[s.value] || 0 })),
  { value: 'livree', label: 'Livrées' },
  { value: 'toutes', label: 'Toutes' },
]);
const catOptions = REPAIR_CATEGORIES.map((c) => ({ value: c.value, label: c.short || c.label, icon: c.icon }));

async function load() {
  try {
    const params = { q: q.value, category: cat.value };
    if (status.value === 'actives') params.open = 1;
    else if (status.value !== 'toutes') params.status = status.value;
    const [list, active] = await Promise.all([api.get('/repairs', params), api.get('/repairs', { open: 1, category: cat.value })]);
    repairs.value = list;
    open.value = active;
  } catch (e) {
    toastError(e);
  }
}

onActivated(() => {
  // Links from the dashboard (e.g. /atelier?status=en_pause) preselect a filter
  if (route.query.status && route.query.status !== status.value) status.value = route.query.status;
  else load();
});
watch([status, cat, q], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 160);
});
</script>

<template>
  <div class="page">
    <NavBar :title="isBattery ? 'Batteries' : 'Atelier'" large :back="isBattery ? '/plus' : false" :refresh="load"
      :subtitle="isBattery ? 'Packs lithium : vélos, trottinettes, scooters, outils' : undefined">
      <router-link v-if="!isBattery" to="/diagnostics" class="nav-icon" aria-label="Diagnostics"><Activity :size="18" :stroke-width="2.3" /></router-link>
      <router-link to="/planning" class="nav-icon" aria-label="Planning"><CalendarDays :size="18" :stroke-width="2.2" /></router-link>
      <router-link :to="`/reparations/nouvelle${cat ? '?category=' + cat : ''}`" class="nav-icon filled" aria-label="Nouvelle réparation"><Plus :size="20" :stroke-width="2.6" /></router-link>
    </NavBar>

    <div class="vstack" style="gap: 10px">
      <SearchField v-model="q" placeholder="Client, marque, modèle, n° de série" />
      <ChipSelect v-model="status" :options="statusOptions" scroll />
      <ChipSelect v-if="!isBattery" v-model="cat" :options="catOptions" allow-empty scroll />
    </div>

    <Skeleton v-if="!repairs" :rows="6" />
    <template v-else>
      <ListGroup v-if="repairs.length">
        <RepairRow v-for="r in repairs" :key="r.id" :repair="r" />
      </ListGroup>
      <EmptyState v-else :icon="isBattery ? BatteryCharging : Wrench" title="Rien ici" :text="q ? 'Aucun résultat pour cette recherche.' : 'Aucune intervention avec ce filtre.'">
        <router-link :to="`/reparations/nouvelle${cat ? '?category=' + cat : ''}`" class="btn filled">{{ isBattery ? 'Nouvelle batterie' : 'Nouvelle réparation' }}</router-link>
      </EmptyState>
    </template>
  </div>
</template>
