<script setup>
// Full-height sheet to pick stock items (or type a non-stock line).
// keepOpen: stays open after each pick so several items can be added in a row.
import { ref, watch, nextTick } from 'vue';
import { Plus, Check } from 'lucide-vue-next';
import { api } from '../api.js';
import { money, fmtNum } from '../store.js';
import { toastError, haptic } from '../ui.js';
import BottomSheet from './BottomSheet.vue';
import SearchField from './SearchField.vue';
import ListGroup from './ListGroup.vue';
import ListRow from './ListRow.vue';
import Segmented from './Segmented.vue';

const props = defineProps({
  open: Boolean,
  title: { type: String, default: 'Ajouter un article' },
  cost: Boolean, // show purchase price instead of sale price
  allowFree: Boolean,
  keepOpen: Boolean,
});
const emit = defineEmits(['close', 'pick', 'free']);

const mode = ref('stock');
const query = ref('');
const results = ref([]);
const loading = ref(false);
const justAdded = ref(null);
const free = ref({ name: '', qty: 1, unit_price: '' });
const search = ref(null);
let timer;

async function find() {
  loading.value = true;
  try {
    results.value = await api.get('/items', { q: query.value, limit: 60 });
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}
watch(query, () => {
  clearTimeout(timer);
  timer = setTimeout(find, 160);
});
watch(
  () => props.open,
  (o) => {
    if (!o) return;
    mode.value = 'stock';
    query.value = '';
    justAdded.value = null;
    find();
    nextTick(() => setTimeout(() => search.value?.focus(), 380));
  }
);

function pick(item) {
  haptic('light');
  emit('pick', item);
  if (props.keepOpen) {
    justAdded.value = item.id;
    setTimeout(() => justAdded.value === item.id && (justAdded.value = null), 1200);
  } else emit('close');
}

function addFree() {
  emit('free', { name: free.value.name.trim(), qty: Number(free.value.qty) || 1, unit_price: Number(free.value.unit_price) || 0 });
  free.value = { name: '', qty: 1, unit_price: '' };
  if (!props.keepOpen) emit('close');
}

const stockColor = (i) => (i.quantity <= 0 ? 'red' : i.low ? 'orange' : 'green');
</script>

<template>
  <BottomSheet
    :open="open" full :title="title" :cancel="keepOpen ? null : 'Annuler'" :action="keepOpen ? 'OK' : mode === 'free' ? 'Ajouter' : undefined"
    :action-disabled="!keepOpen && mode === 'free' && !free.name.trim()"
    @close="emit('close')" @action="keepOpen ? emit('close') : addFree()"
  >
    <div class="vstack" style="gap: 10px">
      <Segmented v-if="allowFree" v-model="mode" :options="[{ value: 'stock', label: 'Stock' }, { value: 'free', label: 'Hors stock' }]" />
      <SearchField v-if="mode === 'stock'" ref="search" v-model="query" placeholder="Nom, référence, tension…" />
    </div>

    <template v-if="mode === 'stock'">
      <ListGroup v-if="results.length">
        <ListRow v-for="i in results" :key="i.id" :thumb="i.photo || null" @click="pick(i)">
          <div class="cell-title wrap">{{ i.name }}</div>
          <div class="cell-sub">{{ [i.reference, i.voltage, i.location].filter(Boolean).join(' · ') || i.category }}</div>
          <template #trailing>
            <div class="cell-trail">
              <span class="bold num">{{ money(cost ? i.purchase_price : i.sale_price) }}</span>
              <span class="pill" :class="stockColor(i)">{{ fmtNum(i.quantity) }} en stock</span>
            </div>
            <span class="tile" :class="justAdded === i.id ? 'bg-green' : 'soft'" style="width: 28px; height: 28px; border-radius: 14px; color: var(--tint)">
              <Check v-if="justAdded === i.id" :size="16" :stroke-width="3" color="#fff" />
              <Plus v-else :size="16" :stroke-width="3" />
            </span>
          </template>
        </ListRow>
      </ListGroup>
      <p v-else-if="!loading" class="center secondary" style="padding: 40px 0">Aucun article trouvé</p>
    </template>

    <template v-else>
      <ListGroup footer="Pour une pièce qui n'est pas gérée dans le stock.">
        <label class="cell field"><span class="field-label">Désignation</span><input v-model="free.name" placeholder="ex : Vis M5 inox" /></label>
        <label class="cell field"><span class="field-label">Quantité</span><input v-model="free.qty" type="number" min="1" inputmode="decimal" /></label>
        <label class="cell field"><span class="field-label">Prix unitaire</span><input v-model="free.unit_price" type="number" step="0.01" inputmode="decimal" placeholder="0" /></label>
      </ListGroup>
      <button v-if="keepOpen" class="btn filled block mt" :disabled="!free.name.trim()" @click="addFree">Ajouter</button>
    </template>
  </BottomSheet>
</template>
