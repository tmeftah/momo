<script setup>
import { ref } from 'vue';
import { api, fileUrl } from '../api.js';
import { money, fmtNum, toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ItemPicker from '../components/ItemPicker.vue';

const item = ref(null);
const qty = ref(1);
const price = ref('');
const note = ref('');
const busy = ref(false);
const recent = ref([]);

function pick(i) {
  item.value = i;
  qty.value = 1;
  price.value = i.purchase_price;
}

async function submit() {
  busy.value = true;
  try {
    const updated = await api.post(`/items/${item.value.id}/adjust`, { delta: qty.value, note: note.value || 'Entrée de stock', purchase_price: price.value });
    recent.value.unshift({ name: updated.name, qty: qty.value, total: updated.quantity });
    toast(`${updated.name} : ${fmtNum(updated.quantity)} en stock`);
    item.value = null;
    note.value = '';
  } catch (e) {
    toastError(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <PageHeader title="➕ Ajouter du stock" back />
    <div class="stack">
      <p class="small muted" style="margin: 0">
        Entrée rapide sur un article existant. Pour un achat avec facture fournisseur, utilisez
        <router-link to="/achats/nouveau">📇 Achat fournisseur</router-link>.
      </p>

      <template v-if="!item">
        <ItemPicker placeholder="🔍 Rechercher l'article…" show-cost @pick="pick" />
        <router-link to="/stock/nouveau" class="btn btn-block">📦 Créer un nouvel article</router-link>
      </template>

      <div v-else class="card stack">
        <div class="row">
          <img v-if="item.photo" class="thumb" :src="fileUrl(item.photo)" alt="" />
          <div v-else class="thumb">📦</div>
          <div class="grow">
            <div class="strong">{{ item.name }}</div>
            <div class="small muted">Stock actuel : {{ fmtNum(item.quantity) }}</div>
          </div>
          <button class="btn btn-sm" @click="item = null">Changer</button>
        </div>
        <label class="field">
          <span>Quantité à ajouter</span>
          <div class="row">
            <button class="btn btn-icon" @click="qty = Math.max(1, qty - 1)">−</button>
            <input v-model.number="qty" class="grow center" type="number" min="1" step="any" inputmode="decimal" style="font-size: 1.4rem; font-weight: 800" />
            <button class="btn btn-icon" @click="qty++">+</button>
          </div>
        </label>
        <label class="field"><span>Prix d'achat unitaire (mise à jour)</span><input v-model="price" type="number" step="0.01" inputmode="decimal" /></label>
        <input v-model="note" placeholder="Note (facultatif)" />
        <div class="small muted">Nouveau stock : <b class="text-green">{{ fmtNum(item.quantity + (Number(qty) || 0)) }}</b> · valeur {{ money((Number(qty) || 0) * (Number(price) || 0)) }}</div>
        <button class="btn btn-accent btn-lg" :disabled="busy || !(qty > 0)" @click="submit">✅ Ajouter au stock</button>
      </div>

      <template v-if="recent.length">
        <div class="section-title">Ajouté à l'instant</div>
        <div class="card">
          <div v-for="(r, i) in recent" :key="i" class="row between small" style="padding: 4px 0">
            <span>{{ r.name }}</span><span class="text-green strong">+{{ fmtNum(r.qty) }} → {{ fmtNum(r.total) }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
