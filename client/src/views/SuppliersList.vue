<script setup>
import { ref, watch, onActivated } from 'vue';
import { Plus, Truck, PackagePlus } from 'lucide-vue-next';
import { api } from '../api.js';
import { fmtDate } from '../store.js';
import { toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import SearchField from '../components/SearchField.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';

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
onActivated(load);
watch(q, () => {
  clearTimeout(timer);
  timer = setTimeout(load, 180);
});
</script>

<template>
  <div class="page">
    <NavBar title="Fournisseurs" large back="/plus" :refresh="load">
      <router-link to="/fournisseurs/nouveau" class="nav-icon filled" aria-label="Nouveau fournisseur"><Plus :size="20" :stroke-width="2.6" /></router-link>
    </NavBar>
    <SearchField v-model="q" placeholder="Nom, téléphone" />
    <ListGroup>
      <ListRow to="/achats/nouveau" :icon="PackagePlus" tile="accent" title="Enregistrer un achat" subtitle="Augmente le stock automatiquement" />
    </ListGroup>
    <Skeleton v-if="!list" :rows="4" :thumb="false" />
    <ListGroup v-else-if="list.length">
      <ListRow
        v-for="s in list" :key="s.id" :to="`/fournisseurs/${s.id}`" :avatar="s.name" :title="s.name"
        :subtitle="[s.phone || s.whatsapp, s.last_purchase_at && `dernier achat ${fmtDate(s.last_purchase_at)}`].filter(Boolean).join(' · ') || '—'"
        :value="s.purchases_count ? `${s.purchases_count} achat(s)` : ''"
      />
    </ListGroup>
    <EmptyState v-else :icon="Truck" title="Aucun fournisseur" text="Gardez les contacts WhatsApp de vos fournisseurs et l'historique de vos achats.">
      <router-link to="/fournisseurs/nouveau" class="btn filled">Nouveau fournisseur</router-link>
    </EmptyState>
  </div>
</template>
