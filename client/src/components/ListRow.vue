<script setup>
// One row of a grouped list. Leading: icon tile | photo thumb | avatar.
import { computed, useAttrs } from 'vue';
import { RouterLink } from 'vue-router';
import { ChevronRight, Check, Package } from 'lucide-vue-next';
import { fileUrl } from '../api.js';
import Avatar from './Avatar.vue';

defineOptions({ inheritAttrs: false });
const props = defineProps({
  to: [String, Object],
  href: String,
  title: [String, Number],
  subtitle: [String, Number],
  value: [String, Number],
  icon: [Object, Function],
  tile: { type: String, default: 'accent' }, // "accent", "soft", or a semantic color (red, orange…)
  thumb: { type: String, default: undefined },
  thumbIcon: { type: [Object, Function], default: () => Package },
  avatar: String,
  chevron: { type: Boolean, default: undefined },
  selected: Boolean,
  destructive: Boolean,
  action: Boolean,
  wrap: Boolean,
  external: Boolean,
});
const attrs = useAttrs();

const tag = computed(() => (props.to ? RouterLink : props.href ? 'a' : attrs.onClick ? 'button' : 'div'));
const tappable = computed(() => !!(props.to || props.href || attrs.onClick));
const showChevron = computed(() => (props.chevron === undefined ? !!props.to && !props.destructive && !props.action : props.chevron));
const hasThumb = computed(() => props.thumb !== undefined);
const bind = computed(() => {
  const b = { ...attrs };
  if (props.to) b.to = props.to;
  if (props.href) {
    b.href = props.href;
    if (props.external) Object.assign(b, { target: '_blank', rel: 'noopener' });
  }
  if (tag.value === 'button') b.type = 'button';
  return b;
});
</script>

<template>
  <component
    :is="tag"
    v-bind="bind"
    class="cell"
    :class="{
      tap: tappable,
      destructive,
      action,
      'has-tile': icon,
      'has-thumb': hasThumb,
      'has-avatar': avatar,
    }"
  >
    <slot name="leading">
      <span v-if="icon" class="tile" :class="tile === 'soft' ? 'soft' : `bg-${tile}`">
        <component :is="icon" :size="18" :stroke-width="2.2" />
      </span>
      <template v-else-if="hasThumb">
        <img v-if="thumb" class="thumb" :src="fileUrl(thumb)" alt="" loading="lazy" />
        <span v-else class="thumb"><component :is="thumbIcon" :size="22" :stroke-width="1.8" /></span>
      </template>
      <Avatar v-else-if="avatar" :name="avatar" :size="40" />
    </slot>
    <div v-if="$slots.default || title !== undefined || subtitle" class="cell-main">
      <slot>
        <div class="cell-title" :class="{ wrap }">{{ title }}</div>
        <div v-if="subtitle" class="cell-sub" :class="{ wrap }">{{ subtitle }}</div>
      </slot>
    </div>
    <slot name="trailing">
      <span v-if="value !== undefined && value !== null && value !== ''" class="cell-value num">{{ value }}</span>
    </slot>
    <Check v-if="selected" class="check-mark" :size="20" :stroke-width="2.8" />
    <ChevronRight v-if="showChevron" class="chev" :size="20" :stroke-width="2.4" />
  </component>
</template>
