<script setup>
import { computed } from 'vue';
import { STATUS, DECISION, PRIORITY } from '../constants.js';

const props = defineProps({ status: String, decision: String, priority: String });
const info = computed(() => {
  if (props.status) return STATUS[props.status];
  if (props.priority) return { ...PRIORITY[props.priority], color: { urgent: 'red', normal: 'yellow', pas_urgent: 'green' }[props.priority] };
  if (props.decision !== undefined) return props.decision ? DECISION[props.decision] : { label: 'En cours', icon: '⚡', color: 'blue' };
  return null;
});
</script>

<template>
  <span v-if="info" class="badge" :class="info.color">{{ info.icon }} {{ info.label }}</span>
</template>
