<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { KeyRound, Lock, TimerReset, Download, FileText, ArchiveRestore, Database, Moon, Smartphone, Sparkles, Puzzle, Copy, FolderDown, ListOrdered, Globe } from 'lucide-vue-next';
import { pwa, canInstall, openInstall, applyUpdate } from '../pwa.js';
import { api, session } from '../api.js';
import { settings, fmtDate } from '../store.js';
import { toast, toastError, confirmAction, theme, setTheme } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import PickerRow from '../components/PickerRow.vue';
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
    Object.assign(apiKey, await api.get('/auth/api-key'));
    Object.assign(extension, await api.get('/extension/info'));
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

const AUTO_LOCK_OPTIONS = [
  { value: '0', label: 'Jamais' },
  { value: '5', label: 'Après 5 min' },
  { value: '15', label: 'Après 15 min' },
  { value: '30', label: 'Après 30 min' },
  { value: '60', label: 'Après 1 h' },
];

async function setAutoLock(v) {
  form.auto_lock_min = v;
  await save();
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

const apiKey = reactive({ active: false, created_at: null });
const newKey = ref('');
const origin = window.location.origin;

async function createKey() {
  if (apiKey.active && !(await confirmAction("L'extension devra être reconnectée avec la nouvelle clé.", { title: 'Remplacer la clé ?', confirm: 'Générer' }))) return;
  try {
    newKey.value = (await api.post('/auth/api-key')).key;
    Object.assign(apiKey, await api.get('/auth/api-key'));
  } catch (e) {
    toastError(e);
  }
}

async function revokeKey() {
  if (!(await confirmAction("L'extension ne pourra plus ajouter d'articles.", { title: 'Révoquer la clé ?', confirm: 'Révoquer' }))) return;
  try {
    await api.del('/auth/api-key');
    Object.assign(apiKey, { active: false, created_at: null });
    toast('Clé révoquée');
  } catch (e) {
    toastError(e);
  }
}

const extension = reactive({ available: false, version: null });
// Phones and tablets can't run browser extensions: offer the share-based import there
const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
const installSheet = ref(false);
const INSTALL_STEPS = [
  'Téléchargez l’extension, puis décompressez le fichier .zip.',
  'Dans Chrome, ouvrez chrome://extensions (Edge : edge://extensions) et activez le mode développeur.',
  'Cliquez sur « Charger l’extension non empaquetée » et choisissez le dossier décompressé.',
  'Épinglez l’extension dans la barre d’outils, ouvrez-la et collez la clé créée ici.',
];

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toastError(new Error('Copie impossible : sélectionnez le texte à la main'));
  }
}

