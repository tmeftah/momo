<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Phone, MessageCircle, UserRound, Pencil, Play, CircleCheckBig, Flag, BookOpen, Cable, Activity, Send } from 'lucide-vue-next';
import { api } from '../api.js';
import { REPAIR_STATUSES, STATUS, PRIORITIES, CATEGORY, VEHICLE, PHOTO_TAGS_BEFORE_AFTER } from '../constants.js';
import { money, fmtDate, settings, vehicleName, vehicleEmoji, readyMessage, waLink, telLink } from '../store.js';
import { toast, toastError, confirmAction, chooseAction, haptic } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import PickerRow from '../components/PickerRow.vue';
import Segmented from '../components/Segmented.vue';
import ActionButtons from '../components/ActionButtons.vue';
import LinesEditor from '../components/LinesEditor.vue';
import PaymentsPanel from '../components/PaymentsPanel.vue';
import PhotoGallery from '../components/PhotoGallery.vue';
import RepairDetailsCard from '../components/RepairDetailsCard.vue';
import StatusPill from '../components/StatusPill.vue';
import Skeleton from '../components/Skeleton.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const r = ref(null);
const labor = ref(0);
const payments = ref(null);

async function load() {
  try {
    r.value = await api.get(`/repairs/${id}`);
    labor.value = r.value.labor;
  } catch (e) {
    toastError(e);
  }
}
onMounted(load);

const phone = computed(() => r.value?.client_whatsapp || r.value?.client_phone);
const waReady = computed(() => (r.value ? waLink(phone.value, readyMessage(r.value)) : null));
const actions = computed(() => [
  { icon: Phone, label: 'Appeler', href: telLink(r.value?.client_phone || r.value?.client_whatsapp), disabled: !phone.value },
  { icon: MessageCircle, label: 'WhatsApp', href: waLink(phone.value), external: true, wa: true, disabled: !phone.value },
  { icon: UserRound, label: 'Client', to: r.value?.client_id ? `/clients/${r.value.client_id}` : null, disabled: !r.value?.client_id },
  { icon: Pencil, label: 'Modifier', to: `/reparations/${id}/modifier` },
]);

// ---------- Workflow: suggest the next logical step ----------
const STEPS = ['en_attente', 'en_cours', 'en_test', 'terminee', 'livree'];
const stepIndex = computed(() => {
  const s = r.value?.status;
  if (s === 'en_pause' || s === 'attente_piece') return 1;
  return STEPS.indexOf(s);
});
const sideState = computed(() => ['en_pause', 'attente_piece'].includes(r.value?.status));
const FLOW = {
  en_attente: { next: 'en_cours', label: 'Commencer la réparation', icon: Play, alts: ['attente_piece', 'en_pause'] },
  en_cours: { next: 'terminee', label: 'Réparation terminée', icon: CircleCheckBig, alts: ['en_test', 'en_pause', 'attente_piece'] },
  en_pause: { next: 'en_cours', label: 'Reprendre', icon: Play, alts: ['attente_piece'] },
  attente_piece: { next: 'en_cours', label: 'Pièce reçue — reprendre', icon: Play, alts: ['en_pause'] },
  en_test: { next: 'terminee', label: 'Test OK — terminer', icon: CircleCheckBig, alts: ['en_cours'] },
  terminee: { next: 'livree', label: 'Véhicule récupéré', icon: Flag, alts: [] },
};
const flow = computed(() => FLOW[r.value?.status]);

async function patch(body, msg) {
  try {
    Object.assign(r.value, await api.put(`/repairs/${id}`, body));
    if (msg) toast(msg);
    return true;
  } catch (e) {
    toastError(e);
    return false;
  }
}

async function setStatus(s) {
  if (!s || s === r.value.status) return;
  if (s === 'livree' && r.value.balance > 0.009) {
    const choice = await chooseAction({
      title: `Reste ${money(r.value.balance)} à payer`,
      message: 'Encaisser maintenant, ou livrer et garder le reste en crédit client ?',
      actions: [{ label: 'Encaisser maintenant', value: 'pay' }, { label: 'Livrer — reste en crédit', value: 'credit' }],
    });
    if (choice === 'pay') return payments.value?.openPay();
    if (choice !== 'credit') return;
  }
  haptic(s === 'terminee' || s === 'livree' ? 'success' : 'light');
  await patch({ status: s }, `${STATUS[s].label}`);
}

async function notify() {
  try {
    Object.assign(r.value, await api.post(`/repairs/${id}/notified`));
  } catch {
    /* the WhatsApp link opens anyway */
  }
}

async function saveLabor() {
  if (Number(labor.value) === r.value.labor) return;
  if (await patch({ labor: Number(labor.value) || 0 }, 'Main-d’œuvre enregistrée')) load();
}

