<script setup>
// Row showing the chosen client; opens a searchable sheet with inline "new client" creation.
import { ref, watch, nextTick } from 'vue';
import { UserPlus, UserRound } from 'lucide-vue-next';
import { api } from '../api.js';
import { toastError } from '../ui.js';
import ListRow from './ListRow.vue';
import ListGroup from './ListGroup.vue';
import BottomSheet from './BottomSheet.vue';
import SearchField from './SearchField.vue';

const props = defineProps({ modelValue: [Number, String, null], optional: Boolean, label: { type: String, default: 'Client' } });
const emit = defineEmits(['update:modelValue', 'selected']);

const selected = ref(null);
const open = ref(false);
const creating = ref(false);
const query = ref('');
const results = ref([]);
const draft = ref({ name: '', phone: '' });
const search = ref(null);
let timer;

async function loadSelected() {
  if (!props.modelValue) return (selected.value = null);
  if (selected.value?.id === Number(props.modelValue)) return;
  selected.value = await api.get(`/clients/${props.modelValue}`).catch(() => null);
}
watch(() => props.modelValue, loadSelected, { immediate: true });

async function find() {
  try {
    results.value = await api.get('/clients', { q: query.value, limit: 40 });
  } catch (e) {
    toastError(e);
  }
}
watch(query, () => {
  clearTimeout(timer);
  timer = setTimeout(find, 180);
});

function show() {
  creating.value = false;
  query.value = '';
  open.value = true;
  find();
  nextTick(() => setTimeout(() => search.value?.focus(), 350));
}

function choose(c) {
  selected.value = c;
  emit('update:modelValue', c?.id ?? null);
  emit('selected', c);
  open.value = false;
}

function startCreate() {
  const q = query.value.trim();
  draft.value = /^[\d\s+]+$/.test(q) ? { name: '', phone: q } : { name: q, phone: '' };
  creating.value = true;
}

async function create() {
  if (!draft.value.name.trim()) return;
  try {
    const c = await api.post('/clients', { ...draft.value, whatsapp: draft.value.phone });
    choose(c);
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <ListRow v-if="selected" :avatar="selected.name" :title="selected.name" :subtitle="selected.phone || selected.whatsapp || label" chevron @click="show" />
  <ListRow v-else :icon="UserRound" tile="gray" :title="label" :value="optional ? 'Client de passage' : 'Choisir'" chevron @click="show" />

  <BottomSheet
    :open="open" full :title="creating ? 'Nouveau client' : 'Choisir un client'"
    :cancel="creating ? 'Retour' : 'Annuler'" :action="creating ? 'Créer' : undefined" :action-disabled="!draft.name.trim()"
    @close="creating ? (creating = false) : (open = false)" @action="create"
  >
    <template v-if="!creating">
      <SearchField ref="search" v-model="query" placeholder="Nom ou téléphone" />
      <ListGroup>
        <ListRow :icon="UserPlus" tile="blue" :title="query.trim() ? `Créer « ${query.trim()} »` : 'Nouveau client'" action @click="startCreate" />
        <ListRow v-if="optional && selected" title="Client de passage (aucun)" action @click="choose(null)" />
      </ListGroup>
      <ListGroup v-if="results.length" :header="query ? 'Résultats' : 'Clients'">
        <ListRow
          v-for="c in results" :key="c.id" :avatar="c.name" :title="c.name" :subtitle="c.phone || c.whatsapp"
          :selected="selected?.id === c.id" @click="choose(c)"
        />
      </ListGroup>
    </template>
    <ListGroup v-else footer="Le numéro est aussi utilisé pour WhatsApp.">
      <label class="cell field"><span class="field-label">Nom</span><input v-model="draft.name" placeholder="Obligatoire" autofocus /></label>
      <label class="cell field"><span class="field-label">Téléphone</span><input v-model="draft.phone" type="tel" inputmode="tel" placeholder="06…" /></label>
    </ListGroup>
  </BottomSheet>
</template>
