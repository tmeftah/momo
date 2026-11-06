import { createRouter, createWebHistory } from 'vue-router';
import { session, checkSession } from './api.js';
import { loadSettings } from './store.js';

const v = (name) => () => import(`./views/${name}.vue`);

const routes = [
  { path: '/login', name: 'login', component: v('LoginView'), meta: { public: true, bare: true } },
  { path: '/', name: 'home', component: v('HomeView'), meta: { tab: 'home' } },

  // Atelier (repairs of every kind)
  { path: '/atelier', component: v('WorkshopView'), meta: { tab: 'atelier' } },
  { path: '/batteries', component: v('WorkshopView'), props: { category: 'batterie' }, meta: { tab: 'plus' } },
  { path: '/reparations/nouvelle', component: v('RepairForm'), meta: { tab: 'atelier' } },
  { path: '/reparations/:id', component: v('RepairDetail'), meta: { tab: 'atelier' } },
  { path: '/reparations/:id/modifier', component: v('RepairForm'), meta: { tab: 'atelier' } },

  { path: '/diagnostics', component: v('DiagnosticsList'), meta: { tab: 'plus' } },
  { path: '/diagnostics/nouveau', component: v('DiagnosticForm'), meta: { tab: 'plus' } },
  { path: '/diagnostics/:id', component: v('DiagnosticDetail'), meta: { tab: 'plus' } },
  { path: '/diagnostics/:id/modifier', component: v('DiagnosticForm'), meta: { tab: 'plus' } },

  // Stock
  { path: '/stock', component: v('StockList'), meta: { tab: 'stock' } },
  { path: '/stock/nouveau', component: v('ItemForm'), meta: { tab: 'stock' } },
  { path: '/stock/ajout', component: v('StockAdd'), meta: { tab: 'stock' } },
  { path: '/stock/:id', component: v('ItemDetail'), meta: { tab: 'stock' } },
  { path: '/stock/:id/modifier', component: v('ItemForm'), meta: { tab: 'stock' } },

  // Sales & cash
  { path: '/vente', component: v('SaleNew'), meta: { tab: 'vente' } },
  { path: '/ventes', component: v('SalesList'), meta: { tab: 'vente' } },
  { path: '/ventes/:id', component: v('SaleDetail'), meta: { tab: 'vente' } },
  { path: '/caisse', component: v('CashView'), meta: { tab: 'vente' } },

  // Clients
  { path: '/clients', component: v('ClientsList'), meta: { tab: 'clients' } },
  { path: '/clients/nouveau', component: v('ClientForm'), meta: { tab: 'clients' } },
  { path: '/clients/:id', component: v('ClientDetail'), meta: { tab: 'clients' } },
  { path: '/clients/:id/modifier', component: v('ClientForm'), meta: { tab: 'clients' } },

  // Plus
  { path: '/plus', component: v('MoreView'), meta: { tab: 'plus' } },
  { path: '/planning', component: v('PlanningView'), meta: { tab: 'plus', wide: true } },
  { path: '/connecteurs', component: v('ConnectorsList'), meta: { tab: 'plus' } },
  { path: '/connecteurs/nouveau', component: v('ConnectorForm'), meta: { tab: 'plus' } },
  { path: '/connecteurs/:id', component: v('ConnectorDetail'), meta: { tab: 'plus' } },
  { path: '/connecteurs/:id/modifier', component: v('ConnectorForm'), meta: { tab: 'plus' } },
  { path: '/adaptations/nouvelle', component: v('AdaptationForm'), meta: { tab: 'plus' } },
  { path: '/adaptations/:id', component: v('AdaptationDetail'), meta: { tab: 'plus' } },
  { path: '/adaptations/:id/modifier', component: v('AdaptationForm'), meta: { tab: 'plus' } },
  { path: '/base', component: v('KnowledgeList'), meta: { tab: 'plus' } },
  { path: '/base/nouveau', component: v('KnowledgeForm'), meta: { tab: 'plus' } },
  { path: '/base/:id', component: v('KnowledgeDetail'), meta: { tab: 'plus' } },
  { path: '/base/:id/modifier', component: v('KnowledgeForm'), meta: { tab: 'plus' } },
  { path: '/fournisseurs', component: v('SuppliersList'), meta: { tab: 'plus' } },
  { path: '/fournisseurs/nouveau', component: v('SupplierForm'), meta: { tab: 'plus' } },
  { path: '/fournisseurs/:id', component: v('SupplierDetail'), meta: { tab: 'plus' } },
  { path: '/fournisseurs/:id/modifier', component: v('SupplierForm'), meta: { tab: 'plus' } },
  { path: '/achats/nouveau', component: v('PurchaseNew'), meta: { tab: 'plus' } },
  { path: '/achats/:id', component: v('PurchaseDetail'), meta: { tab: 'plus' } },
  { path: '/parametres', component: v('SettingsView'), meta: { tab: 'plus' } },

  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
});

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
