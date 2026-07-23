<script setup lang="ts">
import Badge from '@/components/ui/badge.vue';
import Card from '@/components/ui/card.vue';
import type { TranscriptEntry } from '@/composables/useDiabetesSession';

/**
 * Transcript panel that shows the question/answer history in reverse order so
 * the most recent turns are easiest to scan.
 */
defineProps<{
  transcript: TranscriptEntry[];
}>();
</script>

<template>
  <Card
    class="border-white/10 bg-white/5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl"
  >
    <div class="space-y-4 p-5 sm:p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p
            class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400"
          >
            Transcript
          </p>
          <h3 class="mt-2 text-xl font-semibold text-white">
            Follow-up aware responses
          </h3>
        </div>
        <Badge class="border-white/10 bg-white/5 text-slate-200">
          {{ transcript.length }} turns
        </Badge>
      </div>

      <div class="space-y-3">
        <div
          v-for="(entry, index) in [...transcript].reverse()"
          :key="`${entry.role}-${index}-${entry.text}`"
          class="rounded-2xl border border-white/10 p-4"
          :class="
            entry.role === 'user'
              ? 'bg-cyan-400/10 text-cyan-50'
              : 'bg-slate-950/60 text-slate-100'
          "
        >
          <p class="text-xs uppercase tracking-[0.2em] opacity-70">
            {{ entry.role }}
          </p>
          <p class="mt-2 text-sm leading-7">{{ entry.text }}</p>
        </div>
      </div>

      <div
        v-if="transcript.length === 0"
        class="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-6 text-sm text-slate-400"
      >
        The first answer will appear here after the initial query runs.
      </div>
    </div>
  </Card>
</template>
