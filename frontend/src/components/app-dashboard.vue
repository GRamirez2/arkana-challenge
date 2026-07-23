<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';

import Badge from '@/components/ui/badge.vue';
import Button from '@/components/ui/button.vue';
import Card from '@/components/ui/card.vue';
import type { SummaryCard } from '@/composables/useDiabetesSession';

/**
 * Status panel that explains the current session mode and the latest loaded
 * dataset context.
 */
const props = defineProps<{
  summaryCards: SummaryCard[];
  indicators: string[];
  sessionModeLabel: string;
  hasOpenAiApiKey: boolean;
}>();

const emit = defineEmits<{
  (event: 'clear-key-and-restart'): void;
}>();
</script>

<template>
  <header class="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
    <div class="space-y-5">
      <div class="flex flex-wrap items-center gap-3">
        <Badge class="border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
          Diabetes dataset explorer
        </Badge>
        <Badge class="border-white/10 bg-white/5 text-slate-200">
          {{ props.sessionModeLabel }}
        </Badge>
        <Button
          v-if="props.hasOpenAiApiKey"
          variant="outline"
          size="sm"
          class="border-white/15 bg-white/5 text-white hover:bg-white/10"
          @click="emit('clear-key-and-restart')"
        >
          Clear key and restart
        </Button>
      </div>

      <div class="max-w-4xl space-y-4">
        <h1
          class="text-4xl font-semibold tracking-tight text-white sm:text-6xl"
        >
          Ask natural-language questions about U.S. diabetes data and explore
          trend charts with context-aware follow-ups.
        </h1>
      </div>
    </div>

    <Card
      class="border-white/10 bg-white/5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl"
    >
      <div class="space-y-4 p-4 sm:p-5">
        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="item in props.summaryCards"
            :key="item.label"
            class="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"
          >
            <p class="text-xs uppercase tracking-[0.18em] text-slate-400">
              {{ item.label }}
            </p>
            <p class="mt-2 text-xl font-semibold text-white">
              {{ item.value }}
            </p>
          </div>
        </div>
        <div
          class="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3"
        >
          <p
            class="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/90"
          >
            Available indicators
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <span
              v-for="indicator in props.indicators"
              :key="indicator"
              class="rounded-full border border-cyan-200/40 bg-slate-950/45 px-3 py-1 text-xs font-medium text-cyan-50"
            >
              {{ indicator }}
            </span>
          </div>
        </div>
        <div
          class="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50"
        >
          <div class="flex items-center gap-2 font-medium">
            <Sparkles class="h-4 w-4" />
            Follow-ups build on the prior answer state.
          </div>
          <p class="mt-2 text-emerald-50/80">
            The current assistant state is preserved on every request and shown
            back in the interface.
          </p>
        </div>
      </div>
    </Card>
  </header>
</template>
