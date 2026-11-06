<script setup>
import PageHeader from '../components/PageHeader.vue';

const tiles = [
  { to: '/batteries', icon: '🔋', label: 'Batteries', sub: 'Packs lithium, outils' },
  { to: '/diagnostics', icon: '⚡', label: 'Diagnostic', sub: 'Diagnostics facturables' },
  { to: '/connecteurs', icon: '🔌', label: 'Connecteurs', sub: 'Brochages & adaptations' },
  { to: '/base', icon: '📚', label: 'Base technique', sub: 'Mes solutions de dépannage' },
  { to: '/fournisseurs', icon: '📇', label: 'Fournisseurs', sub: 'Achats & réassort' },
  { to: '/planning', icon: '📅', label: 'Planning', sub: 'Vue atelier par statut' },
  { to: '/caisse', icon: '💰', label: 'Caisse', sub: 'Recettes, crédits, marges' },
  { to: '/ventes', icon: '🧾', label: 'Historique ventes', sub: 'Toutes les ventes' },
  { to: '/parametres', icon: '⚙️', label: 'Paramètres', sub: 'PIN, sauvegarde, export' },
];
</script>

<template>
  <div class="page">
    <PageHeader title="Plus" />
    <div class="grid-2">
      <router-link v-for="t in tiles" :key="t.to" :to="t.to" class="quick-action" style="min-height: 110px">
        <span class="qa-icon">{{ t.icon }}</span>
        <span>{{ t.label }}</span>
        <span class="tiny muted" style="font-weight: 500">{{ t.sub }}</span>
      </router-link>
    </div>
  </div>
</template>
