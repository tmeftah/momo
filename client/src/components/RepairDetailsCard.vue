<script setup>
// Read-only rendering of the category specific "details" of a repair.
import { computed } from 'vue';
import { BATTERY_KINDS } from '../constants.js';
import ListGroup from './ListGroup.vue';
import ListRow from './ListRow.vue';
import CellGroups from './CellGroups.vue';

const props = defineProps({ category: String, details: Object });
const d = computed(() => props.details || {});
const has = (...keys) => keys.some((k) => d.value[k] !== undefined && d.value[k] !== null && d.value[k] !== '' && !(Array.isArray(d.value[k]) && !d.value[k].length));
const kind = computed(() => BATTERY_KINDS.find((k) => k.value === d.value.battery_kind)?.label);
</script>

<template>
  <template v-if="category === 'batterie'">
    <ListGroup header="Batterie">
      <ListRow v-if="kind" title="Type" :value="kind" />
      <ListRow v-if="has('capacity_ah')" title="Capacité" :value="`${d.capacity_ah} Ah`" />
      <ListRow v-if="has('config_s', 'config_p')" title="Configuration" :value="`${d.config_s || '?'}S${d.config_p || '?'}P`" />
      <ListRow v-if="has('cell_type')" title="Cellules" :value="d.cell_type" />
      <ListRow v-if="has('bms')" title="BMS" :value="d.bms" />
    </ListGroup>
    <ListGroup v-if="Number(d.groups_count) > 0 && has('groups')" :header="`Mesure des ${d.groups_count} groupes`">
      <CellGroups :model-value="d.groups" :count="Number(d.groups_count)" readonly />
    </ListGroup>
    <ListGroup v-if="has('voltage_before', 'voltage_after', 'capacity_measured', 'internal_resistance', 'test_result')" header="Tests">
      <ListRow v-if="has('voltage_before')" title="Tension avant" :value="`${d.voltage_before} V`" />
      <ListRow v-if="has('voltage_after')" title="Tension après" :value="`${d.voltage_after} V`" />
      <ListRow v-if="has('capacity_measured')" title="Capacité mesurée" :value="`${d.capacity_measured} Ah`" />
      <ListRow v-if="has('internal_resistance')" title="Résistance interne" :value="`${d.internal_resistance} mΩ`" />
      <div v-if="has('test_result')" class="cell text-cell" style="display: block">{{ d.test_result }}</div>
    </ListGroup>
  </template>

  <template v-else-if="category === 'electronique' && has('original_system', 'new_system', 'modification')">
    <ListGroup header="Modification électronique">
      <div v-if="has('original_system')" class="cell text-cell" style="display: block"><span class="t-label">Système d'origine</span>{{ d.original_system }}</div>
      <div v-if="has('new_system')" class="cell text-cell" style="display: block"><span class="t-label">Nouveau système</span>{{ d.new_system }}</div>
      <div v-if="has('modification')" class="cell code-cell" style="display: block"><span class="t-label" style="font-family: var(--font)">Câblage / modification</span>{{ d.modification }}</div>
    </ListGroup>
  </template>

  <template v-else-if="category === 'chargeur' && has('old_connector', 'new_connector', 'solution', 'wiring')">
    <ListGroup header="Adaptation chargeur">
      <ListRow v-if="has('old_connector')" title="Ancien connecteur" :value="d.old_connector" />
      <ListRow v-if="has('new_connector')" title="Nouveau connecteur" :value="d.new_connector" />
      <ListRow v-if="has('charger_voltage')" title="Tension" :value="d.charger_voltage" />
      <ListRow v-if="has('charger_current')" title="Courant" :value="d.charger_current" />
      <ListRow v-if="has('polarity')" title="Polarité" :value="d.polarity" />
      <div v-if="has('wiring')" class="cell code-cell" style="display: block"><span class="t-label" style="font-family: var(--font)">Câblage</span>{{ d.wiring }}</div>
      <div v-if="has('solution')" class="cell text-cell" style="display: block"><span class="t-label">Solution utilisée</span>{{ d.solution }}</div>
    </ListGroup>
  </template>

  <ListGroup v-if="has('interventions') && (category === 'batterie' || category === 'electronique')" header="Interventions réalisées">
    <ListRow v-for="i in d.interventions" :key="i" :title="i" selected />
  </ListGroup>
</template>