async function remove() {
  const ok = await confirmAction('Les pièces seront remises en stock et les paiements supprimés.', { title: `Supprimer la réparation #${id} ?`, confirm: 'Supprimer la réparation' });
  if (!ok) return;
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
    <NavBar :reveal-at="170" :title="r ? vehicleName(r) : ''" back="/atelier">
      <router-link :to="`/reparations/${id}/modifier`" class="nav-btn">Modifier</router-link>
    </NavBar>

    <Skeleton v-if="!r" :rows="5" />
    <template v-else>
      <div class="hero">
        <span class="tile xl soft">{{ vehicleEmoji(r) }}</span>
        <div class="hero-title">{{ vehicleName(r) }}</div>
        <div class="hero-sub">{{ [VEHICLE[r.vehicle_type]?.short, r.voltage, `#${r.id}`].filter(Boolean).join(' · ') }}</div>
        <div class="hero-pills">
          <StatusPill :status="r.status" />
          <span v-if="r.category !== 'general'" class="pill" :class="CATEGORY[r.category]?.color"><component :is="CATEGORY[r.category]?.icon" />{{ CATEGORY[r.category]?.short || CATEGORY[r.category]?.label }}</span>
          <StatusPill v-if="r.priority !== 'normal'" :priority="r.priority" />
        </div>
      </div>
      <ActionButtons :actions="actions" />

      <!-- Next step -->
      <section class="lg">
        <div class="group flow">
          <div class="flow-steps" style="grid-template-columns: repeat(5, 1fr)">
            <i v-for="(s, i) in STEPS" :key="s" :class="{ done: i <= stepIndex && !(sideState && i === stepIndex), warn: sideState && i === stepIndex }" />
          </div>
          <div class="flow-status">
            <span class="tile" :class="`bg-${STATUS[r.status].color}`"><component :is="STATUS[r.status].icon" :size="18" :stroke-width="2.3" /></span>
            <div class="grow">
              <div class="headline">{{ STATUS[r.status].label }}</div>
              <div class="footnote secondary">
                <template v-if="r.status === 'terminee'">{{ r.notified_at ? `Client prévenu ${fmtDate(r.notified_at, true)}` : 'Client pas encore prévenu' }}</template>
                <template v-else-if="r.status === 'livree'">Livrée le {{ fmtDate(r.delivered_at, true) }}</template>
                <template v-else-if="r.due_date">Prévu pour le {{ fmtDate(r.due_date) }}</template>
                <template v-else>Entrée {{ fmtDate(r.created_at) }}</template>
              </div>
            </div>
          </div>
          <a v-if="r.status === 'terminee' && waReady && !r.notified_at" class="btn wa block" :href="waReady" target="_blank" rel="noopener" @click="notify">
            <Send :size="18" />Prévenir le client
          </a>
          <button v-if="flow" class="btn block" :class="r.status === 'terminee' ? (r.notified_at || !waReady ? 'green' : 'gray') : 'filled'" @click="setStatus(flow.next)">
            <component :is="flow.icon" :size="19" :stroke-width="2.3" />{{ flow.label }}
          </button>
          <div v-if="flow?.alts.length" class="flow-alt">
            <button v-for="a in flow.alts" :key="a" class="chip" @click="setStatus(a)">
              <component :is="STATUS[a].icon" :size="15" :stroke-width="2.3" />{{ STATUS[a].label }}
            </button>
          </div>
        </div>
      </section>

      <ListGroup>
        <PickerRow :model-value="r.status" label="Statut" :options="REPAIR_STATUSES" @update:model-value="setStatus" />
        <div class="cell"><span class="cell-main cell-title">Priorité</span><Segmented :model-value="r.priority" :options="PRIORITIES" style="width: 250px" @update:model-value="(p) => patch({ priority: p })" /></div>
      </ListGroup>

      <ListGroup v-if="r.problem || r.diagnosis || r.work_done">
        <div v-if="r.problem" class="cell text-cell" style="display: block"><span class="t-label">Problème déclaré</span>{{ r.problem }}</div>
        <div v-if="r.diagnosis" class="cell text-cell" style="display: block"><span class="t-label">Diagnostic</span>{{ r.diagnosis }}</div>
        <div v-if="r.work_done" class="cell text-cell" style="display: block"><span class="t-label">Travail effectué</span>{{ r.work_done }}</div>
      </ListGroup>

      <ListGroup v-if="r.diagnostic">
        <ListRow :to="`/diagnostics/${r.diagnostic.id}`" :icon="Activity" tile="teal" :title="`Diagnostic #${r.diagnostic.id}`" :subtitle="r.diagnostic.balance > 0.009 ? `${money(r.diagnostic.price)} · reste ${money(r.diagnostic.balance)}` : `${money(r.diagnostic.price)} · payé`" />
      </ListGroup>

      <RepairDetailsCard :category="r.category" :details="r.details" />

      <LinesEditor :repair-id="id" :lines="r.lines" @changed="load" />

      <ListGroup header="Main-d'œuvre">
        <label class="cell field"><span class="field-label">Montant</span><input v-model="labor" type="number" step="0.01" min="0" inputmode="decimal" @change="saveLabor" @keyup.enter="$event.target.blur()" /><span class="unit">{{ settings.currency }}</span></label>
      </ListGroup>

      <PaymentsPanel
        ref="payments" ref-type="repair" :ref-id="id" :total="r.total" :paid="r.paid" :payments="r.payments"
        footer="Acompte possible. Ce qui reste à la livraison devient un crédit client."
        @changed="load"
      />

      <PhotoGallery ref-type="repair" :ref-id="id" :tags="PHOTO_TAGS_BEFORE_AFTER" header="Photos avant / après" />

      <ListGroup header="Capitaliser">
        <ListRow :to="`/base/nouveau?repair_id=${id}`" :icon="BookOpen" tile="orange" title="Ajouter à la base technique" />
        <ListRow :to="`/adaptations/nouvelle?repair_id=${id}`" :icon="Cable" tile="purple" title="Enregistrer une adaptation" />
      </ListGroup>

      <ListGroup v-if="r.notes" header="Notes internes">
        <div class="cell text-cell">{{ r.notes }}</div>
      </ListGroup>

      <ListGroup :footer="`Créée ${fmtDate(r.created_at, true)}${r.finished_at ? ' · terminée ' + fmtDate(r.finished_at, true) : ''}${r.delivered_at ? ' · livrée ' + fmtDate(r.delivered_at, true) : ''}`">
        <ListRow title="Supprimer la réparation" destructive @click="remove" />
      </ListGroup>
    </template>
  </div>
</template>
