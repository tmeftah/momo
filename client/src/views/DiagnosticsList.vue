<script setup>
import { ref, watch, onMounted } from 'vue';
import { api } from '../api.js';
import { money, fmtRelative, toastError, vehicleLabel } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import StatusBadge from '../components/StatusBadge.vue';
import EmptyState from '../components/EmptyState.vue';

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
onMounted(load);
watch([filter, q], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 200);
});
</script>

<template>
  <div class="page">
    <PageHeader title="⚡ Diagnostics" back="/plus" />
    <div class="stack">
      <p class="small muted" style="margin: 0">Diagnostic facturé séparément : même si le client abandonne la réparation, le temps passé est payé.</p>
      <input v-model="q" type="search" placeholder="🔍 Client, marque, symptôme…" />
      <div class="chips">
        <button class="chip" :class="{ active: filter === '1' }" @click="filter = '1'">⚡ En cours</button>
        <button class="chip" :class="{ active: filter === '0' }" @click="filter = '0'">Terminés</button>
        <button class="chip" :class="{ active: filter === '' }" @click="filter = ''">Tous</button>
      </div>
      <div v-if="list" class="list">
        <router-link v-for="d in list" :key="d.id" :to="`/diagnostics/${d.id}`" class="list-item" :class="{ urgent: d.priority === 'urgent' && !d.decision }">
          <div class="thumb">⚡</div>
          <div class="grow">
            <div class="title ellipsis">{{ vehicleLabel(d) }}</div>
            <div class="sub ellipsis">#{{ d.id }} · {{ d.client_name || 'Sans client' }} · {{ fmtRelative(d.created_at) }}</div>
            <div class="sub ellipsis">{{ d.fault_found || d.symptoms }}</div>
            <StatusBadge :decision="d.decision" />
          </div>
          <div class="right">
            <div class="strong">{{ money(d.price) }}</div>
            <div v-if="d.balance > 0.009 && d.decision" class="tiny text-orange">doit {{ money(d.balance) }}</div>
          </div>
        </router-link>
        <EmptyState v-if="!list.length" icon="⚡" text="Aucun diagnostic" />
      </div>
    </div>
    <router-link to="/diagnostics/nouveau" class="fab">➕ Diagnostic</router-link>
  </div>
</template>
