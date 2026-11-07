<script setup>
import { ref, computed, onActivated } from 'vue';
import { CalendarDays, Activity } from 'lucide-vue-next';
import { api } from '../api.js';
import { PRIORITIES } from '../constants.js';
import { fmtDate, fmtRelative, localToday, vehicleName, vehicleIcon } from '../store.js';
import { toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import ChipSelect from '../components/ChipSelect.vue';
import StatusPill from '../components/StatusPill.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';

const data = ref(null);
const prio = ref(null);
async function load() {
  try {
    data.value = await api.get('/planning');
  } catch (e) {
    toastError(e);
  }
}
onActivated(load);

const today = localToday();
const keep = (x) => !prio.value || x.priority === prio.value;

const columns = computed(() => {
  if (!data.value) return [];
  const r = data.value.repairs.filter(keep);
  const by = (s) => r.filter((x) => x.status === s);
  return [
    { key: 'en_cours', title: 'En cours', items: by('en_cours') },
    { key: 'en_attente', title: 'En attente', items: by('en_attente') },
    { key: 'en_pause', title: 'En pause', items: by('en_pause') },
    { key: 'attente_piece', title: 'Attente de pièces', items: by('attente_piece') },
    { key: 'en_test', title: 'En test', items: by('en_test') },
    { key: 'diag', title: 'Diagnostics', items: data.value.diagnostics.filter(keep), diag: true },
    { key: 'terminee', title: 'Terminés — à prévenir', items: r.filter((x) => x.status === 'terminee' && !x.notified_at) },
    { key: 'recuperer', title: 'À récupérer', items: r.filter((x) => x.status === 'terminee' && x.notified_at) },
    { key: 'livree', title: 'Récupérés (7 jours)', items: by('livree') },
  ];
});
const nonEmpty = computed(() => columns.value.filter((c) => c.items.length));
const total = computed(() => columns.value.filter((c) => c.key !== 'livree').reduce((s, c) => s + c.items.length, 0));
const jump = (key) => document.getElementById(`col-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
</script>

<template>
  <div class="page wide">
    <NavBar title="Planning" large back :refresh="load" :subtitle="data ? `${total} véhicule(s) à l’atelier` : ''" />
    <div class="vstack" style="gap: 10px">
      <ChipSelect v-model="prio" :options="PRIORITIES.map((p) => ({ value: p.value, label: p.label }))" allow-empty scroll />
      <div class="chips scroll mobile-only">
        <button v-for="c in nonEmpty" :key="c.key" class="chip" @click="jump(c.key)">{{ c.title }} <span class="count">{{ c.items.length }}</span></button>
      </div>
    </div>

    <Skeleton v-if="!data" :rows="5" />
    <div v-else-if="nonEmpty.length" class="kanban">
      <ListGroup v-for="col in nonEmpty" :id="`col-${col.key}`" :key="col.key" :header="col.title" style="scroll-margin-top: 100px">
        <template #header-right><span class="num" style="text-transform: none; color: var(--label-2)">{{ col.items.length }}</span></template>
        <ListRow v-for="x in col.items" :key="x.id" :to="(col.diag ? '/diagnostics/' : '/reparations/') + x.id" style="--inset: 72px">
          <template #leading><span class="thumb"><component :is="col.diag ? Activity : vehicleIcon(x)" :size="22" :stroke-width="1.8" /></span></template>
          <div class="cell-title"><span v-if="x.priority === 'urgent'" class="c-red" style="font-weight: 800">! </span>{{ vehicleName(x) }}</div>
          <div class="cell-sub">{{ x.client_name || 'Sans client' }} · {{ fmtRelative(x.created_at) }}</div>
          <div v-if="x.due_date" class="cell-sub" :class="x.due_date < today ? 'c-red' : ''">Prévu {{ fmtDate(x.due_date) }}</div>
          <template #trailing><StatusPill v-if="x.priority !== 'normal'" :priority="x.priority" /></template>
        </ListRow>
      </ListGroup>
    </div>
    <EmptyState v-else :icon="CalendarDays" title="Atelier vide" text="Aucun véhicule en cours avec ce filtre." />
  </div>
</template>