const copyKey = () => copyText(newKey.value, 'Clé copiée');

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

    <ListGroup header="Message WhatsApp « véhicule prêt »" footer="Variables : {client} {vehicule} {prestations} {total} {reste} {atelier}" @input="dirty = true">
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
      <ListRow v-if="pwa.updateReady" :icon="Sparkles" tile="accent" title="Installer la nouvelle version" @click="applyUpdate" />
      <ListRow v-if="canInstall()" :icon="Smartphone" tile="accent" title="Installer sur l'écran d'accueil" chevron @click="openInstall" />
      <ListRow v-else :icon="Smartphone" tile="accent" title="Mode application" :value="pwa.standalone ? 'Installée' : 'Navigateur'" />
    </ListGroup>

    <ListGroup header="Sécurité" footer="Sans activité pendant ce délai, l'application se verrouille et redemande le code PIN.">
      <ListRow :icon="KeyRound" tile="accent" title="Changer le code PIN" chevron @click="pinSheet = true" />
      <PickerRow :model-value="String(form.auto_lock_min || '0')" label="Verrouillage automatique" :options="AUTO_LOCK_OPTIONS" :icon="TimerReset" tile="accent" @update:model-value="setAutoLock" />
      <ListRow :icon="Lock" tile="accent" title="Verrouiller maintenant" @click="lock" />
    </ListGroup>

    <ListGroup header="Import de produits" :footer="touch ? 'Sur la page d’un produit, touchez Partager puis VAE Manager. Sur iPhone, copiez le lien et collez-le dans Stock › Importer.' : 'Sur ordinateur, l’extension Chrome ajoute au stock le produit affiché sur le site d’un fournisseur. Sa clé ne donne accès qu’à l’ajout d’articles.'">
      <ListRow to="/stock/importer" :icon="Globe" tile="accent" title="Importer depuis un site" :subtitle="touch ? 'Depuis ce téléphone' : 'Coller le lien d’un produit'" />
      <template v-if="extension.available && !touch">
        <ListRow href="/api/extension/download.zip" :icon="FolderDown" tile="accent" title="Télécharger l'extension" :subtitle="`Version ${extension.version} · Chrome, Edge, Brave`" download />
        <ListRow :icon="ListOrdered" tile="accent" title="Installer l'extension" chevron @click="installSheet = true" />
      </template>
      <template v-if="apiKey.active">
        <ListRow :icon="Puzzle" tile="accent" title="Clé de l'extension" :value="`Créée le ${fmtDate(apiKey.created_at)}`" />
        <ListRow v-if="!touch" :icon="KeyRound" tile="accent" title="Générer une nouvelle clé" subtitle="L'ancienne clé cesse de fonctionner" @click="createKey" />
        <ListRow title="Révoquer la clé" destructive @click="revokeKey" />
      </template>
      <ListRow v-else-if="!touch" :icon="Puzzle" tile="accent" title="Connecter l'extension" subtitle="Crée une clé à coller dans l'extension" chevron @click="createKey" />
    </ListGroup>

    <ListGroup header="Sauvegarde" footer="Téléchargez régulièrement une sauvegarde complète et gardez-la hors du serveur.">
      <ListRow href="/api/backup/export.zip" :icon="Download" tile="accent" title="Sauvegarde complète" subtitle="Données + photos (.zip)" download />
      <ListRow href="/api/backup/export.json" :icon="FileText" tile="accent" title="Exporter les données" subtitle="Format JSON lisible" download />
      <ListRow :icon="ArchiveRestore" tile="red" :title="restoring ? 'Restauration…' : 'Restaurer une sauvegarde'" subtitle="Remplace toutes les données" @click="fileInput.click()" />
    </ListGroup>
    <input ref="fileInput" type="file" accept=".zip,application/zip" hidden @change="restore" />

    <ListGroup v-if="autoBackups.length" header="Copies automatiques quotidiennes">
      <ListRow v-for="b in autoBackups" :key="b.name" :href="`/api/backup/auto/${b.name}`" :icon="Database" tile="accent" :title="b.name.replace('vae-', '').replace('.db', '')" :value="kb(b.size)" download />
    </ListGroup>

    <BottomSheet :open="!!newKey" title="Clé de l'extension" :cancel="null" action="OK" @close="newKey = ''" @action="newKey = ''">
      <ListGroup footer="Collez la clé dans l'extension. Si l'extension a été téléchargée ici, l'adresse y est déjà remplie. La clé ne sera plus affichée ensuite.">
        <div class="cell text-cell" style="display: block"><span class="t-label">Adresse du serveur</span><span class="mono">{{ origin }}</span></div>
        <div class="cell text-cell" style="display: block"><span class="t-label">Clé</span><span class="mono">{{ newKey }}</span></div>
        <ListRow :icon="Copy" tile="accent" title="Copier la clé" @click="copyKey" />
      </ListGroup>
    </BottomSheet>

    <BottomSheet :open="installSheet" title="Installer l'extension" :cancel="null" action="OK" @close="installSheet = false" @action="installSheet = false">
      <ListGroup footer="Sur ordinateur uniquement. Chrome peut signaler une extension en mode développeur au démarrage : c'est normal pour une extension installée hors du Chrome Web Store.">
        <div v-for="(step, i) in INSTALL_STEPS" :key="i" class="cell has-tile">
          <span class="tile soft num">{{ i + 1 }}</span>
          <div class="cell-main"><div class="cell-title wrap">{{ step }}</div></div>
        </div>
        <ListRow :icon="Copy" tile="accent" title="Copier « chrome://extensions »" subtitle="Les navigateurs n'ouvrent pas cette adresse depuis un lien" wrap @click="copyText('chrome://extensions', 'Adresse copiée')" />
      </ListGroup>
    </BottomSheet>

    <BottomSheet :open="pinSheet" title="Code PIN" action="OK" :action-disabled="!pins.current || pins.pin.length < 4" @close="pinSheet = false" @action="changePin">
      <ListGroup footer="4 à 12 chiffres. Les autres appareils seront déconnectés.">
        <label class="cell field"><span class="field-label">Actuel</span><input v-model="pins.current" type="password" inputmode="numeric" autocomplete="current-password" /></label>
        <label class="cell field"><span class="field-label">Nouveau</span><input v-model="pins.pin" type="password" inputmode="numeric" autocomplete="new-password" /></label>
        <label class="cell field"><span class="field-label">Confirmer</span><input v-model="pins.confirm" type="password" inputmode="numeric" autocomplete="new-password" /></label>
      </ListGroup>
    </BottomSheet>
  </div>
</template>
