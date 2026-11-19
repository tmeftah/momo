<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import {
  VEHICLE_TYPES, REPAIR_STATUSES, PRIORITIES, REPAIR_CATEGORIES,
  ELECTRONIC_INTERVENTIONS, BATTERY_INTERVENTIONS, BATTERY_KINDS, CELL_TYPES,
} from '../constants.js';
import { Plus } from 'lucide-vue-next';
import { settings, money, fmtNum } from '../store.js';
import { chargeLevel, checkPack, LIMITS } from '../battery.js';
import { toast, toastError, haptic, confirmAction, chooseAction } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import ClientPicker from '../components/ClientPicker.vue';
import PickerRow from '../components/PickerRow.vue';
import Segmented from '../components/Segmented.vue';
import CellGroups from '../components/CellGroups.vue';
import TaskPickerSheet from '../components/TaskPickerSheet.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const busy = ref(false);

const emptyDetails = () => ({
  battery_kind: 'vehicule', capacity_ah: '', config_s: '', config_p: '', cell_type: '18650', groups: [], groups_after: [],
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

// New repair only: catalog tasks picked up front (on an existing repair they are edited from its page)
const tasks = ref([]);
const pickingTasks = ref(false);
const tasksTotal = computed(() => tasks.value.reduce((s, t) => s + t.price, 0));
const addTask = (t) => tasks.value.push({ task_id: t.id, name: t.name, price: t.price });
const addFreeTask = (t) => tasks.value.push(t);
async function removeTask(i) {
  if (await confirmAction('', { title: `Retirer « ${tasks.value[i].name} » ?`, confirm: 'Retirer la prestation' })) tasks.value.splice(i, 1);
}

// Per-group voltages: `groups` holds the "before" measurement (older repairs only have that one)
const CELL_PHASES = [{ value: 'groups', label: 'Avant' }, { value: 'groups_after', label: 'Après' }];
const cellPhase = ref('groups');
// One group per series cell: the grid follows S
const groupCount = computed(() => {
  const s = Number(form.details.config_s);
  return Number.isInteger(s) && s >= LIMITS.s[0] && s <= LIMITS.s[1] ? s : 0;
});

// Live charge estimate under the pack voltages
const chargeHint = computed(() => {
  const d = form.details;
  const parts = [['avant', d.voltage_before], ['après', d.voltage_after]].filter(([, v]) => v !== '' && v !== null);
  if (!parts.length) return 'Tension mesurée au repos : la charge est estimée à partir de la série (S) et du type de cellule.';
  if (!(Number(d.config_s) > 0)) return 'Renseignez la série (S) pour estimer la charge.';
  const out = parts
    .map(([label, v]) => {
      const l = chargeLevel(v, d.config_s, d.cell_type);
      if (l) return `${label} ≈ ${l.pct} % (${fmtNum(l.perCell)} V par cellule)`;
      // Too high is reported as an error above; too low is a real case
      return Number(v) / Number(d.config_s) < 2 ? `${label} : pack à plat ou BMS en protection` : null;
    })
    .filter(Boolean);
  return out.length ? `Charge estimée : ${out.join(', ')}.` : '';
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
    // Older repairs stored a separate group count
    const { groups_count: g } = form.details;
    if (g && !form.details.config_s) form.details.config_s = g;
    delete form.details.groups_count;
  } catch (e) {
    toastError(e);
  }
});

// Impossible values block saving; unusual combinations ask for confirmation
const NO_ISSUES = { errors: [], warnings: [] };
const packCheck = computed(() => (isBattery.value ? checkPack(form.details, form.voltage) : NO_ISSUES));
const issues = (at) => [
  ...packCheck.value.errors.filter((m) => m.at === at).map((m) => ({ ...m, error: true })),
  ...packCheck.value.warnings.filter((m) => m.at === at),
];
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
    // Readings past S are left over from a larger S typed earlier
    out[k] = (k === 'groups' || k === 'groups_after') && groupCount.value ? v.slice(0, groupCount.value) : v;
  }
  return Object.keys(out).length ? out : null;
}

