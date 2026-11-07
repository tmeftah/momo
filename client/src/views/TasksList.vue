<script setup>
// Catalog of recurring repair tasks with their usual price. Edited in a sheet.
import { ref, watch, onActivated } from 'vue';
import { Plus, ClipboardList } from 'lucide-vue-next';
import { api } from '../api.js';
import { money, fmtDate, settings } from '../store.js';
import { toast, toastError, confirmAction } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import SearchField from '../components/SearchField.vue';
import BottomSheet from '../components/BottomSheet.vue';
import EmptyState from '../components/EmptyState.vue';
import Skeleton from '../components/Skeleton.vue';

const q = ref('');
const list = ref(null);
const editing = ref(null); // { id?, name, price, notes }
const busy = ref(false);
let timer;

async function load() {
  try {
    list.value = await api.get('/tasks', { q: q.value, limit: 1000 });
  } catch (e) {
    toastError(e);
  }
}
onActivated(load);
watch(q, () => {
  clearTimeout(timer);
  timer = setTimeout(load, 180);
});

const openNew = () => (editing.value = { name: '', price: '', notes: '' });
const openEdit = (t) => (editing.value = { id: t.id, name: t.name, price: t.price, notes: t.notes || '', uses: t.uses });

async function save() {
  const e = editing.value;
  if (busy.value || !e.name.trim()) return;
  busy.value = true;
  try {
    const body = { name: e.name, price: Number(e.price) || 0, notes: e.notes };
    if (e.id) await api.put(`/tasks/${e.id}`, body);
    else await api.post('/tasks', body);
    toast(e.id ? 'Prestation enregistrée' : 'Prestation ajoutée');
    editing.value = null;
    load();
  } catch (err) {
    toastError(err);
  } finally {
    busy.value = false;
  }
}

async function remove() {
  const e = editing.value;
  const msg = e.uses ? `Les ${e.uses} réparation(s) qui l'utilisent gardent la ligne et son prix.` : '';
  if (!(await confirmAction(msg, { title: `Supprimer « ${e.name} » du catalogue ?`, confirm: 'Supprimer' }))) return;
  try {
    await api.del(`/tasks/${e.id}`);
    toast('Prestation supprimée');
    editing.value = null;
    load();
  } catch (err) {
    toastError(err);
  }
}

const subtitle = (t) =>
  [t.notes, t.uses ? `faite ${t.uses} fois · dernière ${fmtDate(t.last_used_at)}` : 'pas encore utilisée'].filter(Boolean).join(' · ');
</script>

<template>
  <div class="page">
    <NavBar title="Prestations" large back="/plus" :refresh="load">
      <button class="nav-icon filled" aria-label="Nouvelle prestation" @click="openNew"><Plus :size="20" :stroke-width="2.6" /></button>
    </NavBar>
    <SearchField v-model="q" placeholder="Nom de la prestation" />
    <Skeleton v-if="!list" :rows="4" :thumb="false" />
    <ListGroup v-else-if="list.length" footer="Les plus utilisées en premier. Elles s'ajoutent depuis la fiche réparation, au prix indiqué ici.">
      <ListRow v-for="t in list" :key="t.id" :title="t.name" :subtitle="subtitle(t)" chevron @click="openEdit(t)">
        <template #trailing><span class="bold num">{{ money(t.price) }}</span></template>
      </ListRow>
    </ListGroup>
    <EmptyState v-else-if="q" :icon="ClipboardList" title="Aucune prestation trouvée" />
    <EmptyState v-else :icon="ClipboardList" title="Aucune prestation" text="Enregistrez les travaux que vous faites souvent avec leur prix habituel. Ils s'ajoutent ensuite à une réparation en un geste.">
      <button class="btn filled" @click="openNew">Nouvelle prestation</button>
    </EmptyState>

    <BottomSheet :open="!!editing" :title="editing?.id ? 'Prestation' : 'Nouvelle prestation'" action="OK" :action-disabled="busy || !editing?.name.trim()" @close="editing = null" @action="save">
      <template v-if="editing">
        <ListGroup>
          <label class="cell field"><span class="field-label">Nom</span><input v-model="editing.name" placeholder="ex : Réglage freins avant + arrière" /></label>
          <label class="cell field"><span class="field-label">Prix habituel</span><input v-model="editing.price" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0" /><span class="unit">{{ settings.currency }}</span></label>
          <label class="cell field stacked"><span class="field-label">Notes</span><textarea v-model="editing.notes" placeholder="Facultatif — ex : pièces non comprises" /></label>
        </ListGroup>
        <ListGroup v-if="editing.id" footer="Changer le prix ici ne modifie pas les réparations déjà enregistrées.">
          <ListRow title="Supprimer du catalogue" destructive @click="remove" />
        </ListGroup>
      </template>
    </BottomSheet>
  </div>
</template>
