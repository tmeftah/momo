<script setup>
import { ref, watch, onActivated } from 'vue';
import { Plus, Activity } from 'lucide-vue-next';
import { api } from '../api.js';
import { money, fmtRelative, vehicleName, vehicleIcon } from '../store.js';
import { toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import Segmented from '../components/Segmented.vue';
import SearchField from '../components/SearchField.vue';
import StatusPill from '../components/StatusPill.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';

const filter = ref('1');
const q = ref('');
const list = ref(null);
let timer;

async function load() {
  try {
    list.value = await api.get('/diagnostics', { q: q.value, open: filter.value });
  } catch (e) {
    toastError(e);
  }
}
onActivated(load);
watch([filter, q], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 180);
});
</script>

<template>
  <div class="page">
    <NavBar title="Diagnostics" large back="/plus" :refresh="load" subtitle="Facturés séparément, même si le client abandonne">
      <router-link to="/diagnostics/nouveau" class="nav-icon filled" aria-label="Nouveau diagnostic"><Plus :size="20" :stroke-width="2.6" /></router-link>
    </NavBar>
    <div class="vstack">
      <SearchField v-model="q" placeholder="Client, marque, symptôme" />
      <Segmented v-model="filter" :options="[{ value: '1', label: 'En cours' }, { value: '0', label: 'Terminés' }, { value: '', label: 'Tous' }]" />
    </div>
    <Skeleton v-if="!list" :rows="5" />
    <ListGroup v-else-if="list.length">
      <ListRow v-for="d in list" :key="d.id" :to="`/diagnostics/${d.id}`" style="--inset: 72px">
        <template #leading><span class="thumb"><component :is="vehicleIcon(d)" :size="22" :stroke-width="1.8" /></span></template>
        <div class="cell-title"><span v-if="d.priority === 'urgent' && !d.decision" class="c-red" style="font-weight: 800">! </span>{{ vehicleName(d) }}</div>
        <div class="cell-sub">{{ d.fault_found || d.symptoms || '—' }}</div>
        <div class="cell-sub">{{ d.client_name || 'Sans client' }} · {{ fmtRelative(d.created_at) }}</div>
        <template #trailing>
          <div class="cell-trail">
            <span class="subhead bold num">{{ money(d.price) }}</span>
            <StatusPill :decision="d.decision" short />
          </div>
        </template>
      </ListRow>
    </ListGroup>
    <EmptyState v-else :icon="Activity" title="Aucun diagnostic" text="Un diagnostic se facture seul et se transforme en réparation en un geste.">
      <router-link to="/diagnostics/nouveau" class="btn filled">Nouveau diagnostic</router-link>
    </EmptyState>
  </div>
</template>
