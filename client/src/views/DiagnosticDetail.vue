<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { DIAG_DECISIONS, VEHICLE, STATUS } from '../constants.js';
import { money, fmtDate, toast, toastError, vehicleLabel } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ContactButtons from '../components/ContactButtons.vue';
import PaymentsPanel from '../components/PaymentsPanel.vue';
import PhotoGallery from '../components/PhotoGallery.vue';
import StatusBadge from '../components/StatusBadge.vue';

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

async function decide(value) {
  try {
    d.value = await api.put(`/diagnostics/${id}`, { decision: d.value.decision === value ? null : value });
    toast('Décision enregistrée');
  } catch (e) {
    toastError(e);
  }
}

async function convert() {
  converting.value = true;
  try {
    const { repair_id } = await api.post(`/diagnostics/${id}/convert`);
    toast(`Réparation #${repair_id} créée`);
    router.push(`/reparations/${repair_id}`);
  } catch (e) {
    toastError(e);
  } finally {
    converting.value = false;
  }
}

async function remove() {
  if (!confirm(`Supprimer le diagnostic #${id} et ses paiements ?`)) return;
  try {
    await api.del(`/diagnostics/${id}`);
    router.replace('/diagnostics');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="`⚡ Diagnostic #${id}`" back>
      <router-link :to="`/diagnostics/${id}/modifier`" class="btn btn-sm">✏️ Modifier</router-link>
    </PageHeader>
    <div v-if="d" class="stack">
      <div class="card stack">
        <h2>{{ vehicleLabel(d) }}</h2>
        <div class="small muted">{{ VEHICLE[d.vehicle_type]?.label }}<template v-if="d.voltage"> · {{ d.voltage }}</template><template v-if="d.serial"> · S/N {{ d.serial }}</template></div>
        <div class="row between small">
          <router-link v-if="d.client_id" :to="`/clients/${d.client_id}`" class="strong">👤 {{ d.client_name }}</router-link>
          <span v-else class="muted">Sans client</span>
          <span class="muted">{{ fmtDate(d.created_at, true) }}</span>
        </div>
        <div class="row wrap"><StatusBadge :decision="d.decision" /><StatusBadge :priority="d.priority" /><span class="badge">⏱️ {{ d.duration_min }} min</span></div>
        <ContactButtons :phone="d.client_phone" :whatsapp="d.client_whatsapp" />
      </div>

      <div class="card stack">
        <template v-if="d.symptoms"><div class="label">Symptômes</div><div class="block-text">{{ d.symptoms }}</div></template>
        <template v-if="d.tests"><div class="label">Tests réalisés</div><div class="block-text">{{ d.tests }}</div></template>
        <template v-if="d.measurements"><div class="label">Mesures</div><div class="block-text mono small">{{ d.measurements }}</div></template>
        <template v-if="d.fault_found"><div class="label">Panne trouvée</div><div class="block-text strong">{{ d.fault_found }}</div></template>
        <template v-if="d.proposed_solution"><div class="label">Solution proposée</div><div class="block-text">{{ d.proposed_solution }}</div></template>
        <div v-if="!d.symptoms && !d.fault_found" class="muted small">Complétez le diagnostic via « Modifier ».</div>
      </div>

      <div class="section-title">Décision du client</div>
      <div class="status-grid">
        <button v-for="o in DIAG_DECISIONS" :key="o.value" class="status-btn" :class="{ active: d.decision === o.value }" @click="decide(o.value)">{{ o.icon }} {{ o.label }}</button>
      </div>

      <router-link v-if="d.repair" :to="`/reparations/${d.repair.id}`" class="list-item">
        <div class="thumb">🔧</div>
        <div class="grow">
          <div class="title">Réparation #{{ d.repair.id }}</div>
          <div class="sub">{{ STATUS[d.repair.status]?.icon }} {{ STATUS[d.repair.status]?.label }} · {{ money(d.repair.total) }}</div>
        </div>
        <span>›</span>
      </router-link>
      <button v-else-if="d.decision === 'acceptee' || !d.decision || d.decision === 'reflechit'" class="btn btn-primary btn-lg" :disabled="converting" @click="convert">
        🔧 Créer une réparation
      </button>
      <p v-if="!d.repair" class="tiny muted" style="margin: -4px 0 0">Reprend client, véhicule, symptômes, mesures et photos sans ressaisie. Le diagnostic reste facturable séparément (mettez son prix à 0 s'il est inclus dans la réparation).</p>

      <div class="section-title">Paiement du diagnostic</div>
      <div class="card">
        <PaymentsPanel ref-type="diagnostic" :ref-id="id" :total="d.price" :paid="d.paid" :payments="d.payments" @changed="load" />
      </div>

      <div class="section-title">Photos</div>
      <PhotoGallery ref-type="diagnostic" :ref-id="id" />

      <router-link :to="`/base/nouveau?diagnostic_id=${id}`" class="btn">📚 Ajouter à la base technique</router-link>
      <div v-if="d.notes" class="card"><div class="label">Notes</div><div class="pre small">{{ d.notes }}</div></div>
      <button class="btn btn-danger" @click="remove">Supprimer le diagnostic</button>
    </div>
  </div>
</template>
