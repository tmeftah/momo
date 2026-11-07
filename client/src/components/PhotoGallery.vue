<script setup>
// Photo grid + full-screen swipeable viewer (tag & delete).
import { ref, computed, onMounted, nextTick } from 'vue';
import { Camera, Trash2, X } from 'lucide-vue-next';
import { api, fileUrl } from '../api.js';
import { toast, toastError, confirmAction, chooseAction } from '../ui.js';
import Segmented from './Segmented.vue';

const props = defineProps({
  refType: { type: String, required: true },
  refId: { type: Number, required: true },
  tags: { type: Array, default: () => [] }, // [{ value, label }]
  header: { type: String, default: 'Photos' },
});

const photos = ref([]);
const uploading = ref(0);
const viewer = ref(-1);
const track = ref(null);
const input = ref(null);
const pendingTag = ref(null);
const tagLabel = computed(() => Object.fromEntries(props.tags.map((t) => [t.value, t.label])));
const current = computed(() => photos.value[viewer.value]);

onMounted(async () => {
  try {
    photos.value = await api.get('/photos', { ref_type: props.refType, ref_id: props.refId });
  } catch (e) {
    toastError(e);
  }
});

// With tags, ask which kind first (Avant / Après…), like an iOS menu
async function add() {
  if (props.tags.length) {
    const t = await chooseAction({ title: 'Ajouter des photos', actions: props.tags.map((t) => ({ label: t.label, value: t.value })) });
    if (!t) return;
    pendingTag.value = t;
  }
  input.value.click();
}

// Phone photos (4–12 MB) are shrunk to ~300 KB before upload
async function shrink(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return (await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82))) || file;
  } catch {
    return file;
  }
}

async function onFiles(e) {
  const files = [...e.target.files];
  e.target.value = '';
  for (const f of files) {
    uploading.value++;
    try {
      const fd = new FormData();
      fd.append('file', await shrink(f), 'photo.jpg');
      const params = new URLSearchParams({ ref_type: props.refType, ref_id: props.refId });
      if (pendingTag.value) params.set('tag', pendingTag.value);
      photos.value.push(await api.upload(`/photos?${params}`, fd));
    } catch (err) {
      toastError(err);
    } finally {
      uploading.value--;
    }
  }
  if (files.length) toast(files.length > 1 ? `${files.length} photos ajoutées` : 'Photo ajoutée');
}

function openViewer(i) {
  viewer.value = i;
  document.documentElement.style.overflow = 'hidden';
  nextTick(() => track.value?.scrollTo({ left: i * track.value.clientWidth }));
}
function closeViewer() {
  viewer.value = -1;
  document.documentElement.style.overflow = '';
}
function onTrackScroll() {
  const el = track.value;
  if (el) viewer.value = Math.round(el.scrollLeft / el.clientWidth);
}

async function retag(t) {
  const p = current.value;
  try {
    Object.assign(p, await api.put(`/photos/${p.id}`, { tag: t, caption: p.caption }));
  } catch (e) {
    toastError(e);
  }
}

async function remove() {
  const p = current.value;
  if (!(await confirmAction('', { title: 'Supprimer cette photo ?', confirm: 'Supprimer la photo' }))) return;
  try {
    await api.del(`/photos/${p.id}`);
    photos.value = photos.value.filter((x) => x.id !== p.id);
    if (!photos.value.length) closeViewer();
    else viewer.value = Math.min(viewer.value, photos.value.length - 1);
    toast('Photo supprimée');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <section class="lg">
    <div class="lg-header">
      <span>{{ header }}<template v-if="photos.length"> · {{ photos.length }}</template></span>
    </div>
    <div class="photo-grid">
      <div v-for="(p, i) in photos" :key="p.id" class="photo-cell" @click="openViewer(i)">
        <img :src="fileUrl(p.filename)" alt="" loading="lazy" />
        <span v-if="p.tag && tagLabel[p.tag]" class="pill">{{ tagLabel[p.tag] }}</span>
      </div>
      <button type="button" class="photo-add" @click="add">
        <Camera :size="26" :stroke-width="1.8" />
        <span>{{ uploading ? `Envoi… (${uploading})` : 'Ajouter' }}</span>
      </button>
    </div>
    <input ref="input" type="file" accept="image/*" multiple hidden @change="onFiles" />

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="viewer >= 0 && current" class="viewer">
          <div class="viewer-top">
            <button class="icon-btn" aria-label="Fermer" @click="closeViewer"><X :size="22" /></button>
            <span class="subhead bold">{{ viewer + 1 }} / {{ photos.length }}</span>
            <a class="nav-btn" :href="fileUrl(current.filename)" target="_blank" rel="noopener" style="display: grid; place-items: center">Ouvrir</a>
          </div>
          <div ref="track" class="viewer-track" @scroll.passive="onTrackScroll">
            <figure v-for="p in photos" :key="p.id"><img :src="fileUrl(p.filename)" alt="" /></figure>
          </div>
          <div class="viewer-bar">
            <Segmented v-if="tags.length" :model-value="current.tag" :options="tags" @update:model-value="retag" />
            <span v-else />
            <button class="icon-btn" aria-label="Supprimer" @click="remove"><Trash2 :size="20" /></button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>
