<script setup>
// Voltage of each parallel group of a lithium pack, with min / max / spread highlighting.
import { computed } from 'vue';
import { fmtNum } from '../store.js';

const props = defineProps({ modelValue: { type: Array, default: () => [] }, count: { type: Number, default: 0 }, readonly: Boolean });
const emit = defineEmits(['update:modelValue']);

const values = computed(() => Array.from({ length: props.count }, (_, i) => props.modelValue[i] ?? ''));
const nums = computed(() => values.value.map(Number).filter((v) => v > 0));
const stats = computed(() => {
  const n = nums.value;
  if (!n.length) return null;
  const min = Math.min(...n);
  const max = Math.max(...n);
  const sum = n.reduce((a, b) => a + b, 0);
  // Median, not mean: one weak group must not make every healthy group look "high"
  const sorted = [...n].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const ref = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { min, max, avg: ref, sum, spread: Math.round((max - min) * 1000) };
});

function cls(v) {
  const n = Number(v);
  if (!stats.value || !(n > 0) || stats.value.spread < 30) return '';
  if (n <= stats.value.avg - 0.05) return 'low';
  if (n >= stats.value.avg + 0.05) return 'high';
  return '';
}
const pct = (v) => Math.max(0, Math.min(100, ((Number(v) - 3.0) / 1.2) * 100));

function set(i, v) {
  const arr = [...values.value];
  arr[i] = v === '' ? '' : Number(v);
  emit('update:modelValue', arr);
}
</script>

<template>
  <div class="stack" style="gap: 8px">
    <div class="cells-grid">
      <div v-for="(v, i) in values" :key="i" class="cell-input" :class="cls(v)">
        <label>G{{ i + 1 }}</label>
        <input v-if="!readonly" type="number" step="0.001" inputmode="decimal" placeholder="V" :value="v" @change="set(i, $event.target.value)" />
        <div v-else class="strong center">{{ v === '' ? '—' : fmtNum(v) + ' V' }}</div>
        <div class="cell-bar"><i :style="{ width: pct(v) + '%', background: cls(v) === 'low' ? 'var(--red)' : cls(v) === 'high' ? 'var(--orange)' : '' }" /></div>
      </div>
    </div>
    <div v-if="stats" class="row wrap small">
      <span class="badge">Min {{ fmtNum(stats.min) }} V</span>
      <span class="badge">Max {{ fmtNum(stats.max) }} V</span>
      <span class="badge" :class="stats.spread > 100 ? 'red' : stats.spread > 30 ? 'orange' : 'green'">Écart {{ stats.spread }} mV</span>
      <span class="badge blue">Pack ≈ {{ fmtNum(Math.round(stats.sum * 100) / 100) }} V</span>
    </div>
  </div>
</template>
