import { reactive } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { session, checkSession } from './api.js';
import { loadSettings } from './store.js';

const v = (name) => () => import(`./views/${name}.vue`);

// meta.title labels the back button of the next screen; meta.root marks tab roots
const routes = [
  { path: '/login', component: v('LoginView'), meta: { public: true, bare: true } },
  { path: '/', component: v('HomeView'), meta: { tab: 'home', root: true, title: 'Accueil' } },

  { path: '/atelier', component: v('WorkshopView'), meta: { tab: 'atelier', root: true, title: 'Atelier' } },
  { path: '/batteries', component: v('WorkshopView'), props: { category: 'batterie' }, meta: { tab: 'plus', title: 'Batteries' } },
  { path: '/reparations/nouvelle', component: v('RepairForm'), meta: { tab: 'atelier', title: 'Nouvelle' } },
  { path: '/reparations/:id', component: v('RepairDetail'), meta: { tab: 'atelier', title: 'Réparation' } },
  { path: '/reparations/:id/modifier', component: v('RepairForm'), meta: { tab: 'atelier', title: 'Modifier' } },

  { path: '/diagnostics', component: v('DiagnosticsList'), meta: { tab: 'plus', title: 'Diagnostics' } },
  { path: '/diagnostics/nouveau', component: v('DiagnosticForm'), meta: { tab: 'plus', title: 'Nouveau' } },
  { path: '/diagnostics/:id', component: v('DiagnosticDetail'), meta: { tab: 'plus', title: 'Diagnostic' } },
  { path: '/diagnostics/:id/modifier', component: v('DiagnosticForm'), meta: { tab: 'plus', title: 'Modifier' } },

  { path: '/stock', component: v('StockList'), meta: { tab: 'stock', root: true, title: 'Stock' } },
  { path: '/stock/nouveau', component: v('ItemForm'), meta: { tab: 'stock', title: 'Nouvel article' } },
  { path: '/stock/ajout', component: v('StockAdd'), meta: { tab: 'stock', title: 'Entrée' } },
  { path: '/stock/:id', component: v('ItemDetail'), meta: { tab: 'stock', title: 'Article' } },
  { path: '/stock/:id/modifier', component: v('ItemForm'), meta: { tab: 'stock', title: 'Modifier' } },

  { path: '/vente', component: v('SaleNew'), meta: { tab: 'vente', root: true, title: 'Vente' } },
  { path: '/ventes', component: v('SalesList'), meta: { tab: 'vente', title: 'Ventes' } },
  { path: '/ventes/:id', component: v('SaleDetail'), meta: { tab: 'vente', title: 'Vente' } },
  { path: '/caisse', component: v('CashView'), meta: { tab: 'vente', title: 'Caisse' } },

  { path: '/clients', component: v('ClientsList'), meta: { tab: 'clients', root: true, title: 'Clients' } },
  { path: '/clients/nouveau', component: v('ClientForm'), meta: { tab: 'clients', title: 'Nouveau' } },
  { path: '/clients/:id', component: v('ClientDetail'), meta: { tab: 'clients', title: 'Client' } },
  { path: '/clients/:id/modifier', component: v('ClientForm'), meta: { tab: 'clients', title: 'Modifier' } },

  { path: '/plus', component: v('MoreView'), meta: { tab: 'plus', root: true, title: 'Plus' } },
  { path: '/prestations', component: v('TasksList'), meta: { tab: 'plus', title: 'Prestations' } },
  { path: '/planning', component: v('PlanningView'), meta: { tab: 'plus', title: 'Planning', wide: true } },
  { path: '/connecteurs', component: v('ConnectorsList'), meta: { tab: 'plus', title: 'Connecteurs' } },
  { path: '/connecteurs/nouveau', component: v('ConnectorForm'), meta: { tab: 'plus', title: 'Nouveau' } },
  { path: '/connecteurs/:id', component: v('ConnectorDetail'), meta: { tab: 'plus', title: 'Connecteur' } },
  { path: '/connecteurs/:id/modifier', component: v('ConnectorForm'), meta: { tab: 'plus', title: 'Modifier' } },
  { path: '/adaptations/nouvelle', component: v('AdaptationForm'), meta: { tab: 'plus', title: 'Nouvelle' } },
  { path: '/adaptations/:id', component: v('AdaptationDetail'), meta: { tab: 'plus', title: 'Adaptation' } },
  { path: '/adaptations/:id/modifier', component: v('AdaptationForm'), meta: { tab: 'plus', title: 'Modifier' } },
  { path: '/base', component: v('KnowledgeList'), meta: { tab: 'plus', title: 'Base technique' } },
  { path: '/base/nouveau', component: v('KnowledgeForm'), meta: { tab: 'plus', title: 'Nouvelle' } },
  { path: '/base/:id', component: v('KnowledgeDetail'), meta: { tab: 'plus', title: 'Solution' } },
  { path: '/base/:id/modifier', component: v('KnowledgeForm'), meta: { tab: 'plus', title: 'Modifier' } },
  { path: '/fournisseurs', component: v('SuppliersList'), meta: { tab: 'plus', title: 'Fournisseurs' } },
  { path: '/fournisseurs/nouveau', component: v('SupplierForm'), meta: { tab: 'plus', title: 'Nouveau' } },
  { path: '/fournisseurs/:id', component: v('SupplierDetail'), meta: { tab: 'plus', title: 'Fournisseur' } },
  { path: '/fournisseurs/:id/modifier', component: v('SupplierForm'), meta: { tab: 'plus', title: 'Modifier' } },
  { path: '/achats/nouveau', component: v('PurchaseNew'), meta: { tab: 'plus', title: 'Achat' } },
  { path: '/achats/:id', component: v('PurchaseDetail'), meta: { tab: 'plus', title: 'Achat' } },
  { path: '/parametres', component: v('SettingsView'), meta: { tab: 'plus', title: 'Réglages' } },

  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => false, // handled in App.vue so it follows the page transition
});

// ---------- Navigation direction (push / pop / tab) and scroll memory ----------
export const nav = reactive({ transition: 'tab', direction: 'push' });
export const scrollMemory = new Map();
let lastPosition = window.history.state?.position ?? 0;

router.beforeEach((to, from) => {
  if (from.matched.length) scrollMemory.set(from.fullPath, window.scrollY);
});

router.afterEach((to, from) => {
  const pos = window.history.state?.position ?? 0;
  const direction = pos < lastPosition ? 'pop' : pos > lastPosition ? 'push' : 'replace';
  lastPosition = pos;
  nav.direction = direction;
  const tabSwitch = to.meta.tab !== from.meta.tab || (to.meta.root && from.meta.root);
  nav.transition = !from.matched.length || tabSwitch || direction === 'replace' ? 'tab' : direction;
});

// ---------- Auth guard ----------
let settingsLoaded = false;
router.beforeEach(async (to) => {
  if (!session.checked) {
    try {
      await checkSession();
    } catch {
      session.checked = true;
    }
  }
  if (to.meta.public) return true;
  if (!session.authenticated) return { path: '/login', query: to.fullPath !== '/' ? { r: to.fullPath } : {} };
  if (!settingsLoaded) {
    settingsLoaded = true;
    loadSettings().catch(() => (settingsLoaded = false));
  }
  return true;
});
