<script setup>
// iOS navigation bar: large title that collapses into the blurred bar on scroll,
// back button labelled with the previous screen, optional pull-to-refresh.
import { ref, computed, onMounted, onBeforeUnmount, onActivated, onDeactivated } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronLeft, RefreshCw } from 'lucide-vue-next';
import { haptic } from '../ui.js';

const props = defineProps({
  title: { type: String, default: '' },
  large: Boolean,
  back: { type: [Boolean, String], default: false },
  eyebrow: String,
  subtitle: String,
  refresh: Function,
  revealAt: Number, // pages with their own big title/hero: show the bar title only past this scroll offset
});
const router = useRouter();
const scrolled = ref(false);
const revealed = ref(false);

const backText = computed(() => {
  const prev = window.history.state?.back;
  const target = prev || (typeof props.back === 'string' ? props.back : null);
  if (!target) return 'Retour';
  try {
    return router.resolve(target).meta.title || 'Retour';
  } catch {
    return 'Retour';
  }
});

function goBack() {
  if (window.history.state?.back) router.back();
  else router.push(typeof props.back === 'string' ? props.back : '/');
}

function onScroll() {
  scrolled.value = window.scrollY > (props.large ? 40 : 2);
  revealed.value = window.scrollY > (props.large ? 40 : props.revealAt ?? 0);
}

// ---------- Pull to refresh ----------
const pull = ref(0);
const spinning = ref(false);
let startY = null;
const THRESHOLD = 70;

function tStart(e) {
  if (!props.refresh || spinning.value || window.scrollY > 0) return;
  startY = e.touches[0].clientY;
}
function tMove(e) {
  if (startY === null) return;
  const dy = e.touches[0].clientY - startY;
  if (dy <= 0) return (pull.value = 0);
  const prev = pull.value;
  pull.value = Math.min(dy * 0.45, 110);
  if (prev < THRESHOLD && pull.value >= THRESHOLD) haptic('light');
}
async function tEnd() {
  if (startY === null) return;
  startY = null;
  if (pull.value >= THRESHOLD) {
    spinning.value = true;
    pull.value = THRESHOLD;
    try {
      await props.refresh();
    } finally {
      spinning.value = false;
      pull.value = 0;
    }
  } else pull.value = 0;
}

function bind() {
  window.addEventListener('scroll', onScroll, { passive: true });
  if (props.refresh) {
    window.addEventListener('touchstart', tStart, { passive: true });
    window.addEventListener('touchmove', tMove, { passive: true });
    window.addEventListener('touchend', tEnd);
  }
  onScroll();
}
function unbind() {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('touchstart', tStart);
  window.removeEventListener('touchmove', tMove);
  window.removeEventListener('touchend', tEnd);
}
onMounted(bind);
onActivated(bind);
onDeactivated(unbind);
onBeforeUnmount(unbind);
</script>

<template>
  <header class="navbar" :class="{ scrolled, revealed, compact: !large && revealAt === undefined }">
    <div class="nav-left">
      <button v-if="back" class="nav-back" @click="goBack">
        <ChevronLeft :size="30" :stroke-width="2.3" style="margin-right: -4px" />
        <span>{{ backText }}</span>
      </button>
      <slot name="left" />
    </div>
    <div class="nav-title">{{ title }}</div>
    <div class="nav-right"><slot /></div>
  </header>
  <div v-if="large" class="large-header">
    <div v-if="eyebrow" class="eyebrow">{{ eyebrow }}</div>
    <h1 class="large-title">{{ title }}</h1>
    <div v-if="subtitle" class="subtitle">{{ subtitle }}</div>
  </div>
  <div v-if="refresh && (pull > 0 || spinning)" class="ptr" :class="{ spinning }" :style="{ opacity: Math.min(pull / 70, 1) }">
    <RefreshCw :size="22" :style="{ transform: `rotate(${pull * 4}deg)` }" />
  </div>
</template>
