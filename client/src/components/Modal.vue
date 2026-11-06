<script setup>
defineProps({ title: String });
const emit = defineEmits(['close']);
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-head">
          <h2>{{ title }}</h2>
          <button class="btn btn-ghost btn-icon" aria-label="Fermer" @click="emit('close')">✕</button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
