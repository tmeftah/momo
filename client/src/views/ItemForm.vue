<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { STOCK_CATEGORIES, VEHICLE_TYPES } from '../constants.js';
import { money, settings } from '../store.js';
import { toast, toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import PickerRow from '../components/PickerRow.vue';
import ChipSelect from '../components/ChipSelect.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const form = reactive({
  name: '', category: route.query.category || null, reference: '', voltage: '', power: '',
  quantity: '', min_stock: 1, purchase_price: '', sale_price: '', location: '', notes: '', supplier_id: null,
});
const vehicles = ref([]);
const suppliers = ref([]);
const busy = ref(false);

const margin = computed(() => (Number(form.sale_price) || 0) - (Number(form.purchase_price) || 0));
const marginPct = computed(() => (form.purchase_price > 0 ? Math.round((margin.value / form.purchase_price) * 100) : null));
const supplierOptions = computed(() => suppliers.value.map((s) => ({ value: s.id, label: s.name })));
const vehicleOptions = VEHICLE_TYPES.filter((v) => v.value !== 'autre').map((v) => ({ value: v.value, label: v.short, icon: v.emoji }));

onMounted(async () => {
  suppliers.value = await api.get('/suppliers').catch(() => []);
  if (!id) return;
  try {
    const i = await api.get(`/items/${id}`);
    for (const k of Object.keys(form)) form[k] = i[k] ?? form[k];
    vehicles.value = i.vehicle_types ? i.vehicle_types.split(',') : [];
  } catch (e) {
    toastError(e);
  }
});

async function save() {
  if (!form.name.trim() || busy.value) return;
  busy.value = true;
  try {
    const body = { ...form, vehicle_types: vehicles.value.join(',') };
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
    <NavBar :reveal-at="44" :title="id ? 'Modifier' : 'Nouvel article'" back>
      <button class="nav-btn" :disabled="!form.name.trim() || busy" @click="save">OK</button>
    </NavBar>
    <h1 class="title1" style="margin: 4px 0 2px">{{ id ? 'Modifier l’article' : 'Nouvel article' }}</h1>
    <form @submit.prevent="save">
      <ListGroup>
        <label class="cell field stacked"><span class="field-label">Nom</span><input v-model="form.name" placeholder="ex : Chargeur 42V 2A GX16" /></label>
        <PickerRow v-model="form.category" label="Catégorie" :options="STOCK_CATEGORIES" allow-empty empty-label="Sans catégorie" />
        <label class="cell field"><span class="field-label">Référence</span><input v-model="form.reference" placeholder="—" /></label>
        <label class="cell field"><span class="field-label">Emplacement</span><input v-model="form.location" placeholder="Étagère B2" /></label>
      </ListGroup>

      <ListGroup header="Caractéristiques">
        <label class="cell field"><span class="field-label">Tension</span><input v-model="form.voltage" placeholder="36V" /></label>
        <label class="cell field"><span class="field-label">Puissance</span><input v-model="form.power" placeholder="350W / 2A" /></label>
        <div class="cell" style="display: block; padding: 12px 16px">
          <div class="footnote secondary" style="margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.02em">Véhicules compatibles</div>
          <ChipSelect v-model="vehicles" :options="vehicleOptions" multiple />
        </div>
      </ListGroup>

      <ListGroup header="Quantités">
        <label class="cell field"><span class="field-label">En stock</span><input v-model="form.quantity" type="number" step="any" inputmode="decimal" placeholder="0" /></label>
        <label class="cell field"><span class="field-label">Stock minimum</span><input v-model="form.min_stock" type="number" step="any" inputmode="decimal" /></label>
      </ListGroup>

      <ListGroup header="Prix" :footer="form.purchase_price || form.sale_price ? '' : 'La marge se calcule automatiquement.'">
        <label class="cell field"><span class="field-label">Prix d'achat</span><input v-model="form.purchase_price" type="number" step="0.01" inputmode="decimal" placeholder="0" /><span class="unit">{{ settings.currency }}</span></label>
        <label class="cell field"><span class="field-label">Prix de vente</span><input v-model="form.sale_price" type="number" step="0.01" inputmode="decimal" placeholder="0" /><span class="unit">{{ settings.currency }}</span></label>
        <ListRow title="Marge">
          <template #trailing><span class="bold num" :class="margin >= 0 ? 'c-green' : 'c-red'">{{ money(margin) }}<template v-if="marginPct !== null"> · {{ marginPct }} %</template></span></template>
        </ListRow>
      </ListGroup>

      <ListGroup>
        <PickerRow v-model="form.supplier_id" label="Fournisseur" :options="supplierOptions" allow-empty empty-label="Aucun" />
        <label class="cell field stacked"><span class="field-label">Notes techniques</span><textarea v-model="form.notes" placeholder="Brochage, compatibilités, remarques…" /></label>
      </ListGroup>

      <button class="btn filled lg block mt" :disabled="!form.name.trim() || busy">{{ id ? 'Enregistrer' : 'Créer l’article' }}</button>
    </form>
  </div>
</template>
