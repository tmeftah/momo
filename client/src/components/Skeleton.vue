<script setup>
defineProps({ rows: { type: Number, default: 5 }, thumb: { type: Boolean, default: true } });
</script>

<template>
  <section class="lg">
    <div class="group">
      <div v-for="n in rows" :key="n" class="cell" :class="{ 'has-thumb': thumb }">
        <span v-if="thumb" class="thumb skel" />
        <div class="cell-main" style="gap: 8px">
          <span class="skel" :style="{ height: '14px', width: 40 + ((n * 37) % 45) + '%' }" />
          <span class="skel" :style="{ height: '11px', width: 25 + ((n * 23) % 30) + '%' }" />
        </div>
      </div>
    </div>
  </section>
</template>
