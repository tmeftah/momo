<script setup>
import { ref, computed } from 'vue';
import { api } from '../api.js';
import { METHOD } from '../constants.js';
import { money, fmtDate, round2 } from '../store.js';
import { toast, toastError, confirmAction } from '../ui.js';
import ListGroup from './ListGroup.vue';
import ListRow from './ListRow.vue';
import PaySheet from './PaySheet.vue';

const props = defineProps({
  refType: { type: String, required: true },
  refId: { type: Number, required: true },
  total: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  payments: { type: Array, default: () => [] },
  footer: String,
});
const emit = defineEmits(['changed']);

const balance = computed(() => round2(props.total - props.paid));
const paying = ref(false);
const busy = ref(false);
defineExpose({ openPay: () => (paying.value = balance.value > 0.009) });

async function pay({ amount, method, notes }) {
  busy.value = true;
  try {
    await api.post('/payments', { ref_type: props.refType, ref_id: props.refId, amount, method, notes });
    paying.value = false;
    toast(`${money(amount)} encaissé`);
    emit('changed');
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}

async function remove(p) {
  if (!(await confirmAction(`${money(p.amount)} · ${METHOD[p.method]?.label} · ${fmtDate(p.created_at, true)}`, { title: 'Supprimer ce paiement ?' }))) return;
  try {
    await api.del(`/payments/${p.id}`);
    toast('Paiement supprimé');
    emit('changed');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <ListGroup header="Paiement" :footer="footer">
    <ListRow title="Total"><template #trailing><span class="title3 num">{{ money(total) }}</span></template></ListRow>
    <ListRow title="Déjà payé" :value="money(paid)" />
    <ListRow title="Reste à payer">
      <template #trailing>
        <span v-if="balance > 0.009" class="bold num c-orange">{{ money(balance) }}</span>
        <span v-else class="pill green">Payé</span>
      </template>
    </ListRow>
    <ListRow
      v-for="p in payments" :key="p.id" :icon="METHOD[p.method]?.icon" :tile="METHOD[p.method]?.color"
      :title="`${METHOD[p.method]?.label}`" :subtitle="[fmtDate(p.created_at, true), p.notes].filter(Boolean).join(' · ')"
      @click="remove(p)"
    >
      <template #trailing><span class="bold num c-green">+{{ money(p.amount) }}</span></template>
    </ListRow>
  </ListGroup>
  <button v-if="balance > 0.009" class="btn green block mt-s" @click="paying = true">Encaisser {{ money(balance) }}</button>
  <PaySheet :open="paying" :due="balance" :busy="busy" confirm-label="Encaisser" @close="paying = false" @confirm="pay" />
</template>
