<script setup>
// Contacts-style row of square buttons under a hero header.
// actions: [{ icon, label, to?, href?, external?, onClick?, disabled?, wa? }]
import { RouterLink } from 'vue-router';

defineProps({ actions: { type: Array, required: true } });
</script>

<template>
  <div class="actions-row">
    <template v-for="a in actions" :key="a.label">
      <RouterLink v-if="a.to && !a.disabled" :to="a.to" class="action-btn"><component :is="a.icon" :size="22" :stroke-width="2" />{{ a.label }}</RouterLink>
      <a
        v-else-if="a.href && !a.disabled" :href="a.href" class="action-btn" :class="{ wa: a.wa }"
        :target="a.external ? '_blank' : undefined" rel="noopener" @click="a.onClick?.()"
      ><component :is="a.icon" :size="22" :stroke-width="2" />{{ a.label }}</a>
      <button v-else type="button" class="action-btn" :class="{ disabled: a.disabled }" @click="a.onClick?.()">
        <component :is="a.icon" :size="22" :stroke-width="2" />{{ a.label }}
      </button>
    </template>
  </div>
</template>
