<script setup>
import { computed } from 'vue';
import { waLink, telLink } from '../store.js';

const props = defineProps({ phone: String, whatsapp: String, message: String });
const emit = defineEmits(['whatsapp']);
const wa = computed(() => waLink(props.whatsapp || props.phone, props.message));
const tel = computed(() => telLink(props.phone || props.whatsapp));
</script>

<template>
  <div v-if="wa || tel" class="row">
    <a v-if="tel" class="btn grow" :href="tel">📞 Appeler</a>
    <a v-if="wa" class="btn btn-wa grow" :href="wa" target="_blank" rel="noopener" @click="emit('whatsapp')">💬 WhatsApp</a>
  </div>
</template>
