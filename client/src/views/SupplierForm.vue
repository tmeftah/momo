<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { toast, toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import Avatar from '../components/Avatar.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const busy = ref(false);
const form = reactive({ name: '', phone: '', whatsapp: '', address: '', notes: '' });
const valid = computed(() => form.name.trim().length > 0);

onMounted(async () => {
  if (!id) return;
  try {
    const s = await api.get(`/suppliers/${id}`);
    for (const k of Object.keys(form)) form[k] = s[k] ?? '';
  } catch (e) {
    toastError(e);
  }
});

async function save() {
  if (!valid.value || busy.value) return;
  busy.value = true;
  try {
    const s = id ? await api.put(`/suppliers/${id}`, form) : await api.post('/suppliers', form);
    toast('Fournisseur enregistré');
    router.replace(`/fournisseurs/${s.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <NavBar :reveal-at="44" :title="id ? 'Modifier' : 'Nouveau fournisseur'" back>
      <button class="nav-btn" :disabled="!valid || busy" @click="save">OK</button>
    </NavBar>
    <form @submit.prevent="save">
      <div class="hero" style="padding-top: 8px"><Avatar :name="form.name || '?'" :size="88" /></div>
      <ListGroup>
        <label class="cell field stacked"><span class="field-label">Nom</span><input v-model="form.name" placeholder="Nom du fournisseur" /></label>
      </ListGroup>
      <ListGroup header="Contact">
        <label class="cell field"><span class="field-label">Téléphone</span><input v-model="form.phone" type="tel" inputmode="tel" placeholder="—" /></label>
        <label class="cell field"><span class="field-label">WhatsApp</span><input v-model="form.whatsapp" type="tel" inputmode="tel" placeholder="Si différent" /></label>
        <label class="cell field"><span class="field-label">Adresse / site</span><input v-model="form.address" placeholder="—" /></label>
      </ListGroup>
      <ListGroup>
        <label class="cell field stacked"><span class="field-label">Notes</span><textarea v-model="form.notes" placeholder="Délais, conditions, produits phares…" /></label>
      </ListGroup>
      <button class="btn filled lg block mt" :disabled="!valid || busy">{{ id ? 'Enregistrer' : 'Créer le fournisseur' }}</button>
    </form>
  </div>
</template>
