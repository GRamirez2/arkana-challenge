<script setup lang="ts">
import { computed } from 'vue';

import AppDashboard from '@/components/app-dashboard.vue';
import AppSetupPanel from '@/components/app-setup-panel.vue';
import ConversationTranscript from '@/components/conversation-transcript.vue';
import QueryComposer from '@/components/query-composer.vue';
import SeriesChart from '@/components/series-chart.vue';
import { useDiabetesSession } from '@/composables/useDiabetesSession';

/**
 * App.vue now acts as the page-level orchestrator: it chooses which screen to
 * show, binds the session composable, and passes data into the feature
 * components.
 */
const {
  overview,
  assistant,
  conversationState,
  question,
  loadingOverview,
  loadingAnswer,
  errorMessage,
  setupError,
  setupVisible,
  apiKeyDraft,
  quickPrompts,
  summaryCards,
  activeFilters,
  hasOpenAiApiKey,
  sessionModeLabel,
  transcript,
  submitApiKey,
  continueWithoutApiKey,
  clearApiKeyAndRestart,
  askQuestion,
  usePrompt,
  removeFilter,
} = useDiabetesSession();

const chartSeries = computed(() => assistant.value?.series ?? []);
</script>

<template>
  <main
    class="relative min-h-screen overflow-hidden bg-[#07111f] text-slate-100"
  >
    <div
      class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.24),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(180deg,_rgba(2,6,23,0.96),_rgba(15,23,42,1))]"
    />
    <div
      class="absolute -left-24 top-20 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
    />
    <div
      class="absolute right-0 top-96 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl"
    />

    <AppSetupPanel
      v-if="setupVisible"
      v-model:apiKeyDraft="apiKeyDraft"
      :setup-error="setupError"
      @submit="submitApiKey"
      @continue-without-api-key="continueWithoutApiKey"
    />

    <section
      v-else
      class="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-6 py-10 lg:px-10"
    >
      <AppDashboard
        :summary-cards="summaryCards"
        :indicators="overview?.indicators ?? []"
        :session-mode-label="sessionModeLabel"
        :has-open-ai-api-key="hasOpenAiApiKey"
        @clear-key-and-restart="clearApiKeyAndRestart"
      />

      <section class="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <QueryComposer
          v-model:question="question"
          :loading-answer="loadingAnswer"
          :loading-overview="loadingOverview"
          :error-message="errorMessage"
          :quick-prompts="quickPrompts"
          :active-filters="activeFilters"
          :conversation-state="conversationState"
          @submit="askQuestion()"
          @use-prompt="usePrompt"
          @remove-filter="removeFilter"
        />

        <div class="space-y-6">
          <SeriesChart
            :series="chartSeries"
            :breakdown="assistant?.breakdown ?? null"
            :chart-kind="assistant?.render.chartKind ?? 'line'"
            :metric-label="assistant?.render.metricLabel ?? 'Estimated value'"
            :value-format="assistant?.render.valueFormat ?? 'number'"
            :title="assistant?.render.title ?? 'Diabetes trend over time'"
            :subtitle="
              assistant?.render.subtitle ??
              assistant?.answer ??
              'Run a query to see the chart update.'
            "
          />

          <ConversationTranscript :transcript="transcript" />
        </div>
      </section>
    </section>
  </main>
</template>
