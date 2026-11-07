<script setup>
// Checkout sheet: big amount, payment method cards, remaining balance.
import { ref, computed, watch } from 'vue';
import { PAYMENT_METHODS, COLLECT_METHODS } from '../constants.js';
import { money, round2, settings } from '../store.js';
import BottomSheet from './BottomSheet.vue';

const props = defineProps({
  open: Boolean,
  due: { type: Number, default: 0 },
  title: { type: String, default: 'Encaisser' },
  allowCredit: Boolean,
  confirmLabel: { type: String, default: 'Valider' },
  busy: Boolean,
});
const emit = defineEmits(['close', 'confirm']);

const method = ref('especes');
const amount = ref(0);
const notes = ref('');
const touched = ref(false);
const methods = computed(() => (props.allowCredit ? PAYMENT_METHODS : COLLECT_METHODS));
const remaining = computed(() => Math.max(0, round2(props.due - (Number(amount.value) || 0))));
const tooMuch = computed(() => Number(amount.value) > props.due + 0.009);

watch(() => props.open, (o) => {
  if (!o) return;
  method.value = 'especes';
  amount.value = props.due;
  notes.value = '';
  touched.value = false;
});
watch(method, (m) => {
  if (!touched.value) amount.value = m === 'credit' ? 0 : props.due;
});

function confirm() {
  if (tooMuch.value) return;
  emit('confirm', { method: method.value, amount: Number(amount.value) || 0, notes: notes.value });
}
</script>

<template>
  <BottomSheet :open="open" :title="title" @close="emit('close')">
    <div class="center" style="padding: 8px 0 18px">
      <div class="footnote secondary">{{ method === 'credit' ? 'Acompte versé maintenant (espèces)' : 'Montant reçu' }}</div>
      <div class="hstack" style="justify-content: center; gap: 6px">
        <input
          v-model="amount" class="num" type="number" step="0.01" min="0" inputmode="decimal"
          :style="{ width: `${Math.max(String(amount ?? '').length, 1) + 0.5}ch` }"
          style="border: 0; outline: none; background: none; color: var(--label); text-align: right; font: inherit; font-size: 48px; font-weight: 750; letter-spacing: -0.03em; padding: 0; max-width: 70vw"
          @input="touched = true"
        />
        <span class="title1 secondary">{{ settings.currency }}</span>
      </div>
      <div class="subhead secondary">sur {{ money(due) }}</div>
      <div class="chips" style="justify-content: center; margin-top: 12px">
        <button class="chip" :class="{ on: Number(amount) === due }" @click="amount = due; touched = true">Tout</button>
        <button class="chip" :class="{ on: Number(amount) === round2(due / 2) }" @click="amount = round2(due / 2); touched = true">Moitié</button>
        <button v-if="allowCredit" class="chip" :class="{ on: Number(amount) === 0 }" @click="amount = 0; touched = true">Rien</button>
      </div>
    </div>

    <div class="options" :class="{ two: methods.length === 4 }" :style="methods.length === 3 ? 'grid-template-columns: repeat(3, 1fr)' : ''">
      <button v-for="m in methods" :key="m.value" type="button" class="option" :class="{ on: method === m.value }" @click="method = m.value">
        <span class="tile" :class="`bg-${m.color}`"><component :is="m.icon" :size="18" :stroke-width="2.2" /></span>{{ m.label }}
      </button>
    </div>

    <div class="group mt" style="padding: 14px 16px">
      <div class="hstack between">
        <span>Reste à payer</span>
        <span class="bold num" :class="tooMuch ? 'c-red' : remaining > 0 ? 'c-orange' : 'c-green'">
          {{ tooMuch ? 'Montant trop élevé' : remaining > 0 ? `${money(remaining)} en crédit` : 'Payé' }}
        </span>
      </div>
    </div>
    <input v-model="notes" class="textbox mt-s" placeholder="Note (facultatif) — ex : vélo reçu en échange" />

    <button class="btn green lg block mt" :disabled="busy || tooMuch || (!allowCredit && !(Number(amount) > 0))" @click="confirm">{{ confirmLabel }}</button>
  </BottomSheet>
</template>
