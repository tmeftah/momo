<script setup>
defineProps({ icon: [Object, Function], title: String, text: String });
</script>

<template>
  <div class="empty">
    <div v-if="icon" class="e-icon"><component :is="icon" :size="30" :stroke-width="1.8" /></div>
    <div v-if="title" class="e-title">{{ title }}</div>
    <div v-if="text" class="e-text">{{ text }}</div>
    <div v-if="$slots.default" class="e-action"><slot /></div>
  </div>
</template>
