<script setup>
// Voltage of each parallel group of a lithium pack, highlighting outliers vs the median.
import { computed } from 'vue';
import { fmtNum } from '../store.js';

const props = defineProps({ modelValue: { type: Array, default: () => [] }, count: { type: Number, default: 0 }, readonly: Boolean });
const emit = defineEmits(['update:modelValue']);

const values = computed(() => Array.from({ length: props.count }, (_, i) => props.modelValue[i] ?? ''));
const nums = computed(() => values.value.map(Number).filter((v) => v > 0));
const stats = computed(() => {
  const n = nums.value;
  if (!n.length) return null;
  const sorted = [...n].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // Median, not mean: one weak group must not make every healthy group look "high"
  const ref = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const sum = n.reduce((a, b) => a + b, 0);
  return { min: sorted[0], max: sorted[sorted.length - 1], ref, sum, spread: Math.round((sorted[sorted.length - 1] - sorted[0]) * 1000) };
});

function cls(v) {
  const n = Number(v);
  if (!stats.value || !(n > 0) || stats.value.spread < 30) return '';
  if (n <= stats.value.ref - 0.05) return 'low';
  if (n >= stats.value.ref + 0.05) return 'high';
  return '';
}
const pct = (v) => Math.max(0, Math.min(100, ((Number(v) - 3.0) / 1.2) * 100));

function set(i, v) {
  const arr = [...values.value];
  arr[i] = v === '' ? '' : Number(String(v).replace(',', '.'));
  emit('update:modelValue', arr);
}
</script>

<template>
  <div class="cells">
    <div v-for="(v, i) in values" :key="i" class="cellv" :class="cls(v)">
      <label>G{{ i + 1 }}</label>
      <input v-if="!readonly" type="text" inputmode="decimal" placeholder="—" :value="v" @change="set(i, $event.target.value)" />
      <span v-else class="v bold num">{{ v === '' ? '—' : fmtNum(v) }}</span>
      <div class="bar"><i :style="{ width: pct(v) + '%' }" /></div>
    </div>
  </div>
  <div v-if="stats" class="cells-stats">
    <span class="pill gray">Min {{ fmtNum(stats.min) }} V</span>
    <span class="pill gray">Max {{ fmtNum(stats.max) }} V</span>
    <span class="pill" :class="stats.spread > 100 ? 'red' : stats.spread > 30 ? 'orange' : 'green'">Écart {{ stats.spread }} mV</span>
    <span class="pill blue">Pack ≈ {{ fmtNum(Math.round(stats.sum * 100) / 100) }} V</span>
  </div>
</template>
