<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { toast, toastError, vehicleLabel } from '../store.js';
import PageHeader from '../components/PageHeader.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const busy = ref(false);
const connectors = ref([]);
const form = reactive({
  title: '', connector_id: route.query.connector_id ? Number(route.query.connector_id) : null,
  repair_id: route.query.repair_id ? Number(route.query.repair_id) : null,
  problem: '', pinout: '', solution: '', notes: '',
});

onMounted(async () => {
  connectors.value = await api.get('/connectors').catch(() => []);
  try {
    if (id) Object.assign(form, await api.get(`/adaptations/${id}`));
    else if (form.repair_id) {
      // Prefill from the repair (charger adaptation / electronic work)
      const r = await api.get(`/repairs/${form.repair_id}`);
      const d = r.details || {};
      form.title = d.old_connector && d.new_connector ? `${d.old_connector} → ${d.new_connector} (${vehicleLabel(r).replace(/^\S+\s/, '')})` : `Adaptation ${vehicleLabel(r).replace(/^\S+\s/, '')}`;
      form.problem = [r.problem, d.original_system].filter(Boolean).join('\n');
      form.pinout = [d.wiring, d.modification, d.polarity && `Polarité : ${d.polarity}`].filter(Boolean).join('\n');
      form.solution = [d.solution, d.new_system, r.work_done].filter(Boolean).join('\n');
    }
  } catch (e) {
    toastError(e);
  }
});

async function save() {
  busy.value = true;
  try {
    const body = { ...form };
    delete body.connector_name;
    delete body.photo;
    const a = id ? await api.put(`/adaptations/${id}`, body) : await api.post('/adaptations', body);
    toast('Adaptation enregistrée — ajoutez les photos');
    router.replace(`/adaptations/${a.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="id ? 'Modifier l’adaptation' : 'Nouvelle adaptation'" back />
    <form class="stack" @submit.prevent="save">
      <label class="field"><span>Titre *</span><input v-model="form.title" required placeholder="ex : Câble écran 5 pins cassé → adaptation Julet" /></label>
      <label class="field">
        <span>Connecteur concerné</span>
        <select v-model="form.connector_id">
          <option :value="null">—</option>
          <option v-for="c in connectors" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label class="field"><span>Problème</span><textarea v-model="form.problem" placeholder="ex : Câble d'origine cassé, pièce de remplacement introuvable" /></label>
      <label class="field"><span>Brochage / correspondance des fils</span><textarea v-model="form.pinout" class="mono" rows="6" placeholder="Origine rouge (+)  → Nouveau pin 1 rouge&#10;Origine noir (−)  → Nouveau pin 2 noir" /></label>
      <label class="field"><span>Solution</span><textarea v-model="form.solution" /></label>
      <label class="field"><span>Notes</span><textarea v-model="form.notes" /></label>
      <p v-if="form.repair_id" class="tiny muted" style="margin: 0">Liée à la réparation #{{ form.repair_id }}</p>
      <button class="btn btn-primary btn-lg" :disabled="busy">💾 Enregistrer</button>
    </form>
  </div>
</template>
