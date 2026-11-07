<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { CONNECTOR_APPS, WIRE_COLORS } from '../constants.js';
import { toast, toastError, haptic } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import PickerRow from '../components/PickerRow.vue';
import Stepper from '../components/Stepper.vue';
import BottomSheet from '../components/BottomSheet.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const busy = ref(false);
const form = reactive({ name: '', type: '', application: null, pins: 0, wires: [], wiring: '', notes: '' });
const colorCss = Object.fromEntries(WIRE_COLORS.map((c) => [c.value, c.css]));
const colorFor = ref(null); // wire being colored
const valid = computed(() => form.name.trim().length > 0);

onMounted(async () => {
  if (!id) return;
  try {
    const c = await api.get(`/connectors/${id}`);
    for (const k of Object.keys(form)) form[k] = c[k] ?? form[k];
    form.wires = c.wires || [];
  } catch (e) {
    toastError(e);
  }
});

// One wire row per pin
watch(() => form.pins, (n) => {
  n = Math.min(Number(n) || 0, 40);
  while (form.wires.length < n) form.wires.push({ pin: form.wires.length + 1, color: '', function: '' });
  while (form.wires.length > n && !form.wires.at(-1).color && !form.wires.at(-1).function) form.wires.pop();
});

function pickColor(c) {
  haptic('light');
  colorFor.value.color = c;
  colorFor.value = null;
}

async function save() {
  if (!valid.value || busy.value) return;
  busy.value = true;
  try {
    const body = { ...form, wires: form.wires.filter((w) => w.color || w.function) };
    const c = id ? await api.put(`/connectors/${id}`, body) : await api.post('/connectors', body);
    toast(id ? 'Connecteur enregistré' : 'Connecteur créé — ajoutez des photos');
    router.replace(`/connecteurs/${c.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <NavBar :reveal-at="44" :title="id ? 'Modifier' : 'Nouveau connecteur'" back>
      <button class="nav-btn" :disabled="!valid || busy" @click="save">OK</button>
    </NavBar>
    <h1 class="title1" style="margin: 4px 0 2px">{{ id ? 'Modifier le connecteur' : 'Nouveau connecteur' }}</h1>
    <form @submit.prevent="save">
      <ListGroup>
        <label class="cell field stacked"><span class="field-label">Nom</span><input v-model="form.name" placeholder="ex : Écran KT-LCD3 — Julet 5 pins" /></label>
        <label class="cell field"><span class="field-label">Type</span><input v-model="form.type" placeholder="Julet, XT60, GX16…" /></label>
        <PickerRow v-model="form.application" label="Application" :options="CONNECTOR_APPS" allow-empty />
        <div class="cell"><span class="cell-main cell-title">Nombre de pins</span><Stepper v-model="form.pins" :min="0" :max="40" /></div>
      </ListGroup>

      <ListGroup v-if="form.wires.length" header="Brochage" footer="Touchez la pastille pour choisir la couleur du fil.">
        <div v-for="(w, i) in form.wires" :key="i" class="cell" style="gap: 10px">
          <span class="tile soft bold num" style="width: 28px; height: 28px; border-radius: 14px; font-size: 13px; color: var(--label)">{{ w.pin || i + 1 }}</span>
          <button type="button" class="wire-dot" :style="{ background: colorCss[w.color] || 'transparent' }" :class="{ empty: !w.color }" :aria-label="`Couleur du fil ${i + 1}`" @click="colorFor = w" />
          <input v-model="w.function" class="input" style="text-align: left" :placeholder="w.color ? `Fonction du fil ${w.color}` : 'Fonction (+B, GND, TX, Hall A…)'" />
        </div>
      </ListGroup>

      <ListGroup header="Schéma & notes">
        <label class="cell field stacked"><span class="field-label">Schéma de câblage</span><textarea v-model="form.wiring" class="mono" placeholder="Pin 1 rouge → +36V (clé)&#10;Pin 2 noir → GND" /></label>
        <label class="cell field stacked"><span class="field-label">Notes</span><textarea v-model="form.notes" /></label>
      </ListGroup>
      <button class="btn filled lg block mt" :disabled="!valid || busy">{{ id ? 'Enregistrer' : 'Créer le connecteur' }}</button>
    </form>

    <BottomSheet :open="!!colorFor" title="Couleur du fil" cancel="Fermer" @close="colorFor = null">
      <ListGroup>
        <ListRow v-for="c in WIRE_COLORS" :key="c.value" :title="c.value" :selected="colorFor?.color === c.value" @click="pickColor(c.value)">
          <template #leading><span class="wire-dot" :style="{ background: c.css }" /></template>
        </ListRow>
        <ListRow title="Aucune" :selected="!colorFor?.color" @click="pickColor('')" />
      </ListGroup>
    </BottomSheet>
  </div>
</template>
