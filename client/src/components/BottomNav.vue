<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();
const tabs = [
  { key: 'home', to: '/', icon: '🏠', label: 'Accueil' },
  { key: 'atelier', to: '/atelier', icon: '🔧', label: 'Atelier' },
  { key: 'stock', to: '/stock', icon: '📦', label: 'Stock' },
  { key: 'vente', to: '/vente', icon: '🛒', label: 'Vente' },
  { key: 'clients', to: '/clients', icon: '👥', label: 'Clients' },
  { key: 'plus', to: '/plus', icon: '⚙️', label: 'Plus' },
];
</script>

<template>
  <nav class="bottom-nav">
    <router-link v-for="t in tabs" :key="t.key" :to="t.to" :class="{ active: route.meta.tab === t.key }">
      <span class="nav-icon">{{ t.icon }}</span>
      <span>{{ t.label }}</span>
    </router-link>
  </nav>
</template>
