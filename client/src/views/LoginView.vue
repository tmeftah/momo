<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, session, checkSession } from '../api.js';
import { loadSettings } from '../store.js';

const route = useRoute();
const router = useRouter();
const pin = ref('');
const firstPin = ref('');
const error = ref('');
const busy = ref(false);
const setupMode = computed(() => !session.configured);
const title = computed(() => (!setupMode.value ? 'Entrez votre code PIN' : firstPin.value ? 'Confirmez le code PIN' : 'Choisissez un code PIN (6 chiffres conseillés)'));

onMounted(async () => {
  await checkSession().catch(() => {});
  if (session.authenticated) router.replace(route.query.r || '/');
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

function onKey(e) {
  if (/^\d$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace') pin.value = pin.value.slice(0, -1);
  else if (e.key === 'Enter') submit();
}

function press(d) {
  error.value = '';
  if (pin.value.length < 12) pin.value += d;
}

async function submit() {
  if (busy.value || pin.value.length < 4) return;
  error.value = '';
  if (setupMode.value && !firstPin.value) {
    firstPin.value = pin.value;
    pin.value = '';
    return;
  }
  if (setupMode.value && firstPin.value !== pin.value) {
    error.value = 'Les deux codes ne correspondent pas';
    firstPin.value = '';
    pin.value = '';
    return;
  }
  busy.value = true;
  try {
    await api.post(setupMode.value ? '/auth/setup' : '/auth/login', { pin: pin.value });
    session.authenticated = true;
    session.configured = true;
    await loadSettings().catch(() => {});
    router.replace(route.query.r || '/');
  } catch (e) {
    error.value = e.message;
    pin.value = '';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="center" style="width: 100%; max-width: 360px">
      <div style="font-size: 3rem">🔑</div>
      <div class="brand"><i>VAE</i> <b>Manager</b></div>
      <p class="muted">{{ title }}</p>
      <div class="pin-dots">
        <i v-for="n in Math.max(6, pin.length)" :key="n" :class="{ on: n <= pin.length }" />
      </div>
      <p v-if="error" class="text-red strong">{{ error }}</p>
      <div class="pin-pad">
        <button v-for="d in ['1', '2', '3', '4', '5', '6', '7', '8', '9']" :key="d" @click="press(d)">{{ d }}</button>
        <button aria-label="Effacer" @click="pin = pin.slice(0, -1)">⌫</button>
        <button @click="press('0')">0</button>
        <button aria-label="Valider" :disabled="busy" style="background: var(--yellow); color: #111" @click="submit">✓</button>
      </div>
    </div>
  </div>
</template>
