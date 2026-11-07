<script setup>
// Full-height sheet to pick recurring tasks from the catalog (most used first),
// or type a new one and optionally keep it in the catalog. Stays open so several can be added.
import { ref, watch, nextTick } from 'vue';
import { Plus, Check } from 'lucide-vue-next';
import { api } from '../api.js';
import { money, settings } from '../store.js';
import { toastError, haptic } from '../ui.js';
import BottomSheet from './BottomSheet.vue';
import SearchField from './SearchField.vue';
import ListGroup from './ListGroup.vue';
import ListRow from './ListRow.vue';
import Segmented from './Segmented.vue';
import Toggle from './Toggle.vue';

const props = defineProps({ open: Boolean, title: { type: String, default: 'Ajouter une prestation' } });
const emit = defineEmits(['close', 'pick', 'free']);

const mode = ref('catalog');
const query = ref('');
const results = ref(null);
const justAdded = ref(null);
const free = ref({ name: '', price: '', save: true });
const search = ref(null);
let timer;

async function find() {
  try {
    results.value = await api.get('/tasks', { q: query.value, limit: 200 });
  } catch (e) {
    toastError(e);
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
    query.value = '';
    justAdded.value = null;
    free.value = { name: '', price: '', save: true };
    find().then(() => {
      // Empty catalog: go straight to typing the first task
      mode.value = results.value?.length ? 'catalog' : 'free';
      if (mode.value === 'catalog') nextTick(() => setTimeout(() => search.value?.focus(), 380));
    });
  }
);

function pick(t) {
  haptic('light');
  emit('pick', t);
  justAdded.value = t.id;
  setTimeout(() => justAdded.value === t.id && (justAdded.value = null), 1200);
}

function addFree() {
  const name = free.value.name.trim();
  if (!name) return;
  emit('free', { name, price: Number(free.value.price) || 0, save: free.value.save });
  free.value = { name: '', price: '', save: free.value.save };
  // A task kept in the catalog shows up in the list on the next search
  if (free.value.save) setTimeout(find, 400);
}

const usage = (t) => (t.uses ? `Faite ${t.uses} fois` : 'Pas encore utilisée');
</script>

<template>
  <BottomSheet :open="open" full :title="title" :cancel="null" action="OK" @close="emit('close')" @action="emit('close')">
    <div class="vstack" style="gap: 12px">
      <Segmented v-model="mode" :options="[{ value: 'catalog', label: 'Catalogue' }, { value: 'free', label: 'Nouvelle' }]" />
      <SearchField v-if="mode === 'catalog'" ref="search" v-model="query" placeholder="Réglage freins, chambre à air…" />
    </div>

    <template v-if="mode === 'catalog'">
      <ListGroup v-if="results?.length">
        <ListRow v-for="t in results" :key="t.id" @click="pick(t)">
          <div class="cell-title wrap">{{ t.name }}</div>
          <div class="cell-sub">{{ t.notes || usage(t) }}</div>
          <template #trailing>
            <span class="bold num">{{ money(t.price) }}</span>
            <span class="tile" :class="justAdded === t.id ? 'bg-green' : 'soft'" style="width: 28px; height: 28px; border-radius: 14px; color: var(--tint)">
              <Check v-if="justAdded === t.id" :size="16" :stroke-width="3" color="#fff" />
              <Plus v-else :size="16" :stroke-width="3" />
            </span>
          </template>
        </ListRow>
      </ListGroup>
      <p v-else-if="results" class="center secondary" style="padding: 40px 0">{{ query ? 'Aucune prestation trouvée' : 'Catalogue vide' }}</p>
    </template>

    <template v-else>
      <ListGroup footer="Le prix reste modifiable sur chaque réparation.">
        <label class="cell field"><span class="field-label">Prestation</span><input v-model="free.name" placeholder="ex : Dévoilage roue" @keyup.enter="addFree" /></label>
        <label class="cell field"><span class="field-label">Prix</span><input v-model="free.price" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0" /><span class="unit">{{ settings.currency }}</span></label>
        <div class="cell"><span class="cell-main cell-title">Garder dans le catalogue</span><Toggle v-model="free.save" /></div>
      </ListGroup>
      <button class="btn filled block mt" :disabled="!free.name.trim()" @click="addFree">Ajouter</button>
    </template>
  </BottomSheet>
</template>
