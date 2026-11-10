<script setup>
// iOS sheet: slides up, drag the header down to dismiss, blurred backdrop.
import { ref, watch, onBeforeUnmount } from 'vue';
import { lockScroll } from '../ui.js';

const props = defineProps({
  open: Boolean,
  title: String,
  cancel: { type: [String, null], default: 'Annuler' },
  action: String,
  actionDisabled: Boolean,
  full: Boolean,
});
const emit = defineEmits(['close', 'action']);

// Scroll lock shared by nested sheets
let locked = false;
function lock(on) {
  if (on === locked) return;
  locked = on;
  lockScroll(on);
}
watch(() => props.open, lock, { immediate: true });
onBeforeUnmount(() => lock(false));

// Drag to dismiss (touch only)
const dragY = ref(0);
let startY = null;
let startT = 0;
function down(e) {
  if (e.pointerType === 'mouse' || e.target.closest('button')) return;
  startY = e.clientY;
  startT = Date.now();
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
}
function move(e) {
  if (startY !== null) dragY.value = Math.max(0, e.clientY - startY);
}
function up() {
  window.removeEventListener('pointermove', move);
  const velocity = dragY.value / Math.max(Date.now() - startT, 1);
  if (dragY.value > 110 || (dragY.value > 30 && velocity > 0.6)) emit('close');
  dragY.value = 0;
  startY = null;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="sheet-backdrop" @click="emit('close')" />
    </Transition>
    <Transition name="sheet">
      <div
        v-if="open" class="sheet" :class="{ full }" role="dialog" aria-modal="true"
        :style="dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : null"
      >
        <div class="sheet-grip" @pointerdown="down" />
        <div class="sheet-head" @pointerdown="down">
          <div><button v-if="cancel" class="nav-btn" @click="emit('close')">{{ cancel }}</button></div>
          <div class="sheet-title">{{ title }}</div>
          <div class="right">
            <button v-if="action" class="nav-btn strong" :disabled="actionDisabled" @click="emit('action')">{{ action }}</button>
          </div>
        </div>
        <div class="sheet-body"><slot /></div>
      </div>
    </Transition>
  </Teleport>
</template>
