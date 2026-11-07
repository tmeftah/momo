<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Cable, Wrench } from 'lucide-vue-next';
import { api } from '../api.js';
import { fmtDate } from '../store.js';
import { toast, toastError, confirmAction } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import PhotoGallery from '../components/PhotoGallery.vue';
import Skeleton from '../components/Skeleton.vue';

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
  if (!(await confirmAction('', { title: 'Supprimer cette adaptation ?', confirm: 'Supprimer' }))) return;
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
    <NavBar :reveal-at="44" :title="a?.title || ''" back="/connecteurs">
      <router-link :to="`/adaptations/${id}/modifier`" class="nav-btn">Modifier</router-link>
    </NavBar>
    <Skeleton v-if="!a" :rows="3" />
    <template v-else>
      <h1 class="title1" style="margin: 4px 0 2px">{{ a.title }}</h1>
      <div class="subhead secondary">{{ fmtDate(a.created_at) }}</div>

      <ListGroup v-if="a.connector_id || a.repair_id">
        <ListRow v-if="a.connector_id" :to="`/connecteurs/${a.connector_id}`" :icon="Cable" tile="purple" title="Connecteur" :value="a.connector_name" />
        <ListRow v-if="a.repair_id" :to="`/reparations/${a.repair_id}`" :icon="Wrench" tile="blue" title="Réparation" :value="`#${a.repair_id}`" />
      </ListGroup>

      <PhotoGallery ref-type="adaptation" :ref-id="id" :tags="TAGS" />

      <ListGroup v-if="a.problem" header="Problème"><div class="cell text-cell">{{ a.problem }}</div></ListGroup>
      <ListGroup v-if="a.pinout" header="Brochage"><div class="cell code-cell">{{ a.pinout }}</div></ListGroup>
      <ListGroup v-if="a.solution" header="Solution"><div class="cell text-cell">{{ a.solution }}</div></ListGroup>
      <ListGroup v-if="a.notes" header="Notes"><div class="cell text-cell">{{ a.notes }}</div></ListGroup>
      <ListGroup>
        <ListRow title="Supprimer l'adaptation" destructive @click="remove" />
      </ListGroup>
    </template>
  </div>
</template>
