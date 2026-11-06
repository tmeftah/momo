<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { STOCK_CATEGORIES, VEHICLE_TYPES } from '../constants.js';
import { money, toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ChipSelect from '../components/ChipSelect.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const form = reactive({
  name: '', category: route.query.category || null, reference: '', voltage: '', power: '',
  quantity: 0, min_stock: 1, purchase_price: 0, sale_price: 0, location: '', notes: '', supplier_id: null,
});
const vehicles = ref([]);
const suppliers = ref([]);
const busy = ref(false);

const margin = computed(() => (Number(form.sale_price) || 0) - (Number(form.purchase_price) || 0));
const marginPct = computed(() => (form.purchase_price > 0 ? Math.round((margin.value / form.purchase_price) * 100) : null));

onMounted(async () => {
  suppliers.value = await api.get('/suppliers').catch(() => []);
  if (!id) return;
  try {
    const i = await api.get(`/items/${id}`);
    Object.assign(form, i);
    vehicles.value = i.vehicle_types ? i.vehicle_types.split(',') : [];
  } catch (e) {
    toastError(e);
  }
});

async function save() {
  busy.value = true;
  try {
    const body = { ...form, vehicle_types: vehicles.value.join(',') };
    delete body.movements;
    const item = id ? await api.put(`/items/${id}`, body) : await api.post('/items', body);
    toast(id ? 'Article enregistré' : 'Article créé — ajoutez une photo');
    router.replace(`/stock/${item.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="id ? 'Modifier l’article' : 'Nouvel article'" back />
    <form class="stack" @submit.prevent="save">
      <label class="field"><span>Nom *</span><input v-model="form.name" required placeholder="ex : Chargeur 42V 2A GX16" /></label>
      <label class="field">
        <span>Catégorie</span>
        <select v-model="form.category">
          <option :value="null">—</option>
          <option v-for="c in STOCK_CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <div class="grid-2">
        <label class="field"><span>Référence</span><input v-model="form.reference" /></label>
        <label class="field"><span>Emplacement</span><input v-model="form.location" placeholder="ex : Étagère B2" /></label>
        <label class="field"><span>Tension</span><input v-model="form.voltage" placeholder="ex : 36V" /></label>
        <label class="field"><span>Puissance</span><input v-model="form.power" placeholder="ex : 350W / 2A" /></label>
      </div>
      <div class="field">
        <span>Véhicules compatibles</span>
        <ChipSelect v-model="vehicles" :options="VEHICLE_TYPES.filter((v) => v.value !== 'autre').map((v) => ({ value: v.value, label: v.short, icon: v.icon }))" multiple />
      </div>
      <div class="grid-2">
        <label class="field"><span>Quantité en stock</span><input v-model.number="form.quantity" type="number" step="any" inputmode="decimal" /></label>
        <label class="field"><span>Stock minimum</span><input v-model.number="form.min_stock" type="number" step="any" inputmode="decimal" /></label>
        <label class="field"><span>Prix d'achat</span><input v-model.number="form.purchase_price" type="number" step="0.01" inputmode="decimal" /></label>
        <label class="field"><span>Prix de vente</span><input v-model.number="form.sale_price" type="number" step="0.01" inputmode="decimal" /></label>
      </div>
      <div class="card row between small">
        <span class="muted">Marge par unité</span>
        <span class="strong" :class="margin >= 0 ? 'text-green' : 'text-red'">{{ money(margin) }}<template v-if="marginPct !== null"> ({{ marginPct }} %)</template></span>
      </div>
      <label class="field">
        <span>Fournisseur habituel</span>
        <select v-model="form.supplier_id">
          <option :value="null">—</option>
          <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>
      <label class="field"><span>Notes techniques</span><textarea v-model="form.notes" placeholder="Brochage, compatibilités, remarques…" /></label>
      <button class="btn btn-primary btn-lg" :disabled="busy">💾 Enregistrer</button>
    </form>
  </div>
</template>
