<script setup>
// Parts used in a repair. Every change hits the API immediately so the stock stays exact.
import { ref, computed } from 'vue';
import { api } from '../api.js';
import { money, fmtNum, toast, toastError } from '../store.js';
import ItemPicker from './ItemPicker.vue';

const props = defineProps({ repairId: { type: Number, required: true }, lines: { type: Array, default: () => [] } });
const emit = defineEmits(['changed']);

const busy = ref(false);
const free = ref(null);
const total = computed(() => props.lines.reduce((s, l) => s + l.qty * l.unit_price, 0));
const cost = computed(() => props.lines.reduce((s, l) => s + l.qty * l.unit_cost, 0));

async function run(fn, msg) {
  if (busy.value) return;
  busy.value = true;
  try {
    await fn();
    if (msg) toast(msg);
    emit('changed');
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}

const addItem = (item) => {
  if (item.quantity <= 0 && !confirm(`« ${item.name} » est en rupture de stock (${fmtNum(item.quantity)}). Ajouter quand même ?`)) return;
  run(() => api.post(`/repairs/${props.repairId}/lines`, { item_id: item.id, qty: 1 }), 'Pièce ajoutée, stock mis à jour');
};
const addFree = () =>
  run(async () => {
    await api.post(`/repairs/${props.repairId}/lines`, free.value);
    free.value = null;
  }, 'Pièce ajoutée');
const setQty = (l, qty) => qty > 0 && run(() => api.put(`/lines/${l.id}`, { qty }));
const setPrice = (l, e) => run(() => api.put(`/lines/${l.id}`, { unit_price: e.target.value }));
const remove = (l) => confirm(`Retirer « ${l.name} » ? ${l.item_id ? 'La quantité sera remise en stock.' : ''}`) && run(() => api.del(`/lines/${l.id}`), 'Pièce retirée');
</script>

<template>
  <div class="stack">
    <div v-for="l in lines" :key="l.id" class="card" style="padding: 10px; background: var(--surface-2)">
      <div class="row between">
        <div class="grow">
          <div class="strong">{{ l.name }}</div>
          <div class="tiny muted">
            {{ l.item_id ? `Stock restant : ${fmtNum(l.stock_quantity)}` : 'Hors stock' }}
            <template v-if="l.unit_cost"> · achat {{ money(l.unit_cost) }}</template>
          </div>
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" aria-label="Retirer" @click="remove(l)">🗑️</button>
      </div>
      <div class="row" style="margin-top: 8px">
        <button class="btn btn-icon" :disabled="busy || l.qty <= 1" @click="setQty(l, l.qty - 1)">−</button>
        <div class="strong center" style="min-width: 36px">{{ fmtNum(l.qty) }}</div>
        <button class="btn btn-icon" :disabled="busy" @click="setQty(l, l.qty + 1)">+</button>
        <span class="muted">×</span>
        <input class="grow" type="number" step="0.01" inputmode="decimal" :value="l.unit_price" @change="setPrice(l, $event)" />
        <div class="strong right" style="min-width: 80px">{{ money(l.qty * l.unit_price) }}</div>
      </div>
    </div>

    <ItemPicker @pick="addItem" />

    <div v-if="free" class="card stack" style="background: var(--surface-2)">
      <label class="field"><span>Pièce hors stock</span><input v-model="free.name" placeholder="Désignation" /></label>
      <div class="grid-2">
        <label class="field"><span>Quantité</span><input v-model.number="free.qty" type="number" min="1" inputmode="decimal" /></label>
        <label class="field"><span>Prix unitaire</span><input v-model.number="free.unit_price" type="number" step="0.01" inputmode="decimal" /></label>
      </div>
      <div class="row">
        <button class="btn grow" @click="free = null">Annuler</button>
        <button class="btn btn-primary grow" :disabled="!free.name" @click="addFree">Ajouter</button>
      </div>
    </div>
    <button v-else class="btn btn-ghost btn-sm" @click="free = { name: '', qty: 1, unit_price: 0 }">➕ Pièce hors stock</button>

    <div v-if="lines.length" class="totals">
      <div class="line"><span class="muted">Total pièces</span><span class="strong">{{ money(total) }}</span></div>
      <div class="line tiny muted"><span>Marge sur pièces</span><span>{{ money(total - cost) }}</span></div>
    </div>
  </div>
</template>
