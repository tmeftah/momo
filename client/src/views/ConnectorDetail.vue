<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Cable, Plus, PlugZap } from 'lucide-vue-next';
import { api } from '../api.js';
import { WIRE_COLORS } from '../constants.js';
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
const c = ref(null);
const colorCss = Object.fromEntries(WIRE_COLORS.map((x) => [x.value, x.css]));
const TAGS = [
  { value: 'photo', label: 'Photo' },
  { value: 'schema', label: 'Schéma' },
  { value: 'adaptation', label: 'Adaptation' },
];

onMounted(async () => {
  try {
    c.value = await api.get(`/connectors/${id}`);
  } catch (e) {
    toastError(e);
  }
});

async function remove() {
  if (!(await confirmAction('Les adaptations liées sont conservées.', { title: `Supprimer « ${c.value.name} » ?`, confirm: 'Supprimer le connecteur' }))) return;
  try {
    await api.del(`/connectors/${id}`);
    toast('Connecteur supprimé');
    router.replace('/connecteurs');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <NavBar :reveal-at="160" :title="c?.name || ''" back="/connecteurs">
      <router-link :to="`/connecteurs/${id}/modifier`" class="nav-btn">Modifier</router-link>
    </NavBar>
    <Skeleton v-if="!c" :rows="4" />
    <template v-else>
      <div class="hero">
        <span class="tile xl bg-purple"><Cable :size="36" :stroke-width="1.8" /></span>
        <div class="hero-title">{{ c.name }}</div>
        <div class="hero-sub">{{ [c.application, c.pins ? `${c.pins} pins` : '', c.type].filter(Boolean).join(' · ') }}</div>
      </div>

      <PhotoGallery ref-type="connector" :ref-id="id" :tags="TAGS" />

      <ListGroup v-if="c.wires?.length" header="Brochage">
        <div v-for="(w, i) in c.wires" :key="i" class="cell" style="gap: 10px">
          <span class="tile soft bold num" style="width: 28px; height: 28px; border-radius: 14px; font-size: 13px; color: var(--label)">{{ w.pin || i + 1 }}</span>
          <span class="wire-dot" :style="{ background: colorCss[w.color] || 'transparent' }" :class="{ empty: !w.color }" />
          <div class="cell-main"><div class="cell-title wrap">{{ w.function || '—' }}</div><div class="cell-sub">{{ w.color || 'couleur non renseignée' }}</div></div>
        </div>
      </ListGroup>

      <ListGroup v-if="c.wiring" header="Schéma de câblage"><div class="cell code-cell">{{ c.wiring }}</div></ListGroup>
      <ListGroup v-if="c.notes" header="Notes"><div class="cell text-cell">{{ c.notes }}</div></ListGroup>

      <ListGroup header="Adaptations réalisées">
        <ListRow v-for="a in c.adaptations" :key="a.id" :to="`/adaptations/${a.id}`" :thumb="a.photo || null" :thumb-icon="PlugZap" :title="a.title" :subtitle="fmtDate(a.created_at)" />
        <ListRow :to="`/adaptations/nouvelle?connector_id=${id}`" :icon="Plus" tile="accent" title="Nouvelle adaptation" action />
      </ListGroup>

      <ListGroup>
        <ListRow title="Supprimer le connecteur" destructive @click="remove" />
      </ListGroup>
    </template>
  </div>
</template>
