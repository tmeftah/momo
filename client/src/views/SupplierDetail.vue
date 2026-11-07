<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Phone, MessageCircle, PackagePlus, Pencil, Package } from 'lucide-vue-next';
import { api } from '../api.js';
import { money, fmtNum, fmtDate, waLink, telLink } from '../store.js';
import { toast, toastError, confirmAction } from '../ui.js';
import NavBar from '../components/NavBar.vue';
import ListGroup from '../components/ListGroup.vue';
import ListRow from '../components/ListRow.vue';
import Avatar from '../components/Avatar.vue';
import ActionButtons from '../components/ActionButtons.vue';
import Skeleton from '../components/Skeleton.vue';

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

const wa = computed(() => s.value?.whatsapp || s.value?.phone);
const actions = computed(() => [
  { icon: Phone, label: 'Appeler', href: telLink(s.value?.phone || s.value?.whatsapp), disabled: !wa.value },
  { icon: MessageCircle, label: 'WhatsApp', href: waLink(wa.value), external: true, wa: true, disabled: !wa.value },
  { icon: PackagePlus, label: 'Achat', to: `/achats/nouveau?supplier_id=${id}` },
  { icon: Pencil, label: 'Modifier', to: `/fournisseurs/${id}/modifier` },
]);

async function remove() {
  if (!(await confirmAction('Impossible si des achats y sont liés.', { title: `Supprimer « ${s.value.name} » ?`, confirm: 'Supprimer le fournisseur' }))) return;
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
    <NavBar :reveal-at="180" :title="s?.name || ''" back="/fournisseurs">
      <router-link :to="`/fournisseurs/${id}/modifier`" class="nav-btn">Modifier</router-link>
    </NavBar>
    <Skeleton v-if="!s" :rows="4" />
    <template v-else>
      <div class="hero">
        <Avatar :name="s.name" :size="96" />
        <div class="hero-title">{{ s.name }}</div>
        <div class="hero-sub">{{ s.purchases_count }} achat(s){{ s.last_purchase_at ? ` · dernier le ${fmtDate(s.last_purchase_at)}` : '' }}</div>
      </div>
      <ActionButtons :actions="actions" />

      <ListGroup v-if="s.phone || s.whatsapp || s.address || s.notes">
        <ListRow v-if="s.phone" title="Téléphone" :value="s.phone" :href="telLink(s.phone)" />
        <ListRow v-if="s.whatsapp && s.whatsapp !== s.phone" title="WhatsApp" :value="s.whatsapp" :href="waLink(s.whatsapp)" external />
        <ListRow v-if="s.address" title="Adresse" :value="s.address" />
        <div v-if="s.notes" class="cell text-cell" style="display: block"><span class="t-label">Notes</span>{{ s.notes }}</div>
      </ListGroup>

      <ListGroup header="Achats">
        <ListRow v-for="p in s.purchases" :key="p.id" :to="`/achats/${p.id}`" :icon="Package" tile="soft" :title="p.summary" :subtitle="`#${p.id}${p.reference ? ' · ' + p.reference : ''} · ${fmtDate(p.created_at)}`" :chevron="false">
          <template #trailing><span class="bold num">{{ money(p.total) }}</span></template>
        </ListRow>
        <ListRow :to="`/achats/nouveau?supplier_id=${id}`" :icon="PackagePlus" tile="accent" title="Nouvel achat" action />
      </ListGroup>

      <ListGroup v-if="s.items.length" header="Articles de ce fournisseur">
        <ListRow v-for="i in s.items" :key="i.id" :to="`/stock/${i.id}`" :title="i.name" :subtitle="`${i.reference || '—'} · stock ${fmtNum(i.quantity)}`" :value="money(i.purchase_price)" />
      </ListGroup>

      <ListGroup>
        <ListRow title="Supprimer le fournisseur" destructive @click="remove" />
      </ListGroup>
    </template>
  </div>
</template>
