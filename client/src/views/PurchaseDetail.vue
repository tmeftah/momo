<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Truck } from 'lucide-vue-next';
import { api } from '../api.js';
import { money, fmtNum, fmtDate } from '../store.js';
import { toast, toastError, confirmAction } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import Skeleton from '../components/Skeleton.vue';

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
  if (!(await confirmAction('Les quantités seront retirées du stock.', { title: `Annuler l'achat #${id} ?`, confirm: "Annuler l'achat" }))) return;
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
    <NavBar :reveal-at="100" :title="`Achat #${id}`" back />
    <Skeleton v-if="!p" :rows="3" />
    <template v-else>
      <div class="hero" style="padding: 12px 0 4px">
        <div class="footnote secondary">Achat #{{ p.id }} · {{ fmtDate(p.created_at, true) }}</div>
        <div class="hero-amount">{{ money(p.total) }}</div>
      </div>
      <ListGroup>
        <ListRow v-if="p.supplier_id" :to="`/fournisseurs/${p.supplier_id}`" :icon="Truck" tile="accent" title="Fournisseur" :value="p.supplier_name" />
        <ListRow v-else :icon="Truck" tile="accent" title="Fournisseur" value="—" />
        <ListRow v-if="p.reference" title="N° de facture" :value="p.reference" />
      </ListGroup>
      <ListGroup header="Articles">
        <ListRow
          v-for="l in p.lines" :key="l.id" :to="l.item_id ? `/stock/${l.item_id}` : undefined" :thumb="l.photo || null"
          :title="l.name" :subtitle="`${fmtNum(l.qty)} × ${money(l.unit_cost)}`" :chevron="false"
        >
          <template #trailing><span class="bold num">{{ money(l.qty * l.unit_cost) }}</span></template>
        </ListRow>
      </ListGroup>
      <ListGroup v-if="p.notes" header="Note"><div class="cell text-cell">{{ p.notes }}</div></ListGroup>
      <ListGroup>
        <ListRow title="Annuler l'achat et retirer du stock" destructive @click="remove" />
      </ListGroup>
    </template>
  </div>
</template>
