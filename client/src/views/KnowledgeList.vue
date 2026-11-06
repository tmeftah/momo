<script setup>
import { ref, watch, onMounted } from 'vue';
import { api, fileUrl } from '../api.js';
import { KNOWLEDGE_CATEGORIES } from '../constants.js';
import { toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ChipSelect from '../components/ChipSelect.vue';
import EmptyState from '../components/EmptyState.vue';

const q = ref('');
const category = ref(null);
const fav = ref(false);
const list = ref(null);
let timer;

async function load() {
  try {
    list.value = await api.get('/solutions', { q: q.value, category: category.value, favorite: fav.value ? 1 : '' });
  } catch (e) {
    toastError(e);
  }
}
onMounted(load);
watch([q, category, fav], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 200);
});

async function toggleFav(s) {
  try {
    Object.assign(s, await api.put(`/solutions/${s.id}`, { favorite: s.favorite ? 0 : 1 }));
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <PageHeader title="📚 Base technique" back="/plus" />
    <div class="stack">
      <input v-model="q" type="search" placeholder="🔍 Symptôme, panne, cause, solution…" />
      <div class="chips">
        <button class="chip" :class="{ active: !fav }" @click="fav = false">Toutes</button>
        <button class="chip yellow" :class="{ active: fav }" @click="fav = true">⭐ Favoris</button>
      </div>
      <ChipSelect v-model="category" :options="KNOWLEDGE_CATEGORIES" allow-empty scroll />
      <div v-if="list" class="list">
        <router-link v-for="s in list" :key="s.id" :to="`/base/${s.id}`" class="list-item">
          <img v-if="s.photo" class="thumb" :src="fileUrl(s.photo)" alt="" loading="lazy" />
          <div v-else class="thumb">📘</div>
          <div class="grow">
            <div class="title ellipsis">{{ s.title }}</div>
            <div class="sub ellipsis">{{ s.category ? s.category + ' · ' : '' }}{{ s.symptoms || s.cause || s.solution }}</div>
          </div>
          <button class="btn btn-ghost btn-icon" :aria-label="s.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'" @click.prevent="toggleFav(s)">{{ s.favorite ? '⭐' : '☆' }}</button>
        </router-link>
        <EmptyState v-if="!list.length" icon="📚" :text="q ? 'Aucune solution trouvée' : 'Votre bibliothèque de dépannage est vide. Ajoutez votre première solution !'" />
      </div>
    </div>
    <router-link to="/base/nouveau" class="fab">➕ Solution</router-link>
  </div>
</template>
