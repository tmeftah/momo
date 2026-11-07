<script setup>
import { ref, computed, onActivated } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Plus, Receipt, Wallet, ShoppingCart, Trash2, NotebookPen, Package, Nut } from 'lucide-vue-next';
import { api, fileUrl } from '../api.js';
import { money, fmtNum, round2 } from '../store.js';
import { toast, toastError, confirmAction, haptic } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import ClientPicker from '../components/ClientPicker.vue';
import ItemPickerSheet from '../components/ItemPickerSheet.vue';
import PaySheet from '../components/PaySheet.vue';
import Stepper from '../components/Stepper.vue';
import EmptyState from '../components/EmptyState.vue';

const route = useRoute();
const router = useRouter();
const clientId = ref(route.query.client_id ? Number(route.query.client_id) : null);
const cart = ref([]);
const notes = ref('');
const picking = ref(false);
const paying = ref(false);
const busy = ref(false);

const total = computed(() => round2(cart.value.reduce((s, l) => s + l.qty * l.unit_price, 0)));
const count = computed(() => cart.value.reduce((s, l) => s + l.qty, 0));
const margin = computed(() => cart.value.reduce((s, l) => s + l.qty * (l.unit_price - (l.unit_cost || 0)), 0));

// Kept alive: the cart survives tab switches; a client passed from a client page is applied
onActivated(() => {
  if (route.query.client_id) clientId.value = Number(route.query.client_id);
});

function add(item) {
  const existing = cart.value.find((l) => l.item_id === item.id);
  if (existing) existing.qty++;
  else cart.value.push({ key: `i${item.id}`, item_id: item.id, name: item.name, qty: 1, unit_price: item.sale_price, unit_cost: item.purchase_price, stock: item.quantity, photo: item.photo });
}
function addFree(l) {
  cart.value.push({ key: `f${Date.now()}`, item_id: null, name: l.name, qty: l.qty, unit_price: l.unit_price, unit_cost: 0, stock: null, photo: null });
}
function removeLine(i) {
  haptic('light');
  cart.value.splice(i, 1);
}

async function checkout() {
  const over = cart.value.filter((l) => l.stock !== null && l.qty > l.stock);
  if (over.length && !(await confirmAction(over.map((l) => `${l.name} : ${fmtNum(l.stock)} en stock`).join('\n'), { title: 'Stock insuffisant', confirm: 'Continuer quand même', destructive: false }))) return;
  paying.value = true;
}

async function submit(payment) {
  const remaining = round2(total.value - payment.amount);
  if (remaining > 0 && !clientId.value && !(await confirmAction(`${money(remaining)} restera à payer sans client associé.`, { title: 'Vente à crédit sans client', confirm: 'Valider quand même', destructive: false }))) return;
  busy.value = true;
  try {
    const sale = await api.post('/sales', {
      client_id: clientId.value,
      notes: [notes.value, payment.notes].filter(Boolean).join(' — '),
      lines: cart.value.map(({ item_id, name, qty, unit_price }) => ({ item_id, name, qty, unit_price })),
      payment: { method: payment.method, amount: payment.amount },
    });
    haptic('success');
    toast(`Vente #${sale.id} · ${money(sale.total)}`);
    paying.value = false;
    cart.value = [];
    notes.value = '';
    router.push(`/ventes/${sale.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page" :class="{ 'has-bottom-bar': cart.length }">
    <NavBar title="Vente" large subtitle="Vente directe de pièces et accessoires">
      <router-link to="/ventes" class="nav-icon" aria-label="Historique"><Receipt :size="18" :stroke-width="2.2" /></router-link>
      <router-link to="/caisse" class="nav-icon" aria-label="Caisse"><Wallet :size="18" :stroke-width="2.2" /></router-link>
    </NavBar>

    <EmptyState v-if="!cart.length" :icon="ShoppingCart" title="Panier vide" text="Ajoutez un article : le stock est déduit automatiquement à la validation.">
      <button class="btn filled lg" style="padding: 0 32px" @click="picking = true"><Plus :size="20" :stroke-width="2.6" />Ajouter un article</button>
    </EmptyState>

    <template v-else>
      <ListGroup :header="`Panier · ${fmtNum(count)} article(s)`">
        <div v-for="(l, i) in cart" :key="l.key" class="cell has-thumb" style="align-items: flex-start; padding-top: 12px; padding-bottom: 12px">
          <img v-if="l.photo" class="thumb" :src="fileUrl(l.photo)" alt="" />
          <span v-else class="thumb"><component :is="l.item_id ? Package : Nut" :size="22" :stroke-width="1.8" /></span>
          <div class="cell-main" style="gap: 8px">
            <div class="hstack between" style="align-items: flex-start">
              <div class="grow">
                <div class="cell-title wrap">{{ l.name }}</div>
                <div class="cell-sub" :class="{ 'c-red': l.stock !== null && l.qty > l.stock }">{{ l.stock === null ? 'Hors stock' : `${fmtNum(l.stock)} en stock` }}</div>
              </div>
              <span class="headline num">{{ money(l.qty * l.unit_price) }}</span>
            </div>
            <div class="hstack">
              <Stepper v-model="l.qty" />
              <label class="search grow" style="height: 36px; color: var(--label-2)">
                <span class="footnote">P.U.</span>
                <input v-model.number="l.unit_price" type="number" step="0.01" inputmode="decimal" class="num" style="text-align: right; font-size: 16px" />
              </label>
              <button class="nav-icon" style="color: var(--red)" aria-label="Retirer" @click="removeLine(i)"><Trash2 :size="17" /></button>
            </div>
          </div>
        </div>
        <ListRow :icon="Plus" tile="accent" title="Ajouter un article" action @click="picking = true" />
      </ListGroup>

      <ListGroup header="Client">
        <ClientPicker v-model="clientId" optional />
      </ListGroup>

      <ListGroup :footer="`Marge estimée : ${money(margin)}`">
        <label class="cell field has-tile"><span class="tile bg-gray"><NotebookPen :size="17" /></span><input v-model="notes" placeholder="Note pour cette vente" style="text-align: left" /></label>
      </ListGroup>

      <div class="bottom-bar">
        <div class="grow" style="margin-left: auto">
          <div class="caption secondary">Total</div>
          <div class="title2 num">{{ money(total) }}</div>
        </div>
        <button class="btn yellow" style="min-width: 160px" @click="checkout">Encaisser</button>
      </div>
    </template>

    <ItemPickerSheet :open="picking" allow-free keep-open @close="picking = false" @pick="add" @free="addFree" />
    <PaySheet :open="paying" :due="total" title="Paiement" allow-credit :busy="busy" :confirm-label="`Valider la vente · ${money(total)}`" @close="paying = false" @confirm="submit" />
  </div>
</template>
