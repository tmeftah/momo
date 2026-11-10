<script setup>
// Full-screen crop: drag the frame or its corners, rotate by quarter turns, free or square.
// Emits the crop as fractions of the rotated image; the server does the actual cut.
import { ref, reactive, computed, watch, onBeforeUnmount, nextTick } from 'vue';
import { RotateCw, X } from 'lucide-vue-next';
import { toastError } from '../ui.js';
import Segmented from './Segmented.vue';

const props = defineProps({ open: Boolean, src: String, busy: Boolean });
const emit = defineEmits(['close', 'confirm']);

const MIN = 48; // smallest frame side, in screen pixels
const HANDLES = ['nw', 'ne', 'sw', 'se'];
const stage = ref(null);
const shown = ref(null); // object URL of the (rotated) image on screen
const bitmap = ref(null);
const rotate = ref(0);
const ratio = ref('free');
const box = reactive({ w: 0, h: 0 }); // displayed image size
const rect = reactive({ x: 0, y: 0, w: 0, h: 0 }); // frame, in displayed pixels
let drag = null;

const untouched = computed(() => rotate.value === 0 && rect.x < 1 && rect.y < 1 && rect.w > box.w - 1 && rect.h > box.h - 1);

watch(
  () => props.open,
  async (o) => {
    if (!o) return cleanup();
    rotate.value = 0;
    ratio.value = 'free';
    try {
      const blob = await (await fetch(props.src)).blob();
      bitmap.value = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      await render();
    } catch (e) {
      toastError(e);
      emit('close');
    }
  }
);

// Draw the photo turned by `rotate` and fit it in the stage
async function render() {
  const b = bitmap.value;
  const turned = rotate.value % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = turned ? b.height : b.width;
  canvas.height = turned ? b.width : b.height;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotate.value * Math.PI) / 180);
  ctx.drawImage(b, -b.width / 2, -b.height / 2);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  if (shown.value) URL.revokeObjectURL(shown.value);
  shown.value = URL.createObjectURL(blob);
  await nextTick();
  const s = stage.value.getBoundingClientRect();
  const scale = Math.min((s.width - 32) / canvas.width, (s.height - 32) / canvas.height, 1);
  box.w = Math.round(canvas.width * scale);
  box.h = Math.round(canvas.height * scale);
  resetRect();
}

function resetRect() {
  Object.assign(rect, { x: 0, y: 0, w: box.w, h: box.h });
  if (ratio.value === 'square') squareUp();
}

// Largest square inside the current frame, centred on it
function squareUp() {
  const s = Math.min(rect.w, rect.h);
  Object.assign(rect, { x: rect.x + (rect.w - s) / 2, y: rect.y + (rect.h - s) / 2, w: s, h: s });
}
watch(ratio, (r) => r === 'square' && squareUp());

async function reset() {
  ratio.value = 'free';
  if (rotate.value !== 0) {
    rotate.value = 0;
    await render();
  } else resetRect();
}

async function turn() {
  rotate.value = (rotate.value + 90) % 360;
  await render();
}

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

function start(e, mode) {
  e.preventDefault();
  drag = { mode, px: e.clientX, py: e.clientY, r: { ...rect } };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

function move(e) {
  if (!drag) return;
  const { r, mode } = drag;
  const dx = e.clientX - drag.px;
  const dy = e.clientY - drag.py;
  if (mode === 'move') {
    rect.x = clamp(r.x + dx, 0, box.w - r.w);
    rect.y = clamp(r.y + dy, 0, box.h - r.h);
    return;
  }
  // Corner: the opposite corner stays put
  const sx = mode.includes('e') ? 1 : -1;
  const sy = mode.includes('s') ? 1 : -1;
  const ax = sx > 0 ? r.x : r.x + r.w;
  const ay = sy > 0 ? r.y : r.y + r.h;
  const maxW = sx > 0 ? box.w - ax : ax;
  const maxH = sy > 0 ? box.h - ay : ay;
  let w = clamp(sx * (sx > 0 ? r.x + r.w + dx - ax : r.x + dx - ax), MIN, maxW);
  let h = clamp(sy * (sy > 0 ? r.y + r.h + dy - ay : r.y + dy - ay), MIN, maxH);
  if (ratio.value === 'square') w = h = clamp(Math.max(w, h), MIN, Math.min(maxW, maxH));
  Object.assign(rect, { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h });
}

function end() {
  drag = null;
  window.removeEventListener('pointermove', move);
  window.removeEventListener('pointerup', end);
  window.removeEventListener('pointercancel', end);
}

function confirm() {
  if (untouched.value) return emit('close');
  emit('confirm', { rotate: rotate.value, x: rect.x / box.w, y: rect.y / box.h, w: rect.w / box.w, h: rect.h / box.h });
}

function cleanup() {
  end();
  if (shown.value) URL.revokeObjectURL(shown.value);
  shown.value = null;
  bitmap.value?.close?.();
  bitmap.value = null;
  box.w = box.h = 0;
}
onBeforeUnmount(cleanup);
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="viewer crop">
        <div class="viewer-top">
          <button class="icon-btn" aria-label="Annuler" @click="emit('close')"><X :size="22" /></button>
          <span class="subhead bold">Recadrer</span>
          <button class="nav-btn bold" :disabled="busy || !box.w" @click="confirm">{{ busy ? 'Envoi…' : 'Valider' }}</button>
        </div>
        <div ref="stage" class="crop-stage">
          <div v-if="shown && box.w" class="crop-box" :style="{ width: `${box.w}px`, height: `${box.h}px` }">
            <img :src="shown" alt="" draggable="false" />
            <div
              class="crop-frame" :style="{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` }"
              @pointerdown="start($event, 'move')"
            >
              <i class="crop-grid" />
              <span v-for="hd in HANDLES" :key="hd" class="crop-handle" :class="hd" @pointerdown.stop="start($event, hd)" />
            </div>
          </div>
        </div>
        <div class="viewer-bar">
          <button class="icon-btn" aria-label="Pivoter d'un quart de tour" :disabled="busy || !box.w" @click="turn"><RotateCw :size="20" /></button>
          <Segmented v-model="ratio" :options="[{ value: 'free', label: 'Libre' }, { value: 'square', label: 'Carré' }]" />
          <button class="nav-btn" :disabled="busy || untouched" @click="reset">Réinitialiser</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
