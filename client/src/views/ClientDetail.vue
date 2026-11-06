<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { DOC_LABEL, DOC_ROUTE, METHOD } from '../constants.js';
import { money, fmtDate, toast, toastError, vehicleLabel } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ContactButtons from '../components/ContactButtons.vue';
import RepairCard from '../components/RepairCard.vue';
import StatusBadge from '../components/StatusBadge.vue';
import ChipSelect from '../components/ChipSelect.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const h = ref(null);
const tab = ref('tout');

async function load() {
  try {
    h.value = await api.get(`/clients/${id}/history`);
  } catch (e) {
    toastError(e);
  }
}
onMounted(load);

const repairsOnly = computed(() => h.value?.repairs.filter((r) => r.category !== 'batterie') || []);
const batteries = computed(() => h.value?.repairs.filter((r) => r.category === 'batterie') || []);

const tabs = computed(() => [
  { value: 'tout', label: 'Tout' },
  { value: 'reparations', label: '🔧 Réparations', count: repairsOnly.value.length },
  { value: 'diagnostics', label: '⚡ Diagnostics', count: h.value?.diagnostics.length || 0 },
  { value: 'achats', label: '🛒 Achats', count: h.value?.sales.length || 0 },
  { value: 'paiements', label: '💵 Paiements', count: h.value?.payments.length || 0 },
  { value: 'credits', label: '💳 Crédits', count: h.value?.credits.length || 0 },
  { value: 'batteries', label: '🔋 Batteries', count: batteries.value.length },
]);

// Unified timeline for the "Tout" tab
const timeline = computed(() => {
  if (!h.value) return [];
  const items = [
    ...h.value.repairs.map((r) => ({ key: `r${r.id}`, date: r.created_at, icon: r.category === 'batterie' ? '🔋' : '🔧', title: vehicleLabel(r), sub: `Réparation #${r.id}`, amount: r.total, to: `/reparations/${r.id}`, status: r.status })),
    ...h.value.diagnostics.map((d) => ({ key: `d${d.id}`, date: d.created_at, icon: '⚡', title: d.fault_found || d.symptoms || 'Diagnostic', sub: `Diagnostic #${d.id}`, amount: d.price, to: `/diagnostics/${d.id}` })),
    ...h.value.sales.map((s) => ({ key: `s${s.id}`, date: s.created_at, icon: '🛒', title: s.summary, sub: `Vente #${s.id}`, amount: s.total, to: `/ventes/${s.id}` })),
    ...h.value.payments.map((p) => ({ key: `p${p.id}`, date: p.created_at, icon: METHOD[p.method]?.icon || '💵', title: `Paiement ${METHOD[p.method]?.label || ''}`, sub: `${DOC_LABEL[p.ref_type]} #${p.ref_id}`, amount: p.amount, to: DOC_ROUTE[p.ref_type] + p.ref_id, paid: true })),
  ];
  return items.sort((a, b) => (a.date < b.date ? 1 : -1));
});

