<script setup>
import { ref, computed, onActivated } from 'vue';
import {
  Wrench, Zap, ShoppingCart, UserPlus, PackagePlus, CalendarDays, Pause, PackageSearch,
  CircleCheckBig, TriangleAlert, Banknote, CreditCard, Activity, X,
} from 'lucide-vue-next';
import { canInstall, openInstall, setBadge } from '../pwa.js';
import { api } from '../api.js';
import { money, fmtNum, settings } from '../store.js';
import { toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import RepairRow from '../components/RepairRow.vue';
import Skeleton from '../components/Skeleton.vue';

const d = ref(null);
async function load() {
  try {
    d.value = await api.get('/dashboard');
    setBadge(d.value.to_collect);
  } catch (e) {
    toastError(e);
  }
}
onActivated(load);

// « Installer l'app » tip, until installed or dismissed
const tipKey = 'vae-install-tip';
const tipHidden = ref((() => { try { return !!localStorage.getItem(tipKey); } catch { return false; } })());
const showTip = computed(() => !tipHidden.value && canInstall());
function hideTip() {
  tipHidden.value = true;
  try { localStorage.setItem(tipKey, '1'); } catch { /* ignore */ }
}

const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

const quick = [
  { to: '/reparations/nouvelle', icon: Wrench, label: 'Réparation' },
  { to: '/diagnostics/nouveau', icon: Zap, label: 'Diagnostic' },
  { to: '/vente', icon: ShoppingCart, label: 'Vente' },
  { to: '/clients/nouveau', icon: UserPlus, label: 'Client' },
  { to: '/stock/ajout', icon: PackagePlus, label: 'Stock' },
];
</script>

<template>
  <div class="page">
    <NavBar :title="settings.shop_name || 'Accueil'" large :eyebrow="today" :refresh="load">
      <router-link to="/planning" class="nav-icon" aria-label="Planning"><CalendarDays :size="18" :stroke-width="2.2" /></router-link>
    </NavBar>

    <div class="quick">
      <router-link v-for="q in quick" :key="q.to" :to="q.to">
        <span class="q-icon"><component :is="q.icon" :size="25" :stroke-width="2.1" /></span>
        {{ q.label }}
      </router-link>
    </div>

    <div v-if="showTip" class="install-tip mt" role="button" @click="openInstall">
      <img src="/apple-touch-icon.png" alt="" />
      <div class="grow">
        <div class="headline">Installer VAE Manager</div>
        <div class="footnote secondary">Plein écran, icône sur l'écran d'accueil, consultable hors ligne.</div>
      </div>
      <button class="dock-x" aria-label="Masquer" @click.stop="hideTip"><X :size="15" :stroke-width="2.6" /></button>
    </div>

    <template v-if="d">
      <div class="lg-header big mt">Atelier</div>
      <div class="widgets four">
        <router-link to="/atelier?status=en_cours" class="widget">
          <div class="w-head"><Wrench :size="16" :stroke-width="2.4" />En cours</div>
          <div class="w-value">{{ d.repairs.en_cours || 0 }}</div>
          <div class="w-sub">{{ d.repairs.en_attente || 0 }} en attente · {{ d.repairs.en_test || 0 }} en test</div>
        </router-link>
        <router-link to="/atelier?status=en_pause" class="widget">
          <div class="w-head"><Pause :size="16" :stroke-width="2.4" />En pause</div>
          <div class="w-value">{{ d.repairs.en_pause || 0 }}</div>
          <div class="w-sub">réparations</div>
        </router-link>
        <router-link to="/atelier?status=attente_piece" class="widget">
          <div class="w-head"><PackageSearch :size="16" :stroke-width="2.4" />Attente pièces</div>
          <div class="w-value">{{ d.repairs.attente_piece || 0 }}</div>
          <div class="w-sub">réparations</div>
        </router-link>
        <router-link to="/diagnostics" class="widget">
          <div class="w-head"><Activity :size="16" :stroke-width="2.4" />Diagnostics</div>
          <div class="w-value">{{ d.diagnostics_open }}</div>
          <div class="w-sub">en cours</div>
        </router-link>
        <router-link to="/atelier?status=terminee" class="widget">
          <div class="w-head" :class="{ 'c-green': d.to_collect }"><CircleCheckBig :size="16" :stroke-width="2.4" />À récupérer</div>
          <div class="w-value">{{ d.to_collect }}</div>
          <div class="w-sub">véhicules prêts</div>
        </router-link>
        <router-link to="/stock?low=1" class="widget">
          <div class="w-head" :class="{ 'c-red': d.low_stock.count }"><TriangleAlert :size="16" :stroke-width="2.4" />Stock faible</div>
          <div class="w-value">{{ d.low_stock.count }}</div>
          <div class="w-sub">sous le minimum</div>
        </router-link>
      </div>

      <div class="lg-header big mt">Aujourd'hui</div>
      <div class="widgets">
        <router-link to="/caisse" class="widget span2 hero-w">
          <div class="w-head"><Banknote :size="16" :stroke-width="2.4" />Argent encaissé</div>
          <div class="w-value">{{ money(d.cash_today.total) }}</div>
          <div class="w-sub">dont espèces {{ money(d.cash_today.especes || 0) }}</div>
        </router-link>
        <router-link to="/ventes" class="widget">
          <div class="w-head"><ShoppingCart :size="16" :stroke-width="2.4" />Ventes</div>
          <div class="w-value" style="font-size: 24px">{{ money(d.sales_today.total) }}</div>
          <div class="w-sub">{{ d.sales_today.count }} vente(s)</div>
        </router-link>
        <router-link to="/caisse#credits" class="widget">
          <div class="w-head" :class="{ 'c-orange': d.credits.count }"><CreditCard :size="16" :stroke-width="2.4" />Crédits clients</div>
          <div class="w-value" style="font-size: 24px">{{ money(d.credits.total) }}</div>
          <div class="w-sub">{{ d.credits.count }} impayé(s)</div>
        </router-link>
      </div>

      <ListGroup v-if="d.active.length" header="Réparations actives" class="mt">
        <template #header-right><router-link to="/atelier">Tout voir</router-link></template>
        <RepairRow v-for="r in d.active" :key="r.id" :repair="r" />
      </ListGroup>

      <ListGroup v-if="d.low_stock.items.length" header="Stock faible">
        <template #header-right><router-link to="/stock?low=1">Tout voir</router-link></template>
        <ListRow v-for="i in d.low_stock.items" :key="i.id" :to="`/stock/${i.id}`" :thumb="i.photo || null" :title="i.name" :subtitle="i.category">
          <template #trailing><span class="pill" :class="i.quantity <= 0 ? 'red' : 'orange'">{{ fmtNum(i.quantity) }} / {{ fmtNum(i.min_stock) }}</span></template>
        </ListRow>
      </ListGroup>
    </template>
    <Skeleton v-else :rows="4" />
  </div>
</template>
