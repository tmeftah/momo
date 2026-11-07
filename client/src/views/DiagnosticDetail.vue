<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Phone, MessageCircle, UserRound, Pencil, Wrench, BookOpen, Timer } from 'lucide-vue-next';
import { api } from '../api.js';
import { DIAG_DECISIONS, VEHICLE, STATUS } from '../constants.js';
import { money, fmtDate, vehicleName, vehicleIcon, waLink, telLink } from '../store.js';
import { toast, toastError, confirmAction, haptic } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import ActionButtons from '../components/ActionButtons.vue';
import PaymentsPanel from '../components/PaymentsPanel.vue';
import PhotoGallery from '../components/PhotoGallery.vue';
import StatusPill from '../components/StatusPill.vue';
import Skeleton from '../components/Skeleton.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const d = ref(null);
const converting = ref(false);

async function load() {
  try {
    d.value = await api.get(`/diagnostics/${id}`);
  } catch (e) {
    toastError(e);
  }
}
onMounted(load);

const phone = computed(() => d.value?.client_whatsapp || d.value?.client_phone);
const actions = computed(() => [
  { icon: Phone, label: 'Appeler', href: telLink(d.value?.client_phone || d.value?.client_whatsapp), disabled: !phone.value },
  { icon: MessageCircle, label: 'WhatsApp', href: waLink(phone.value), external: true, wa: true, disabled: !phone.value },
  { icon: UserRound, label: 'Client', to: d.value?.client_id ? `/clients/${d.value.client_id}` : null, disabled: !d.value?.client_id },
  { icon: Pencil, label: 'Modifier', to: `/diagnostics/${id}/modifier` },
]);

async function decide(value) {
  haptic('light');
  try {
    d.value = await api.put(`/diagnostics/${id}`, { decision: d.value.decision === value ? null : value });
  } catch (e) {
    toastError(e);
  }
}

async function convert() {
  converting.value = true;
  try {
    const { repair_id } = await api.post(`/diagnostics/${id}/convert`);
    haptic('success');
    toast(`Réparation #${repair_id} créée`);
    router.push(`/reparations/${repair_id}`);
  } catch (e) {
    toastError(e);
  } finally {
    converting.value = false;
  }
}

async function remove() {
  if (!(await confirmAction('Ses paiements seront aussi supprimés.', { title: `Supprimer le diagnostic #${id} ?`, confirm: 'Supprimer le diagnostic' }))) return;
  try {
    await api.del(`/diagnostics/${id}`);
    toast('Diagnostic supprimé');
    router.replace('/diagnostics');
  } catch (e) {
    toastError(e);
  }
}

const sections = [
  ['symptoms', 'Symptômes'],
  ['tests', 'Tests réalisés'],
  ['measurements', 'Mesures', true],
  ['fault_found', 'Panne trouvée'],
  ['proposed_solution', 'Solution proposée'],
];
</script>

<template>
  <div class="page">
    <NavBar :reveal-at="170" :title="`Diagnostic #${id}`" back="/diagnostics">
      <router-link :to="`/diagnostics/${id}/modifier`" class="nav-btn">Modifier</router-link>
    </NavBar>
    <Skeleton v-if="!d" :rows="5" />
    <template v-else>
      <div class="hero">
        <span class="tile xl soft"><component :is="vehicleIcon(d)" :size="36" :stroke-width="1.8" /></span>
        <div class="hero-title">{{ vehicleName(d) }}</div>
        <div class="hero-sub">{{ [VEHICLE[d.vehicle_type]?.short, d.voltage, d.client_name].filter(Boolean).join(' · ') }}</div>
        <div class="hero-pills">
          <StatusPill :decision="d.decision" />
          <span class="pill gray"><Timer />{{ d.duration_min }} min</span>
          <StatusPill v-if="d.priority !== 'normal'" :priority="d.priority" />
        </div>
      </div>
      <ActionButtons :actions="actions" />

      <ListGroup>
        <template v-for="[k, label, mono] in sections" :key="k">
          <div v-if="d[k]" class="cell" :class="mono ? 'code-cell' : 'text-cell'" style="display: block">
            <span class="t-label" style="font-family: var(--font)">{{ label }}</span><span :class="{ bold: k === 'fault_found' }">{{ d[k] }}</span>
          </div>
        </template>
        <ListRow v-if="!d.symptoms && !d.fault_found" :to="`/diagnostics/${id}/modifier`" title="Compléter le diagnostic" action />
      </ListGroup>

      <div class="lg-header mt">Décision du client</div>
      <div class="options two">
        <button v-for="o in DIAG_DECISIONS" :key="o.value" type="button" class="option row" :class="{ on: d.decision === o.value }" @click="decide(o.value)">
          <span class="tile" :class="`bg-${o.color}`"><component :is="o.icon" :size="18" :stroke-width="2.3" /></span>{{ o.label }}
        </button>
      </div>

      <ListGroup v-if="d.repair">
        <ListRow :to="`/reparations/${d.repair.id}`" :icon="Wrench" tile="accent" :title="`Réparation #${d.repair.id}`" :subtitle="`${STATUS[d.repair.status]?.label} · ${money(d.repair.total)}`" />
      </ListGroup>
      <template v-else-if="d.decision !== 'refuse' && d.decision !== 'impossible'">
        <button class="btn filled lg block mt" :disabled="converting" @click="convert"><Wrench :size="20" />Créer la réparation</button>
        <p class="lg-footer">Reprend client, véhicule, symptômes, mesures et photos. Le diagnostic reste facturable à part (mettez son prix à 0 s'il est inclus).</p>
      </template>

      <PaymentsPanel ref-type="diagnostic" :ref-id="id" :total="d.price" :paid="d.paid" :payments="d.payments" @changed="load" />

      <PhotoGallery ref-type="diagnostic" :ref-id="id" />

      <ListGroup>
        <ListRow :to="`/base/nouveau?diagnostic_id=${id}`" :icon="BookOpen" tile="accent" title="Ajouter à la base technique" />
      </ListGroup>
      <ListGroup v-if="d.notes" header="Notes"><div class="cell text-cell">{{ d.notes }}</div></ListGroup>
      <ListGroup :footer="`Créé ${fmtDate(d.created_at, true)}`">
        <ListRow title="Supprimer le diagnostic" destructive @click="remove" />
      </ListGroup>
    </template>
  </div>
</template>
