<script setup>
import { ref, computed, watch, onActivated } from 'vue';
import { Plus, Users } from 'lucide-vue-next';
import { api } from '../api.js';
import { money, groupBy } from '../store.js';
import { toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import SearchField from '../components/SearchField.vue';
import Segmented from '../components/Segmented.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';

const q = ref('');
const filter = ref('all');
const clients = ref(null);
let timer;

async function load() {
  try {
    clients.value = await api.get('/clients', { q: q.value, with_credit: filter.value === 'credit' ? 1 : '', limit: 2000 });
  } catch (e) {
    toastError(e);
  }
}
onActivated(load);
watch([q, filter], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 180);
});

// Contacts-style A–Z sections
const sections = computed(() =>
  groupBy(clients.value || [], (c) => {
    const ch = (c.name || '#').normalize('NFD').replace(/[̀-ͯ]/g, '')[0].toUpperCase();
    return /[A-Z]/.test(ch) ? ch : '#';
  })
);
</script>

<template>
  <div class="page">
    <NavBar title="Clients" large :refresh="load">
      <router-link to="/clients/nouveau" class="nav-icon filled" aria-label="Nouveau client"><Plus :size="20" :stroke-width="2.6" /></router-link>
    </NavBar>
    <div class="vstack">
      <SearchField v-model="q" placeholder="Nom, téléphone, adresse" />
      <Segmented v-model="filter" :options="[{ value: 'all', label: 'Tous' }, { value: 'credit', label: 'Avec crédit' }]" />
    </div>

    <Skeleton v-if="!clients" :rows="6" :thumb="false" />
    <template v-else>
      <ListGroup v-for="s in sections" :key="s.key" :header="s.key">
        <ListRow v-for="c in s.items" :key="c.id" :to="`/clients/${c.id}`" :avatar="c.name" :title="c.name" :subtitle="c.phone || c.whatsapp || 'Pas de téléphone'">
          <template #trailing><span v-if="c.credit > 0" class="pill orange">{{ money(c.credit) }}</span></template>
        </ListRow>
      </ListGroup>
      <EmptyState v-if="!clients.length" :icon="Users" :title="q ? 'Aucun résultat' : 'Aucun client'" :text="q ? `Rien ne correspond à « ${q} ».` : 'Ajoutez votre premier client pour suivre ses réparations et achats.'">
        <router-link v-if="!q" to="/clients/nouveau" class="btn filled">Nouveau client</router-link>
      </EmptyState>
      <p v-if="clients.length" class="center footnote secondary mt">{{ clients.length }} client{{ clients.length > 1 ? 's' : '' }}</p>
    </template>
  </div>
</template>
