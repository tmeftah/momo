<script setup>
// A settings-style row showing the current choice; tapping opens a sheet with a checkmarked list.
import { ref, computed } from 'vue';
import ListRow from './ListRow.vue';
import BottomSheet from './BottomSheet.vue';
import ListGroup from './ListGroup.vue';
import { haptic } from '../ui.js';

const props = defineProps({
  label: String,
  modelValue: [String, Number, null],
  options: { type: Array, required: true },
  placeholder: { type: String, default: 'Choisir' },
  allowEmpty: Boolean,
  emptyLabel: { type: String, default: 'Aucun' },
  icon: [Object, Function],
  tile: String,
});
const emit = defineEmits(['update:modelValue']);
const open = ref(false);

const opts = computed(() => props.options.map((o) => (typeof o === 'object' ? o : { value: o, label: o })));
const current = computed(() => opts.value.find((o) => o.value === props.modelValue));

function pick(v) {
  haptic('light');
  emit('update:modelValue', v);
  setTimeout(() => (open.value = false), 120);
}
</script>

<template>
  <ListRow :title="label" :value="current?.label || placeholder" :icon="icon" :tile="tile" chevron @click="open = true" />
  <BottomSheet :open="open" :title="label" cancel="Fermer" @close="open = false">
    <ListGroup>
      <ListRow v-if="allowEmpty" :title="emptyLabel" :selected="modelValue === null || modelValue === undefined" @click="pick(null)" />
      <ListRow
        v-for="o in opts" :key="o.value" :title="o.label" :icon="o.icon" :tile="o.color || 'blue'"
        :selected="o.value === modelValue" @click="pick(o.value)"
      />
    </ListGroup>
  </BottomSheet>
</template>
