<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { KNOWLEDGE_CATEGORIES } from '../constants.js';
import { toast, toastError, vehicleLabel } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ChipSelect from '../components/ChipSelect.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const busy = ref(false);
const form = reactive({ title: '', category: null, symptoms: '', diagnosis: '', cause: '', solution: '', parts: '', wiring: '', notes: '', favorite: 0 });

const strip = (s) => s.replace(/^\S+\s/, '');

onMounted(async () => {
  try {
    if (id) return Object.assign(form, await api.get(`/solutions/${id}`));
    // Prefill from a finished repair or diagnostic
    if (route.query.repair_id) {
      const r = await api.get(`/repairs/${route.query.repair_id}`);
      const d = r.details || {};
      form.title = `${strip(vehicleLabel(r))} — ${(r.problem || '').split('\n')[0].slice(0, 60)}`;
      form.category = { batterie: 'Batterie', chargeur: 'Chargeur' }[r.category] || null;
      form.symptoms = r.problem || '';
      form.diagnosis = r.diagnosis || '';
      form.solution = [r.work_done, d.solution, d.new_system].filter(Boolean).join('\n');
      form.parts = r.lines.map((l) => `${l.qty}× ${l.name}`).join('\n');
      form.wiring = [d.wiring, d.modification].filter(Boolean).join('\n');
    } else if (route.query.diagnostic_id) {
      const d = await api.get(`/diagnostics/${route.query.diagnostic_id}`);
      form.title = `${strip(vehicleLabel(d))} — ${(d.fault_found || d.symptoms || '').split('\n')[0].slice(0, 60)}`;
      form.symptoms = d.symptoms || '';
      form.diagnosis = [d.tests, d.measurements].filter(Boolean).join('\n');
      form.cause = d.fault_found || '';
      form.solution = d.proposed_solution || '';
    }
  } catch (e) {
    toastError(e);
  }
});

async function save() {
  busy.value = true;
  try {
    const body = { ...form };
    delete body.photo;
    const s = id ? await api.put(`/solutions/${id}`, body) : await api.post('/solutions', body);
    toast('Solution enregistrée');
    router.replace(`/base/${s.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="id ? 'Modifier la solution' : 'Nouvelle solution'" back />
    <form class="stack" @submit.prevent="save">
      <label class="field"><span>Titre *</span><input v-model="form.title" required placeholder="ex : Trottinette M365 — erreur 21 BMS" /></label>
      <div class="field"><span>Catégorie</span><ChipSelect v-model="form.category" :options="KNOWLEDGE_CATEGORIES" allow-empty /></div>
      <label class="field"><span>Symptômes</span><textarea v-model="form.symptoms" /></label>
      <label class="field"><span>Diagnostic (tests, mesures)</span><textarea v-model="form.diagnosis" /></label>
      <label class="field"><span>Cause</span><textarea v-model="form.cause" /></label>
      <label class="field"><span>Solution</span><textarea v-model="form.solution" rows="5" /></label>
      <label class="field"><span>Pièces utilisées</span><textarea v-model="form.parts" /></label>
      <label class="field"><span>Schéma</span><textarea v-model="form.wiring" class="mono" rows="5" /></label>
      <label class="field"><span>Notes</span><textarea v-model="form.notes" /></label>
      <label class="check" :class="{ on: form.favorite }"><input type="checkbox" :checked="!!form.favorite" @change="form.favorite = $event.target.checked ? 1 : 0" /> ⭐ Favori</label>
      <button class="btn btn-primary btn-lg" :disabled="busy">💾 Enregistrer</button>
    </form>
  </div>
</template>
