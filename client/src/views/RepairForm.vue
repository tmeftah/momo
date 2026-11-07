<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import {
  VEHICLE_TYPES, REPAIR_STATUSES, PRIORITIES, REPAIR_CATEGORIES,
  ELECTRONIC_INTERVENTIONS, BATTERY_INTERVENTIONS, BATTERY_KINDS, CELL_TYPES,
} from '../constants.js';
import { settings } from '../store.js';
import { toast, toastError, haptic } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import ClientPicker from '../components/ClientPicker.vue';
import PickerRow from '../components/PickerRow.vue';
import Segmented from '../components/Segmented.vue';
import CellGroups from '../components/CellGroups.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const busy = ref(false);

const emptyDetails = () => ({
  battery_kind: 'vehicule', capacity_ah: '', config_s: '', config_p: '', cell_type: '18650', groups_count: '', groups: [],
  bms: '', voltage_before: '', voltage_after: '', capacity_measured: '', internal_resistance: '', test_result: '',
  interventions: [],
  original_system: '', new_system: '', modification: '',
  old_connector: '', new_connector: '', charger_voltage: '', charger_current: '', polarity: '', wiring: '', solution: '',
});

const form = reactive({
  category: route.query.category || 'general',
  client_id: route.query.client_id ? Number(route.query.client_id) : null,
  vehicle_type: route.query.category === 'batterie' ? 'batterie' : 'velo',
  brand: '', model: '', voltage: '', serial: '',
  problem: '', diagnosis: '', work_done: '',
  labor: '', status: 'en_attente', priority: 'normal', due_date: '', notes: '',
  details: emptyDetails(),
});

const isBattery = computed(() => form.category === 'batterie');
const interventionOptions = computed(() => (isBattery.value ? BATTERY_INTERVENTIONS : ELECTRONIC_INTERVENTIONS));
const vehicleOptions = computed(() => VEHICLE_TYPES.filter((v) => !isBattery.value || v.value !== 'autre'));
const title = computed(() => (id ? `Modifier #${id}` : isBattery.value ? 'Nouvelle batterie' : 'Nouvelle réparation'));

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

// 13S → 13 groups by default
watch(() => form.details.config_s, (s) => {
  if (s && !form.details.groups_count) form.details.groups_count = s;
});
watch(() => form.details.battery_kind, (k) => {
  if (k === 'outil' && form.vehicle_type === 'batterie') form.vehicle_type = 'outil';
});

