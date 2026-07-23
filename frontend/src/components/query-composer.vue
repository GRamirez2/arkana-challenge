<script setup lang="ts">
import { Activity, RefreshCcw, Sparkles } from 'lucide-vue-next';

import Button from '@/components/ui/button.vue';
import Card from '@/components/ui/card.vue';
import type { ActiveFilter } from '@/composables/useDiabetesSession';
import type { ConversationState } from '@/lib/api';

type QuestionIdea = {
  category: string;
  examples: string[];
};

/**
 * Main interaction panel that collects the next question and surfaces the
 * reusable follow-up prompts.
 */
const question = defineModel<string>('question', { default: '' });

const props = defineProps<{
  loadingAnswer: boolean;
  loadingOverview: boolean;
  errorMessage: string;
  quickPrompts: string[];
  activeFilters: ActiveFilter[];
  conversationState: ConversationState | undefined;
}>();

const emit = defineEmits<{
  (event: 'submit'): void;
  (event: 'use-prompt', prompt: string): void;
  (event: 'remove-filter', key: string): void;
}>();

const questionIdeas: QuestionIdea[] = [
  {
    category: 'Trends',
    examples: [
      'Show Diagnosed Diabetes trend in Texas from 2010 to 2024',
      'Show Newly Diagnosed Diabetes in California over time',
    ],
  },
  {
    category: 'Age breakdown',
    examples: [
      'Break down diabetes by age group in Florida',
      'Compare 18-44 vs 65+ diagnosed diabetes rates in Ohio',
    ],
  },
  {
    category: 'Sex, race or education (age-adjusted)',
    examples: [
      'Compare male vs female diagnosed diabetes rates in Georgia',
      'Show diagnosed diabetes by race, age-adjusted, in New York',
    ],
  },
  {
    category: 'State & time comparisons',
    examples: [
      'Compare Texas and Florida diagnosed diabetes since 2015',
      'Which states have the highest newly diagnosed diabetes rate in 2023?',
    ],
  },
];
</script>

<template>
  <Card
    class="border-white/10 bg-white/6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl"
  >
    <div class="space-y-3 p-5 sm:p-6">
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-2">
          <p
            class="text-xs font-semibold uppercase tracking-[0.22em] text-black"
          >
            Questions:
          </p>
          <h2 class="text-2xl font-semibold text-slate-800">Ask the dataset</h2>
        </div>
      </div>

      <form class="space-y-4" @submit.prevent="emit('submit')">
        <textarea
          v-model="question"
          rows="4"
          :disabled="props.loadingAnswer"
          :aria-busy="props.loadingAnswer"
          class="w-full rounded-3xl border border-white/10 bg-black px-4 py-4 text-base leading-7 text-white outline-none transition placeholder:text-white/70 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:border-cyan-300/25 disabled:bg-black/80 disabled:text-white/60"
          :placeholder="
            props.loadingAnswer
              ? 'Running query... input is temporarily locked.'
              : 'Ask for a trend, a comparison, or a follow-up filter...'
          "
          @keydown.enter.exact.prevent="emit('submit')"
        />

        <p v-if="props.loadingAnswer" class="text-sm font-medium text-red-600">
          Query in progress. You can type again after this response finishes.
        </p>

        <div class="flex flex-wrap gap-3">
          <Button
            type="submit"
            :disabled="props.loadingAnswer"
            class="w-full !bg-green-600 !text-white hover:!bg-green-500"
          >
            <RefreshCcw
              class="mr-2 h-4 w-4"
              :class="{ 'animate-spin': props.loadingAnswer }"
            />
            {{ props.loadingAnswer ? 'Analyzing...' : 'Run query' }}
          </Button>

          <Button
            variant="outline"
            class="border-white/10 bg-white/5 text-white hover:bg-white/10"
            @click.prevent="emit('use-prompt', 'Show age-adjusted estimates')"
          >
            <Sparkles class="mr-2 h-4 w-4" />
            Age-adjusted
          </Button>
          <Button
            variant="outline"
            class="border-white/10 bg-white/5 text-white hover:bg-white/10"
            @click.prevent="
              emit('use-prompt', 'Compare male and female trends')
            "
          >
            <Sparkles class="mr-2 h-4 w-4" />
            Sex comparison
          </Button>
        </div>

        <div class="rounded-2xl border border-white/10 bg-black p-4 text-white">
          <div class="flex items-center gap-2 text-sm font-medium text-white">
            <Activity class="h-4 w-4 text-cyan-300" />
            Current conversation state
          </div>
          <div
            v-if="props.conversationState"
            class="mt-4 space-y-3 text-sm text-white/85"
          >
            <p>Turns: {{ props.conversationState.turnCount }}</p>
            <p v-if="props.conversationState.lastQuestion">
              Last question: {{ props.conversationState.lastQuestion }}
            </p>
            <p v-if="props.conversationState.lastAnswer">
              Last answer: {{ props.conversationState.lastAnswer }}
            </p>
          </div>
          <p v-else class="mt-4 text-sm text-white/75">
            Ask a question to create the first state snapshot.
          </p>
        </div>
      </form>

      <div v-if="props.quickPrompts.length > 0" class="space-y-3">
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-black">
          Quick follow ups:
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="prompt in props.quickPrompts"
            :key="prompt"
            type="button"
            class="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-200"
            @click.prevent="emit('use-prompt', prompt)"
          >
            {{ prompt }}
          </button>
        </div>
      </div>

      <div class="rounded-3xl border border-white/10 bg-black p-4 text-white">
        <div class="flex items-center gap-2 text-sm font-medium text-white">
          <Sparkles class="h-4 w-4 text-cyan-300" />
          Not sure what to ask?
        </div>
        <p class="mt-2 text-xs text-slate-400">
          One demographic breakdown (age, sex, race, or education) works per
          question. Sex, race, and education comparisons automatically use
          age-adjusted rates.
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="idea in questionIdeas" :key="idea.category">
            <p class="text-xs font-semibold text-cyan-200">
              {{ idea.category }}
            </p>
            <ul class="mt-1 space-y-1">
              <li v-for="example in idea.examples" :key="example">
                <button
                  type="button"
                  class="text-left text-xs text-slate-300 underline decoration-dotted underline-offset-2 hover:text-slate-100"
                  @click.prevent="emit('use-prompt', example)"
                >
                  {{ example }}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div v-if="props.activeFilters.length > 0" class="space-y-3">
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-black">
          Applied filters
        </p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="filter in props.activeFilters"
            :key="`${filter.label}:${filter.value}`"
            class="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800"
          >
            {{ filter.label }}: {{ filter.value }}
            <button
              type="button"
              class="ml-1 rounded-full hover:text-red-600"
              :aria-label="`Remove ${filter.label} filter`"
              @click="emit('remove-filter', filter.key)"
            >
              &times;
            </button>
          </span>
        </div>
      </div>

      <div
        v-if="props.errorMessage"
        class="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
      >
        {{ props.errorMessage }}
      </div>

      <div v-if="props.loadingOverview" class="text-sm text-slate-400">
        Loading dataset metadata...
      </div>
    </div>
  </Card>
</template>
