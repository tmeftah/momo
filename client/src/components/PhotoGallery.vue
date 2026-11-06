<script setup>
import { ref, onMounted, computed } from 'vue';
import { api, fileUrl } from '../api.js';
import { toast, toastError } from '../store.js';
import ChipSelect from './ChipSelect.vue';

const props = defineProps({
  refType: { type: String, required: true },
  refId: { type: Number, required: true },
  tags: { type: Array, default: () => [] }, // [{ value, label }]
});

const photos = ref([]);
const tag = ref(props.tags[0]?.value || null);
const uploading = ref(0);
const viewing = ref(null);
const input = ref(null);
const tagLabel = computed(() => Object.fromEntries(props.tags.map((t) => [t.value, t.label])));

async function load() {
  photos.value = await api.get('/photos', { ref_type: props.refType, ref_id: props.refId });
}
onMounted(() => load().catch(toastError));

// Shrinks phone photos (often 4–12 MB) to ~200–400 KB before upload
async function shrink(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    return blob || file;
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
      const blob = await shrink(f);
      fd.append('file', blob, 'photo.jpg');
      const params = new URLSearchParams({ ref_type: props.refType, ref_id: props.refId });
      if (tag.value) params.set('tag', tag.value);
      photos.value.push(await api.upload(`/photos?${params}`, fd));
    } catch (err) {
      toastError(err);
    } finally {
      uploading.value--;
    }
  }
}

async function remove(p) {
  if (!confirm('Supprimer cette photo ?')) return;
  try {
    await api.del(`/photos/${p.id}`);
    photos.value = photos.value.filter((x) => x.id !== p.id);
    viewing.value = null;
    toast('Photo supprimée');
  } catch (e) {
    toastError(e);
  }
}

async function retag(p, t) {
  try {
    Object.assign(p, await api.put(`/photos/${p.id}`, { tag: t, caption: p.caption }));
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="stack">
    <ChipSelect v-if="tags.length" v-model="tag" :options="tags" />
    <div class="photo-grid">
      <div v-for="p in photos" :key="p.id" class="photo-cell" @click="viewing = p">
        <img :src="fileUrl(p.filename)" alt="" loading="lazy" />
        <span v-if="p.tag" class="badge photo-tag" :class="p.tag === 'apres' ? 'green' : p.tag === 'avant' ? 'orange' : 'blue'">
          {{ tagLabel[p.tag] || p.tag }}
        </span>
      </div>
      <button type="button" class="photo-add" @click="input.click()">
        <span style="font-size: 1.6rem">📷</span>
        <span>{{ uploading ? `Envoi… (${uploading})` : tags.length ? `Ajouter (${tagLabel[tag] || ''})` : 'Ajouter' }}</span>
      </button>
    </div>
    <input ref="input" type="file" accept="image/*" multiple hidden @change="onFiles" />

    <Teleport to="body">
      <div v-if="viewing" class="lightbox" @click.self="viewing = null">
        <img :src="fileUrl(viewing.filename)" alt="" @click="viewing = null" />
        <div class="lb-bar">
          <button v-for="t in tags" :key="t.value" class="chip" :class="{ active: viewing.tag === t.value }" @click="retag(viewing, t.value)">{{ t.label }}</button>
          <a class="btn" :href="fileUrl(viewing.filename)" target="_blank" rel="noopener">⤢ Ouvrir</a>
          <button class="btn btn-danger" @click="remove(viewing)">🗑️ Supprimer</button>
          <button class="btn" @click="viewing = null">Fermer</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
