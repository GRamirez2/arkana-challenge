<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { cn } from '@/lib/utils';

const attrs = useAttrs();

const classes = computed(() =>
  cn(
    'inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-700',
    attrs.class
  )
);

const forwardedAttrs = computed(() => {
  const { class: _class, ...rest } = attrs;
  return rest;
});
</script>

<template>
  <span v-bind="forwardedAttrs" :class="classes">
    <slot />
  </span>
</template>
