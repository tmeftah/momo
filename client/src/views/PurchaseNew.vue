<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Plus, Trash2 } from 'lucide-vue-next';
import { api, fileUrl } from '../api.js';
import { money, fmtNum } from '../store.js';
import { toast, toastError, haptic } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import PickerRow from '../components/PickerRow.vue';
import ItemPickerSheet from '../components/ItemPickerSheet.vue';
import Stepper from '../components/Stepper.vue';
import Toggle from '../components/Toggle.vue';

const route = useRoute();
const router = useRouter();
const suppliers = ref([]);
const supplierId = ref(route.query.supplier_id ? Number(route.query.supplier_id) : null);
const reference = ref('');
const notes = ref('');
const lines = ref([]);
const picking = ref(false);
const updatePrices = ref(true);
const busy = ref(false);
const total = computed(() => lines.value.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0));
const supplierOptions = computed(() => suppliers.value.map((s) => ({ value: s.id, label: s.name })));

onMounted(async () => {
  suppliers.value = await api.get('/suppliers').catch(() => []);
});

function add(item) {
  const ex = lines.value.find((l) => l.item_id === item.id);
  if (ex) return ex.qty++;
  lines.value.push({ item_id: item.id, name: item.name, qty: 1, unit_cost: item.purchase_price, stock: item.quantity, photo: item.photo });
}

async function submit() {
  busy.value = true;
  try {
    const p = await api.post('/purchases', {
      supplier_id: supplierId.value,
      reference: reference.value,
      notes: notes.value,
      lines: lines.value.map((l) => ({ ...l, update_price: updatePrices.value })),
    });
    haptic('success');
    toast(`Achat enregistré · stock mis à jour`);
    router.replace(`/achats/${p.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page" :class="{ 'has-bottom-bar': lines.length }">
    <NavBar title="Achat fournisseur" large back subtitle="Les quantités s'ajoutent au stock" />

    <ListGroup>
      <PickerRow v-model="supplierId" label="Fournisseur" :options="supplierOptions" allow-empty empty-label="Sans fournisseur" />
      <label class="cell field"><span class="field-label">N° de facture</span><input v-model="reference" placeholder="Facultatif" /></label>
    </ListGroup>

    <ListGroup header="Articles reçus" footer="Article absent ? Créez-le d'abord dans le Stock.">
      <div v-for="(l, i) in lines" :key="l.item_id" class="cell has-thumb" style="align-items: flex-start; padding-top: 12px; padding-bottom: 12px">
        <img v-if="l.photo" class="thumb" :src="fileUrl(l.photo)" alt="" />
        <span v-else class="thumb">📦</span>
        <div class="cell-main" style="gap: 8px">
          <div class="hstack between" style="align-items: flex-start">
            <div class="grow">
              <div class="cell-title wrap">{{ l.name }}</div>
              <div class="cell-sub">Stock {{ fmtNum(l.stock) }} → <b class="c-green">{{ fmtNum(l.stock + (Number(l.qty) || 0)) }}</b></div>
            </div>
            <span class="headline num">{{ money(l.qty * l.unit_cost) }}</span>
          </div>
          <div class="hstack">
            <Stepper v-model="l.qty" />
            <label class="search grow" style="height: 36px">
              <span class="footnote">P.U.</span>
              <input v-model.number="l.unit_cost" type="number" step="0.01" inputmode="decimal" class="num" style="text-align: right; font-size: 16px" />
            </label>
            <button class="nav-icon" style="color: var(--red)" aria-label="Retirer" @click="lines.splice(i, 1)"><Trash2 :size="17" /></button>
          </div>
        </div>
      </div>
      <ListRow :icon="Plus" tile="blue" title="Ajouter un article" action @click="picking = true" />
    </ListGroup>

    <ListGroup v-if="lines.length">
      <div class="cell"><span class="cell-main cell-title">Mettre à jour les prix d'achat</span><Toggle v-model="updatePrices" /></div>
      <label class="cell field"><span class="field-label">Note</span><input v-model="notes" placeholder="Facultatif" /></label>
    </ListGroup>

    <div v-if="lines.length" class="bottom-bar">
      <div class="grow">
        <div class="caption secondary">Total achat</div>
        <div class="title2 num">{{ money(total) }}</div>
      </div>
      <button class="btn yellow" style="min-width: 150px" :disabled="busy" @click="submit">Enregistrer</button>
    </div>

    <ItemPickerSheet :open="picking" title="Articles reçus" cost keep-open @close="picking = false" @pick="add" />
  </div>
</template>
