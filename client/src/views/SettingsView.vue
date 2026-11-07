<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { KeyRound, Lock, Download, FileText, ArchiveRestore, Database, Moon, Smartphone, Sparkles } from 'lucide-vue-next';
import { pwa, canInstall, openInstall, applyUpdate } from '../pwa.js';
import { api, session } from '../api.js';
import { settings } from '../store.js';
import { toast, toastError, confirmAction, theme, setTheme } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import Segmented from '../components/Segmented.vue';
import BottomSheet from '../components/BottomSheet.vue';

const router = useRouter();
const form = reactive({ ...settings });
const pins = reactive({ current: '', pin: '', confirm: '' });
const pinSheet = ref(false);
const autoBackups = ref([]);
const restoring = ref(false);
const fileInput = ref(null);
const dirty = ref(false);

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
    dirty.value = false;
    toast('Réglages enregistrés');
  } catch (e) {
    toastError(e);
  }
}

async function changePin() {
  if (pins.pin !== pins.confirm) return toastError(new Error('Les deux nouveaux codes ne correspondent pas'));
  try {
    await api.post('/auth/change-pin', { current: pins.current, pin: pins.pin });
    try {
      localStorage.setItem('vae-pin-len', String(pins.pin.length));
    } catch {
      /* ignore */
    }
    Object.assign(pins, { current: '', pin: '', confirm: '' });
    pinSheet.value = false;
    toast('Code modifié · autres appareils déconnectés');
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
  const ok = await confirmAction(`Toutes les données actuelles seront remplacées par « ${file.name} ». Une copie de sécurité est gardée sur le serveur.`, {
    title: 'Restaurer cette sauvegarde ?',
    confirm: 'Restaurer',
  });
  if (!ok) return;
  restoring.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.upload('/backup/restore', fd);
    toast(`Restauration terminée (${res.photos} photos). Reconnectez-vous.`);
    setTimeout(() => (window.location.href = '/'), 1500);
  } catch (err) {
    toastError(err);
  } finally {
    restoring.value = false;
  }
}

const build = __BUILD_DATE__;
const kb = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} Mo` : `${Math.round(b / 1024)} Ko`);
</script>

<template>
  <div class="page">
    <NavBar :reveal-at="150" title="Réglages" back="/plus">
      <button v-if="dirty" class="nav-btn" @click="save">OK</button>
    </NavBar>

    <div class="hero" style="padding-top: 12px">
      <img src="/icon-192.png" alt="" style="width: 72px; height: 72px; border-radius: 18px" />
      <div class="hero-title">{{ form.shop_name || 'Mon atelier' }}</div>
      <div class="hero-sub">VAE Manager · v1.0 · {{ build }}</div>
    </div>

    <ListGroup header="Atelier" @input="dirty = true">
      <label class="cell field"><span class="field-label">Nom</span><input v-model="form.shop_name" /></label>
      <label class="cell field"><span class="field-label">Téléphone</span><input v-model="form.shop_phone" type="tel" placeholder="—" /></label>
      <label class="cell field"><span class="field-label">Devise</span><input v-model="form.currency" placeholder="€, DH, DA…" /></label>
      <label class="cell field"><span class="field-label">Indicatif pays</span><input v-model="form.country_code" inputmode="numeric" placeholder="33" /></label>
      <label class="cell field"><span class="field-label">Tarif diagnostic</span><input v-model="form.diag_hourly_rate" type="number" step="0.01" inputmode="decimal" /><span class="unit">{{ form.currency }}/h</span></label>
    </ListGroup>
    <div class="lg-footer">L'indicatif transforme « 06… » en numéro WhatsApp international. Tarif à 0 = prix du diagnostic saisi à la main.</div>

    <ListGroup header="Message WhatsApp « véhicule prêt »" footer="Variables : {client} {vehicule} {total} {reste} {atelier}" @input="dirty = true">
      <label class="cell field stacked"><textarea v-model="form.wa_ready_template" rows="3" /></label>
    </ListGroup>
    <button v-if="dirty" class="btn filled block mt-s" @click="save">Enregistrer les réglages</button>

    <ListGroup header="Apparence">
      <div class="cell has-tile">
        <span class="tile bg-indigo"><Moon :size="18" /></span>
        <span class="cell-main cell-title">Thème</span>
        <Segmented :model-value="theme" :options="[{ value: 'dark', label: 'Sombre' }, { value: 'light', label: 'Clair' }, { value: 'auto', label: 'Auto' }]" style="width: 210px" @update:model-value="setTheme" />
      </div>
    </ListGroup>

    <ListGroup header="Application">
      <ListRow v-if="pwa.updateReady" :icon="Sparkles" tile="blue" title="Installer la nouvelle version" @click="applyUpdate" />
      <ListRow v-if="canInstall()" :icon="Smartphone" tile="blue" title="Installer sur l'écran d'accueil" chevron @click="openInstall" />
      <ListRow v-else :icon="Smartphone" tile="green" title="Mode application" :value="pwa.standalone ? 'Installée' : 'Navigateur'" />
    </ListGroup>

    <ListGroup header="Sécurité">
      <ListRow :icon="KeyRound" tile="gray" title="Changer le code PIN" chevron @click="pinSheet = true" />
      <ListRow :icon="Lock" tile="blue" title="Verrouiller maintenant" @click="lock" />
    </ListGroup>

    <ListGroup header="Sauvegarde" footer="Téléchargez régulièrement une sauvegarde complète et gardez-la hors du serveur.">
      <ListRow href="/api/backup/export.zip" :icon="Download" tile="green" title="Sauvegarde complète" subtitle="Données + photos (.zip)" download />
      <ListRow href="/api/backup/export.json" :icon="FileText" tile="orange" title="Exporter les données" subtitle="Format JSON lisible" download />
      <ListRow :icon="ArchiveRestore" tile="red" :title="restoring ? 'Restauration…' : 'Restaurer une sauvegarde'" subtitle="Remplace toutes les données" @click="fileInput.click()" />
    </ListGroup>
    <input ref="fileInput" type="file" accept=".zip,application/zip" hidden @change="restore" />

    <ListGroup v-if="autoBackups.length" header="Copies automatiques quotidiennes">
      <ListRow v-for="b in autoBackups" :key="b.name" :href="`/api/backup/auto/${b.name}`" :icon="Database" tile="gray" :title="b.name.replace('vae-', '').replace('.db', '')" :value="kb(b.size)" download />
    </ListGroup>

    <BottomSheet :open="pinSheet" title="Code PIN" action="OK" :action-disabled="!pins.current || pins.pin.length < 4" @close="pinSheet = false" @action="changePin">
      <ListGroup footer="4 à 12 chiffres. Les autres appareils seront déconnectés.">
        <label class="cell field"><span class="field-label">Actuel</span><input v-model="pins.current" type="password" inputmode="numeric" autocomplete="current-password" /></label>
        <label class="cell field"><span class="field-label">Nouveau</span><input v-model="pins.pin" type="password" inputmode="numeric" autocomplete="new-password" /></label>
        <label class="cell field"><span class="field-label">Confirmer</span><input v-model="pins.confirm" type="password" inputmode="numeric" autocomplete="new-password" /></label>
      </ListGroup>
    </BottomSheet>
  </div>
</template>
