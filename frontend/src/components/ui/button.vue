<script setup lang="ts">
import { computed } from 'vue';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-slate-950 text-white shadow-lg shadow-slate-950/10 hover:bg-slate-800',
        secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
        outline:
          'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
        ghost: 'text-slate-700 hover:bg-slate-100',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-3 rounded-lg',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants['variant'];
    size?: ButtonVariants['size'];
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
  }>(),
  {
    variant: 'default',
    size: 'default',
    type: 'button',
  }
);

const classes = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size }))
);
</script>

<template>
  <button :type="type" :disabled="disabled" :class="classes">
    <slot />
  </button>
</template>
