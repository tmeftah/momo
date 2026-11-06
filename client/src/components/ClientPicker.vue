<script setup>
import { ref, watch, onMounted } from 'vue';
import { api } from '../api.js';
import { toastError } from '../store.js';
import Modal from './Modal.vue';

const props = defineProps({ modelValue: [Number, String, null], optional: Boolean });
const emit = defineEmits(['update:modelValue', 'selected']);

const selected = ref(null);
const query = ref('');
const results = ref([]);
const creating = ref(false);
const draft = ref({ name: '', phone: '', whatsapp: '' });
let timer;

async function loadSelected() {
  if (!props.modelValue) return (selected.value = null);
  if (selected.value?.id === Number(props.modelValue)) return;
  try {
    selected.value = await api.get(`/clients/${props.modelValue}`);
  } catch {
    selected.value = null;
  }
}
onMounted(loadSelected);
watch(() => props.modelValue, loadSelected);

watch(query, (q) => {
  clearTimeout(timer);
  if (!q.trim()) return (results.value = []);
  timer = setTimeout(async () => {
    try {
      results.value = await api.get('/clients', { q, limit: 8 });
    } catch (e) {
      toastError(e);
    }
  }, 200);
});

function choose(c) {
  selected.value = c;
  query.value = '';
  results.value = [];
  emit('update:modelValue', c.id);
  emit('selected', c);
}

function clear() {
  selected.value = null;
  emit('update:modelValue', null);
  emit('selected', null);
}

function openCreate() {
  const q = query.value.trim();
  draft.value = /^[\d\s+]+$/.test(q) ? { name: '', phone: q, whatsapp: q } : { name: q, phone: '', whatsapp: '' };
  creating.value = true;
}

async function create() {
  if (!draft.value.name.trim()) return;
  try {
    const c = await api.post('/clients', { ...draft.value, whatsapp: draft.value.whatsapp || draft.value.phone });
    creating.value = false;
    choose(c);
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="field">
    <span>Client <template v-if="optional">(facultatif)</template></span>
    <div v-if="selected" class="list-item" style="cursor: default">
      <div class="thumb">👤</div>
      <div class="grow">
        <div class="title">{{ selected.name }}</div>
        <div class="sub">{{ selected.phone || selected.whatsapp || 'Pas de téléphone' }}</div>
      </div>
      <button type="button" class="btn btn-sm" @click="clear">Changer</button>
    </div>
    <template v-else>
      <input v-model="query" type="search" placeholder="🔍 Rechercher nom ou téléphone…" autocomplete="off" />
      <div v-if="query.trim()" class="list">
        <div v-for="c in results" :key="c.id" class="list-item" @click="choose(c)">
          <div class="grow">
            <div class="title">{{ c.name }}</div>
            <div class="sub">{{ c.phone || c.whatsapp }}</div>
          </div>
        </div>
        <button type="button" class="btn btn-block" @click="openCreate">➕ Nouveau client « {{ query.trim() }} »</button>
      </div>
      <button v-else type="button" class="btn btn-block btn-ghost" @click="openCreate">➕ Nouveau client</button>
    </template>

    <Modal v-if="creating" title="Nouveau client" @close="creating = false">
      <form class="stack" @submit.prevent="create">
        <label class="field"><span>Nom *</span><input v-model="draft.name" required autofocus /></label>
        <label class="field"><span>Téléphone</span><input v-model="draft.phone" type="tel" inputmode="tel" /></label>
        <label class="field"><span>WhatsApp (si différent)</span><input v-model="draft.whatsapp" type="tel" inputmode="tel" /></label>
        <button class="btn btn-primary btn-lg" type="submit">Créer le client</button>
      </form>
    </Modal>
  </div>
</template>
