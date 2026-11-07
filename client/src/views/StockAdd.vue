<script setup>
import { ref } from 'vue';
import { Search, PackagePlus, Truck, CircleCheck } from 'lucide-vue-next';
import { api } from '../api.js';
import { money, fmtNum, settings } from '../store.js';
import { toast, toastError, haptic } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import ItemPickerSheet from '../components/ItemPickerSheet.vue';
import Stepper from '../components/Stepper.vue';

const item = ref(null);
const picking = ref(true);
const qty = ref(1);
const price = ref('');
const note = ref('');
const busy = ref(false);
const recent = ref([]);

function pick(i) {
  item.value = i;
  qty.value = 1;
  price.value = i.purchase_price;
}

async function submit() {
  busy.value = true;
  try {
    const updated = await api.post(`/items/${item.value.id}/adjust`, { delta: qty.value, note: note.value || 'Entrée de stock', purchase_price: price.value });
    recent.value.unshift({ id: updated.id, name: updated.name, qty: qty.value, total: updated.quantity, photo: updated.photo });
    haptic('success');
    toast(`${updated.name} · ${fmtNum(updated.quantity)} en stock`);
    item.value = null;
    note.value = '';
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <NavBar title="Entrée de stock" large back="/stock" subtitle="Ajout rapide sur un article existant" />

    <ListGroup v-if="!item">
      <ListRow :icon="Search" tile="blue" title="Choisir un article" chevron @click="picking = true" />
      <ListRow to="/stock/nouveau" :icon="PackagePlus" tile="green" title="Créer un nouvel article" />
      <ListRow to="/achats/nouveau" :icon="Truck" tile="indigo" title="Achat fournisseur (avec facture)" />
    </ListGroup>

    <template v-else>
      <ListGroup>
        <ListRow :thumb="item.photo || null" :title="item.name" :subtitle="`Stock actuel : ${fmtNum(item.quantity)}`" chevron @click="picking = true" />
      </ListGroup>
      <ListGroup :footer="`Nouveau stock : ${fmtNum(item.quantity + (Number(qty) || 0))} · valeur ${money((Number(qty) || 0) * (Number(price) || 0))}`">
        <div class="cell"><span class="cell-main cell-title">Quantité reçue</span><Stepper v-model="qty" /></div>
        <label class="cell field"><span class="field-label">Prix d'achat unit.</span><input v-model="price" type="number" step="0.01" inputmode="decimal" /><span class="unit">{{ settings.currency }}</span></label>
        <label class="cell field"><span class="field-label">Note</span><input v-model="note" placeholder="Facultatif" /></label>
      </ListGroup>
      <button class="btn yellow lg block mt" :disabled="busy || !(qty > 0)" @click="submit">Ajouter {{ fmtNum(qty) }} au stock</button>
    </template>

    <ListGroup v-if="recent.length" header="Ajouté à l'instant">
      <ListRow v-for="(r, i) in recent" :key="i" :to="`/stock/${r.id}`" :thumb="r.photo || null" :title="r.name" :subtitle="`Stock : ${fmtNum(r.total)}`">
        <template #trailing><span class="hstack c-green bold num" style="gap: 4px"><CircleCheck :size="16" />+{{ fmtNum(r.qty) }}</span></template>
      </ListRow>
    </ListGroup>

    <ItemPickerSheet :open="picking" title="Choisir l'article" cost @close="picking = false" @pick="pick" />
  </div>
</template>
