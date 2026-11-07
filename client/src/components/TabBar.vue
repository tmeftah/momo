<script setup>
import { useRoute } from 'vue-router';
import { House, Wrench, Package, ShoppingCart, Users, LayoutGrid } from 'lucide-vue-next';
import { haptic } from '../ui.js';

const route = useRoute();
const tabs = [
  { key: 'home', to: '/', icon: House, label: 'Accueil' },
  { key: 'atelier', to: '/atelier', icon: Wrench, label: 'Atelier' },
  { key: 'stock', to: '/stock', icon: Package, label: 'Stock' },
  { key: 'vente', to: '/vente', icon: ShoppingCart, label: 'Vente' },
  { key: 'clients', to: '/clients', icon: Users, label: 'Clients' },
  { key: 'plus', to: '/plus', icon: LayoutGrid, label: 'Plus' },
];

// Tapping the active tab scrolls back to the top, like iOS
function tap(t, e) {
  haptic('light');
  if (route.path === t.to) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
</script>

<template>
  <nav class="tabbar">
    <router-link v-for="t in tabs" :key="t.key" :to="t.to" class="tab" :class="{ on: route.meta.tab === t.key }" @click="tap(t, $event)">
      <component :is="t.icon" :size="25" :stroke-width="route.meta.tab === t.key ? 2.3 : 1.8" />
      <span>{{ t.label }}</span>
    </router-link>
  </nav>
</template>
