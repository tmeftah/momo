<script setup>
import { ref, onMounted } from 'vue';
import { api, fileUrl } from '../api.js';
import { money, fmtNum, settings, toastError } from '../store.js';
import RepairCard from '../components/RepairCard.vue';

const d = ref(null);
onMounted(async () => {
  try {
    d.value = await api.get('/dashboard');
  } catch (e) {
    toastError(e);
  }
});

const quick = [
  { to: '/reparations/nouvelle', icon: '🔧', label: 'Nouvelle réparation', cls: 'primary' },
  { to: '/diagnostics/nouveau', icon: '⚡', label: 'Nouveau diagnostic', cls: '' },
  { to: '/vente', icon: '🛒', label: 'Nouvelle vente', cls: 'accent' },
  { to: '/clients/nouveau', icon: '👤', label: 'Nouveau client', cls: '' },
  { to: '/stock/ajout', icon: '📦', label: 'Ajouter stock', cls: '' },
];
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div class="grow">
        <div class="brand" style="font-size: 1.25rem">🔑 <i>VAE</i> <b>Manager</b></div>
        <div class="tiny muted">{{ settings.shop_name }}</div>
      </div>
      <router-link to="/planning" class="btn btn-sm">📅 Planning</router-link>
    </header>

    <div class="quick-actions">
      <router-link v-for="q in quick" :key="q.to" :to="q.to" class="quick-action" :class="q.cls">
        <span class="qa-icon">{{ q.icon }}</span>{{ q.label }}
      </router-link>
    </div>

    <template v-if="d">
      <div class="section-title">Atelier</div>
      <div class="stats grid-4-md">
        <router-link to="/atelier?status=en_cours" class="stat blue">
          <span class="stat-label">🔧 En cours</span><span class="stat-value">{{ d.repairs.en_cours || 0 }}</span>
          <span class="stat-sub">{{ d.repairs.en_attente || 0 }} en attente · {{ d.repairs.en_test || 0 }} en test</span>
        </router-link>
        <router-link to="/atelier?status=en_pause" class="stat orange">
          <span class="stat-label">⏸️ En pause</span><span class="stat-value">{{ d.repairs.en_pause || 0 }}</span>
        </router-link>
        <router-link to="/atelier?status=attente_piece" class="stat purple">
          <span class="stat-label">📦 Attente pièces</span><span class="stat-value">{{ d.repairs.attente_piece || 0 }}</span>
        </router-link>
        <router-link to="/diagnostics" class="stat cyan">
          <span class="stat-label">⚡ Diagnostics en cours</span><span class="stat-value">{{ d.diagnostics_open }}</span>
        </router-link>
        <router-link to="/atelier?status=terminee" class="stat green">
          <span class="stat-label">✅ À récupérer</span><span class="stat-value">{{ d.to_collect }}</span>
        </router-link>
        <router-link to="/stock?low=1" class="stat" :class="d.low_stock.count ? 'red' : ''">
          <span class="stat-label">⚠️ Stock faible</span><span class="stat-value">{{ d.low_stock.count }}</span>
          <span class="stat-sub">articles sous le minimum</span>
        </router-link>
      </div>

      <div class="section-title">Caisse du jour</div>
      <div class="stats grid-4-md">
        <router-link to="/ventes" class="stat yellow">
          <span class="stat-label">🛒 Ventes du jour</span><span class="stat-value">{{ money(d.sales_today.total) }}</span>
          <span class="stat-sub">{{ d.sales_today.count }} vente(s)</span>
        </router-link>
        <router-link to="/caisse" class="stat green">
          <span class="stat-label">💵 Argent encaissé</span><span class="stat-value">{{ money(d.cash_today.total) }}</span>
          <span class="stat-sub">dont espèces {{ money(d.cash_today.especes || 0) }}</span>
        </router-link>
        <router-link to="/caisse#credits" class="stat orange">
          <span class="stat-label">💳 Crédits clients</span><span class="stat-value">{{ money(d.credits.total) }}</span>
          <span class="stat-sub">{{ d.credits.count }} document(s) impayé(s)</span>
        </router-link>
      </div>

      <div class="section-title row between">
        <span>Réparations actives</span>
        <router-link to="/atelier" class="small">Tout voir ›</router-link>
      </div>
      <div class="list">
        <RepairCard v-for="r in d.active" :key="r.id" :repair="r" />
        <div v-if="!d.active.length" class="empty small">Aucune réparation active 🎉</div>
      </div>

      <template v-if="d.low_stock.items.length">
        <div class="section-title row between">
          <span>Stock faible</span>
          <router-link to="/stock?low=1" class="small">Tout voir ›</router-link>
        </div>
        <div class="list">
          <router-link v-for="i in d.low_stock.items" :key="i.id" :to="`/stock/${i.id}`" class="list-item">
            <img v-if="i.photo" class="thumb" :src="fileUrl(i.photo)" alt="" />
            <div v-else class="thumb">📦</div>
            <div class="grow">
              <div class="title ellipsis">{{ i.name }}</div>
              <div class="sub">{{ i.category }}</div>
            </div>
            <span class="badge" :class="i.quantity <= 0 ? 'red' : 'orange'">{{ fmtNum(i.quantity) }} / min {{ fmtNum(i.min_stock) }}</span>
          </router-link>
        </div>
      </template>
    </template>
  </div>
</template>
