<script setup>
import { CATEGORY } from '../constants.js';
import { money, fmtRelative, vehicleLabel } from '../store.js';
import StatusBadge from './StatusBadge.vue';

defineProps({ repair: { type: Object, required: true }, showMoney: { type: Boolean, default: true } });
</script>

<template>
  <router-link :to="`/reparations/${repair.id}`" class="list-item" :class="{ urgent: repair.priority === 'urgent' && repair.status !== 'livree' }">
    <div class="thumb">{{ CATEGORY[repair.category]?.icon || '🔧' }}</div>
    <div class="grow">
      <div class="title ellipsis">{{ vehicleLabel(repair) }}</div>
      <div class="sub ellipsis">#{{ repair.id }} · {{ repair.client_name || 'Sans client' }} · {{ fmtRelative(repair.created_at) }}</div>
      <div class="row wrap" style="gap: 6px; margin-top: 4px">
        <StatusBadge :status="repair.status" />
        <StatusBadge v-if="repair.priority !== 'normal'" :priority="repair.priority" />
        <span v-if="repair.status === 'terminee' && repair.notified_at" class="badge cyan">📲 Client prévenu</span>
      </div>
    </div>
    <div v-if="showMoney" class="right">
      <div class="strong">{{ money(repair.total) }}</div>
      <div v-if="repair.balance > 0.009 && repair.status === 'livree'" class="tiny text-orange">doit {{ money(repair.balance) }}</div>
    </div>
  </router-link>
</template>
