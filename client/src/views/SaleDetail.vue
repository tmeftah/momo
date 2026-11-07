<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { money, fmtNum, fmtDate } from '../store.js';
import { toast, toastError, confirmAction } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import PaymentsPanel from '../components/PaymentsPanel.vue';
import ClientPicker from '../components/ClientPicker.vue';
import Skeleton from '../components/Skeleton.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const s = ref(null);

async function load() {
  try {
    s.value = await api.get(`/sales/${id}`);
  } catch (e) {
    toastError(e);
  }
}
onMounted(load);

async function setClient(clientId) {
  try {
    s.value = await api.put(`/sales/${id}`, { client_id: clientId, notes: s.value.notes });
    toast(clientId ? 'Client associé' : 'Client retiré');
  } catch (e) {
    toastError(e);
  }
}

async function cancel() {
  if (!(await confirmAction('Les articles seront remis en stock et les paiements supprimés.', { title: `Annuler la vente #${id} ?`, confirm: 'Annuler la vente' }))) return;
  try {
    await api.del(`/sales/${id}`);
    toast('Vente annulée · stock rétabli');
    router.replace('/ventes');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <NavBar :reveal-at="100" :title="`Vente #${id}`" back="/ventes" />
    <Skeleton v-if="!s" :rows="4" />
    <template v-else>
      <div class="hero" style="padding: 12px 0 4px">
        <div class="footnote secondary">Vente #{{ s.id }} · {{ fmtDate(s.created_at, true) }}</div>
        <div class="hero-amount">{{ money(s.total) }}</div>
        <div class="hero-pills">
          <span v-if="s.balance > 0.009" class="pill orange">Reste {{ money(s.balance) }}</span>
          <span v-else class="pill green">Payée</span>
        </div>
      </div>

      <ListGroup header="Client">
        <ClientPicker :model-value="s.client_id" optional @update:model-value="setClient" />
      </ListGroup>

      <ListGroup header="Articles" :footer="`Coût d'achat ${money(s.cost)} · marge ${money(s.total - s.cost)}`">
        <ListRow
          v-for="l in s.lines" :key="l.id" :to="l.item_id ? `/stock/${l.item_id}` : undefined" :thumb="l.photo || null" :thumb-icon="l.item_id ? '📦' : '🔩'"
          :title="l.name" :subtitle="`${fmtNum(l.qty)} × ${money(l.unit_price)}`" :chevron="false"
        >
          <template #trailing><span class="bold num">{{ money(l.qty * l.unit_price) }}</span></template>
        </ListRow>
      </ListGroup>

      <PaymentsPanel ref-type="sale" :ref-id="id" :total="s.total" :paid="s.paid" :payments="s.payments" @changed="load" />

      <ListGroup v-if="s.notes" header="Note"><div class="cell text-cell">{{ s.notes }}</div></ListGroup>
      <ListGroup>
        <ListRow title="Annuler la vente et remettre en stock" destructive @click="cancel" />
      </ListGroup>
    </template>
  </div>
</template>