function setCategory(c) {
  haptic('light');
  form.category = c;
  if (c === 'batterie' && !['batterie', 'outil'].includes(form.vehicle_type) && !id) form.vehicle_type = 'batterie';
}
function setVehicle(v) {
  haptic('light');
  form.vehicle_type = v;
}
function toggleIntervention(i) {
  haptic('light');
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
  if (busy.value) return;
  busy.value = true;
  try {
    const body = { ...form, labor: Number(form.labor) || 0, details: cleanDetails() };
    const r = id ? await api.put(`/repairs/${id}`, body) : await api.post('/repairs', body);
    toast(id ? 'Réparation enregistrée' : 'Réparation créée');
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
    <NavBar :reveal-at="44" :title="title" back>
      <button class="nav-btn" :disabled="busy" @click="save">OK</button>
    </NavBar>
    <h1 class="title1" style="margin: 4px 0 2px">{{ title }}</h1>

    <form @submit.prevent="save">
      <div class="lg-header mt">Type d'intervention</div>
      <div class="options two">
        <button v-for="c in REPAIR_CATEGORIES" :key="c.value" type="button" class="option row" :class="{ on: form.category === c.value }" @click="setCategory(c.value)">
          <span class="tile" :class="`bg-${c.color}`"><component :is="c.icon" :size="18" :stroke-width="2.2" /></span>{{ c.label }}
        </button>
      </div>

      <ListGroup header="Client">
        <ClientPicker v-model="form.client_id" optional />
      </ListGroup>

      <div class="lg-header mt">{{ isBattery ? 'Batterie de' : 'Véhicule' }}</div>
      <div class="options" style="grid-template-columns: repeat(3, minmax(0, 1fr))">
        <button v-for="v in vehicleOptions" :key="v.value" type="button" class="option" :class="{ on: form.vehicle_type === v.value }" @click="setVehicle(v.value)">
          <span class="o-icon">{{ v.emoji }}</span>{{ v.short }}
        </button>
      </div>
      <ListGroup>
        <label class="cell field"><span class="field-label">Marque</span><input v-model="form.brand" placeholder="Xiaomi, Bosch…" /></label>
        <label class="cell field"><span class="field-label">Modèle</span><input v-model="form.model" placeholder="—" /></label>
        <label class="cell field"><span class="field-label">Tension</span><input v-model="form.voltage" placeholder="36V" /></label>
        <label class="cell field"><span class="field-label">N° de série</span><input v-model="form.serial" placeholder="Facultatif" /></label>
      </ListGroup>

      <ListGroup header="Problème déclaré par le client">
        <label class="cell field stacked"><textarea v-model="form.problem" placeholder="Ce que décrit le client…" /></label>
      </ListGroup>

      <!-- Lithium battery -->
      <template v-if="isBattery">
        <ListGroup header="Batterie">
          <div class="cell"><Segmented v-model="form.details.battery_kind" :options="BATTERY_KINDS" style="width: 100%" /></div>
          <label class="cell field"><span class="field-label">Capacité</span><input v-model="form.details.capacity_ah" type="number" step="0.1" inputmode="decimal" placeholder="—" /><span class="unit">Ah</span></label>
          <label class="cell field"><span class="field-label">Série</span><input v-model.number="form.details.config_s" type="number" min="1" inputmode="numeric" placeholder="—" /><span class="unit">S</span></label>
          <label class="cell field"><span class="field-label">Parallèle</span><input v-model.number="form.details.config_p" type="number" min="1" inputmode="numeric" placeholder="—" /><span class="unit">P</span></label>
          <PickerRow v-model="form.details.cell_type" label="Cellules" :options="CELL_TYPES" />
          <label class="cell field"><span class="field-label">Groupes</span><input v-model.number="form.details.groups_count" type="number" min="0" max="40" inputmode="numeric" placeholder="—" /></label>
          <label class="cell field"><span class="field-label">BMS</span><input v-model="form.details.bms" placeholder="13S 20A…" /></label>
        </ListGroup>
        <ListGroup v-if="Number(form.details.groups_count) > 0" header="Tension de chaque groupe (V)" footer="Les groupes qui s'écartent de la médiane sont signalés en couleur.">
          <CellGroups v-model="form.details.groups" :count="Math.min(Number(form.details.groups_count), 40)" />
        </ListGroup>
        <ListGroup header="Tests">
          <label class="cell field"><span class="field-label">Tension avant</span><input v-model="form.details.voltage_before" type="number" step="0.01" inputmode="decimal" placeholder="—" /><span class="unit">V</span></label>
          <label class="cell field"><span class="field-label">Tension après</span><input v-model="form.details.voltage_after" type="number" step="0.01" inputmode="decimal" placeholder="—" /><span class="unit">V</span></label>
          <label class="cell field"><span class="field-label">Capacité mesurée</span><input v-model="form.details.capacity_measured" type="number" step="0.01" inputmode="decimal" placeholder="—" /><span class="unit">Ah</span></label>
          <label class="cell field"><span class="field-label">Résistance int.</span><input v-model="form.details.internal_resistance" type="number" step="0.1" inputmode="decimal" placeholder="—" /><span class="unit">mΩ</span></label>
          <label class="cell field stacked"><span class="field-label">Résultat des tests</span><textarea v-model="form.details.test_result" placeholder="Conclusions…" /></label>
        </ListGroup>
      </template>

      <ListGroup v-if="isBattery || form.category === 'electronique'" header="Interventions réalisées">
        <ListRow v-for="i in interventionOptions" :key="i" :title="i" :selected="form.details.interventions.includes(i)" wrap @click="toggleIntervention(i)" />
      </ListGroup>

      <ListGroup v-if="form.category === 'electronique'" header="Modification électronique">
        <label class="cell field stacked"><span class="field-label">Système d'origine</span><textarea v-model="form.details.original_system" placeholder="ex : contrôleur d'origine HS et introuvable, batterie et écran OK" /></label>
        <label class="cell field stacked"><span class="field-label">Nouveau système</span><textarea v-model="form.details.new_system" placeholder="ex : kit contrôleur 36V 15A + écran LCD3 générique" /></label>
        <label class="cell field stacked"><span class="field-label">Câblage / modification</span><textarea v-model="form.details.modification" class="mono" placeholder="Correspondance des fils, soudures…" /></label>
      </ListGroup>

      <ListGroup v-if="form.category === 'chargeur'" header="Adaptation chargeur">
        <label class="cell field"><span class="field-label">Ancien connecteur</span><input v-model="form.details.old_connector" placeholder="DC 5.5×2.1" /></label>
        <label class="cell field"><span class="field-label">Nouveau connecteur</span><input v-model="form.details.new_connector" placeholder="GX16 3 pins" /></label>
        <label class="cell field"><span class="field-label">Tension</span><input v-model="form.details.charger_voltage" placeholder="42V" /></label>
        <label class="cell field"><span class="field-label">Courant</span><input v-model="form.details.charger_current" placeholder="2A" /></label>
        <label class="cell field"><span class="field-label">Polarité</span><input v-model="form.details.polarity" placeholder="+ au centre" /></label>
        <label class="cell field stacked"><span class="field-label">Câblage</span><textarea v-model="form.details.wiring" class="mono" placeholder="Rouge → pin 1 (+)&#10;Noir → pin 2 (−)" /></label>
        <label class="cell field stacked"><span class="field-label">Solution utilisée</span><textarea v-model="form.details.solution" /></label>
      </ListGroup>

      <ListGroup header="Atelier" footer="Les pièces s'ajoutent depuis la fiche : le stock est déduit automatiquement. Total = pièces + main-d'œuvre.">
        <label class="cell field stacked"><span class="field-label">Diagnostic</span><textarea v-model="form.diagnosis" placeholder="Panne constatée…" /></label>
        <label class="cell field stacked"><span class="field-label">Travail effectué</span><textarea v-model="form.work_done" placeholder="Ce qui a été fait…" /></label>
        <label class="cell field"><span class="field-label">Main-d'œuvre</span><input v-model="form.labor" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0" /><span class="unit">{{ settings.currency }}</span></label>
      </ListGroup>

      <ListGroup header="Suivi">
        <PickerRow v-model="form.status" label="Statut" :options="REPAIR_STATUSES" />
        <div class="cell"><span class="cell-main cell-title">Priorité</span><Segmented v-model="form.priority" :options="PRIORITIES" style="width: 250px" /></div>
        <label class="cell field"><span class="field-label">Date prévue</span><input v-model="form.due_date" type="date" /></label>
        <label class="cell field stacked"><span class="field-label">Notes internes</span><textarea v-model="form.notes" placeholder="Visible uniquement par vous" /></label>
      </ListGroup>

      <button class="btn filled lg block mt" :disabled="busy">{{ id ? 'Enregistrer' : 'Créer la réparation' }}</button>
    </form>
  </div>
</template>
