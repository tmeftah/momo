<script setup>
// Options: array of strings or { value, label, icon }. multiple → v-model is an array.
const props = defineProps({
  modelValue: [String, Number, Array, null],
  options: { type: Array, required: true },
  multiple: Boolean,
  allowEmpty: Boolean,
  big: Boolean,
  scroll: Boolean,
  yellow: Boolean,
});
const emit = defineEmits(['update:modelValue']);

const norm = (o) => (typeof o === 'object' ? o : { value: o, label: o });
const isOn = (v) => (props.multiple ? (props.modelValue || []).includes(v) : props.modelValue === v);

function toggle(v) {
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
  <div class="chips" :class="{ big, scroll }">
    <button
      v-for="o in options.map(norm)"
      :key="o.value"
      type="button"
      class="chip"
      :class="{ active: isOn(o.value), yellow }"
      @click="toggle(o.value)"
    >
      <span v-if="o.icon">{{ o.icon }}</span>{{ o.label }}
      <span v-if="o.count !== undefined" class="count">{{ o.count }}</span>
    </button>
  </div>
</template>
