<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { vehicleName } from '../store.js';
import { toast, toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import PickerRow from '../components/PickerRow.vue';

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
const connectorOptions = computed(() => connectors.value.map((c) => ({ value: c.id, label: c.name })));
const valid = computed(() => form.title.trim().length > 0);

onMounted(async () => {
  connectors.value = await api.get('/connectors').catch(() => []);
  try {
    if (id) {
      const a = await api.get(`/adaptations/${id}`);
      for (const k of Object.keys(form)) form[k] = a[k] ?? form[k];
    } else if (form.repair_id) {
      // Prefill from the repair (charger adaptation / electronic work)
      const r = await api.get(`/repairs/${form.repair_id}`);
      const d = r.details || {};
      form.title = d.old_connector && d.new_connector ? `${d.old_connector} → ${d.new_connector} (${vehicleName(r)})` : `Adaptation ${vehicleName(r)}`;
      form.problem = [r.problem, d.original_system].filter(Boolean).join('\n');
      form.pinout = [d.wiring, d.modification, d.polarity && `Polarité : ${d.polarity}`].filter(Boolean).join('\n');
      form.solution = [d.solution, d.new_system, r.work_done].filter(Boolean).join('\n');
    }
  } catch (e) {
    toastError(e);
  }
});

async function save() {
  if (!valid.value || busy.value) return;
  busy.value = true;
  try {
    const a = id ? await api.put(`/adaptations/${id}`, form) : await api.post('/adaptations', form);
    toast(id ? 'Adaptation enregistrée' : 'Adaptation créée — ajoutez les photos');
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
    <NavBar :reveal-at="44" :title="id ? 'Modifier' : 'Nouvelle adaptation'" back>
      <button class="nav-btn" :disabled="!valid || busy" @click="save">OK</button>
    </NavBar>
    <h1 class="title1" style="margin: 4px 0 2px">{{ id ? 'Modifier l’adaptation' : 'Nouvelle adaptation' }}</h1>
    <form @submit.prevent="save">
      <ListGroup :footer="form.repair_id ? `Liée à la réparation #${form.repair_id}` : ''">
        <label class="cell field stacked"><span class="field-label">Titre</span><input v-model="form.title" placeholder="ex : Câble écran 5 pins cassé → Julet" /></label>
        <PickerRow v-model="form.connector_id" label="Connecteur" :options="connectorOptions" allow-empty empty-label="Aucun" />
      </ListGroup>
      <ListGroup>
        <label class="cell field stacked"><span class="field-label">Problème</span><textarea v-model="form.problem" placeholder="ex : câble d'origine cassé, pièce introuvable" /></label>
        <label class="cell field stacked"><span class="field-label">Brochage / correspondance</span><textarea v-model="form.pinout" class="mono" placeholder="Origine rouge (+) → nouveau pin 1&#10;Origine noir (−) → nouveau pin 2" /></label>
        <label class="cell field stacked"><span class="field-label">Solution</span><textarea v-model="form.solution" /></label>
        <label class="cell field stacked"><span class="field-label">Notes</span><textarea v-model="form.notes" /></label>
      </ListGroup>
      <button class="btn filled lg block mt" :disabled="!valid || busy">{{ id ? 'Enregistrer' : 'Créer l’adaptation' }}</button>
    </form>
  </div>
</template>
