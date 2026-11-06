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
const s = ref(null);
const TAGS = [
  { value: 'photo', label: 'Photo' },
  { value: 'schema', label: 'Schéma' },
];
const sections = [
  ['symptoms', 'Symptômes'],
  ['diagnosis', 'Diagnostic'],
  ['cause', 'Cause'],
  ['solution', 'Solution'],
  ['parts', 'Pièces utilisées'],
];

onMounted(async () => {
  try {
    s.value = await api.get(`/solutions/${id}`);
  } catch (e) {
    toastError(e);
  }
});

async function toggleFav() {
  try {
    s.value = await api.put(`/solutions/${id}`, { favorite: s.value.favorite ? 0 : 1 });
  } catch (e) {
    toastError(e);
  }
}

async function remove() {
  if (!confirm('Supprimer cette solution ?')) return;
  try {
    await api.del(`/solutions/${id}`);
    toast('Solution supprimée');
    router.replace('/base');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="s?.title || 'Solution'" back="/base">
      <button v-if="s" class="btn btn-sm" @click="toggleFav">{{ s.favorite ? '⭐' : '☆' }}</button>
      <router-link :to="`/base/${id}/modifier`" class="btn btn-sm">✏️</router-link>
    </PageHeader>
    <div v-if="s" class="stack">
      <div class="row small"><span v-if="s.category" class="badge blue">{{ s.category }}</span><span class="muted">{{ fmtDate(s.updated_at || s.created_at) }}</span></div>
      <template v-for="[k, label] in sections" :key="k">
        <div v-if="s[k]" class="card" :style="k === 'solution' ? 'border-color: rgba(34,197,94,.5)' : ''">
          <div class="card-title">{{ label }}</div>
          <div class="pre">{{ s[k] }}</div>
        </div>
      </template>
      <div v-if="s.wiring" class="card"><div class="card-title">Schéma</div><div class="block-text mono small">{{ s.wiring }}</div></div>
      <div v-if="s.notes" class="card"><div class="card-title">Notes</div><div class="pre">{{ s.notes }}</div></div>
      <div class="section-title">Photos & schémas</div>
      <PhotoGallery ref-type="solution" :ref-id="id" :tags="TAGS" />
      <button class="btn btn-danger" style="margin-top: 16px" @click="remove">Supprimer</button>
    </div>
  </div>
</template>
