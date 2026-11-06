<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, fileUrl } from '../api.js';
import { PAYMENT_METHODS } from '../constants.js';
import { money, fmtNum, toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ClientPicker from '../components/ClientPicker.vue';
import ItemPicker from '../components/ItemPicker.vue';
import ChipSelect from '../components/ChipSelect.vue';

const route = useRoute();
const router = useRouter();
const clientId = ref(route.query.client_id ? Number(route.query.client_id) : null);
const cart = ref([]);
const method = ref('especes');
const amount = ref(0);
const amountTouched = ref(false);
const notes = ref('');
const free = ref(null);
const busy = ref(false);

const total = computed(() => Math.round(cart.value.reduce((s, l) => s + l.qty * l.unit_price, 0) * 100) / 100);
const remaining = computed(() => Math.max(0, Math.round((total.value - (Number(amount.value) || 0)) * 100) / 100));
const margin = computed(() => cart.value.reduce((s, l) => s + l.qty * (l.unit_price - (l.unit_cost || 0)), 0));

// Default amount: full total, or 0 for a credit sale — until edited by hand
watch([total, method], () => {
  if (!amountTouched.value) amount.value = method.value === 'credit' ? 0 : total.value;
});

function add(item) {
  const existing = cart.value.find((l) => l.item_id === item.id);
  if (existing) existing.qty++;
  else cart.value.push({ item_id: item.id, name: item.name, qty: 1, unit_price: item.sale_price, unit_cost: item.purchase_price, stock: item.quantity, photo: item.photo });
}
function addFree() {
  cart.value.push({ item_id: null, name: free.value.name, qty: free.value.qty || 1, unit_price: free.value.unit_price || 0, unit_cost: 0, stock: null });
  free.value = null;
}

async function submit() {
  if (!cart.value.length) return;
  if (amount.value > total.value + 0.009) return toastError(new Error('Le montant payé dépasse le total'));
  if (remaining.value > 0 && !clientId.value && !confirm(`Reste ${money(remaining.value)} à payer sans client associé. Continuer ?`)) return;
  const over = cart.value.filter((l) => l.stock !== null && l.qty > l.stock);
  if (over.length && !confirm(`Stock insuffisant pour : ${over.map((l) => l.name).join(', ')}.\nValider quand même ?`)) return;
  busy.value = true;
  try {
    const sale = await api.post('/sales', {
      client_id: clientId.value,
      notes: notes.value,
      lines: cart.value.map(({ item_id, name, qty, unit_price }) => ({ item_id, name, qty, unit_price })),
      payment: { method: method.value, amount: Number(amount.value) || 0 },
    });
    toast(`Vente #${sale.id} enregistrée · ${money(sale.total)}`);
    router.replace(`/ventes/${sale.id}`);
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <PageHeader title="🛒 Vente">
      <router-link to="/ventes" class="btn btn-sm">🧾 Historique</router-link>
      <router-link to="/caisse" class="btn btn-sm">💰 Caisse</router-link>
    </PageHeader>

    <div class="stack">
      <ItemPicker placeholder="🔍 Rechercher un article (nom, réf, tension)…" @pick="add" />

      <div v-for="(l, i) in cart" :key="i" class="card" style="padding: 10px">
        <div class="row">
          <img v-if="l.photo" class="thumb" :src="fileUrl(l.photo)" alt="" style="width: 44px; height: 44px" />
          <div class="grow">
            <div class="strong">{{ l.name }}</div>
            <div class="tiny" :class="l.stock !== null && l.qty > l.stock ? 'text-red' : 'muted'">
              {{ l.stock === null ? 'Hors stock' : `En stock : ${fmtNum(l.stock)}` }}
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" aria-label="Retirer" @click="cart.splice(i, 1)">🗑️</button>
        </div>
        <div class="row" style="margin-top: 8px">
          <button class="btn btn-icon" :disabled="l.qty <= 1" @click="l.qty--">−</button>
          <div class="strong center" style="min-width: 32px">{{ fmtNum(l.qty) }}</div>
          <button class="btn btn-icon" @click="l.qty++">+</button>
          <span class="muted">×</span>
          <input v-model.number="l.unit_price" class="grow" type="number" step="0.01" inputmode="decimal" />
          <div class="strong right" style="min-width: 76px">{{ money(l.qty * l.unit_price) }}</div>
        </div>
      </div>

      <div v-if="free" class="card stack">
        <label class="field"><span>Article hors stock</span><input v-model="free.name" placeholder="Désignation" /></label>
        <div class="grid-2">
          <label class="field"><span>Quantité</span><input v-model.number="free.qty" type="number" min="1" inputmode="decimal" /></label>
          <label class="field"><span>Prix unitaire</span><input v-model.number="free.unit_price" type="number" step="0.01" inputmode="decimal" /></label>
        </div>
        <div class="row"><button class="btn grow" @click="free = null">Annuler</button><button class="btn btn-primary grow" :disabled="!free.name" @click="addFree">Ajouter</button></div>
      </div>
      <button v-else class="btn btn-ghost btn-sm" @click="free = { name: '', qty: 1, unit_price: 0 }">➕ Article hors stock</button>

      <template v-if="cart.length">
        <ClientPicker v-model="clientId" optional />

        <div class="card stack">
          <div class="totals">
            <div class="line"><span>Total</span><span class="grand">{{ money(total) }}</span></div>
            <div class="line tiny muted"><span>Marge estimée</span><span>{{ money(margin) }}</span></div>
          </div>
          <div class="field"><span>Mode de paiement</span><ChipSelect v-model="method" :options="PAYMENT_METHODS" big /></div>
          <label class="field">
            <span>{{ method === 'credit' ? 'Acompte versé en espèces (facultatif)' : 'Montant reçu' }}</span>
            <input v-model.number="amount" type="number" step="0.01" min="0" inputmode="decimal" style="font-size: 1.3rem; font-weight: 800" @input="amountTouched = true" />
          </label>
          <div class="totals">
            <div class="line">
              <span>Reste à payer</span>
              <span :class="remaining > 0 ? 'due' : 'ok'">{{ remaining > 0 ? money(remaining) + ' (crédit)' : '✅ Payé' }}</span>
            </div>
          </div>
          <input v-model="notes" placeholder="Note (facultatif) — ex : article reçu en échange" />
        </div>

        <button class="btn btn-accent btn-lg btn-block" :disabled="busy" @click="submit">✅ Valider la vente · {{ money(total) }}</button>
      </template>
      <div v-else class="empty">
        <div class="big">🛒</div>
        <div>Recherchez un article pour commencer la vente.</div>
        <div class="tiny" style="margin-top: 6px">Le stock est déduit automatiquement à la validation.</div>
      </div>
    </div>
  </div>
</template>
