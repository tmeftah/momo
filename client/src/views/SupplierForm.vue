<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const busy = ref(false);
const form = reactive({ name: '', phone: '', whatsapp: '', address: '', notes: '' });

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
    <PageHeader :title="id ? 'Modifier le fournisseur' : 'Nouveau fournisseur'" back />
    <form class="stack" @submit.prevent="save">
      <label class="field"><span>Nom *</span><input v-model="form.name" required /></label>
      <label class="field"><span>Téléphone</span><input v-model="form.phone" type="tel" inputmode="tel" /></label>
      <label class="field"><span>WhatsApp</span><input v-model="form.whatsapp" type="tel" inputmode="tel" placeholder="Si différent du téléphone" /></label>
      <label class="field"><span>Adresse / site web</span><input v-model="form.address" /></label>
      <label class="field"><span>Notes</span><textarea v-model="form.notes" placeholder="Délais, conditions, produits phares…" /></label>
      <button class="btn btn-primary btn-lg" :disabled="busy">💾 Enregistrer</button>
    </form>
  </div>
</template>
