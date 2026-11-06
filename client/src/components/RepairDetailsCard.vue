<script setup>
// Read-only rendering of the category specific "details" of a repair.
import { computed } from 'vue';
import { BATTERY_KINDS } from '../constants.js';
import CellGroups from './CellGroups.vue';

const props = defineProps({ category: String, details: Object });
const d = computed(() => props.details || {});
const has = (...keys) => keys.some((k) => d.value[k] !== undefined && d.value[k] !== null && d.value[k] !== '' && !(Array.isArray(d.value[k]) && !d.value[k].length));
const kind = computed(() => BATTERY_KINDS.find((k) => k.value === d.value.battery_kind));
</script>

<template>
  <div v-if="category === 'batterie'" class="card stack">
    <div class="card-title">🔋 Batterie <span v-if="kind" class="badge">{{ kind.icon }} {{ kind.label }}</span></div>
    <dl class="kv" style="margin: 0">
      <template v-if="has('capacity_ah')"><dt>Capacité</dt><dd>{{ d.capacity_ah }} Ah</dd></template>
      <template v-if="has('config_s', 'config_p')"><dt>Configuration</dt><dd>{{ d.config_s || '?' }}S{{ d.config_p || '?' }}P</dd></template>
      <template v-if="has('cell_type')"><dt>Cellules</dt><dd>{{ d.cell_type }}</dd></template>
      <template v-if="has('groups_count')"><dt>Groupes</dt><dd>{{ d.groups_count }}</dd></template>
      <template v-if="has('bms')"><dt>BMS</dt><dd>{{ d.bms }}</dd></template>
      <template v-if="has('voltage_before')"><dt>Tension avant</dt><dd>{{ d.voltage_before }} V</dd></template>
      <template v-if="has('voltage_after')"><dt>Tension après</dt><dd>{{ d.voltage_after }} V</dd></template>
      <template v-if="has('capacity_measured')"><dt>Capacité mesurée</dt><dd>{{ d.capacity_measured }} Ah</dd></template>
      <template v-if="has('internal_resistance')"><dt>Résistance interne</dt><dd>{{ d.internal_resistance }} mΩ</dd></template>
    </dl>
    <div v-if="has('interventions')" class="chips">
      <span v-for="i in d.interventions" :key="i" class="badge blue">{{ i }}</span>
    </div>
    <template v-if="Number(d.groups_count) > 0 && has('groups')">
      <div class="label">Mesure de chaque groupe</div>
      <CellGroups :model-value="d.groups" :count="Number(d.groups_count)" readonly />
    </template>
    <template v-if="has('test_result')">
      <div class="label">Résultat des tests</div>
      <div class="block-text">{{ d.test_result }}</div>
    </template>
  </div>

  <div v-else-if="category === 'electronique' && has('interventions', 'original_system', 'new_system', 'modification')" class="card stack">
    <div class="card-title">⚡ Intervention électronique</div>
    <div v-if="has('interventions')" class="chips">
      <span v-for="i in d.interventions" :key="i" class="badge blue">{{ i }}</span>
    </div>
    <template v-if="has('original_system')"><div class="label">Système d'origine</div><div class="block-text">{{ d.original_system }}</div></template>
    <template v-if="has('new_system')"><div class="label">Nouveau système / pièces de remplacement</div><div class="block-text">{{ d.new_system }}</div></template>
    <template v-if="has('modification')"><div class="label">Modification réalisée / câblage</div><div class="block-text mono small">{{ d.modification }}</div></template>
  </div>

  <div v-else-if="category === 'chargeur' && has('old_connector', 'new_connector', 'solution', 'wiring')" class="card stack">
    <div class="card-title">🔌 Adaptation chargeur</div>
    <dl class="kv" style="margin: 0">
      <template v-if="has('old_connector')"><dt>Ancien connecteur</dt><dd>{{ d.old_connector }}</dd></template>
      <template v-if="has('new_connector')"><dt>Nouveau connecteur</dt><dd>{{ d.new_connector }}</dd></template>
      <template v-if="has('charger_voltage')"><dt>Tension chargeur</dt><dd>{{ d.charger_voltage }}</dd></template>
      <template v-if="has('charger_current')"><dt>Courant</dt><dd>{{ d.charger_current }}</dd></template>
      <template v-if="has('polarity')"><dt>Polarité</dt><dd>{{ d.polarity }}</dd></template>
    </dl>
    <template v-if="has('wiring')"><div class="label">Câblage</div><div class="block-text mono small">{{ d.wiring }}</div></template>
    <template v-if="has('solution')"><div class="label">Solution utilisée</div><div class="block-text">{{ d.solution }}</div></template>
  </div>
</template>
