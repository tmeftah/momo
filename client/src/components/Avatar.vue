<script setup>
import { computed } from 'vue';
import { initials, avatarGradient } from '../store.js';

const props = defineProps({ name: { type: String, default: '' }, size: { type: Number, default: 40 } });
const style = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
  fontSize: Math.round(props.size * 0.4) + 'px',
  background: avatarGradient(props.name),
}));
</script>

<template>
  <span class="avatar" :style="style">{{ initials(name) }}</span>
</template>
