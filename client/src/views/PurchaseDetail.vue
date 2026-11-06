<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { money, fmtNum, fmtDate, toast, toastError } from '../store.js';
import PageHeader from '../components/PageHeader.vue';

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const p = ref(null);

onMounted(async () => {
  try {
    p.value = await api.get(`/purchases/${id}`);
  } catch (e) {
    toastError(e);
  }
});

async function remove() {
  if (!confirm(`Annuler l'achat #${id} ? Les quantités seront retirées du stock.`)) return;
  try {
    await api.del(`/purchases/${id}`);
    toast('Achat annulé');
    router.replace(p.value.supplier_id ? `/fournisseurs/${p.value.supplier_id}` : '/fournisseurs');
  } catch (e) {
    toastError(e);
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="`📦 Achat #${id}`" back />
    <div v-if="p" class="stack">
      <div class="card">
        <dl class="kv" style="margin: 0">
          <dt>Fournisseur</dt>
          <dd><router-link v-if="p.supplier_id" :to="`/fournisseurs/${p.supplier_id}`">{{ p.supplier_name }}</router-link><template v-else>—</template></dd>
          <template v-if="p.reference"><dt>Référence</dt><dd>{{ p.reference }}</dd></template>
          <dt>Date</dt><dd>{{ fmtDate(p.created_at, true) }}</dd>
        </dl>
      </div>
      <div class="card">
        <table class="table">
          <thead><tr><th>Article</th><th class="right">Qté</th><th class="right">P.U.</th><th class="right">Total</th></tr></thead>
          <tbody>
            <tr v-for="l in p.lines" :key="l.id">
              <td><router-link v-if="l.item_id" :to="`/stock/${l.item_id}`">{{ l.name }}</router-link><template v-else>{{ l.name }}</template></td>
              <td class="right">{{ fmtNum(l.qty) }}</td>
              <td class="right">{{ money(l.unit_cost) }}</td>
              <td class="right strong">{{ money(l.qty * l.unit_cost) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="totals" style="margin-top: 10px"><div class="line"><span>Total</span><span class="grand">{{ money(p.total) }}</span></div></div>
      </div>
      <div v-if="p.notes" class="card small">{{ p.notes }}</div>
      <button class="btn btn-danger" @click="remove">↩️ Annuler l'achat (retirer du stock)</button>
    </div>
  </div>
</template>
