<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { Banknote, Repeat, Handshake, CreditCard, ShoppingCart, Wrench, Activity } from 'lucide-vue-next';
import { api } from '../api.js';
import { METHOD, DOC_LABEL, DOC_ROUTE } from '../constants.js';
import { money, fmtDate, fmtTime, localToday } from '../store.js';
import { toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import Segmented from '../components/Segmented.vue';
import Skeleton from '../components/Skeleton.vue';

const route = useRoute();
const period = ref('today');
const from = ref(localToday());
const to = ref(localToday());
const c = ref(null);

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
watch(period, (p) => {
  const today = localToday();
  if (p === 'today') from.value = to.value = today;
  if (p === 'yesterday') from.value = to.value = iso(new Date(Date.now() - 86400000));
  if (p === 'month') {
    from.value = today.slice(0, 8) + '01';
    to.value = today;
  }
});

async function load() {
  try {
    c.value = await api.get('/cash', { from: from.value, to: to.value });
  } catch (e) {
    toastError(e);
  }
}
onMounted(async () => {
  await load();
  if (route.hash === '#credits') nextTick(() => document.getElementById('credits')?.scrollIntoView({ behavior: 'smooth' }));
});
watch([from, to], load);
</script>

<template>
  <div class="page">
    <NavBar title="Caisse" large back :refresh="load" />
    <Segmented v-model="period" :options="[{ value: 'today', label: 'Aujourd’hui' }, { value: 'yesterday', label: 'Hier' }, { value: 'month', label: 'Mois' }, { value: 'custom', label: 'Dates' }]" />
    <ListGroup v-if="period === 'custom'">
      <label class="cell field"><span class="field-label">Du</span><input v-model="from" type="date" /></label>
      <label class="cell field"><span class="field-label">Au</span><input v-model="to" type="date" /></label>
    </ListGroup>

    <Skeleton v-if="!c" :rows="4" :thumb="false" />
    <template v-else>
      <div class="widgets mt">
        <div class="widget span2 hero-w">
          <div class="w-head">Recettes</div>
          <div class="w-value">{{ money(c.total) }}</div>
          <div class="w-sub">{{ c.payments.length }} paiement(s){{ c.from !== c.to ? ` · du ${fmtDate(c.from)} au ${fmtDate(c.to)}` : '' }}</div>
        </div>
        <div class="widget" style="min-height: 92px">
          <div class="w-head"><Banknote :size="16" />Espèces</div>
          <div class="w-value" style="font-size: 24px">{{ money(c.by_method.especes || 0) }}</div>
        </div>
        <div class="widget" style="min-height: 92px">
          <div class="w-head"><Repeat :size="16" />Échange</div>
          <div class="w-value" style="font-size: 24px">{{ money(c.by_method.echange || 0) }}</div>
        </div>
        <div class="widget" style="min-height: 92px">
          <div class="w-head"><Handshake :size="16" />Emprunt</div>
          <div class="w-value" style="font-size: 24px">{{ money(c.by_method.emprunt || 0) }}</div>
        </div>
        <a href="#credits" class="widget" style="min-height: 92px">
          <div class="w-head" :class="{ 'c-orange': c.credits.total > 0 }"><CreditCard :size="16" />Crédits en cours</div>
          <div class="w-value" style="font-size: 24px">{{ money(c.credits.total) }}</div>
        </a>
      </div>

      <ListGroup header="Encaissé par origine">
        <ListRow :icon="ShoppingCart" tile="accent" title="Ventes" :value="money(c.by_type.sale || 0)" />
        <ListRow :icon="Wrench" tile="accent" title="Réparations" :value="money(c.by_type.repair || 0)" />
        <ListRow :icon="Activity" tile="accent" title="Diagnostics" :value="money(c.by_type.diagnostic || 0)" />
      </ListGroup>

      <ListGroup header="Activité et marges">
        <ListRow :title="`Ventes (${c.sales.count})`" :value="money(c.sales.total)" />
        <ListRow title="Marge sur ventes"><template #trailing><span class="bold num c-green">{{ money(c.sales.margin) }}</span></template></ListRow>
        <ListRow :title="`Réparations livrées (${c.repairs_delivered.count})`" :value="money(c.repairs_delivered.total)" />
        <ListRow title="Main-d'œuvre"><template #trailing><span class="bold num c-green">{{ money(c.repairs_delivered.labor) }}</span></template></ListRow>
        <ListRow title="Marge sur pièces"><template #trailing><span class="bold num c-green">{{ money(c.repairs_delivered.parts_margin) }}</span></template></ListRow>
        <ListRow :title="`Diagnostics conclus (${c.diagnostics.count})`" :value="money(c.diagnostics.total)" />
      </ListGroup>

      <ListGroup header="Paiements reçus">
        <ListRow
          v-for="p in c.payments" :key="p.id" :to="DOC_ROUTE[p.ref_type] + p.ref_id" :icon="METHOD[p.method]?.icon" :tile="METHOD[p.method]?.color"
          :title="p.client_name || 'Client de passage'" :subtitle="`${DOC_LABEL[p.ref_type]} #${p.ref_id} · ${c.from === c.to ? fmtTime(p.created_at) : fmtDate(p.created_at, true)}${p.notes ? ' · ' + p.notes : ''}`" :chevron="false"
        >
          <template #trailing><span class="bold num c-green">+{{ money(p.amount) }}</span></template>
        </ListRow>
        <div v-if="!c.payments.length" class="cell secondary">Aucun paiement sur la période</div>
      </ListGroup>

      <ListGroup id="credits" header="Crédits clients en cours">
        <template #header-right><span class="num c-orange" style="text-transform: none; font-weight: 600">{{ money(c.credits.total) }}</span></template>
        <ListRow
          v-for="d in c.credits.items" :key="d.ref_type + d.id" :to="DOC_ROUTE[d.ref_type] + d.id" :avatar="d.client_name || '?'"
          :title="d.client_name || 'Sans client'" :subtitle="`${DOC_LABEL[d.ref_type]} #${d.id} · ${fmtDate(d.created_at)}${d.label ? ' · ' + d.label : ''}`" :chevron="false"
        >
          <template #trailing><div class="cell-trail"><span class="bold num c-orange">{{ money(d.balance) }}</span><span class="caption secondary">sur {{ money(d.total) }}</span></div></template>
        </ListRow>
        <div v-if="!c.credits.items.length" class="cell secondary">Aucun crédit en cours</div>
      </ListGroup>
    </template>
  </div>
</template>
