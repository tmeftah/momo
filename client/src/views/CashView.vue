<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';
import { METHOD, DOC_LABEL, DOC_ROUTE } from '../constants.js';
import { money, fmtDate, localToday, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';

const route = useRoute();
const from = ref(localToday());
const to = ref(localToday());
const c = ref(null);

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

function preset(p) {
  const today = localToday();
  if (p === 'today') from.value = to.value = today;
  if (p === 'yesterday') {
    const d = new Date(Date.now() - 86400000);
    from.value = to.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (p === 'month') {
    from.value = today.slice(0, 8) + '01';
    to.value = today;
  }
}
</script>

<template>
  <div class="page">
    <PageHeader title="💰 Caisse" back />
    <div class="stack">
      <div class="chips">
        <button class="chip" @click="preset('today')">Aujourd'hui</button>
        <button class="chip" @click="preset('yesterday')">Hier</button>
        <button class="chip" @click="preset('month')">Ce mois</button>
      </div>
      <div class="grid-2">
        <label class="field"><span>Du</span><input v-model="from" type="date" /></label>
        <label class="field"><span>Au</span><input v-model="to" type="date" /></label>
      </div>

      <template v-if="c">
        <div class="stat yellow">
          <span class="stat-label">Recettes de la période</span>
          <span class="stat-value" style="font-size: 2rem">{{ money(c.total) }}</span>
          <span class="stat-sub">{{ c.payments.length }} paiement(s)</span>
        </div>
        <div class="stats">
          <div class="stat green"><span class="stat-label">💵 Espèces</span><span class="stat-value">{{ money(c.by_method.especes || 0) }}</span></div>
          <div class="stat cyan"><span class="stat-label">🔄 Échange</span><span class="stat-value">{{ money(c.by_method.echange || 0) }}</span></div>
          <div class="stat purple"><span class="stat-label">🤝 Emprunt</span><span class="stat-value">{{ money(c.by_method.emprunt || 0) }}</span></div>
          <div class="stat orange"><span class="stat-label">💳 Crédits en cours</span><span class="stat-value">{{ money(c.credits.total) }}</span><span class="stat-sub">toutes dates</span></div>
        </div>

        <div class="section-title">Encaissements par origine</div>
        <div class="card">
          <dl class="kv" style="margin: 0">
            <dt>🛒 Ventes payées</dt><dd>{{ money(c.by_type.sale || 0) }}</dd>
            <dt>🔧 Réparations payées</dt><dd>{{ money(c.by_type.repair || 0) }}</dd>
            <dt>⚡ Diagnostics payés</dt><dd>{{ money(c.by_type.diagnostic || 0) }}</dd>
          </dl>
        </div>

        <div class="section-title">Activité & marges</div>
        <div class="card">
          <dl class="kv" style="margin: 0">
            <dt>Ventes ({{ c.sales.count }})</dt><dd>{{ money(c.sales.total) }}</dd>
            <dt>↳ coût d'achat</dt><dd class="muted">{{ money(c.sales.cost) }}</dd>
            <dt>↳ marge ventes</dt><dd class="text-green">{{ money(c.sales.margin) }}</dd>
            <dt>Réparations livrées ({{ c.repairs_delivered.count }})</dt><dd>{{ money(c.repairs_delivered.total) }}</dd>
            <dt>↳ main-d'œuvre</dt><dd class="text-green">{{ money(c.repairs_delivered.labor) }}</dd>
            <dt>↳ marge pièces</dt><dd class="text-green">{{ money(c.repairs_delivered.parts_margin) }}</dd>
            <dt>Diagnostics conclus ({{ c.diagnostics.count }})</dt><dd>{{ money(c.diagnostics.total) }}</dd>
          </dl>
        </div>

        <div class="section-title">Paiements reçus</div>
        <div class="list">
          <router-link v-for="p in c.payments" :key="p.id" :to="DOC_ROUTE[p.ref_type] + p.ref_id" class="list-item" style="min-height: 56px">
            <div class="thumb" style="width: 40px; height: 40px; font-size: 1.2rem">{{ METHOD[p.method]?.icon }}</div>
            <div class="grow">
              <div class="title small">{{ DOC_LABEL[p.ref_type] }} #{{ p.ref_id }} · {{ p.client_name || 'Client de passage' }}</div>
              <div class="sub tiny">{{ fmtDate(p.created_at, true) }}<template v-if="p.notes"> · {{ p.notes }}</template></div>
            </div>
            <div class="strong text-green">{{ money(p.amount) }}</div>
          </router-link>
          <div v-if="!c.payments.length" class="empty small">Aucun paiement sur la période</div>
        </div>

        <div id="credits" class="section-title">💳 Crédits clients en cours ({{ money(c.credits.total) }})</div>
        <div class="list">
          <router-link v-for="d in c.credits.items" :key="d.ref_type + d.id" :to="DOC_ROUTE[d.ref_type] + d.id" class="list-item" style="min-height: 56px">
            <div class="grow">
              <div class="title small">{{ d.client_name || 'Sans client' }}</div>
              <div class="sub tiny ellipsis">{{ DOC_LABEL[d.ref_type] }} #{{ d.id }} · {{ fmtDate(d.created_at) }}{{ d.label ? ' · ' + d.label : '' }}</div>
            </div>
            <div class="right">
              <div class="strong text-orange">{{ money(d.balance) }}</div>
              <div class="tiny muted">sur {{ money(d.total) }}</div>
            </div>
          </router-link>
          <div v-if="!c.credits.items.length" class="empty small">Aucun crédit en cours 🎉</div>
        </div>
      </template>
    </div>
  </div>
</template>
