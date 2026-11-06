<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import {
  VEHICLE_TYPES, REPAIR_STATUSES, PRIORITIES, REPAIR_CATEGORIES,
  ELECTRONIC_INTERVENTIONS, BATTERY_INTERVENTIONS, BATTERY_KINDS, CELL_TYPES,
} from '../constants.js';
import { toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ChipSelect from '../components/ChipSelect.vue';
import ClientPicker from '../components/ClientPicker.vue';
import CellGroups from '../components/CellGroups.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const busy = ref(false);

const emptyDetails = () => ({
  // battery
  battery_kind: 'vehicule', capacity_ah: '', config_s: '', config_p: '', cell_type: '18650', groups_count: '', groups: [],
  bms: '', voltage_before: '', voltage_after: '', capacity_measured: '', internal_resistance: '', test_result: '',
  // battery + electronic
  interventions: [],
  // electronic
  original_system: '', new_system: '', modification: '',
  // charger adaptation
  old_connector: '', new_connector: '', charger_voltage: '', charger_current: '', polarity: '', wiring: '', solution: '',
});

const form = reactive({
  category: route.query.category || 'general',
  client_id: route.query.client_id ? Number(route.query.client_id) : null,
  vehicle_type: route.query.category === 'batterie' ? 'batterie' : 'velo',
  brand: '', model: '', voltage: '', serial: '',
  problem: '', diagnosis: '', work_done: '',
  labor: 0, status: 'en_attente', priority: 'normal', due_date: '', notes: '',
  details: emptyDetails(),
});

const isBattery = computed(() => form.category === 'batterie');
const interventionOptions = computed(() => (isBattery.value ? BATTERY_INTERVENTIONS : ELECTRONIC_INTERVENTIONS));
const vehicleOptions = computed(() =>
  VEHICLE_TYPES.filter((v) => (isBattery.value ? ['batterie', 'outil', 'velo', 'trottinette', 'scooter'].includes(v.value) : true)).map((v) => ({ value: v.value, label: v.short, icon: v.icon }))
);

onMounted(async () => {
  if (!id) return;
  try {
    const r = await api.get(`/repairs/${id}`);
    for (const k of Object.keys(form)) if (k !== 'details' && r[k] !== undefined && r[k] !== null) form[k] = r[k];
    form.details = { ...emptyDetails(), ...(r.details || {}) };
  } catch (e) {
    toastError(e);
  }
});

// Number of groups defaults to the series count (13S → 13 groups)
watch(() => form.details.config_s, (s) => {
  if (s && !form.details.groups_count) form.details.groups_count = s;
});
watch(() => form.details.battery_kind, (k) => {
  if (k === 'outil' && form.vehicle_type === 'batterie') form.vehicle_type = 'outil';
});

function toggleIntervention(i) {
  const list = form.details.interventions;
  const idx = list.indexOf(i);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(i);
}

function cleanDetails() {
  const out = {};
  for (const [k, v] of Object.entries(form.details)) {
    if (v === '' || v === null || (Array.isArray(v) && !v.length)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

async function save() {
  busy.value = true;
  try {
    const body = { ...form, details: cleanDetails() };
    const r = id ? await api.put(`/repairs/${id}`, body) : await api.post('/repairs', body);
    toast(id ? 'Réparation enregistrée' : 'Réparation créée — ajoutez pièces et photos');
    router.replace(`/reparations/${r.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="id ? `Modifier #${id}` : isBattery ? 'Nouvelle intervention batterie' : 'Nouvelle réparation'" back />
    <form class="stack" @submit.prevent="save">
      <div class="field">
        <span>Type d'intervention</span>
        <ChipSelect v-model="form.category" :options="REPAIR_CATEGORIES" big />
      </div>

      <ClientPicker v-model="form.client_id" optional />

      <div class="field">
        <span>{{ isBattery ? 'Batterie de' : 'Type de véhicule' }}</span>
        <ChipSelect v-model="form.vehicle_type" :options="vehicleOptions" />
      </div>
      <div class="grid-2">
        <label class="field"><span>Marque</span><input v-model="form.brand" placeholder="ex : Xiaomi, Bosch, Makita" /></label>
        <label class="field"><span>Modèle</span><input v-model="form.model" /></label>
        <label class="field"><span>Tension</span><input v-model="form.voltage" placeholder="ex : 36V" /></label>
        <label class="field"><span>N° de série (facultatif)</span><input v-model="form.serial" /></label>
      </div>

      <label class="field"><span>Problème déclaré par le client</span><textarea v-model="form.problem" /></label>

      <!-- Lithium battery -->
      <div v-if="isBattery" class="card stack">
        <div class="card-title">🔋 Informations batterie</div>
        <ChipSelect v-model="form.details.battery_kind" :options="BATTERY_KINDS" />
        <div class="grid-3">
          <label class="field"><span>Capacité (Ah)</span><input v-model="form.details.capacity_ah" type="number" step="0.1" inputmode="decimal" /></label>
          <label class="field"><span>Série (S)</span><input v-model.number="form.details.config_s" type="number" min="1" inputmode="numeric" /></label>
          <label class="field"><span>Parallèle (P)</span><input v-model.number="form.details.config_p" type="number" min="1" inputmode="numeric" /></label>
        </div>
        <div class="field"><span>Type de cellules</span><ChipSelect v-model="form.details.cell_type" :options="CELL_TYPES" /></div>
        <div class="grid-2">
          <label class="field"><span>Nombre de groupes</span><input v-model.number="form.details.groups_count" type="number" min="0" max="40" inputmode="numeric" /></label>
          <label class="field"><span>BMS</span><input v-model="form.details.bms" placeholder="ex : 13S 20A commun" /></label>
        </div>
        <template v-if="Number(form.details.groups_count) > 0">
          <div class="label">Mesure de chaque groupe (V)</div>
          <CellGroups v-model="form.details.groups" :count="Math.min(Number(form.details.groups_count), 40)" />
        </template>
        <div class="grid-2">
          <label class="field"><span>Tension avant (V)</span><input v-model="form.details.voltage_before" type="number" step="0.01" inputmode="decimal" /></label>
          <label class="field"><span>Tension après (V)</span><input v-model="form.details.voltage_after" type="number" step="0.01" inputmode="decimal" /></label>
          <label class="field"><span>Capacité mesurée (Ah)</span><input v-model="form.details.capacity_measured" type="number" step="0.01" inputmode="decimal" /></label>
          <label class="field"><span>Résistance int. (mΩ)</span><input v-model="form.details.internal_resistance" type="number" step="0.1" inputmode="decimal" /></label>
        </div>
        <label class="field"><span>Résultat des tests</span><textarea v-model="form.details.test_result" /></label>
      </div>

      <!-- Interventions (battery / electronic) -->
      <div v-if="isBattery || form.category === 'electronique'" class="field">
        <span>Interventions réalisées</span>
        <div class="check-list">
          <label v-for="i in interventionOptions" :key="i" class="check" :class="{ on: form.details.interventions.includes(i) }">
            <input type="checkbox" :checked="form.details.interventions.includes(i)" @change="toggleIntervention(i)" /> {{ i }}
          </label>
        </div>
      </div>

      <!-- Electronic -->
      <div v-if="form.category === 'electronique'" class="card stack">
        <div class="card-title">⚡ Modification électronique</div>
        <label class="field"><span>Système d'origine (état)</span><textarea v-model="form.details.original_system" placeholder="ex : Contrôleur d'origine HS, plus disponible. Batterie et écran OK." /></label>
        <label class="field"><span>Nouveau système / pièces de remplacement</span><textarea v-model="form.details.new_system" placeholder="ex : Kit contrôleur 36V 15A sinus + écran LCD3 générique" /></label>
        <label class="field"><span>Modification réalisée / câblage</span><textarea v-model="form.details.modification" class="mono" placeholder="Correspondance des fils, soudures, adaptations…" /></label>
      </div>

      <!-- Charger adaptation -->
      <div v-if="form.category === 'chargeur'" class="card stack">
        <div class="card-title">🔌 Adaptation chargeur</div>
        <div class="grid-2">
          <label class="field"><span>Ancien connecteur</span><input v-model="form.details.old_connector" placeholder="ex : DC 5.5×2.1" /></label>
          <label class="field"><span>Nouveau connecteur</span><input v-model="form.details.new_connector" placeholder="ex : GX16 3 pins" /></label>
          <label class="field"><span>Tension chargeur</span><input v-model="form.details.charger_voltage" placeholder="ex : 42V" /></label>
          <label class="field"><span>Courant</span><input v-model="form.details.charger_current" placeholder="ex : 2A" /></label>
        </div>
        <label class="field"><span>Polarité</span><input v-model="form.details.polarity" placeholder="ex : + centre / pin 1 = +" /></label>
        <label class="field"><span>Câblage</span><textarea v-model="form.details.wiring" class="mono" placeholder="Rouge → pin 1 (+)&#10;Noir → pin 2 (−)" /></label>
        <label class="field"><span>Solution utilisée</span><textarea v-model="form.details.solution" /></label>
      </div>

      <label class="field"><span>Diagnostic</span><textarea v-model="form.diagnosis" /></label>
      <label class="field"><span>Travail effectué</span><textarea v-model="form.work_done" /></label>

      <label class="field"><span>Main-d'œuvre</span><input v-model.number="form.labor" type="number" step="0.01" min="0" inputmode="decimal" /></label>
      <p class="tiny muted" style="margin: -4px 0 0">Les pièces s'ajoutent depuis la fiche (le stock est déduit automatiquement). Prix total = pièces + main-d'œuvre.</p>

      <div class="field"><span>Statut</span><ChipSelect v-model="form.status" :options="REPAIR_STATUSES" /></div>
      <div class="field"><span>Priorité</span><ChipSelect v-model="form.priority" :options="PRIORITIES" /></div>
      <label class="field"><span>Date prévue (facultatif)</span><input v-model="form.due_date" type="date" /></label>
      <label class="field"><span>Notes internes</span><textarea v-model="form.notes" /></label>

      <button class="btn btn-primary btn-lg" :disabled="busy">💾 Enregistrer</button>
    </form>
  </div>
</template>
