<script setup>
import { haptic } from '../ui.js';

const props = defineProps({ modelValue: [Boolean, Number] });
const emit = defineEmits(['update:modelValue']);
function flip() {
  haptic('light');
  emit('update:modelValue', typeof props.modelValue === 'number' ? (props.modelValue ? 0 : 1) : !props.modelValue);
}
</script>

<template>
  <button type="button" role="switch" class="switch" :class="{ on: !!modelValue }" :aria-checked="!!modelValue" @click.stop.prevent="flip" />
</template>
