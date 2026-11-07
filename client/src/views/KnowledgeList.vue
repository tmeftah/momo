<script setup>
import { ref, watch, onActivated } from 'vue';
import { Plus, BookOpen, Star } from 'lucide-vue-next';
import { api } from '../api.js';
import { KNOWLEDGE_CATEGORIES } from '../constants.js';
import { toastError, haptic } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import ChipSelect from '../components/ChipSelect.vue';
import Segmented from '../components/Segmented.vue';
import SearchField from '../components/SearchField.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';

const q = ref('');
const category = ref(null);
const fav = ref('all');
const list = ref(null);
let timer;

async function load() {
  try {
    list.value = await api.get('/solutions', { q: q.value, category: category.value, favorite: fav.value === 'fav' ? 1 : '' });
  } catch (e) {
    toastError(e);
  }
}
onActivated(load);
watch([q, category, fav], () => {
  clearTimeout(timer);
  timer = setTimeout(load, 180);
});

async function toggleFav(s) {
  haptic('light');
  try {
    Object.assign(s, await api.put(`/solutions/${s.id}`, { favorite: s.favorite ? 0 : 1 }));
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <NavBar title="Base technique" large back="/plus" :refresh="load" subtitle="Votre bibliothèque de dépannage">
      <router-link to="/base/nouveau" class="nav-icon filled" aria-label="Nouvelle solution"><Plus :size="20" :stroke-width="2.6" /></router-link>
    </NavBar>
    <div class="vstack" style="gap: 10px">
      <SearchField v-model="q" placeholder="Symptôme, panne, cause, solution" />
      <Segmented v-model="fav" :options="[{ value: 'all', label: 'Toutes' }, { value: 'fav', label: 'Favoris', icon: Star }]" />
      <ChipSelect v-model="category" :options="KNOWLEDGE_CATEGORIES" allow-empty scroll />
    </div>
    <Skeleton v-if="!list" :rows="5" />
    <ListGroup v-else-if="list.length">
      <ListRow v-for="s in list" :key="s.id" :to="`/base/${s.id}`" :thumb="s.photo || null" :thumb-icon="BookOpen" :chevron="false">
        <div class="cell-title">{{ s.title }}</div>
        <div class="cell-sub">{{ [s.category, s.symptoms || s.cause || s.solution].filter(Boolean).join(' · ') }}</div>
        <template #trailing>
          <button class="nav-icon" style="background: none" :aria-label="s.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'" @click.prevent.stop="toggleFav(s)">
            <Star :size="22" :stroke-width="2" :fill="s.favorite ? 'var(--yellow)' : 'none'" :color="s.favorite ? 'var(--yellow)' : 'var(--label-3)'" />
          </button>
        </template>
      </ListRow>
    </ListGroup>
    <EmptyState v-else :icon="BookOpen" :title="q ? 'Aucun résultat' : 'Bibliothèque vide'" :text="q ? 'Essayez un autre mot-clé.' : 'Chaque panne résolue peut devenir une fiche. Depuis une réparation : « Ajouter à la base technique ».'">
      <router-link v-if="!q" to="/base/nouveau" class="btn filled">Nouvelle solution</router-link>
    </EmptyState>
  </div>
</template>
