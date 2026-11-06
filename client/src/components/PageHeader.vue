<script setup>
import { useRouter } from 'vue-router';

const props = defineProps({ title: String, back: { type: [Boolean, String], default: false } });
const router = useRouter();

function goBack() {
  if (typeof props.back === 'string') router.push(props.back);
  else if (window.history.state?.back) router.back();
  else router.push('/');
}
</script>

<template>
  <header class="page-header">
    <button v-if="back" class="back-btn" aria-label="Retour" @click="goBack">‹</button>
    <h1>{{ title }}</h1>
    <slot />
  </header>
</template>
