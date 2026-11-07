<script setup>
// Filter chips. Options: strings or { value, label, icon, count }. multiple → array model.
import { haptic } from '../ui.js';

const props = defineProps({
  modelValue: [String, Number, Array, null],
  options: { type: Array, required: true },
  multiple: Boolean,
  allowEmpty: Boolean,
  scroll: Boolean,
});
const emit = defineEmits(['update:modelValue']);

const norm = (o) => (typeof o === 'object' ? o : { value: o, label: o });
const isOn = (v) => (props.multiple ? (props.modelValue || []).includes(v) : props.modelValue === v);

function toggle(v) {
  haptic('light');
  if (props.multiple) {
    const cur = [...(props.modelValue || [])];
    const i = cur.indexOf(v);
    if (i >= 0) cur.splice(i, 1);
    else cur.push(v);
    emit('update:modelValue', cur);
  } else {
    emit('update:modelValue', props.modelValue === v && props.allowEmpty ? null : v);
  }
}
</script>

<template>
  <div class="chips" :class="{ scroll }">
    <button v-for="o in options.map(norm)" :key="o.value" type="button" class="chip" :class="{ on: isOn(o.value) }" @click="toggle(o.value)">
      <component :is="o.icon" v-if="o.icon && typeof o.icon !== 'string'" :size="15" :stroke-width="2.3" />
      <span v-else-if="o.icon">{{ o.icon }}</span>
      {{ o.label }}
      <span v-if="o.count !== undefined" class="count">{{ o.count }}</span>
    </button>
  </div>
</template>
