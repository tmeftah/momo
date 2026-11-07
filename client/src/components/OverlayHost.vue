<script setup>
// Global overlays: toast banners and the iOS action sheet (see ui.js).
import { CircleCheck, CircleAlert } from 'lucide-vue-next';
import { toasts, actionSheet, closeActionSheet } from '../ui.js';
</script>

<template>
  <Teleport to="body">
    <TransitionGroup tag="div" name="toast" class="toasts">
      <div v-for="t in toasts" :key="t.id" class="toast" role="status">
        <CircleAlert v-if="t.type === 'error'" class="error" :size="22" :stroke-width="2.4" />
        <CircleCheck v-else class="ok" :size="22" :stroke-width="2.4" />
        <span>{{ t.message }}</span>
      </div>
    </TransitionGroup>

    <Transition name="fade">
      <div v-if="actionSheet" class="sheet-backdrop" style="z-index: 90" @click="closeActionSheet(null)" />
    </Transition>
    <Transition name="as">
      <div v-if="actionSheet" class="as-wrap" role="dialog" aria-modal="true">
        <div class="as-group">
          <div v-if="actionSheet.title || actionSheet.message" class="as-head">
            <b v-if="actionSheet.title">{{ actionSheet.title }}</b>{{ actionSheet.message }}
          </div>
          <button
            v-for="a in actionSheet.actions" :key="a.label" class="as-btn" :class="{ destructive: a.destructive }"
            @click="closeActionSheet(a.value)"
          >{{ a.label }}</button>
        </div>
        <button class="as-btn as-cancel" @click="closeActionSheet(null)">{{ actionSheet.cancel }}</button>
      </div>
    </Transition>
  </Teleport>
</template>
