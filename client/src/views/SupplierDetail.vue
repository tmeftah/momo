<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { money, fmtNum, fmtDate, toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';
import ContactButtons from '../components/ContactButtons.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const s = ref(null);

onMounted(async () => {
  try {
    s.value = await api.get(`/suppliers/${id}`);
  } catch (e) {
    toastError(e);
  }
});

async function remove() {
  if (!confirm(`Supprimer « ${s.value.name} » ?`)) return;
  try {
    await api.del(`/suppliers/${id}`);
    toast('Fournisseur supprimé');
    router.replace('/fournisseurs');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="s?.name || 'Fournisseur'" back="/fournisseurs">
      <router-link :to="`/fournisseurs/${id}/modifier`" class="btn btn-sm">✏️</router-link>
    </PageHeader>
    <div v-if="s" class="stack">
      <div class="card stack">
        <dl class="kv" style="margin: 0">
          <template v-if="s.phone"><dt>Téléphone</dt><dd>{{ s.phone }}</dd></template>
          <template v-if="s.whatsapp"><dt>WhatsApp</dt><dd>{{ s.whatsapp }}</dd></template>
          <template v-if="s.address"><dt>Adresse</dt><dd>{{ s.address }}</dd></template>
        </dl>
        <div v-if="s.notes" class="block-text small">{{ s.notes }}</div>
        <ContactButtons :phone="s.phone" :whatsapp="s.whatsapp" />
      </div>
      <router-link :to="`/achats/nouveau?supplier_id=${id}`" class="btn btn-accent btn-lg">📦 Nouvel achat (entrée en stock)</router-link>

      <div class="section-title">Historique des achats</div>
      <div class="list">
        <router-link v-for="p in s.purchases" :key="p.id" :to="`/achats/${p.id}`" class="list-item">
          <div class="thumb">📦</div>
          <div class="grow">
            <div class="title ellipsis">{{ p.summary }}</div>
            <div class="sub">#{{ p.id }}{{ p.reference ? ' · ' + p.reference : '' }} · {{ fmtDate(p.created_at) }}</div>
          </div>
          <div class="strong">{{ money(p.total) }}</div>
        </router-link>
        <div v-if="!s.purchases.length" class="empty small">Aucun achat enregistré</div>
      </div>

      <template v-if="s.items.length">
        <div class="section-title">Articles de ce fournisseur</div>
        <div class="list">
          <router-link v-for="i in s.items" :key="i.id" :to="`/stock/${i.id}`" class="list-item" style="min-height: 52px">
            <div class="grow"><div class="title small ellipsis">{{ i.name }}</div><div class="sub tiny">{{ i.reference }}</div></div>
            <div class="right small"><div>{{ money(i.purchase_price) }}</div><div class="muted">stock {{ fmtNum(i.quantity) }}</div></div>
          </router-link>
        </div>
      </template>
      <button class="btn btn-danger" style="margin-top: 16px" @click="remove">Supprimer le fournisseur</button>
    </div>
  </div>
</template>
