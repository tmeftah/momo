<script setup>
import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { session } from './api.js';
import { toasts } from './store.js';
import BottomNav from './components/BottomNav.vue';

const route = useRoute();
const router = useRouter();

// Session expired while using the app → back to the PIN screen
watch(
  () => session.authenticated,
  (ok) => {
    if (!ok && session.checked && !route.meta.public) router.replace({ path: '/login', query: { r: route.fullPath } });
  }
);
</script>

<template>
  <div class="toasts">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">{{ t.message }}</div>
  </div>
  <router-view v-slot="{ Component }">
    <component :is="Component" :key="route.path" />
  </router-view>
  <BottomNav v-if="!route.meta.bare && session.authenticated" />
</template>
