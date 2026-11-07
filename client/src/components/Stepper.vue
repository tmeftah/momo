<script setup>
import { Minus, Plus } from 'lucide-vue-next';
import { fmtNum } from '../store.js';
import { haptic } from '../ui.js';

const props = defineProps({ modelValue: { type: Number, default: 1 }, min: { type: Number, default: 1 }, max: Number, disabled: Boolean });
const emit = defineEmits(['update:modelValue']);

function step(d) {
  const v = (Number(props.modelValue) || 0) + d;
  if (v < props.min || (props.max !== undefined && v > props.max)) return;
  haptic('light');
  emit('update:modelValue', v);
}
</script>

<template>
  <div class="stepper" @click.stop>
    <button type="button" aria-label="Moins" :disabled="disabled || modelValue <= min" @click="step(-1)"><Minus :size="18" :stroke-width="2.6" /></button>
    <span class="val">{{ fmtNum(modelValue) }}</span>
    <button type="button" aria-label="Plus" :disabled="disabled || (max !== undefined && modelValue >= max)" @click="step(1)"><Plus :size="18" :stroke-width="2.6" /></button>
  </div>
</template>
