<script setup>
import { reactive, onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { BookUser } from 'lucide-vue-next';
import { api } from '../api.js';
import { toast, toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import Toggle from '../components/Toggle.vue';
import Avatar from '../components/Avatar.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const form = reactive({ name: '', phone: '', whatsapp: '', address: '', notes: '' });
const sameWa = ref(true);
const busy = ref(false);
const valid = computed(() => form.name.trim().length > 0);

onMounted(async () => {
  if (!id) return;
  try {
    const c = await api.get(`/clients/${id}`);
    for (const k of Object.keys(form)) form[k] = c[k] ?? '';
    sameWa.value = !c.whatsapp || c.whatsapp === c.phone;
  } catch (e) {
    toastError(e);
  }
});

// Contact Picker API: Chrome/Edge on Android. Elsewhere the row is hidden.
const canPickContact = !id && typeof navigator.contacts?.select === 'function';
async function pickContact() {
  try {
    const [c] = await navigator.contacts.select(['name', 'tel']);
    if (!c) return;
    if (c.name?.[0]) form.name = c.name[0];
    if (c.tel?.[0]) form.phone = c.tel[0];
  } catch {
    /* picker closed or unavailable */
  }
}

async function save() {
  if (!valid.value || busy.value) return;
  busy.value = true;
  try {
    const body = { ...form, whatsapp: sameWa.value ? form.phone : form.whatsapp };
    const c = id ? await api.put(`/clients/${id}`, body) : await api.post('/clients', body);
    toast(id ? 'Client modifié' : 'Client créé');
    router.replace(`/clients/${c.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <NavBar :reveal-at="44" :title="id ? 'Modifier' : 'Nouveau client'" back>
      <button class="nav-btn" :disabled="!valid || busy" @click="save">OK</button>
    </NavBar>
    <form @submit.prevent="save">
      <div class="hero" style="padding-top: 8px">
        <Avatar :name="form.name || '?'" :size="88" />
      </div>
      <ListGroup>
        <label class="cell field stacked"><span class="field-label">Nom</span><input v-model="form.name" placeholder="Prénom Nom" autocomplete="off" :autofocus="!id" /></label>
      </ListGroup>
      <ListGroup header="Contact">
        <ListRow v-if="canPickContact" :icon="BookUser" tile="accent" title="Importer depuis les contacts" action @click="pickContact" />
        <label class="cell field"><span class="field-label">Téléphone</span><input v-model="form.phone" type="tel" inputmode="tel" placeholder="06 12 34 56 78" /></label>
        <div class="cell"><span class="cell-main cell-title">WhatsApp sur ce numéro</span><Toggle v-model="sameWa" /></div>
        <label v-if="!sameWa" class="cell field"><span class="field-label">WhatsApp</span><input v-model="form.whatsapp" type="tel" inputmode="tel" placeholder="Autre numéro" /></label>
      </ListGroup>
      <ListGroup header="Autres informations">
        <label class="cell field stacked"><span class="field-label">Adresse</span><input v-model="form.address" placeholder="Facultatif" /></label>
        <label class="cell field stacked"><span class="field-label">Notes</span><textarea v-model="form.notes" placeholder="Habitudes, préférences, remarques…" /></label>
      </ListGroup>
      <button class="btn filled lg block mt" :disabled="!valid || busy">{{ id ? 'Enregistrer' : 'Créer le client' }}</button>
    </form>
  </div>
</template>
