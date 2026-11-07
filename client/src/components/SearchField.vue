<script setup>
import { ref } from 'vue';
import { Search, X } from 'lucide-vue-next';

defineProps({ modelValue: String, placeholder: { type: String, default: 'Rechercher' }, autofocus: Boolean });
const emit = defineEmits(['update:modelValue']);
const input = ref(null);
defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <label class="search">
    <Search :size="18" :stroke-width="2.3" />
    <input
      ref="input" type="search" :value="modelValue" :placeholder="placeholder" :autofocus="autofocus"
      autocomplete="off" enterkeyhint="search" @input="emit('update:modelValue', $event.target.value)"
    />
    <button v-if="modelValue" type="button" class="clear" aria-label="Effacer" @click="emit('update:modelValue', ''); input.focus()">
      <X :size="14" :stroke-width="3" />
    </button>
  </label>
</template>
