<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Phone, MessageCircle, Wrench, ShoppingCart, Activity, CreditCard } from 'lucide-vue-next';
import { api } from '../api.js';
import { DOC_LABEL, DOC_ROUTE, METHOD } from '../constants.js';
import { money, fmtDate, vehicleName, vehicleEmoji, waLink, telLink, monthLabel, groupBy } from '../store.js';
import { toast, toastError, confirmAction } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import RepairRow from '../components/RepairRow.vue';
import StatusPill from '../components/StatusPill.vue';
import ChipSelect from '../components/ChipSelect.vue';
import Avatar from '../components/Avatar.vue';
import ActionButtons from '../components/ActionButtons.vue';
import Skeleton from '../components/Skeleton.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const h = ref(null);
const tab = ref('tout');

onMounted(async () => {
  try {
    h.value = await api.get(`/clients/${id}/history`);
  } catch (e) {
    toastError(e);
  }
});

const c = computed(() => h.value?.client);
const repairsOnly = computed(() => h.value?.repairs.filter((r) => r.category !== 'batterie') || []);
const batteries = computed(() => h.value?.repairs.filter((r) => r.category === 'batterie') || []);

const actions = computed(() => [
  { icon: Phone, label: 'Appeler', href: telLink(c.value?.phone || c.value?.whatsapp), disabled: !(c.value?.phone || c.value?.whatsapp) },
  { icon: MessageCircle, label: 'WhatsApp', href: waLink(c.value?.whatsapp || c.value?.phone), external: true, wa: true, disabled: !(c.value?.whatsapp || c.value?.phone) },
  { icon: Wrench, label: 'Réparation', to: `/reparations/nouvelle?client_id=${id}` },
  { icon: ShoppingCart, label: 'Vente', to: `/vente?client_id=${id}` },
]);

const tabs = computed(() => [
  { value: 'tout', label: 'Tout' },
  { value: 'reparations', label: 'Réparations', count: repairsOnly.value.length },
  { value: 'batteries', label: 'Batteries', count: batteries.value.length },
  { value: 'diagnostics', label: 'Diagnostics', count: h.value?.diagnostics.length || 0 },
  { value: 'achats', label: 'Achats', count: h.value?.sales.length || 0 },
  { value: 'paiements', label: 'Paiements', count: h.value?.payments.length || 0 },
  { value: 'credits', label: 'Crédits', count: h.value?.credits.length || 0 },
]);

