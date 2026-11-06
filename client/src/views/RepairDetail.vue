<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { REPAIR_STATUSES, PRIORITIES, CATEGORY, VEHICLE, PHOTO_TAGS_BEFORE_AFTER } from '../constants.js';
import { money, fmtDate, toast, toastError, vehicleLabel, readyMessage, waLink } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ChipSelect from '../components/ChipSelect.vue';
import ContactButtons from '../components/ContactButtons.vue';
import LinesEditor from '../components/LinesEditor.vue';
import PaymentsPanel from '../components/PaymentsPanel.vue';
import PhotoGallery from '../components/PhotoGallery.vue';
import RepairDetailsCard from '../components/RepairDetailsCard.vue';
import StatusBadge from '../components/StatusBadge.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const r = ref(null);
const labor = ref(0);

async function load() {
  try {
    r.value = await api.get(`/repairs/${id}`);
    labor.value = r.value.labor;
  } catch (e) {
    toastError(e);
  }
}
onMounted(load);

const waReady = computed(() => (r.value ? waLink(r.value.client_whatsapp || r.value.client_phone, readyMessage(r.value)) : null));

async function patch(body, msg) {
  try {
    const updated = await api.put(`/repairs/${id}`, body);
    Object.assign(r.value, updated);
    if (msg) toast(msg);
  } catch (e) {
    toastError(e);
  }
}

function setStatus(s) {
  if (s === r.value.status) return;
  if (s === 'livree' && r.value.balance > 0.009 && !confirm(`Le client doit encore ${money(r.value.balance)}.\nLivrer quand même ? (le reste passe en crédit client)`)) return;
  patch({ status: s }, `Statut : ${REPAIR_STATUSES.find((x) => x.value === s).label}`);
}

async function notify() {
  try {
    Object.assign(r.value, await api.post(`/repairs/${id}/notified`));
  } catch {
    /* the WhatsApp link opens anyway */
  }
}

