<script setup>
// Parts used in a repair. Changes hit the API immediately so the stock stays exact.
import { ref, computed } from 'vue';
import { Plus } from 'lucide-vue-next';
import { api } from '../api.js';
import { money, fmtNum } from '../store.js';
import { toast, toastError, confirmAction } from '../ui.js';
import ListGroup from './ListGroup.vue';
import ListRow from './ListRow.vue';
import ItemPickerSheet from './ItemPickerSheet.vue';
import BottomSheet from './BottomSheet.vue';
import Stepper from './Stepper.vue';

const props = defineProps({ repairId: { type: Number, required: true }, lines: { type: Array, default: () => [] } });
const emit = defineEmits(['changed']);

const picking = ref(false);
const editing = ref(null); // { line, qty, unit_price }
const busy = ref(false);
const total = computed(() => props.lines.reduce((s, l) => s + l.qty * l.unit_price, 0));
const cost = computed(() => props.lines.reduce((s, l) => s + l.qty * l.unit_cost, 0));

async function run(fn, msg) {
  if (busy.value) return false;
  busy.value = true;
  try {
    await fn();
    if (msg) toast(msg);
    emit('changed');
    return true;
  } catch (e) {
    toastError(e);
    return false;
  } finally {
    busy.value = false;
  }
}

async function addItem(item) {
  if (item.quantity <= 0 && !(await confirmAction(`« ${item.name} » est en rupture (${fmtNum(item.quantity)} en stock).`, { confirm: 'Ajouter quand même', destructive: false }))) return;
  run(() => api.post(`/repairs/${props.repairId}/lines`, { item_id: item.id, qty: 1 }), `${item.name} ajouté · stock mis à jour`);
}
const addFree = (l) => run(() => api.post(`/repairs/${props.repairId}/lines`, l), 'Pièce ajoutée');

const edit = (l) => (editing.value = { line: l, qty: l.qty, unit_price: l.unit_price });
async function saveEdit() {
  const e = editing.value;
  if (await run(() => api.put(`/lines/${e.line.id}`, { qty: e.qty, unit_price: e.unit_price }), 'Pièce modifiée')) editing.value = null;
}
async function removeLine() {
  const l = editing.value.line;
  if (!(await confirmAction(l.item_id ? 'La quantité sera remise en stock.' : '', { title: `Retirer « ${l.name} » ?`, confirm: 'Retirer la pièce' }))) return;
  if (await run(() => api.del(`/lines/${l.id}`), 'Pièce retirée')) editing.value = null;
}
</script>

<template>
  <ListGroup header="Pièces utilisées">
    <ListRow v-for="l in lines" :key="l.id" :thumb="l.photo || null" :thumb-icon="l.item_id ? '📦' : '🔩'" chevron @click="edit(l)">
      <div class="cell-title">{{ l.name }}</div>
      <div class="cell-sub">{{ fmtNum(l.qty) }} × {{ money(l.unit_price) }} · {{ l.item_id ? `reste ${fmtNum(l.stock_quantity)} en stock` : 'hors stock' }}</div>
      <template #trailing><span class="bold num">{{ money(l.qty * l.unit_price) }}</span></template>
    </ListRow>
    <ListRow :icon="Plus" tile="blue" title="Ajouter une pièce" action @click="picking = true" />
    <template v-if="lines.length" #footer>
      <div class="hstack between"><span>Total pièces <b class="num" style="color: var(--label)">{{ money(total) }}</b></span><span>Marge {{ money(total - cost) }}</span></div>
    </template>
  </ListGroup>

  <ItemPickerSheet :open="picking" title="Ajouter une pièce" allow-free keep-open @close="picking = false" @pick="addItem" @free="addFree" />

  <BottomSheet :open="!!editing" :title="editing?.line.name" action="OK" :action-disabled="busy" @close="editing = null" @action="saveEdit">
    <template v-if="editing">
      <ListGroup>
        <div class="cell"><span class="cell-main cell-title">Quantité</span><Stepper v-model="editing.qty" /></div>
        <label class="cell field"><span class="field-label">Prix unitaire</span><input v-model.number="editing.unit_price" type="number" step="0.01" inputmode="decimal" /></label>
        <ListRow title="Total" :value="money(editing.qty * editing.unit_price)" />
      </ListGroup>
      <ListGroup>
        <ListRow title="Retirer la pièce" destructive @click="removeLine" />
      </ListGroup>
    </template>
  </BottomSheet>
</template>