async function save() {
  if (busy.value) return;
  const { errors, warnings } = packCheck.value;
  if (errors.length) {
    haptic('error');
    return toastError(new Error(errors[0].text));
  }
  if (warnings.length) {
    const ok = await chooseAction({
      title: warnings.length > 1 ? `${warnings.length} valeurs inhabituelles` : 'Valeur inhabituelle',
      message: warnings.map((w) => w.text).join('\n'),
      actions: [{ label: 'Enregistrer quand même', value: true }],
      cancel: 'Corriger',
    });
    if (ok !== true) return;
  }
  busy.value = true;
  try {
    const body = { ...form, labor: Number(form.labor) || 0, details: cleanDetails() };
    if (!id) body.tasks = tasks.value;
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
          <component :is="v.icon" class="o-icon" :size="26" :stroke-width="1.8" />{{ v.short }}
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
          <label class="cell field"><span class="field-label">Capacité</span><input v-model="form.details.capacity_ah" type="number" step="0.1" :min="LIMITS.capacity[0]" :max="LIMITS.capacity[1]" inputmode="decimal" placeholder="—" /><span class="unit">Ah</span></label>
          <label class="cell field"><span class="field-label">Série</span><input v-model.number="form.details.config_s" type="number" step="1" :min="LIMITS.s[0]" :max="LIMITS.s[1]" inputmode="numeric" placeholder="—" /><span class="unit">S</span></label>
          <label class="cell field"><span class="field-label">Parallèle</span><input v-model.number="form.details.config_p" type="number" step="1" :min="LIMITS.p[0]" :max="LIMITS.p[1]" inputmode="numeric" placeholder="—" /><span class="unit">P</span></label>
          <PickerRow v-model="form.details.cell_type" label="Cellules" :options="CELL_TYPES" />
          <label class="cell field"><span class="field-label">BMS</span><input v-model="form.details.bms" placeholder="13S 20A…" /></label>
          <template v-if="issues('pack').length" #footer>
            <div v-for="m in issues('pack')" :key="m.text" class="issue" :class="m.error ? 'c-red' : 'c-orange'">{{ m.text }}</div>
          </template>
        </ListGroup>
        <ListGroup v-if="groupCount" header="Tension de chaque groupe (V)">
          <div class="cell"><Segmented v-model="cellPhase" :options="CELL_PHASES" style="width: 100%" /></div>
          <CellGroups
            :key="cellPhase" :model-value="form.details[cellPhase]" :count="groupCount"
            :compare="cellPhase === 'groups_after' ? form.details.groups : null"
            @update:model-value="(v) => (form.details[cellPhase] = v)"
          />
          <template #footer>
            <div v-for="m in issues('groups')" :key="m.text" class="issue" :class="m.error ? 'c-red' : 'c-orange'">{{ m.text }}</div>
            Mesurez avant l'intervention, puis après. Les groupes qui s'écartent de la médiane sont signalés en couleur.
          </template>
        </ListGroup>
        <ListGroup header="Tests">
          <label class="cell field"><span class="field-label">Tension avant</span><input v-model="form.details.voltage_before" type="number" step="0.01" min="0" inputmode="decimal" placeholder="—" /><span class="unit">V</span></label>
          <label class="cell field"><span class="field-label">Tension après</span><input v-model="form.details.voltage_after" type="number" step="0.01" min="0" inputmode="decimal" placeholder="—" /><span class="unit">V</span></label>
          <template #footer>
            <div v-for="m in issues('tests')" :key="m.text" class="issue" :class="m.error ? 'c-red' : 'c-orange'">{{ m.text }}</div>
            {{ chargeHint }}
          </template>
        </ListGroup>
        <ListGroup>
          <label class="cell field"><span class="field-label">Capacité mesurée</span><input v-model="form.details.capacity_measured" type="number" step="0.01" min="0" inputmode="decimal" placeholder="—" /><span class="unit">Ah</span></label>
          <label class="cell field"><span class="field-label">Résistance int.</span><input v-model="form.details.internal_resistance" type="number" step="0.1" inputmode="decimal" placeholder="—" /><span class="unit">mΩ</span></label>
          <label class="cell field stacked"><span class="field-label">Résultat des tests</span><textarea v-model="form.details.test_result" placeholder="Conclusions…" /></label>
          <template v-if="issues('capacity').length" #footer>
            <div v-for="m in issues('capacity')" :key="m.text" class="issue" :class="m.error ? 'c-red' : 'c-orange'">{{ m.text }}</div>
          </template>
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

      <ListGroup v-if="!id" header="Prestations">
        <ListRow v-for="(t, i) in tasks" :key="i" :title="t.name" @click="removeTask(i)">
          <template #trailing><span class="bold num">{{ money(t.price) }}</span></template>
        </ListRow>
        <ListRow :icon="Plus" tile="accent" title="Ajouter une prestation" action @click="pickingTasks = true" />
        <template v-if="tasks.length" #footer>Total prestations <b class="num" style="color: var(--label)">{{ money(tasksTotal) }}</b>. Touchez une ligne pour la retirer.</template>
      </ListGroup>

      <ListGroup header="Atelier" footer="Les pièces s'ajoutent depuis la fiche : le stock est déduit automatiquement. Total = prestations + pièces + main-d'œuvre.">
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
    <TaskPickerSheet :open="pickingTasks" @close="pickingTasks = false" @pick="addTask" @free="addFreeTask" />
  </div>
</template>
