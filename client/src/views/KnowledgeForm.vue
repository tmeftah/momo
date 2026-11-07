<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { KNOWLEDGE_CATEGORIES } from '../constants.js';
import { vehicleName } from '../store.js';
import { toast, toastError } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import PickerRow from '../components/PickerRow.vue';
import Toggle from '../components/Toggle.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const busy = ref(false);
const form = reactive({ title: '', category: null, symptoms: '', diagnosis: '', cause: '', solution: '', parts: '', wiring: '', notes: '', favorite: 0 });
const valid = computed(() => form.title.trim().length > 0);

onMounted(async () => {
  try {
    if (id) {
      const s = await api.get(`/solutions/${id}`);
      for (const k of Object.keys(form)) form[k] = s[k] ?? form[k];
      return;
    }
    // Prefill from a finished repair or diagnostic
    if (route.query.repair_id) {
      const r = await api.get(`/repairs/${route.query.repair_id}`);
      const d = r.details || {};
      form.title = `${vehicleName(r)} — ${(r.problem || '').split('\n')[0].slice(0, 60)}`;
      form.category = { batterie: 'Batterie', chargeur: 'Chargeur' }[r.category] || null;
      form.symptoms = r.problem || '';
      form.diagnosis = r.diagnosis || '';
      form.solution = [r.work_done, d.solution, d.new_system].filter(Boolean).join('\n');
      form.parts = r.lines.map((l) => `${l.qty}× ${l.name}`).join('\n');
      form.wiring = [d.wiring, d.modification].filter(Boolean).join('\n');
    } else if (route.query.diagnostic_id) {
      const d = await api.get(`/diagnostics/${route.query.diagnostic_id}`);
      form.title = `${vehicleName(d)} — ${(d.fault_found || d.symptoms || '').split('\n')[0].slice(0, 60)}`;
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
  if (!valid.value || busy.value) return;
  busy.value = true;
  try {
    const s = id ? await api.put(`/solutions/${id}`, form) : await api.post('/solutions', form);
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
    <NavBar :reveal-at="44" :title="id ? 'Modifier' : 'Nouvelle solution'" back>
      <button class="nav-btn" :disabled="!valid || busy" @click="save">OK</button>
    </NavBar>
    <h1 class="title1" style="margin: 4px 0 2px">{{ id ? 'Modifier la solution' : 'Nouvelle solution' }}</h1>
    <form @submit.prevent="save">
      <ListGroup>
        <label class="cell field stacked"><span class="field-label">Titre</span><input v-model="form.title" placeholder="ex : M365 — erreur 21 BMS" /></label>
        <PickerRow v-model="form.category" label="Catégorie" :options="KNOWLEDGE_CATEGORIES" allow-empty empty-label="Aucune" />
        <div class="cell"><span class="cell-main cell-title">Favori</span><Toggle v-model="form.favorite" /></div>
      </ListGroup>
      <ListGroup header="Dépannage">
        <label class="cell field stacked"><span class="field-label">Symptômes</span><textarea v-model="form.symptoms" /></label>
        <label class="cell field stacked"><span class="field-label">Diagnostic</span><textarea v-model="form.diagnosis" placeholder="Tests, mesures…" /></label>
        <label class="cell field stacked"><span class="field-label">Cause</span><textarea v-model="form.cause" /></label>
        <label class="cell field stacked"><span class="field-label">Solution</span><textarea v-model="form.solution" rows="4" /></label>
      </ListGroup>
      <ListGroup header="Compléments">
        <label class="cell field stacked"><span class="field-label">Pièces utilisées</span><textarea v-model="form.parts" /></label>
        <label class="cell field stacked"><span class="field-label">Schéma</span><textarea v-model="form.wiring" class="mono" /></label>
        <label class="cell field stacked"><span class="field-label">Notes</span><textarea v-model="form.notes" /></label>
      </ListGroup>
      <button class="btn filled lg block mt" :disabled="!valid || busy">{{ id ? 'Enregistrer' : 'Créer la solution' }}</button>
    </form>
  </div>
</template>