// Unified timeline grouped by month
const timeline = computed(() => {
  if (!h.value) return [];
  const items = [
    ...h.value.repairs.map((r) => ({ key: `r${r.id}`, date: r.created_at, emoji: vehicleEmoji(r), title: vehicleName(r), sub: `${r.category === 'batterie' ? 'Batterie' : 'Réparation'} #${r.id}`, amount: r.total, to: `/reparations/${r.id}`, status: r.status })),
    ...h.value.diagnostics.map((d) => ({ key: `d${d.id}`, date: d.created_at, emoji: '⚡', title: d.fault_found || d.symptoms || 'Diagnostic', sub: `Diagnostic #${d.id}`, amount: d.price, to: `/diagnostics/${d.id}` })),
    ...h.value.sales.map((s) => ({ key: `s${s.id}`, date: s.created_at, emoji: '🛒', title: s.summary, sub: `Achat #${s.id}`, amount: s.total, to: `/ventes/${s.id}` })),
    ...h.value.payments.map((p) => ({ key: `p${p.id}`, date: p.created_at, icon: METHOD[p.method]?.icon, tile: METHOD[p.method]?.color, title: `Paiement ${METHOD[p.method]?.label?.toLowerCase() || ''}`, sub: `${DOC_LABEL[p.ref_type]} #${p.ref_id}`, amount: p.amount, to: DOC_ROUTE[p.ref_type] + p.ref_id, paid: true })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  return groupBy(items, (i) => monthLabel(i.date));
});

async function remove() {
  if (!(await confirmAction('Impossible si le client a un historique.', { title: `Supprimer ${c.value.name} ?`, confirm: 'Supprimer le client' }))) return;
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
    <NavBar :reveal-at="180" :title="c?.name || ''" back="/clients">
      <router-link :to="`/clients/${id}/modifier`" class="nav-btn">Modifier</router-link>
    </NavBar>

    <Skeleton v-if="!h" :rows="4" />
    <template v-else>
      <div class="hero">
        <Avatar :name="c.name" :size="96" />
        <div class="hero-title">{{ c.name }}</div>
        <div class="hero-sub">Client depuis {{ fmtDate(c.created_at) }}</div>
      </div>
      <ActionButtons :actions="actions" />

      <router-link v-if="c.credit > 0" :to="h.credits[0] ? DOC_ROUTE[h.credits[0].ref_type] + h.credits[0].id : ''" class="widget mt" style="min-height: 0; flex-direction: row; align-items: center; gap: 12px">
        <span class="tile lg bg-orange"><CreditCard :size="22" /></span>
        <div class="grow">
          <div class="footnote secondary">Crédit en cours</div>
          <div class="title2 num c-orange">{{ money(c.credit) }}</div>
        </div>
        <span class="pill orange">{{ h.credits.length }} impayé(s)</span>
      </router-link>

      <ListGroup>
        <ListRow v-if="c.phone" title="Téléphone" :value="c.phone" :href="telLink(c.phone)" />
        <ListRow v-if="c.whatsapp && c.whatsapp !== c.phone" title="WhatsApp" :value="c.whatsapp" :href="waLink(c.whatsapp)" external />
        <ListRow v-if="c.address" title="Adresse" :value="c.address" />
        <div v-if="c.notes" class="cell text-cell" style="display: block"><span class="t-label">Notes</span>{{ c.notes }}</div>
      </ListGroup>

      <div class="lg-header big mt">Historique</div>
      <ChipSelect v-model="tab" :options="tabs" scroll />

      <template v-if="tab === 'tout'">
        <ListGroup v-for="m in timeline" :key="m.key" :header="m.key">
          <ListRow v-for="t in m.items" :key="t.key" :to="t.to" :emoji="t.emoji" :icon="t.icon" :tile="t.tile || 'soft'" :title="t.title" :subtitle="`${t.sub} · ${fmtDate(t.date)}`" :chevron="false">
            <template #trailing>
              <div class="cell-trail">
                <span class="bold num" :class="{ 'c-green': t.paid }">{{ t.paid ? '+' : '' }}{{ money(t.amount) }}</span>
                <StatusPill v-if="t.status" :status="t.status" />
              </div>
            </template>
          </ListRow>
        </ListGroup>
        <p v-if="!timeline.length" class="center secondary" style="padding: 32px 0">Aucun historique pour le moment</p>
      </template>

      <ListGroup v-else>
        <template v-if="tab === 'reparations'"><RepairRow v-for="r in repairsOnly" :key="r.id" :repair="r" /></template>
        <template v-if="tab === 'batteries'"><RepairRow v-for="r in batteries" :key="r.id" :repair="r" /></template>
        <template v-if="tab === 'diagnostics'">
          <ListRow v-for="d in h.diagnostics" :key="d.id" :to="`/diagnostics/${d.id}`" :icon="Activity" tile="teal" :title="d.fault_found || d.symptoms || 'Diagnostic'" :subtitle="`#${d.id} · ${fmtDate(d.created_at)}`">
            <template #trailing><div class="cell-trail"><span class="bold num">{{ money(d.price) }}</span><StatusPill :decision="d.decision" short /></div></template>
          </ListRow>
        </template>
        <template v-if="tab === 'achats'">
          <ListRow v-for="s in h.sales" :key="s.id" :to="`/ventes/${s.id}`" emoji="🛒" tile="soft" :title="s.summary" :subtitle="`#${s.id} · ${fmtDate(s.created_at)}`">
            <template #trailing><div class="cell-trail"><span class="bold num">{{ money(s.total) }}</span><span v-if="s.balance > 0.009" class="pill orange">reste {{ money(s.balance) }}</span></div></template>
          </ListRow>
        </template>
        <template v-if="tab === 'paiements'">
          <ListRow v-for="p in h.payments" :key="p.id" :to="DOC_ROUTE[p.ref_type] + p.ref_id" :icon="METHOD[p.method]?.icon" :tile="METHOD[p.method]?.color" :title="METHOD[p.method]?.label" :subtitle="`${DOC_LABEL[p.ref_type]} #${p.ref_id} · ${fmtDate(p.created_at, true)}`">
            <template #trailing><span class="bold num c-green">+{{ money(p.amount) }}</span></template>
          </ListRow>
        </template>
        <template v-if="tab === 'credits'">
          <ListRow v-for="cr in h.credits" :key="cr.ref_type + cr.id" :to="DOC_ROUTE[cr.ref_type] + cr.id" :icon="CreditCard" tile="orange" :title="`${DOC_LABEL[cr.ref_type]} #${cr.id}`" :subtitle="[cr.label, fmtDate(cr.created_at)].filter(Boolean).join(' · ')">
            <template #trailing><div class="cell-trail"><span class="bold num c-orange">{{ money(cr.balance) }}</span><span class="caption secondary">sur {{ money(cr.total) }}</span></div></template>
          </ListRow>
        </template>
        <div v-if="tabs.find((t) => t.value === tab)?.count === 0" class="cell centered secondary">Rien à afficher</div>
      </ListGroup>

      <ListGroup class="mt">
        <ListRow title="Supprimer le client" destructive @click="remove" />
      </ListGroup>
    </template>
  </div>
</template>
