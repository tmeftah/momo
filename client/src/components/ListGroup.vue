<script setup>
defineProps({ header: String, footer: String, big: Boolean, plain: Boolean });
</script>

<template>
  <section class="lg">
    <div v-if="header || $slots['header-right']" class="lg-header" :class="{ big }">
      <span>{{ header }}</span>
      <slot name="header-right" />
    </div>
    <div class="group" :class="{ plain }"><slot /></div>
    <div v-if="footer || $slots.footer" class="lg-footer"><slot name="footer">{{ footer }}</slot></div>
  </section>
</template>
