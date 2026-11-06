<script setup>
import { reactive, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { VEHICLE_TYPES, PRIORITIES } from '../constants.js';
import { settings, money, toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ChipSelect from '../components/ChipSelect.vue';
import ClientPicker from '../components/ClientPicker.vue';

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
const durations = [15, 30, 45, 60, 90, 120];

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
    <PageHeader :title="id ? `Modifier diagnostic #${id}` : 'Nouveau diagnostic'" back />
    <form class="stack" @submit.prevent="save">
      <ClientPicker v-model="form.client_id" optional />
      <div class="field">
        <span>Véhicule</span>
        <ChipSelect v-model="form.vehicle_type" :options="VEHICLE_TYPES.map((v) => ({ value: v.value, label: v.short, icon: v.icon }))" />
      </div>
      <div class="grid-2">
        <label class="field"><span>Marque</span><input v-model="form.brand" /></label>
        <label class="field"><span>Modèle</span><input v-model="form.model" /></label>
        <label class="field"><span>Tension</span><input v-model="form.voltage" placeholder="ex : 48V" /></label>
        <label class="field"><span>N° de série</span><input v-model="form.serial" /></label>
      </div>
      <label class="field"><span>Symptômes</span><textarea v-model="form.symptoms" placeholder="Ce que décrit le client / ce que vous constatez" /></label>
      <label class="field"><span>Tests réalisés</span><textarea v-model="form.tests" placeholder="ex : test batterie à vide, test Hall, continuité câble moteur…" /></label>
      <label class="field"><span>Mesures</span><textarea v-model="form.measurements" class="mono" placeholder="ex : Batterie 38,2V · Hall A/B/C 0-5V OK · Phase-phase 0,3Ω" /></label>
      <label class="field"><span>Panne trouvée</span><textarea v-model="form.fault_found" /></label>
      <label class="field"><span>Solution proposée</span><textarea v-model="form.proposed_solution" placeholder="Pièces, prix estimé, délai…" /></label>

      <div class="field">
        <span>Temps de diagnostic</span>
        <div class="chips">
          <button v-for="m in durations" :key="m" type="button" class="chip" :class="{ active: form.duration_min === m }" @click="form.duration_min = m">{{ m < 60 ? m + ' min' : m / 60 + ' h' }}</button>
        </div>
        <div class="input-suffix"><input v-model.number="form.duration_min" type="number" min="0" inputmode="numeric" /><em>min</em></div>
      </div>
      <label class="field">
        <span>Prix du diagnostic <template v-if="rate()">(tarif {{ money(rate()) }}/h)</template></span>
        <input v-model.number="form.price" type="number" step="0.01" min="0" inputmode="decimal" @input="priceTouched = true" />
      </label>
      <div class="field"><span>Priorité</span><ChipSelect v-model="form.priority" :options="PRIORITIES" /></div>
      <label class="field"><span>Notes</span><textarea v-model="form.notes" /></label>
      <button class="btn btn-primary btn-lg" :disabled="busy">💾 Enregistrer</button>
    </form>
  </div>
</template>