async function remove() {
  if (!confirm(`Supprimer le client « ${h.value.client.name} » ?`)) return;
  try {
    await api.del(`/clients/${id}`);
    toast('Client supprimé');
    router.replace('/clients');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="h?.client.name || 'Client'" back="/clients">
      <router-link :to="`/clients/${id}/modifier`" class="btn btn-sm">✏️</router-link>
    </PageHeader>
    <div v-if="h" class="stack">
      <div class="card stack">
        <dl class="kv" style="margin: 0">
          <template v-if="h.client.phone"><dt>Téléphone</dt><dd>{{ h.client.phone }}</dd></template>
          <template v-if="h.client.whatsapp && h.client.whatsapp !== h.client.phone"><dt>WhatsApp</dt><dd>{{ h.client.whatsapp }}</dd></template>
          <template v-if="h.client.address"><dt>Adresse</dt><dd>{{ h.client.address }}</dd></template>
          <dt>Client depuis</dt><dd>{{ fmtDate(h.client.created_at) }}</dd>
          <dt>Crédit en cours</dt>
          <dd :class="h.client.credit > 0 ? 'text-orange' : 'text-green'">{{ h.client.credit > 0 ? money(h.client.credit) : 'Aucun' }}</dd>
        </dl>
        <div v-if="h.client.notes" class="block-text small">{{ h.client.notes }}</div>
        <ContactButtons :phone="h.client.phone" :whatsapp="h.client.whatsapp" />
      </div>

      <div class="grid-3">
        <router-link :to="`/reparations/nouvelle?client_id=${id}`" class="quick-action primary" style="min-height: 76px"><span class="qa-icon" style="font-size: 1.4rem">🔧</span>Réparation</router-link>
        <router-link :to="`/diagnostics/nouveau?client_id=${id}`" class="quick-action" style="min-height: 76px"><span class="qa-icon" style="font-size: 1.4rem">⚡</span>Diagnostic</router-link>
        <router-link :to="`/vente?client_id=${id}`" class="quick-action accent" style="min-height: 76px"><span class="qa-icon" style="font-size: 1.4rem">🛒</span>Vente</router-link>
      </div>

      <div class="section-title">Historique</div>
      <ChipSelect v-model="tab" :options="tabs" scroll />

      <div class="list">
        <template v-if="tab === 'tout'">
          <router-link v-for="t in timeline" :key="t.key" :to="t.to" class="list-item">
            <div class="thumb">{{ t.icon }}</div>
            <div class="grow">
              <div class="title ellipsis">{{ t.title }}</div>
              <div class="sub">{{ t.sub }} · {{ fmtDate(t.date) }}</div>
            </div>
            <div class="right">
              <div class="strong" :class="{ 'text-green': t.paid }">{{ t.paid ? '+' : '' }}{{ money(t.amount) }}</div>
              <StatusBadge v-if="t.status" :status="t.status" />
            </div>
          </router-link>
        </template>
        <template v-if="tab === 'reparations'"><RepairCard v-for="r in repairsOnly" :key="r.id" :repair="r" /></template>
        <template v-if="tab === 'batteries'"><RepairCard v-for="r in batteries" :key="r.id" :repair="r" /></template>
        <template v-if="tab === 'diagnostics'">
          <router-link v-for="d in h.diagnostics" :key="d.id" :to="`/diagnostics/${d.id}`" class="list-item">
            <div class="thumb">⚡</div>
            <div class="grow">
              <div class="title ellipsis">{{ d.fault_found || d.symptoms || 'Diagnostic' }}</div>
              <div class="sub">#{{ d.id }} · {{ fmtDate(d.created_at) }}</div>
              <StatusBadge :decision="d.decision" />
            </div>
            <div class="strong">{{ money(d.price) }}</div>
          </router-link>
        </template>
        <template v-if="tab === 'achats'">
          <router-link v-for="s in h.sales" :key="s.id" :to="`/ventes/${s.id}`" class="list-item">
            <div class="thumb">🛒</div>
            <div class="grow">
              <div class="title ellipsis">{{ s.summary }}</div>
              <div class="sub">#{{ s.id }} · {{ fmtDate(s.created_at) }}</div>
            </div>
            <div class="right">
              <div class="strong">{{ money(s.total) }}</div>
              <div v-if="s.balance > 0.009" class="tiny text-orange">doit {{ money(s.balance) }}</div>
            </div>
          </router-link>
        </template>
        <template v-if="tab === 'paiements'">
          <router-link v-for="p in h.payments" :key="p.id" :to="DOC_ROUTE[p.ref_type] + p.ref_id" class="list-item">
            <div class="thumb">{{ METHOD[p.method]?.icon }}</div>
            <div class="grow">
              <div class="title">{{ METHOD[p.method]?.label }}</div>
              <div class="sub">{{ DOC_LABEL[p.ref_type] }} #{{ p.ref_id }} · {{ fmtDate(p.created_at, true) }}</div>
            </div>
            <div class="strong text-green">{{ money(p.amount) }}</div>
          </router-link>
        </template>
        <template v-if="tab === 'credits'">
          <router-link v-for="c in h.credits" :key="c.ref_type + c.id" :to="DOC_ROUTE[c.ref_type] + c.id" class="list-item">
            <div class="thumb">💳</div>
            <div class="grow">
              <div class="title ellipsis">{{ DOC_LABEL[c.ref_type] }} #{{ c.id }} {{ c.label ? '· ' + c.label : '' }}</div>
              <div class="sub">{{ fmtDate(c.created_at) }} · total {{ money(c.total) }}</div>
            </div>
            <div class="strong text-orange">{{ money(c.balance) }}</div>
          </router-link>
        </template>
        <div v-if="tab === 'tout' && !timeline.length" class="empty small">Aucun historique</div>
      </div>

      <button class="btn btn-danger" style="margin-top: 20px" @click="remove">Supprimer le client</button>
    </div>
  </div>
</template>
