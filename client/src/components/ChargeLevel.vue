<script setup>
// Pack voltage before / after with the estimated charge level of each.
import { computed } from 'vue';
import { fmtNum } from '../store.js';
import { chargeLevel } from '../battery.js';

const props = defineProps({ before: [String, Number], after: [String, Number], series: [String, Number], cellType: String });

const filled = (v) => v !== undefined && v !== null && v !== '';
const rows = computed(() =>
  [
    { label: 'Avant', volts: props.before },
    { label: 'Après', volts: props.after },
  ]
    .filter((r) => filled(r.volts))
    .map((r) => ({ ...r, level: chargeLevel(r.volts, props.series, props.cellType) }))
);
</script>

<template>
  <div v-if="rows.length" class="soc">
    <div v-for="r in rows" :key="r.label" class="soc-row">
      <div class="soc-head">
        <span>Tension {{ r.label.toLowerCase() }}</span>
        <span class="bold num">{{ fmtNum(r.volts) }} V</span>
      </div>
      <template v-if="r.level">
        <div class="soc-bar" :class="{ low: r.level.pct < 20 }"><i :style="{ width: r.level.pct + '%' }" /></div>
        <div class="soc-sub footnote secondary num">
          <span>≈ {{ r.level.pct }} % de charge</span>
          <span>{{ fmtNum(r.level.perCell) }} V par cellule</span>
        </div>
      </template>
    </div>
  </div>
</template>
