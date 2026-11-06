<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { fmtDate, toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import PhotoGallery from '../components/PhotoGallery.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const a = ref(null);
const TAGS = [
  { value: 'avant', label: 'Avant' },
  { value: 'apres', label: 'Après' },
  { value: 'schema', label: 'Brochage' },
];

onMounted(async () => {
  try {
    a.value = await api.get(`/adaptations/${id}`);
  } catch (e) {
    toastError(e);
  }
});

async function remove() {
  if (!confirm('Supprimer cette adaptation ?')) return;
  try {
    await api.del(`/adaptations/${id}`);
    toast('Adaptation supprimée');
    router.replace(a.value.connector_id ? `/connecteurs/${a.value.connector_id}` : '/connecteurs');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="a?.title || 'Adaptation'" back>
      <router-link :to="`/adaptations/${id}/modifier`" class="btn btn-sm">✏️</router-link>
    </PageHeader>
    <div v-if="a" class="stack">
      <div class="row wrap small">
        <router-link v-if="a.connector_id" :to="`/connecteurs/${a.connector_id}`" class="badge blue">🔌 {{ a.connector_name }}</router-link>
        <router-link v-if="a.repair_id" :to="`/reparations/${a.repair_id}`" class="badge">🔧 Réparation #{{ a.repair_id }}</router-link>
        <span class="muted">{{ fmtDate(a.created_at) }}</span>
      </div>
      <PhotoGallery ref-type="adaptation" :ref-id="id" :tags="TAGS" />
      <div v-if="a.problem" class="card"><div class="card-title">Problème</div><div class="pre">{{ a.problem }}</div></div>
      <div v-if="a.pinout" class="card"><div class="card-title">Brochage</div><div class="block-text mono small">{{ a.pinout }}</div></div>
      <div v-if="a.solution" class="card"><div class="card-title">Solution</div><div class="pre">{{ a.solution }}</div></div>
      <div v-if="a.notes" class="card"><div class="card-title">Notes</div><div class="pre">{{ a.notes }}</div></div>
      <button class="btn btn-danger" style="margin-top: 16px" @click="remove">Supprimer</button>
    </div>
  </div>
</template>
