<script setup>
// Floating PWA status above the tab bar: « nouvelle version », offline state, install how-to sheet.
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { Sparkles, WifiOff, X, Share, SquarePlus, EllipsisVertical, Zap, CloudOff, Smartphone } from 'lucide-vue-next';
import { pwa, applyUpdate } from '../pwa.js';
import BottomSheet from './BottomSheet.vue';
import ListGroup from './ListGroup.vue';

const route = useRoute();
const hideUpdate = ref(false);
const updating = ref(false);
const bare = computed(() => route.meta.bare);
const since = computed(() => {
  const d = pwa.offlineSince;
  if (!d) return 'données enregistrées';
  const today = new Date().toDateString() === d.toDateString();
  return `données de ${today ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
});

function update() {
  updating.value = true;
  applyUpdate();
}
</script>

<template>
  <Teleport to="body">
    <div class="pwa-dock" :class="{ bare }">
      <Transition name="dock">
        <div v-if="pwa.updateReady && !hideUpdate" class="dock-card">
          <span class="tile bg-blue"><Sparkles :size="18" /></span>
          <div class="grow dock-text">
            <div class="headline">Nouvelle version</div>
            <div class="footnote secondary">Prête à installer</div>
          </div>
          <button class="btn filled sm" :disabled="updating" @click="update">{{ updating ? '…' : 'Mettre à jour' }}</button>
          <button class="dock-x" aria-label="Plus tard" @click="hideUpdate = true"><X :size="16" :stroke-width="2.6" /></button>
        </div>
      </Transition>
      <Transition name="dock">
        <div v-if="pwa.offline" class="dock-pill" role="status">
          <WifiOff :size="14" :stroke-width="2.6" />Hors ligne · {{ since }}
        </div>
      </Transition>
    </div>
  </Teleport>

  <BottomSheet :open="pwa.showInstall" title="Installer l'app" :cancel="null" action="OK" @close="pwa.showInstall = false" @action="pwa.showInstall = false">
    <div class="hero" style="padding: 4px 0 8px">
      <img src="/apple-touch-icon.png" alt="" style="width: 76px; height: 76px; border-radius: 18px" />
      <div class="hero-title">VAE Manager</div>
      <div class="hero-sub">Sur votre écran d'accueil, comme une vraie app</div>
    </div>

    <ListGroup v-if="pwa.ios" header="Sur iPhone / iPad (Safari)">
      <div class="cell has-tile"><span class="tile bg-blue"><Share :size="17" /></span><span class="cell-main"><span>1. Touchez <b>Partager</b> dans la barre de Safari</span></span></div>
      <div class="cell has-tile"><span class="tile bg-gray"><SquarePlus :size="17" /></span><span class="cell-main"><span>2. Choisissez <b>Sur l'écran d'accueil</b></span></span></div>
      <div class="cell has-tile"><span class="tile bg-green"><Smartphone :size="17" /></span><span class="cell-main"><span>3. Touchez <b>Ajouter</b></span></span></div>
    </ListGroup>
    <ListGroup v-else header="Sur Android (Chrome)">
      <div class="cell has-tile"><span class="tile bg-gray"><EllipsisVertical :size="17" /></span><span class="cell-main"><span>1. Ouvrez le menu <b>⋮</b> du navigateur</span></span></div>
      <div class="cell has-tile"><span class="tile bg-blue"><SquarePlus :size="17" /></span><span class="cell-main"><span>2. Touchez <b>Installer l'application</b></span></span></div>
    </ListGroup>

    <ListGroup header="Avantages">
      <div class="cell has-tile"><span class="tile bg-yellow"><Zap :size="17" /></span><span class="cell-main"><span>Plein écran, démarrage instantané</span></span></div>
      <div class="cell has-tile"><span class="tile bg-indigo"><CloudOff :size="17" /></span><span class="cell-main"><span>Consultation des fiches même sans réseau</span></span></div>
    </ListGroup>
  </BottomSheet>
</template>

<style scoped>
.pwa-dock {
  position: fixed; z-index: 60; left: 0; right: 0;
  bottom: calc(var(--tab-h) + var(--safe-b) + 10px);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 0 12px; pointer-events: none;
}
.pwa-dock.bare { bottom: calc(var(--safe-b) + 16px); }
:global(body:has(.page.has-bottom-bar)) .pwa-dock:not(.bare) { bottom: calc(var(--tab-h) + var(--safe-b) + 84px); }
.dock-card {
  pointer-events: auto; width: 100%; max-width: 440px;
  display: flex; align-items: center; gap: 12px; padding: 12px 10px 12px 14px;
  background: var(--bar-solid); border-radius: 18px; box-shadow: var(--shadow);
  -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
  border: 0.5px solid var(--sep);
}
.dock-text { min-width: 0; }
.dock-text > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dock-text .headline { font-size: 15px; }
.dock-pill {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
  border-radius: 999px; font-size: 13px; font-weight: 600;
  background: var(--bar-solid); color: var(--label-2); box-shadow: var(--shadow);
  -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); border: 0.5px solid var(--sep);
}
.dock-pill svg { color: var(--orange); }
.dock-enter-active, .dock-leave-active { transition: transform 0.4s var(--ease), opacity 0.3s; }
.dock-enter-from, .dock-leave-to { transform: translateY(24px) scale(0.96); opacity: 0; }
</style>
