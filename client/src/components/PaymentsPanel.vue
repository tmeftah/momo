<script setup>
import { ref, computed, watch } from 'vue';
import { api } from '../api.js';
import { COLLECT_METHODS, METHOD } from '../constants.js';
import { money, fmtDate, toast, toastError } from '../store.js';
import ChipSelect from './ChipSelect.vue';

const props = defineProps({
  refType: { type: String, required: true },
  refId: { type: Number, required: true },
  total: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  payments: { type: Array, default: () => [] },
  hint: String,
});
const emit = defineEmits(['changed']);

const balance = computed(() => Math.round((props.total - props.paid) * 100) / 100);
const amount = ref(0);
const method = ref('especes');
const notes = ref('');
const busy = ref(false);
watch(balance, (b) => (amount.value = Math.max(b, 0)), { immediate: true });

async function pay() {
  busy.value = true;
  try {
    await api.post('/payments', { ref_type: props.refType, ref_id: props.refId, amount: amount.value, method: method.value, notes: notes.value });
    notes.value = '';
    toast('Paiement enregistré');
    emit('changed');
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}

async function remove(p) {
  if (!confirm(`Supprimer le paiement de ${money(p.amount)} ?`)) return;
  try {
    await api.del(`/payments/${p.id}`);
    emit('changed');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="stack">
    <div class="totals">
      <div class="line"><span>Total</span><span class="grand">{{ money(total) }}</span></div>
      <div class="line"><span class="muted">Déjà payé</span><span class="strong">{{ money(paid) }}</span></div>
      <div class="line">
        <span>Reste à payer</span>
        <span :class="balance > 0.009 ? 'due' : 'ok'">{{ balance > 0.009 ? money(balance) : '✅ Payé' }}</span>
      </div>
    </div>

    <div v-if="payments.length" class="list">
      <div v-for="p in payments" :key="p.id" class="row" style="padding: 8px 0; border-bottom: 1px solid var(--border)">
        <span>{{ METHOD[p.method]?.icon }}</span>
        <div class="grow">
          <div class="strong">{{ money(p.amount) }} <span class="muted small">{{ METHOD[p.method]?.label }}</span></div>
          <div class="tiny muted">{{ fmtDate(p.created_at, true) }}<template v-if="p.notes"> · {{ p.notes }}</template></div>
        </div>
        <button class="btn btn-ghost btn-sm" aria-label="Supprimer" @click="remove(p)">✕</button>
      </div>
    </div>

    <template v-if="balance > 0.009">
      <p v-if="hint" class="tiny muted" style="margin: 0">{{ hint }}</p>
      <ChipSelect v-model="method" :options="COLLECT_METHODS" />
      <div class="row">
        <div class="input-suffix grow">
          <input v-model.number="amount" type="number" step="0.01" min="0" inputmode="decimal" />
        </div>
        <button class="btn btn-success" :disabled="busy || !(amount > 0)" @click="pay">Encaisser</button>
      </div>
      <input v-model="notes" placeholder="Note (facultatif) — ex : vélo donné en échange" />
    </template>
  </div>
</template>