async function remove() {
  if (!confirm(`Supprimer la réparation #${id} ? Les pièces seront remises en stock et les paiements supprimés.`)) return;
  try {
    await api.del(`/repairs/${id}`);
    toast('Réparation supprimée');
    router.replace('/atelier');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="r ? `#${r.id} ${CATEGORY[r.category]?.label || 'Réparation'}` : 'Réparation'" back>
      <router-link :to="`/reparations/${id}/modifier`" class="btn btn-sm">✏️ Modifier</router-link>
    </PageHeader>

    <div v-if="r" class="stack">
      <div class="card stack">
        <div class="row">
          <div class="thumb" style="width: 60px; height: 60px; font-size: 1.8rem">{{ CATEGORY[r.category]?.icon }}</div>
          <div class="grow">
            <h2>{{ vehicleLabel(r) }}</h2>
            <div class="small muted">{{ VEHICLE[r.vehicle_type]?.label }}<template v-if="r.voltage"> · {{ r.voltage }}</template><template v-if="r.serial"> · S/N {{ r.serial }}</template></div>
            <div class="row wrap" style="gap: 6px; margin-top: 6px">
              <StatusBadge :status="r.status" /><StatusBadge :priority="r.priority" />
            </div>
          </div>
        </div>
        <div class="row between small">
          <router-link v-if="r.client_id" :to="`/clients/${r.client_id}`" class="strong">👤 {{ r.client_name }}</router-link>
          <span v-else class="muted">Sans client</span>
          <span class="muted">Entrée le {{ fmtDate(r.created_at) }}</span>
        </div>
        <div v-if="r.due_date" class="small">📅 Prévu pour le <b>{{ fmtDate(r.due_date) }}</b></div>
        <ContactButtons :phone="r.client_phone" :whatsapp="r.client_whatsapp" />
      </div>

      <!-- Ready → tell the customer, then deliver -->
      <div v-if="r.status === 'terminee'" class="card stack" style="border-color: rgba(34, 197, 94, 0.5)">
        <div class="strong">✅ Réparation terminée {{ r.notified_at ? `· client prévenu le ${fmtDate(r.notified_at, true)}` : '' }}</div>
        <a v-if="waReady" class="btn btn-wa btn-lg" :href="waReady" target="_blank" rel="noopener" @click="notify">💬 Prévenir le client (WhatsApp)</a>
        <button class="btn btn-success btn-lg" @click="setStatus('livree')">🏁 Véhicule récupéré (livrée)</button>
      </div>

      <div class="section-title">Statut</div>
      <div class="status-grid">
        <button v-for="s in REPAIR_STATUSES" :key="s.value" class="status-btn" :class="{ active: r.status === s.value }" @click="setStatus(s.value)">{{ s.icon }} {{ s.label }}</button>
      </div>
      <ChipSelect :model-value="r.priority" :options="PRIORITIES" @update:model-value="(p) => patch({ priority: p })" />

      <div v-if="r.problem || r.diagnosis || r.work_done" class="card stack">
        <template v-if="r.problem"><div class="label">Problème déclaré</div><div class="block-text">{{ r.problem }}</div></template>
        <template v-if="r.diagnosis"><div class="label">Diagnostic</div><div class="block-text">{{ r.diagnosis }}</div></template>
        <template v-if="r.work_done"><div class="label">Travail effectué</div><div class="block-text">{{ r.work_done }}</div></template>
      </div>
      <router-link v-if="r.diagnostic" :to="`/diagnostics/${r.diagnostic.id}`" class="list-item">
        <div class="thumb">⚡</div>
        <div class="grow">
          <div class="title">Issu du diagnostic #{{ r.diagnostic.id }}</div>
          <div class="sub">{{ money(r.diagnostic.price) }} · {{ r.diagnostic.balance > 0.009 ? `reste ${money(r.diagnostic.balance)}` : 'payé' }}</div>
        </div>
      </router-link>

      <RepairDetailsCard :category="r.category" :details="r.details" />

      <div class="section-title">Pièces utilisées</div>
      <LinesEditor :repair-id="id" :lines="r.lines" @changed="load" />

      <div class="section-title">Main-d'œuvre</div>
      <div class="row">
        <input v-model.number="labor" class="grow" type="number" step="0.01" min="0" inputmode="decimal" />
        <button class="btn" :disabled="labor === r.labor" @click="patch({ labor }, 'Main-d\'œuvre enregistrée')">💾</button>
      </div>

      <div class="section-title">Paiement</div>
      <div class="card">
        <PaymentsPanel
          ref-type="repair" :ref-id="id" :total="r.total" :paid="r.paid" :payments="r.payments"
          hint="Acompte possible. Le reste non payé à la livraison apparaît en crédit client."
          @changed="load"
        />
      </div>

      <div class="section-title">Photos</div>
      <PhotoGallery ref-type="repair" :ref-id="id" :tags="PHOTO_TAGS_BEFORE_AFTER" />

      <div class="section-title">Capitaliser</div>
      <div class="grid-2">
        <router-link :to="`/base/nouveau?repair_id=${id}`" class="btn">📚 Ajouter à la base technique</router-link>
        <router-link :to="`/adaptations/nouvelle?repair_id=${id}`" class="btn">🔌 Enregistrer une adaptation</router-link>
      </div>

      <div v-if="r.notes" class="card"><div class="label">Notes internes</div><div class="pre small">{{ r.notes }}</div></div>
      <div class="tiny muted">
        Créée {{ fmtDate(r.created_at, true) }}<template v-if="r.finished_at"> · terminée {{ fmtDate(r.finished_at, true) }}</template><template v-if="r.delivered_at"> · livrée {{ fmtDate(r.delivered_at, true) }}</template>
      </div>
      <button class="btn btn-danger" @click="remove">Supprimer la réparation</button>
    </div>
  </div>
</template>
