<script setup>
// iOS-style passcode screen. Remembers the PIN length on this device to auto-submit.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, session, checkSession } from '../api.js';
import { loadSettings } from '../store.js';
import { haptic } from '../ui.js';

const route = useRoute();
const router = useRouter();
const pin = ref('');
const firstPin = ref('');
const error = ref('');
const shake = ref(false);
const busy = ref(false);
const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ']];

const knownLength = (() => {
  try {
    return Number(localStorage.getItem('vae-pin-len')) || 0;
  } catch {
    return 0;
  }
})();
const setupMode = computed(() => !session.configured);
const dots = computed(() => Math.max(knownLength || 6, pin.value.length));
const title = computed(() => {
  if (!setupMode.value) return 'Saisissez le code';
  return firstPin.value ? 'Confirmez le code' : 'Choisissez un code';
});

onMounted(async () => {
  await checkSession().catch(() => {});
  if (session.authenticated) router.replace(route.query.r || '/');
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

function onKey(e) {
  if (/^\d$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace') erase();
  else if (e.key === 'Enter') submit();
}

function press(d) {
  if (busy.value || pin.value.length >= 12) return;
  haptic('light');
  error.value = '';
  pin.value += d;
  if (!setupMode.value && knownLength && pin.value.length === knownLength) submit();
}
const erase = () => (pin.value = pin.value.slice(0, -1));

function fail(msg) {
  error.value = msg;
  shake.value = true;
  haptic('error');
  setTimeout(() => {
    shake.value = false;
    pin.value = '';
  }, 450);
}

async function submit() {
  if (busy.value) return;
  if (pin.value.length < 4) return fail('Au moins 4 chiffres');
  if (setupMode.value && !firstPin.value) {
    firstPin.value = pin.value;
    pin.value = '';
    return;
  }
  if (setupMode.value && firstPin.value !== pin.value) {
    firstPin.value = '';
    return fail('Les codes ne correspondent pas');
  }
  busy.value = true;
  try {
    await api.post(setupMode.value ? '/auth/setup' : '/auth/login', { pin: pin.value });
    try {
      localStorage.setItem('vae-pin-len', String(pin.value.length));
    } catch {
      /* private mode */
    }
    haptic('success');
    session.authenticated = true;
    session.configured = true;
    await loadSettings().catch(() => {});
    router.replace(route.query.r || '/');
  } catch (e) {
    fail(e.message);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="passcode">
    <img class="brandmark" src="/icon-192.png" alt="" />
    <div class="title3" style="margin-top: 18px">{{ title }}</div>
    <div class="footnote secondary" style="margin-top: 4px; min-height: 18px" :class="{ 'c-red': error }">
      {{ error || (setupMode ? '6 chiffres conseillés' : 'VAE Manager') }}
    </div>
    <div class="dots" :class="{ shake }">
      <i v-for="n in dots" :key="n" :class="{ on: n <= pin.length }" />
    </div>
    <div class="keypad">
      <button v-for="[d, letters] in KEYS" :key="d" @click="press(d)">{{ d }}<small>{{ letters || '&nbsp;' }}</small></button>
      <button class="ghost" :style="{ visibility: pin ? 'visible' : 'hidden' }" @click="erase">Effacer</button>
      <button @click="press('0')">0<small>&nbsp;</small></button>
      <button class="ghost tint" style="font-weight: 600" :disabled="busy" @click="submit">OK</button>
    </div>
  </div>
</template>
