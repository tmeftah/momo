<script setup>
import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { session } from './api.js';
import { nav, scrollMemory } from './router.js';
import TabBar from './components/TabBar.vue';
import OverlayHost from './components/OverlayHost.vue';
import PwaStatus from './components/PwaStatus.vue';

const route = useRoute();
const router = useRouter();

// List screens stay alive so going back is instant and keeps the scroll position
const CACHED = ['HomeView', 'SaleNew','WorkshopView', 'StockList', 'ClientsList', 'SalesList', 'DiagnosticsList', 'ConnectorsList', 'KnowledgeList', 'SuppliersList', 'MoreView', 'PlanningView'];

function restoreScroll() {
  const saved = nav.direction === 'pop' ? scrollMemory.get(route.fullPath) : 0;
  window.scrollTo(0, saved || 0);
}

watch(
  () => session.authenticated,
  (ok) => {
    if (!ok && session.checked && !route.meta.public) router.replace({ path: '/login', query: { r: route.fullPath } });
  }
);
</script>

<template>
  <router-view v-slot="{ Component, route: r }">
    <Transition :name="nav.transition" mode="out-in" @before-enter="restoreScroll">
      <KeepAlive :include="CACHED" :max="12">
        <component :is="Component" :key="r.path" />
      </KeepAlive>
    </Transition>
  </router-view>
  <TabBar v-if="!route.meta.bare && session.authenticated" />
  <PwaStatus />
  <OverlayHost />
</template>
