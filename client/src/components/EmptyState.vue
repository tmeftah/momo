<script setup>
defineProps({ icon: { type: String, default: '📭' }, text: String });
</script>

<template>
  <div class="empty">
    <div class="big">{{ icon }}</div>
    <div>{{ text }}</div>
    <div style="margin-top: 12px"><slot /></div>
  </div>
</template>
