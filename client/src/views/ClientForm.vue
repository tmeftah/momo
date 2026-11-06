<script setup>
import { reactive, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const form = reactive({ name: '', phone: '', whatsapp: '', address: '', notes: '' });
const sameWa = ref(true);
const busy = ref(false);

onMounted(async () => {
  if (!id) return;
  try {
    const c = await api.get(`/clients/${id}`);
    Object.assign(form, c);
    sameWa.value = !c.whatsapp || c.whatsapp === c.phone;
  } catch (e) {
    toastError(e);
  }
});

async function save() {
  busy.value = true;
  try {
    const body = { ...form, whatsapp: sameWa.value ? form.phone : form.whatsapp };
    const c = id ? await api.put(`/clients/${id}`, body) : await api.post('/clients', body);
    toast('Client enregistré');
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
    <PageHeader :title="id ? 'Modifier le client' : 'Nouveau client'" back />
    <form class="stack" @submit.prevent="save">
      <label class="field"><span>Nom *</span><input v-model="form.name" required autofocus /></label>
      <label class="field"><span>Téléphone</span><input v-model="form.phone" type="tel" inputmode="tel" /></label>
      <label class="check" :class="{ on: sameWa }"><input v-model="sameWa" type="checkbox" /> WhatsApp = même numéro</label>
      <label v-if="!sameWa" class="field"><span>WhatsApp</span><input v-model="form.whatsapp" type="tel" inputmode="tel" /></label>
      <label class="field"><span>Adresse (facultatif)</span><input v-model="form.address" /></label>
      <label class="field"><span>Notes</span><textarea v-model="form.notes" /></label>
      <button class="btn btn-primary btn-lg" :disabled="busy">💾 Enregistrer</button>
    </form>
  </div>
</template>
