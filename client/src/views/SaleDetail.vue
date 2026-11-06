<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { money, fmtNum, fmtDate, toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import PaymentsPanel from '../components/PaymentsPanel.vue';
import ContactButtons from '../components/ContactButtons.vue';
import ClientPicker from '../components/ClientPicker.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const s = ref(null);
const editClient = ref(false);

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
    editClient.value = false;
    toast('Client associé');
  } catch (e) {
    toastError(e);
  }
}

async function cancel() {
  if (!confirm(`Annuler la vente #${id} ? Les articles seront remis en stock et les paiements supprimés.`)) return;
  try {
    await api.del(`/sales/${id}`);
    toast('Vente annulée, stock rétabli');
    router.replace('/ventes');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="`🧾 Vente #${id}`" back />
    <div v-if="s" class="stack">
      <div class="card stack">
        <div class="row between">
          <router-link v-if="s.client_id" :to="`/clients/${s.client_id}`" class="strong">👤 {{ s.client_name }}</router-link>
          <span v-else class="muted">Client de passage</span>
          <button class="btn btn-sm" @click="editClient = !editClient">{{ s.client_id ? 'Changer' : '➕ Associer un client' }}</button>
        </div>
        <ClientPicker v-if="editClient" :model-value="s.client_id" @update:model-value="setClient" />
        <div class="small muted">{{ fmtDate(s.created_at, true) }}</div>
        <ContactButtons v-if="s.client_id" :phone="s.client_phone" :whatsapp="s.client_whatsapp" />
      </div>

      <div class="card">
        <table class="table">
          <thead><tr><th>Article</th><th class="right">Qté</th><th class="right">Prix</th><th class="right">Total</th></tr></thead>
          <tbody>
            <tr v-for="l in s.lines" :key="l.id">
              <td><router-link v-if="l.item_id" :to="`/stock/${l.item_id}`">{{ l.name }}</router-link><template v-else>{{ l.name }}</template></td>
              <td class="right">{{ fmtNum(l.qty) }}</td>
              <td class="right">{{ money(l.unit_price) }}</td>
              <td class="right strong">{{ money(l.qty * l.unit_price) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="row between tiny muted" style="margin-top: 8px"><span>Coût d'achat {{ money(s.cost) }}</span><span>Marge {{ money(s.total - s.cost) }}</span></div>
      </div>

      <div class="card">
        <PaymentsPanel ref-type="sale" :ref-id="id" :total="s.total" :paid="s.paid" :payments="s.payments" @changed="load" />
      </div>
      <div v-if="s.notes" class="card small"><div class="label">Note</div>{{ s.notes }}</div>
      <button class="btn btn-danger" @click="cancel">↩️ Annuler la vente (remettre en stock)</button>
    </div>
  </div>
</template>
