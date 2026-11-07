<script setup>
import { Smartphone, BatteryCharging, Activity, ClipboardList, CalendarDays, Cable, BookOpen, Wallet, Receipt, Truck, Settings, Lock } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { api, session } from '../api.js';
import { canInstall, openInstall } from '../pwa.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';

const router = useRouter();
async function lock() {
  await api.post('/auth/logout').catch(() => {});
  session.authenticated = false;
  router.replace('/login');
}
</script>

<template>
  <div class="page">
    <NavBar title="Plus" large />
    <ListGroup v-if="canInstall()">
      <ListRow :icon="Smartphone" tile="accent" title="Installer l'application" subtitle="Plein écran · hors ligne · écran d'accueil" chevron @click="openInstall" />
    </ListGroup>
    <ListGroup header="Atelier">
      <ListRow to="/batteries" :icon="BatteryCharging" tile="accent" title="Batteries lithium" />
      <ListRow to="/diagnostics" :icon="Activity" tile="accent" title="Diagnostics" />
      <ListRow to="/prestations" :icon="ClipboardList" tile="accent" title="Prestations" subtitle="Travaux courants et leur prix" />
      <ListRow to="/planning" :icon="CalendarDays" tile="accent" title="Planning" />
    </ListGroup>
    <ListGroup header="Bibliothèque">
      <ListRow to="/connecteurs" :icon="Cable" tile="accent" title="Connecteurs & adaptations" />
      <ListRow to="/base" :icon="BookOpen" tile="accent" title="Base technique" />
    </ListGroup>
    <ListGroup header="Commerce">
      <ListRow to="/caisse" :icon="Wallet" tile="accent" title="Caisse" />
      <ListRow to="/ventes" :icon="Receipt" tile="accent" title="Historique des ventes" />
      <ListRow to="/fournisseurs" :icon="Truck" tile="accent" title="Fournisseurs & achats" />
    </ListGroup>
    <ListGroup>
      <ListRow to="/parametres" :icon="Settings" tile="accent" title="Réglages" />
      <ListRow :icon="Lock" tile="accent" title="Verrouiller" @click="lock" />
    </ListGroup>
  </div>
</template>
