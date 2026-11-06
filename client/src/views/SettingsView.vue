<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api, session } from '../api.js';
import { settings, toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';

const router = useRouter();
const form = reactive({ ...settings });
const pins = reactive({ current: '', pin: '', confirm: '' });
const autoBackups = ref([]);
const restoring = ref(false);
const fileInput = ref(null);

onMounted(async () => {
  try {
    Object.assign(form, await api.get('/settings'));
    autoBackups.value = await api.get('/backup/auto');
  } catch (e) {
    toastError(e);
  }
});

async function save() {
  try {
    Object.assign(settings, await api.put('/settings', form));
    toast('Paramètres enregistrés');
  } catch (e) {
    toastError(e);
  }
}

async function changePin() {
  if (pins.pin !== pins.confirm) return toastError(new Error('Les deux nouveaux codes ne correspondent pas'));
  try {
    await api.post('/auth/change-pin', { current: pins.current, pin: pins.pin });
    Object.assign(pins, { current: '', pin: '', confirm: '' });
    toast('Code PIN modifié · autres appareils déconnectés');
  } catch (e) {
    toastError(e);
  }
}

async function lock() {
  await api.post('/auth/logout').catch(() => {});
  session.authenticated = false;
  router.replace('/login');
}

async function restore(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!confirm(`Restaurer « ${file.name} » ?\n\nToutes les données actuelles seront remplacées (une copie de sécurité est conservée sur le serveur).`)) return;
  restoring.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.upload('/backup/restore', fd);
    alert(`Restauration terminée (${res.photos} photo(s)).\nReconnectez-vous avec le code PIN de la sauvegarde.`);
    window.location.href = '/';
  } catch (err) {
    toastError(err);
  } finally {
    restoring.value = false;
  }
}

const sizeKb = (b) => `${Math.round(b / 1024)} Ko`;
</script>

<template>
  <div class="page">
    <PageHeader title="⚙️ Paramètres" back="/plus" />
    <div class="stack">
      <div class="section-title">Atelier</div>
      <div class="card stack">
        <label class="field"><span>Nom de l'atelier</span><input v-model="form.shop_name" /></label>
        <label class="field"><span>Téléphone de l'atelier</span><input v-model="form.shop_phone" type="tel" /></label>
        <div class="grid-2">
          <label class="field"><span>Devise</span><input v-model="form.currency" placeholder="€, DH, DA, DT…" /></label>
          <label class="field"><span>Indicatif pays (WhatsApp)</span><input v-model="form.country_code" inputmode="numeric" placeholder="33, 212, 213, 216…" /></label>
        </div>
        <label class="field"><span>Tarif horaire diagnostic (0 = manuel)</span><input v-model="form.diag_hourly_rate" type="number" step="0.01" inputmode="decimal" /></label>
        <label class="field">
          <span>Message WhatsApp « véhicule prêt »</span>
          <textarea v-model="form.wa_ready_template" />
          <span class="tiny muted">Variables : {client} {vehicule} {total} {reste} {atelier}</span>
        </label>
        <button class="btn btn-primary" @click="save">💾 Enregistrer</button>
      </div>

      <div class="section-title">🔐 Sécurité</div>
      <div class="card stack">
        <input v-model="pins.current" type="password" inputmode="numeric" placeholder="Code PIN actuel" autocomplete="current-password" />
        <input v-model="pins.pin" type="password" inputmode="numeric" placeholder="Nouveau code PIN (4 à 12 chiffres)" autocomplete="new-password" />
        <input v-model="pins.confirm" type="password" inputmode="numeric" placeholder="Confirmer le nouveau code" autocomplete="new-password" />
        <button class="btn" :disabled="!pins.current || !pins.pin" @click="changePin">🔑 Changer le code PIN</button>
        <button class="btn btn-accent" @click="lock">🔒 Verrouiller l'application</button>
      </div>

      <div class="section-title">💾 Sauvegarde & export</div>
      <div class="card stack">
        <a class="btn btn-primary" href="/api/backup/export.zip" download>⬇️ Sauvegarde complète (données + photos, .zip)</a>
        <a class="btn" href="/api/backup/export.json" download>📄 Export des données (.json)</a>
        <button class="btn btn-danger" :disabled="restoring" @click="fileInput.click()">{{ restoring ? 'Restauration…' : '♻️ Restaurer une sauvegarde (.zip)' }}</button>
        <input ref="fileInput" type="file" accept=".zip,application/zip" hidden @change="restore" />
        <p class="tiny muted" style="margin: 0">Le serveur garde aussi une copie automatique de la base chaque jour. Pensez à télécharger régulièrement une sauvegarde complète hors du serveur.</p>
      </div>

      <template v-if="autoBackups.length">
        <div class="section-title">Sauvegardes automatiques (base seule)</div>
        <div class="card">
          <div v-for="b in autoBackups" :key="b.name" class="row between small" style="padding: 6px 0; border-bottom: 1px solid var(--border)">
            <span>{{ b.name }}</span>
            <a :href="`/api/backup/auto/${b.name}`" download>⬇️ {{ sizeKb(b.size) }}</a>
          </div>
        </div>
      </template>
      <p class="tiny muted center">🔑 VAE Manager v1.0</p>
    </div>
  </div>
</template>
