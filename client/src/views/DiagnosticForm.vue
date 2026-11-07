<script setup>
import { reactive, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { VEHICLE_TYPES, PRIORITIES } from '../constants.js';
import { settings, money } from '../store.js';
import { toast, toastError, haptic } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ClientPicker from '../components/ClientPicker.vue';
import Segmented from '../components/Segmented.vue';
import ChipSelect from '../components/ChipSelect.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const busy = ref(false);
const priceTouched = ref(!!id);

const form = reactive({
  client_id: route.query.client_id ? Number(route.query.client_id) : null,
  vehicle_type: 'velo', brand: '', model: '', voltage: '', serial: '',
  symptoms: '', tests: '', measurements: '', fault_found: '', proposed_solution: '',
  duration_min: 30, price: 0, priority: 'normal', notes: '',
});
const rate = () => Number(settings.diag_hourly_rate) || 0;
const durations = [15, 30, 45, 60, 90, 120].map((m) => ({ value: m, label: m < 60 ? `${m} min` : `${m / 60} h` }));

onMounted(async () => {
  if (!id) {
    if (rate()) form.price = Math.round((rate() * form.duration_min) / 60);
    return;
  }
  try {
    const d = await api.get(`/diagnostics/${id}`);
    for (const k of Object.keys(form)) if (d[k] !== null && d[k] !== undefined) form[k] = d[k];
  } catch (e) {
    toastError(e);
  }
});

// Price follows the time spent (hourly rate from settings) until edited by hand
watch(() => form.duration_min, (m) => {
  if (!priceTouched.value && rate()) form.price = Math.round((rate() * (Number(m) || 0)) / 60);
});

async function save() {
  if (busy.value) return;
  busy.value = true;
  try {
    const d = id ? await api.put(`/diagnostics/${id}`, form) : await api.post('/diagnostics', form);
    toast('Diagnostic enregistré');
    router.replace(`/diagnostics/${d.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <NavBar :reveal-at="44" :title="id ? `Diagnostic #${id}` : 'Nouveau diagnostic'" back>
      <button class="nav-btn" :disabled="busy" @click="save">OK</button>
    </NavBar>
    <h1 class="title1" style="margin: 4px 0 2px">{{ id ? 'Modifier le diagnostic' : 'Nouveau diagnostic' }}</h1>
    <form @submit.prevent="save">
      <ListGroup header="Client"><ClientPicker v-model="form.client_id" optional /></ListGroup>

      <div class="lg-header mt">Véhicule</div>
      <div class="options" style="grid-template-columns: repeat(3, minmax(0, 1fr))">
        <button v-for="v in VEHICLE_TYPES" :key="v.value" type="button" class="option" :class="{ on: form.vehicle_type === v.value }" @click="haptic(); form.vehicle_type = v.value">
          <component :is="v.icon" class="o-icon" :size="26" :stroke-width="1.8" />{{ v.short }}
        </button>
      </div>
      <ListGroup>
        <label class="cell field"><span class="field-label">Marque</span><input v-model="form.brand" placeholder="—" /></label>
        <label class="cell field"><span class="field-label">Modèle</span><input v-model="form.model" placeholder="—" /></label>
        <label class="cell field"><span class="field-label">Tension</span><input v-model="form.voltage" placeholder="48V" /></label>
        <label class="cell field"><span class="field-label">N° de série</span><input v-model="form.serial" placeholder="Facultatif" /></label>
      </ListGroup>

      <ListGroup header="Diagnostic">
        <label class="cell field stacked"><span class="field-label">Symptômes</span><textarea v-model="form.symptoms" placeholder="Ce que décrit le client / ce que vous constatez" /></label>
        <label class="cell field stacked"><span class="field-label">Tests réalisés</span><textarea v-model="form.tests" placeholder="Test batterie à vide, Hall, continuité câble moteur…" /></label>
        <label class="cell field stacked"><span class="field-label">Mesures</span><textarea v-model="form.measurements" class="mono" placeholder="Batterie 38,2V · Hall A/B/C OK · phase-phase 0,3Ω" /></label>
        <label class="cell field stacked"><span class="field-label">Panne trouvée</span><textarea v-model="form.fault_found" /></label>
        <label class="cell field stacked"><span class="field-label">Solution proposée</span><textarea v-model="form.proposed_solution" placeholder="Pièces, prix estimé, délai…" /></label>
      </ListGroup>

      <ListGroup header="Facturation" :footer="rate() ? `Tarif ${money(rate())}/h — le prix suit le temps tant que vous ne le modifiez pas.` : 'Définissez un tarif horaire dans Réglages pour calculer le prix automatiquement.'">
        <div class="cell" style="display: block; padding: 12px 16px"><ChipSelect v-model="form.duration_min" :options="durations" /></div>
        <label class="cell field"><span class="field-label">Temps passé</span><input v-model.number="form.duration_min" type="number" min="0" inputmode="numeric" /><span class="unit">min</span></label>
        <label class="cell field"><span class="field-label">Prix</span><input v-model.number="form.price" type="number" step="0.01" min="0" inputmode="decimal" @input="priceTouched = true" /><span class="unit">{{ settings.currency }}</span></label>
      </ListGroup>

      <ListGroup>
        <div class="cell"><span class="cell-main cell-title">Priorité</span><Segmented v-model="form.priority" :options="PRIORITIES" style="width: 250px" /></div>
        <label class="cell field stacked"><span class="field-label">Notes</span><textarea v-model="form.notes" /></label>
      </ListGroup>
      <button class="btn filled lg block mt" :disabled="busy">{{ id ? 'Enregistrer' : 'Créer le diagnostic' }}</button>
    </form>
  </div>
</template>
