<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { money, fmtNum, toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ItemPicker from '../components/ItemPicker.vue';

const route = useRoute();
const router = useRouter();
const suppliers = ref([]);
const supplierId = ref(route.query.supplier_id ? Number(route.query.supplier_id) : null);
const reference = ref('');
const notes = ref('');
const lines = ref([]);
const busy = ref(false);
const total = computed(() => lines.value.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0));

onMounted(async () => {
  suppliers.value = await api.get('/suppliers').catch(() => []);
});

function add(item) {
  const ex = lines.value.find((l) => l.item_id === item.id);
  if (ex) return ex.qty++;
  lines.value.push({ item_id: item.id, name: item.name, qty: 1, unit_cost: item.purchase_price, update_price: true, stock: item.quantity });
}

async function submit() {
  busy.value = true;
  try {
    const p = await api.post('/purchases', { supplier_id: supplierId.value, reference: reference.value, notes: notes.value, lines: lines.value });
    toast(`Achat enregistré · stock mis à jour (${lines.value.length} article(s))`);
    router.replace(`/achats/${p.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <PageHeader title="📦 Achat fournisseur" back />
    <div class="stack">
      <label class="field">
        <span>Fournisseur</span>
        <select v-model="supplierId">
          <option :value="null">— Sans fournisseur —</option>
          <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>
      <label class="field"><span>N° de facture / référence</span><input v-model="reference" /></label>

      <ItemPicker placeholder="🔍 Ajouter un article acheté…" show-cost @pick="add" />
      <router-link to="/stock/nouveau" class="small">📦 Article absent ? Créez-le d'abord dans le stock</router-link>

      <div v-for="(l, i) in lines" :key="l.item_id" class="card stack" style="padding: 10px">
        <div class="row between">
          <div class="grow"><div class="strong">{{ l.name }}</div><div class="tiny muted">Stock {{ fmtNum(l.stock) }} → <b class="text-green">{{ fmtNum(l.stock + (Number(l.qty) || 0)) }}</b></div></div>
          <button class="btn btn-ghost btn-sm" @click="lines.splice(i, 1)">🗑️</button>
        </div>
        <div class="grid-2">
          <label class="field"><span>Quantité</span><input v-model.number="l.qty" type="number" min="1" step="any" inputmode="decimal" /></label>
          <label class="field"><span>Prix d'achat unitaire</span><input v-model.number="l.unit_cost" type="number" step="0.01" inputmode="decimal" /></label>
        </div>
        <label class="check" :class="{ on: l.update_price }"><input v-model="l.update_price" type="checkbox" /> Mettre à jour le prix d'achat de l'article</label>
      </div>

      <template v-if="lines.length">
        <input v-model="notes" placeholder="Note (facultatif)" />
        <div class="card totals"><div class="line"><span>Total achat</span><span class="grand">{{ money(total) }}</span></div></div>
        <button class="btn btn-accent btn-lg" :disabled="busy" @click="submit">✅ Enregistrer l'achat et augmenter le stock</button>
      </template>
    </div>
  </div>
</template>
