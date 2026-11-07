<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Star } from 'lucide-vue-next';
import { api } from '../api.js';
import { fmtDate } from '../store.js';
import { toast, toastError, confirmAction, haptic } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import PhotoGallery from '../components/PhotoGallery.vue';
import Skeleton from '../components/Skeleton.vue';

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
  haptic('light');
  try {
    s.value = await api.put(`/solutions/${id}`, { favorite: s.value.favorite ? 0 : 1 });
  } catch (e) {
    toastError(e);
  }
}

async function remove() {
  if (!(await confirmAction('', { title: 'Supprimer cette solution ?', confirm: 'Supprimer' }))) return;
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
    <NavBar :reveal-at="44" :title="s?.title || ''" back="/base">
      <button v-if="s" class="nav-icon" style="background: none" aria-label="Favori" @click="toggleFav">
        <Star :size="22" :fill="s.favorite ? 'var(--yellow)' : 'none'" :color="s.favorite ? 'var(--yellow)' : 'var(--tint)'" />
      </button>
      <router-link :to="`/base/${id}/modifier`" class="nav-btn">Modifier</router-link>
    </NavBar>
    <Skeleton v-if="!s" :rows="4" :thumb="false" />
    <template v-else>
      <h1 class="title1" style="margin: 4px 0 4px">{{ s.title }}</h1>
      <div class="hstack" style="gap: 8px">
        <span v-if="s.category" class="pill blue">{{ s.category }}</span>
        <span class="footnote secondary">Mis à jour {{ fmtDate(s.updated_at || s.created_at) }}</span>
      </div>

      <template v-for="[k, label] in sections" :key="k">
        <ListGroup v-if="s[k]" :header="label">
          <div class="cell text-cell" :style="k === 'solution' ? 'box-shadow: inset 3px 0 0 var(--green)' : ''">{{ s[k] }}</div>
        </ListGroup>
      </template>
      <ListGroup v-if="s.wiring" header="Schéma"><div class="cell code-cell">{{ s.wiring }}</div></ListGroup>
      <ListGroup v-if="s.notes" header="Notes"><div class="cell text-cell">{{ s.notes }}</div></ListGroup>

      <PhotoGallery ref-type="solution" :ref-id="id" :tags="TAGS" header="Photos & schémas" />

      <ListGroup>
        <ListRow title="Supprimer la solution" destructive @click="remove" />
      </ListGroup>
    </template>
  </div>
</template>
