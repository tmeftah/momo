<script setup>
import { ref, watch, onMounted } from 'vue';
import { api, fileUrl } from '../api.js';
import { CONNECTOR_APPS } from '../constants.js';
import { toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ChipSelect from '../components/ChipSelect.vue';
import EmptyState from '../components/EmptyState.vue';

const q = ref('');
const app = ref(null);
const list = ref(null);
const adaptations = ref([]);
let timer;

async function load() {
  try {
    list.value = await api.get('/connectors', { q: q.value, application: app.value });
    adaptations.value = q.value ? await api.get('/adaptations', { q: q.value, limit: 20 }) : [];
  } catch (e) {
    toastError(e);
  }
}
onMounted(load);
watch([q, app], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 200);
});
</script>

<template>
  <div class="page">
    <PageHeader title="🔌 Connecteurs" back="/plus">
      <router-link to="/adaptations/nouvelle" class="btn btn-sm">➕ Adaptation</router-link>
    </PageHeader>
    <div class="stack">
      <input v-model="q" type="search" placeholder="🔍 Type, application, couleur de fil, adaptation…" />
      <ChipSelect v-model="app" :options="CONNECTOR_APPS" allow-empty scroll />
      <div v-if="list" class="grid-2">
        <router-link v-for="c in list" :key="c.id" :to="`/connecteurs/${c.id}`" class="card" style="padding: 0; overflow: hidden; color: inherit">
          <img v-if="c.photo" :src="fileUrl(c.photo)" alt="" loading="lazy" style="width: 100%; aspect-ratio: 4/3; object-fit: cover" />
          <div v-else class="thumb" style="width: 100%; height: auto; aspect-ratio: 4/3; border-radius: 0; font-size: 2.4rem">🔌</div>
          <div style="padding: 10px">
            <div class="strong ellipsis">{{ c.name }}</div>
            <div class="tiny muted ellipsis">{{ [c.application, c.pins ? c.pins + ' pins' : '', c.type].filter(Boolean).join(' · ') }}</div>
            <span v-if="c.adaptations_count" class="badge yellow tiny" style="margin-top: 4px">{{ c.adaptations_count }} adaptation(s)</span>
          </div>
        </router-link>
      </div>
      <EmptyState v-if="list && !list.length" icon="🔌" text="Aucun connecteur enregistré" />

      <template v-if="adaptations.length">
        <div class="section-title">Adaptations trouvées</div>
        <div class="list">
          <router-link v-for="a in adaptations" :key="a.id" :to="`/adaptations/${a.id}`" class="list-item">
            <img v-if="a.photo" class="thumb" :src="fileUrl(a.photo)" alt="" />
            <div v-else class="thumb">🛠️</div>
            <div class="grow">
              <div class="title ellipsis">{{ a.title }}</div>
              <div class="sub ellipsis">{{ a.connector_name || 'Sans connecteur' }}</div>
            </div>
          </router-link>
        </div>
      </template>
    </div>
    <router-link to="/connecteurs/nouveau" class="fab">➕ Connecteur</router-link>
  </div>
</template>
