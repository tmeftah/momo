<script setup>
import { ref, watch, onActivated } from 'vue';
import { Plus, Cable, Wrench, PlugZap } from 'lucide-vue-next';
import { api, fileUrl } from '../api.js';
import { CONNECTOR_APPS } from '../constants.js';
import { toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import ChipSelect from '../components/ChipSelect.vue';
import SearchField from '../components/SearchField.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';

const q = ref('');
const app = ref(null);
const list = ref(null);
const adaptations = ref([]);
let timer;

async function load() {
  try {
    const [c, a] = await Promise.all([api.get('/connectors', { q: q.value, application: app.value }), api.get('/adaptations', { q: q.value, limit: 30 })]);
    list.value = c;
    adaptations.value = a;
  } catch (e) {
    toastError(e);
  }
}
onActivated(load);
watch([q, app], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 180);
});
</script>

<template>
  <div class="page">
    <NavBar title="Connecteurs" large back="/plus" :refresh="load" subtitle="Brochages, photos et adaptations réalisées">
      <router-link to="/connecteurs/nouveau" class="nav-icon filled" aria-label="Nouveau connecteur"><Plus :size="20" :stroke-width="2.6" /></router-link>
    </NavBar>
    <div class="vstack" style="gap: 10px">
      <SearchField v-model="q" placeholder="Type, application, couleur de fil…" />
      <ChipSelect v-model="app" :options="CONNECTOR_APPS" allow-empty scroll />
    </div>

    <Skeleton v-if="!list" :rows="4" />
    <template v-else>
      <div v-if="list.length" class="media-grid mt">
        <router-link v-for="c in list" :key="c.id" :to="`/connecteurs/${c.id}`" class="media-card">
          <img v-if="c.photo" :src="fileUrl(c.photo)" alt="" loading="lazy" />
          <span v-else class="media-ph"><Cable :size="34" :stroke-width="1.5" /></span>
          <div class="media-body">
            <div class="subhead bold ellipsis">{{ c.name }}</div>
            <div class="caption secondary ellipsis">{{ [c.application, c.pins ? c.pins + ' pins' : '', c.type].filter(Boolean).join(' · ') || '—' }}</div>
          </div>
          <span v-if="c.adaptations_count" class="pill yellow media-badge">{{ c.adaptations_count }} adapt.</span>
        </router-link>
      </div>
      <EmptyState v-else-if="!adaptations.length" :icon="Cable" title="Bibliothèque vide" text="Photographiez vos connecteurs et notez leur brochage pour les retrouver plus tard.">
        <router-link to="/connecteurs/nouveau" class="btn filled">Nouveau connecteur</router-link>
      </EmptyState>

      <ListGroup v-if="adaptations.length" header="Adaptations réalisées">
        <template #header-right><router-link to="/adaptations/nouvelle">Ajouter</router-link></template>
        <ListRow v-for="a in adaptations" :key="a.id" :to="`/adaptations/${a.id}`" :thumb="a.photo || null" :thumb-icon="PlugZap" :title="a.title" :subtitle="a.connector_name || 'Sans connecteur'" />
      </ListGroup>
      <ListGroup v-else-if="list.length">
        <ListRow to="/adaptations/nouvelle" :icon="Wrench" tile="accent" title="Enregistrer une adaptation" />
      </ListGroup>
    </template>
  </div>
</template>
