<script setup>
import { ref, watch, onMounted } from 'vue';
import { api } from '../api.js';
import { fmtDate, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';

const q = ref('');
const list = ref(null);
let timer;

async function load() {
  try {
    list.value = await api.get('/suppliers', { q: q.value });
  } catch (e) {
    toastError(e);
  }
}
onMounted(load);
watch(q, () => {
  clearTimeout(timer);
  timer = setTimeout(load, 200);
});
</script>

<template>
  <div class="page">
    <PageHeader title="📇 Fournisseurs" back="/plus">
      <router-link to="/achats/nouveau" class="btn btn-sm">➕ Achat</router-link>
    </PageHeader>
    <div class="stack">
      <input v-model="q" type="search" placeholder="🔍 Nom, téléphone…" />
      <div v-if="list" class="list">
        <router-link v-for="s in list" :key="s.id" :to="`/fournisseurs/${s.id}`" class="list-item">
          <div class="thumb">📇</div>
          <div class="grow">
            <div class="title ellipsis">{{ s.name }}</div>
            <div class="sub ellipsis">{{ s.phone || s.whatsapp || '—' }}</div>
          </div>
          <div class="right tiny muted">
            <div>{{ s.purchases_count }} achat(s)</div>
            <div v-if="s.last_purchase_at">{{ fmtDate(s.last_purchase_at) }}</div>
          </div>
        </router-link>
        <EmptyState v-if="!list.length" icon="📇" text="Aucun fournisseur" />
      </div>
    </div>
    <router-link to="/fournisseurs/nouveau" class="fab">➕ Fournisseur</router-link>
  </div>
</template>
