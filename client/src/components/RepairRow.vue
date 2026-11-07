<script setup>
import { CATEGORY } from '../constants.js';
import { money, fmtRelative, vehicleName, vehicleEmoji } from '../store.js';
import ListRow from './ListRow.vue';
import StatusPill from './StatusPill.vue';

defineProps({ repair: { type: Object, required: true }, showMoney: { type: Boolean, default: true } });
</script>

<template>
  <ListRow :to="`/reparations/${repair.id}`" style="--inset: 72px">
    <template #leading>
      <span class="thumb" style="position: relative">
        {{ vehicleEmoji(repair) }}
        <span
          v-if="repair.category !== 'general'" class="tile" :class="`bg-${CATEGORY[repair.category]?.color}`"
          style="position: absolute; right: -4px; bottom: -4px; width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--cell)"
        ><component :is="CATEGORY[repair.category]?.icon" :size="11" :stroke-width="2.6" /></span>
      </span>
    </template>
    <div class="cell-title">
      <span v-if="repair.priority === 'urgent' && repair.status !== 'livree'" class="c-red" style="font-weight: 800">! </span>{{ vehicleName(repair) }}
    </div>
    <div class="cell-sub">{{ repair.client_name || 'Sans client' }} · #{{ repair.id }} · {{ fmtRelative(repair.created_at) }}</div>
    <template #trailing>
      <div class="cell-trail">
        <span v-if="showMoney" class="subhead bold num">{{ money(repair.total) }}</span>
        <StatusPill :status="repair.status" />
      </div>
    </template>
  </ListRow>
</template>
