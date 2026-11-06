<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, fileUrl } from '../api.js';
import { WIRE_COLORS } from '../constants.js';
import { fmtDate, toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import PhotoGallery from '../components/PhotoGallery.vue';

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
  if (!confirm(`Supprimer « ${c.value.name} » ? Les adaptations liées sont conservées.`)) return;
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
    <PageHeader :title="c?.name || 'Connecteur'" back="/connecteurs">
      <router-link :to="`/connecteurs/${id}/modifier`" class="btn btn-sm">✏️</router-link>
    </PageHeader>
    <div v-if="c" class="stack">
      <PhotoGallery ref-type="connector" :ref-id="id" :tags="TAGS" />
      <div class="card">
        <dl class="kv" style="margin: 0">
          <template v-if="c.type"><dt>Type</dt><dd>{{ c.type }}</dd></template>
          <template v-if="c.application"><dt>Application</dt><dd>{{ c.application }}</dd></template>
          <template v-if="c.pins"><dt>Pins</dt><dd>{{ c.pins }}</dd></template>
        </dl>
      </div>

      <div v-if="c.wires?.length" class="card">
        <div class="card-title">Brochage</div>
        <table class="table">
          <thead><tr><th>Pin</th><th>Fil</th><th>Fonction</th></tr></thead>
          <tbody>
            <tr v-for="(w, i) in c.wires" :key="i">
              <td class="strong">{{ w.pin || i + 1 }}</td>
              <td><div class="row" style="gap: 6px"><span class="wire-swatch" :style="{ background: colorCss[w.color] || 'transparent' }" />{{ w.color }}</div></td>
              <td>{{ w.function }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="c.wiring" class="card"><div class="card-title">Schéma de câblage</div><div class="block-text mono small">{{ c.wiring }}</div></div>
      <div v-if="c.notes" class="card"><div class="card-title">Notes</div><div class="pre">{{ c.notes }}</div></div>

      <div class="section-title row between">
        <span>Adaptations réalisées</span>
        <router-link :to="`/adaptations/nouvelle?connector_id=${id}`" class="small">➕ Ajouter</router-link>
      </div>
      <div class="list">
        <router-link v-for="a in c.adaptations" :key="a.id" :to="`/adaptations/${a.id}`" class="list-item">
          <img v-if="a.photo" class="thumb" :src="fileUrl(a.photo)" alt="" />
          <div v-else class="thumb">🛠️</div>
          <div class="grow">
            <div class="title ellipsis">{{ a.title }}</div>
            <div class="sub">{{ fmtDate(a.created_at) }}</div>
          </div>
        </router-link>
        <div v-if="!c.adaptations.length" class="empty small">Aucune adaptation enregistrée</div>
      </div>
      <button class="btn btn-danger" style="margin-top: 16px" @click="remove">Supprimer le connecteur</button>
    </div>
  </div>
</template>
