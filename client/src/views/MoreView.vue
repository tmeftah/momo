<script setup>
import { BatteryCharging, Activity, CalendarDays, Cable, BookOpen, Wallet, Receipt, Truck, Settings, Lock } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { api, session } from '../api.js';
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
    <ListGroup header="Atelier">
      <ListRow to="/batteries" :icon="BatteryCharging" tile="green" title="Batteries lithium" />
      <ListRow to="/diagnostics" :icon="Activity" tile="teal" title="Diagnostics" />
      <ListRow to="/planning" :icon="CalendarDays" tile="red" title="Planning" />
    </ListGroup>
    <ListGroup header="Bibliothèque">
      <ListRow to="/connecteurs" :icon="Cable" tile="purple" title="Connecteurs & adaptations" />
      <ListRow to="/base" :icon="BookOpen" tile="orange" title="Base technique" />
    </ListGroup>
    <ListGroup header="Commerce">
      <ListRow to="/caisse" :icon="Wallet" tile="green" title="Caisse" />
      <ListRow to="/ventes" :icon="Receipt" tile="yellow" title="Historique des ventes" />
      <ListRow to="/fournisseurs" :icon="Truck" tile="indigo" title="Fournisseurs & achats" />
    </ListGroup>
    <ListGroup>
      <ListRow to="/parametres" :icon="Settings" tile="gray" title="Réglages" />
      <ListRow :icon="Lock" tile="blue" title="Verrouiller" @click="lock" />
    </ListGroup>
  </div>
</template>
