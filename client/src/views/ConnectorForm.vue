<script setup>
import { reactive, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { CONNECTOR_APPS, WIRE_COLORS } from '../constants.js';
import { toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ChipSelect from '../components/ChipSelect.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const busy = ref(false);
const form = reactive({ name: '', type: '', application: null, pins: 0, wires: [], wiring: '', notes: '' });
const colorCss = Object.fromEntries(WIRE_COLORS.map((c) => [c.value, c.css]));

onMounted(async () => {
  if (!id) return;
  try {
    const c = await api.get(`/connectors/${id}`);
    Object.assign(form, { ...c, wires: c.wires || [] });
  } catch (e) {
    toastError(e);
  }
});

// One wire row per pin
watch(() => form.pins, (n) => {
  n = Math.min(Number(n) || 0, 40);
  while (form.wires.length < n) form.wires.push({ pin: form.wires.length + 1, color: '', function: '' });
  while (form.wires.length > n && !form.wires[form.wires.length - 1].color && !form.wires[form.wires.length - 1].function) form.wires.pop();
});

async function save() {
  busy.value = true;
  try {
    const body = { ...form, wires: form.wires.filter((w) => w.color || w.function) };
    delete body.adaptations;
    const c = id ? await api.put(`/connectors/${id}`, body) : await api.post('/connectors', body);
    toast('Connecteur enregistré — ajoutez des photos');
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
    <PageHeader :title="id ? 'Modifier le connecteur' : 'Nouveau connecteur'" back />
    <form class="stack" @submit.prevent="save">
      <label class="field"><span>Nom *</span><input v-model="form.name" required placeholder="ex : Écran KT-LCD3 — prise 5 pins Julet" /></label>
      <label class="field"><span>Type</span><input v-model="form.type" placeholder="ex : Julet étanche, XT60, GX16, DC 5.5×2.1, JST-SM" /></label>
      <div class="field"><span>Application</span><ChipSelect v-model="form.application" :options="CONNECTOR_APPS" allow-empty /></div>
      <div class="field">
        <span>Nombre de pins</span>
        <div class="chips">
          <button v-for="n in [2, 3, 4, 5, 6, 8, 9]" :key="n" type="button" class="chip" :class="{ active: form.pins === n }" @click="form.pins = n">{{ n }}</button>
          <input v-model.number="form.pins" type="number" min="0" max="40" inputmode="numeric" style="width: 90px" />
        </div>
      </div>

      <div v-if="form.wires.length" class="card stack">
        <div class="card-title">Couleur & fonction de chaque fil</div>
        <div v-for="(w, i) in form.wires" :key="i" class="row">
          <span class="strong" style="width: 26px">{{ w.pin || i + 1 }}</span>
          <span class="wire-swatch" :style="{ background: colorCss[w.color] || 'transparent' }" />
          <select v-model="w.color" style="width: 120px; flex: none">
            <option value="">couleur</option>
            <option v-for="c in WIRE_COLORS" :key="c.value" :value="c.value">{{ c.value }}</option>
          </select>
          <input v-model="w.function" class="grow" placeholder="ex : +B batterie / GND / TX / Hall A" />
        </div>
      </div>

      <label class="field"><span>Schéma de câblage</span><textarea v-model="form.wiring" class="mono" rows="6" placeholder="Pin 1 rouge  → +36V (clé)&#10;Pin 2 noir   → GND&#10;Pin 3 vert   → TX contrôleur" /></label>
      <label class="field"><span>Notes</span><textarea v-model="form.notes" /></label>
      <button class="btn btn-primary btn-lg" :disabled="busy">💾 Enregistrer</button>
    </form>
  </div>
</template>
