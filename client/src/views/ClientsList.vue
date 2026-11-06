<script setup>
import { ref, watch, onMounted } from 'vue';
import { api } from '../api.js';
import { money, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import EmptyState from '../components/EmptyState.vue';

const q = ref('');
const withCredit = ref(false);
const clients = ref(null);
let timer;

async function load() {
  try {
    clients.value = await api.get('/clients', { q: q.value, with_credit: withCredit.value ? 1 : '' });
  } catch (e) {
    toastError(e);
  }
}
onMounted(load);
watch([q, withCredit], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 200);
});
</script>

<template>
  <div class="page">
    <PageHeader title="👥 Clients" />
    <div class="stack">
      <input v-model="q" type="search" placeholder="🔍 Nom, téléphone, adresse…" />
      <div class="chips">
        <button class="chip" :class="{ active: !withCredit }" @click="withCredit = false">Tous</button>
        <button class="chip" :class="{ active: withCredit }" @click="withCredit = true">💳 Avec crédit</button>
      </div>
      <div v-if="clients" class="list">
        <router-link v-for="c in clients" :key="c.id" :to="`/clients/${c.id}`" class="list-item">
          <div class="thumb">👤</div>
          <div class="grow">
            <div class="title ellipsis">{{ c.name }}</div>
            <div class="sub ellipsis">{{ c.phone || c.whatsapp || '—' }}</div>
          </div>
          <span v-if="c.credit > 0" class="badge orange">doit {{ money(c.credit) }}</span>
        </router-link>
        <EmptyState v-if="!clients.length" icon="👥" :text="q ? 'Aucun client trouvé' : 'Aucun client pour le moment'" />
      </div>
    </div>
    <router-link to="/clients/nouveau" class="fab">➕ Client</router-link>
  </div>
</template>
