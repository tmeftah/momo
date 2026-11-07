<script setup>
// Tasks done on a repair. Each one adds qty × price to the repair total.
import { ref, computed } from 'vue';
import { Plus } from 'lucide-vue-next';
import { api } from '../api.js';
import { money, fmtNum, settings } from '../store.js';
import { toast, toastError, confirmAction } from '../ui.js';
import ListGroup from './ListGroup.vue';
import ListRow from './ListRow.vue';
import BottomSheet from './BottomSheet.vue';
import Stepper from './Stepper.vue';
import TaskPickerSheet from './TaskPickerSheet.vue';

const props = defineProps({ repairId: { type: Number, required: true }, tasks: { type: Array, default: () => [] } });
const emit = defineEmits(['changed']);

const picking = ref(false);
const editing = ref(null); // { task, qty, price }
const busy = ref(false);
const total = computed(() => props.tasks.reduce((s, t) => s + t.qty * t.price, 0));

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

const addTask = (t) => run(() => api.post(`/repairs/${props.repairId}/tasks`, { task_id: t.id }), `${t.name} ajoutée`);
const addFree = (t) => run(() => api.post(`/repairs/${props.repairId}/tasks`, t), t.save ? 'Prestation ajoutée au catalogue' : 'Prestation ajoutée');

const edit = (t) => (editing.value = { task: t, qty: t.qty, price: t.price });
async function saveEdit() {
  const e = editing.value;
  if (await run(() => api.put(`/repair-tasks/${e.task.id}`, { qty: e.qty, price: Number(e.price) || 0 }), 'Prestation modifiée')) editing.value = null;
}
async function removeTask() {
  const t = editing.value.task;
  if (!(await confirmAction('', { title: `Retirer « ${t.name} » ?`, confirm: 'Retirer la prestation' }))) return;
  if (await run(() => api.del(`/repair-tasks/${t.id}`), 'Prestation retirée')) editing.value = null;
}
</script>

<template>
  <ListGroup header="Prestations">
    <ListRow v-for="t in tasks" :key="t.id" chevron @click="edit(t)">
      <div class="cell-title wrap">{{ t.name }}</div>
      <div v-if="t.qty !== 1" class="cell-sub">{{ fmtNum(t.qty) }} × {{ money(t.price) }}</div>
      <template #trailing><span class="bold num">{{ money(t.qty * t.price) }}</span></template>
    </ListRow>
    <ListRow :icon="Plus" tile="accent" title="Ajouter une prestation" action @click="picking = true" />
    <template v-if="tasks.length" #footer>
      Total prestations <b class="num" style="color: var(--label)">{{ money(total) }}</b>
    </template>
  </ListGroup>

  <TaskPickerSheet :open="picking" @close="picking = false" @pick="addTask" @free="addFree" />

  <BottomSheet :open="!!editing" :title="editing?.task.name" action="OK" :action-disabled="busy" @close="editing = null" @action="saveEdit">
    <template v-if="editing">
      <ListGroup footer="Le prix du catalogue ne change pas.">
        <div class="cell"><span class="cell-main cell-title">Quantité</span><Stepper v-model="editing.qty" /></div>
        <label class="cell field"><span class="field-label">Prix</span><input v-model.number="editing.price" type="number" step="0.01" min="0" inputmode="decimal" /><span class="unit">{{ settings.currency }}</span></label>
        <ListRow title="Total" :value="money(editing.qty * (Number(editing.price) || 0))" />
      </ListGroup>
      <ListGroup>
        <ListRow title="Retirer la prestation" destructive @click="removeTask" />
      </ListGroup>
    </template>
  </BottomSheet>
</template>
