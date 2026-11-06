<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';
import { PRIORITY, CATEGORY } from '../constants.js';
import { fmtDate, fmtRelative, localToday, toastError, vehicleLabel } from '../store.js';
import PageHeader from '../components/PageHeader.vue';

const data = ref(null);
const prio = ref('');
onMounted(async () => {
  try {
    data.value = await api.get('/planning');
  } catch (e) {
    toastError(e);
  }
});

const today = localToday();
const keep = (x) => !prio.value || x.priority === prio.value;

const columns = computed(() => {
  if (!data.value) return [];
  const r = data.value.repairs.filter(keep);
  const by = (s) => r.filter((x) => x.status === s);
  return [
    { key: 'en_cours', title: '🔧 En cours', items: by('en_cours') },
    { key: 'en_attente', title: '🕓 En attente', items: by('en_attente') },
    { key: 'en_pause', title: '⏸️ En pause', items: by('en_pause') },
    { key: 'attente_piece', title: '📦 Attente pièces', items: by('attente_piece') },
    { key: 'en_test', title: '🧪 En test', items: by('en_test') },
    { key: 'diag', title: '⚡ Diagnostics', items: data.value.diagnostics.filter(keep), diag: true },
    { key: 'terminee', title: '✅ Terminés (à prévenir)', items: r.filter((x) => x.status === 'terminee' && !x.notified_at) },
    { key: 'recuperer', title: '📲 À récupérer', items: r.filter((x) => x.status === 'terminee' && x.notified_at) },
    { key: 'livree', title: '🏁 Récupérés (7 j)', items: by('livree') },
  ];
});
</script>

<template>
  <div class="page wide">
    <PageHeader title="📅 Planning" back />
    <div class="chips" style="margin-bottom: 14px">
      <button class="chip" :class="{ active: !prio }" @click="prio = ''">Toutes priorités</button>
      <button v-for="(p, k) in PRIORITY" :key="k" class="chip" :class="{ active: prio === k }" @click="prio = k">{{ p.icon }} {{ p.label }}</button>
    </div>
    <div class="kanban">
      <div v-for="col in columns" :key="col.key" class="col">
        <div class="col-head"><span>{{ col.title }}</span><span class="badge">{{ col.items.length }}</span></div>
        <div class="list">
          <router-link
            v-for="x in col.items" :key="x.id" :to="(col.diag ? '/diagnostics/' : '/reparations/') + x.id"
            class="list-item" :class="{ urgent: x.priority === 'urgent' }" style="min-height: 0; padding: 10px"
          >
            <div class="grow">
              <div class="title small ellipsis">{{ col.diag ? '⚡' : CATEGORY[x.category]?.icon }} {{ vehicleLabel(x) }}</div>
              <div class="sub tiny ellipsis">#{{ x.id }} · {{ x.client_name || 'Sans client' }} · {{ fmtRelative(x.created_at) }}</div>
              <div v-if="x.due_date" class="tiny" :class="x.due_date < today ? 'text-red strong' : 'text-yellow'">📅 {{ fmtDate(x.due_date) }}</div>
            </div>
            <span v-if="x.priority !== 'normal'" title="Priorité">{{ PRIORITY[x.priority]?.icon }}</span>
          </router-link>
          <div v-if="!col.items.length" class="tiny muted" style="padding: 4px 2px">—</div>
        </div>
      </div>
    </div>
  </div>
</template>
