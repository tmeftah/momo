<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../api.js';
import { money, fmtDate, localToday, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';

const period = ref('today');
const q = ref('');
const unpaid = ref(false);
const sales = ref(null);
let timer;

const total = computed(() => (sales.value || []).reduce((s, x) => s + x.total, 0));

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
onMounted(load);
watch([period, q, unpaid], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 200);
});
</script>

<template>
  <div class="page">
    <PageHeader title="🧾 Ventes" back="/vente" />
    <div class="stack">
      <input v-model="q" type="search" placeholder="🔍 Article, client, n° de vente…" />
      <div class="chips">
        <button class="chip" :class="{ active: period === 'today' }" @click="period = 'today'">Aujourd'hui</button>
        <button class="chip" :class="{ active: period === 'month' }" @click="period = 'month'">Ce mois</button>
        <button class="chip" :class="{ active: period === 'all' }" @click="period = 'all'">Tout</button>
        <button class="chip" :class="{ active: unpaid, yellow: true }" @click="unpaid = !unpaid">💳 Impayées</button>
      </div>
      <div v-if="sales" class="row between small muted"><span>{{ sales.length }} vente(s)</span><span class="strong text-yellow">{{ money(total) }}</span></div>
      <div v-if="sales" class="list">
        <router-link v-for="s in sales" :key="s.id" :to="`/ventes/${s.id}`" class="list-item">
          <div class="thumb">🛒</div>
          <div class="grow">
            <div class="title ellipsis">{{ s.summary }}</div>
            <div class="sub">#{{ s.id }} · {{ s.client_name || 'Client de passage' }} · {{ fmtDate(s.created_at, true) }}</div>
          </div>
          <div class="right">
            <div class="strong">{{ money(s.total) }}</div>
            <div v-if="s.balance > 0.009" class="tiny text-orange">reste {{ money(s.balance) }}</div>
          </div>
        </router-link>
        <EmptyState v-if="!sales.length" icon="🧾" text="Aucune vente sur la période" />
      </div>
    </div>
    <router-link to="/vente" class="fab">🛒 Vendre</router-link>
  </div>
</template>
