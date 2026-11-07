<script setup>
import { computed } from 'vue';
import { Zap } from 'lucide-vue-next';
import { STATUS, DECISION, PRIORITY, METHOD } from '../constants.js';

const props = defineProps({ status: String, decision: { type: String, default: undefined }, priority: String, method: String, short: Boolean });
const info = computed(() => {
  if (props.status) return STATUS[props.status];
  if (props.priority) return PRIORITY[props.priority];
  if (props.method) return METHOD[props.method];
  if (props.decision !== undefined) {
    if (!props.decision) return { label: 'En cours', icon: Zap, color: 'blue' };
    const d = DECISION[props.decision];
    return d && { ...d, label: props.short ? d.short : d.label };
  }
  return null;
});
</script>

<template>
  <span v-if="info" class="pill" :class="info.color">
    <component :is="info.icon" v-if="info.icon" :stroke-width="2.6" />
    <i v-else-if="priority" style="width: 7px; height: 7px; border-radius: 50%; background: currentColor" />
    {{ info.label }}
  </span>
</template>
