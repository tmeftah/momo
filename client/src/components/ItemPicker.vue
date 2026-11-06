<script setup>
import { ref, watch } from 'vue';
import { api, fileUrl } from '../api.js';
import { money, fmtNum, toastError } from '../store.js';

const props = defineProps({ placeholder: { type: String, default: '🔍 Ajouter un article du stock…' }, showCost: Boolean });
const emit = defineEmits(['pick']);

const query = ref('');
const results = ref([]);
const open = ref(false);
let timer;

async function search() {
  try {
    results.value = await api.get('/items', { q: query.value, limit: 25 });
  } catch (e) {
    toastError(e);
  }
}

watch(query, () => {
  clearTimeout(timer);
  timer = setTimeout(search, 180);
});

function focus() {
  open.value = true;
  if (!results.value.length) search();
}

function pick(item) {
  emit('pick', item);
  query.value = '';
  open.value = false;
}
</script>

<template>
  <div class="stack" style="gap: 8px">
    <input v-model="query" type="search" :placeholder="placeholder" autocomplete="off" @focus="focus" />
    <div v-if="open" class="list" style="max-height: 360px; overflow: auto">
      <div v-for="i in results" :key="i.id" class="list-item" @click="pick(i)">
        <img v-if="i.photo" class="thumb" :src="fileUrl(i.photo)" alt="" loading="lazy" />
        <div v-else class="thumb">📦</div>
        <div class="grow">
          <div class="title ellipsis">{{ i.name }}</div>
          <div class="sub ellipsis">{{ [i.reference, i.voltage, i.category].filter(Boolean).join(' · ') }}</div>
        </div>
        <div class="right">
          <div class="strong">{{ money(showCost ? i.purchase_price : i.sale_price) }}</div>
          <span class="badge" :class="i.quantity <= 0 ? 'red' : i.low ? 'orange' : 'green'">Stock {{ fmtNum(i.quantity) }}</span>
        </div>
      </div>
      <div v-if="!results.length" class="empty small">Aucun article trouvé</div>
      <button type="button" class="btn btn-ghost btn-sm" @click="open = false">Fermer la liste</button>
    </div>
  </div>
</template>
