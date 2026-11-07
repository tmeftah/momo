<script setup>
import { computed } from 'vue';
import { haptic } from '../ui.js';

const props = defineProps({ modelValue: [String, Number, Boolean, null], options: { type: Array, required: true }, lg: Boolean });
const emit = defineEmits(['update:modelValue']);

const opts = computed(() => props.options.map((o) => (typeof o === 'object' ? o : { value: o, label: o })));
const index = computed(() => Math.max(0, opts.value.findIndex((o) => o.value === props.modelValue)));
const thumbStyle = computed(() => ({
  width: `calc((100% - 4px) / ${opts.value.length})`,
  transform: `translateX(${index.value * 100}%)`,
}));

function pick(v) {
  if (v === props.modelValue) return;
  haptic('light');
  emit('update:modelValue', v);
}
</script>

<template>
  <div class="seg" :class="{ lg }" role="tablist">
    <div class="seg-thumb" :style="thumbStyle" />
    <button
      v-for="o in opts" :key="String(o.value)" type="button" role="tab"
      class="seg-item" :class="{ on: o.value === modelValue }" :aria-selected="o.value === modelValue"
      @click="pick(o.value)"
    >
      <component :is="o.icon" v-if="o.icon" :size="15" :stroke-width="2.3" />{{ o.label }}
    </button>
  </div>
</template>
