<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  Activity,
  ArrowRight,
  KeyRound,
  Lock,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-vue-next';

import Badge from '@/components/ui/badge.vue';
import Button from '@/components/ui/button.vue';
import Card from '@/components/ui/card.vue';
import SeriesChart from '@/components/series-chart.vue';
import {
  fetchDatasetOverview,
  sendDiabetesQuestion,
  type ConversationState,
  type DatasetOverview,
  type DiabetesAssistantResponse,
} from '@/lib/api';

const starterQuestion = 'Show diagnosed diabetes in Arkansas over time';
const openAiApiKeyStorageKey = 'arkana-openai-api-key';

const overview = ref<DatasetOverview | null>(null);
const assistant = ref<DiabetesAssistantResponse | null>(null);
const conversationState = ref<ConversationState | undefined>(undefined);
const question = ref(starterQuestion);
const loadingOverview = ref(true);
const loadingAnswer = ref(false);
const errorMessage = ref('');
const setupError = ref('');
const setupVisible = ref(true);
const openAiApiKey = ref('');
const apiKeyDraft = ref('');
const transcript = ref<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

const quickPrompts = [
  'Break down by age group',
  'Compare male vs female, age-adjusted',
  'Compare 2015 to 2020',
  'Show Non-Hispanic Black adults, age-adjusted',
];

const questionIdeas = [
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

const activeFilters = computed(() => {
  const filters = assistant.value?.appliedFilters ?? {};

  return Object.entries(filters)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
    .map(([key, value]) => ({
      key,
      label: key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (char) => char.toUpperCase()),
      value: String(value),
    }));
});

const summaryCards = computed(() => {
  if (!overview.value) {
    return [];
  }

  return [
    {
      label: 'Rows loaded',
      value: overview.value.rowCount.toLocaleString(),
    },
    {
      label: 'States',
      value: overview.value.stateCount.toString(),
    },
    {
      label: 'Indicators',
      value: overview.value.indicatorCount.toString(),
    },
    {
      label: 'Years',
      value:
        overview.value.yearMin && overview.value.yearMax
          ? `${overview.value.yearMin} - ${overview.value.yearMax}`
          : 'Unknown',
    },
  ];
});

const hasOpenAiApiKey = computed(() => openAiApiKey.value.trim().length > 0);

const sessionModeLabel = computed(() =>
  hasOpenAiApiKey.value
    ? 'Session key detected · OpenAI requested'
    : 'No session key · local fallback mode'
);

function readSessionApiKey() {
  try {
    return sessionStorage.getItem(openAiApiKeyStorageKey) ?? '';
  } catch {
    return '';
  }
}

function saveSessionApiKey(nextKey: string) {
  try {
    sessionStorage.setItem(openAiApiKeyStorageKey, nextKey);
  } catch {
    // Session storage may be unavailable in locked-down browser contexts.
  }
}

function removeSessionApiKey() {
  try {
    sessionStorage.removeItem(openAiApiKeyStorageKey);
  } catch {
    // Session storage may be unavailable in locked-down browser contexts.
  }
}

async function loadOverview() {
  loadingOverview.value = true;
  errorMessage.value = '';

  try {
    const result = await fetchDatasetOverview();
    overview.value = result.overview;
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to load dataset overview';
  } finally {
    loadingOverview.value = false;
  }
}

async function initializeApp() {
  if (!setupVisible.value) {
    return;
  }

  setupVisible.value = false;
  await loadOverview();

  if (overview.value) {
    await askQuestion(starterQuestion);
  }
}

async function askQuestion(promptOverride?: string) {
  if (loadingAnswer.value) {
    return;
  }

  const currentQuestion = (promptOverride ?? question.value).trim();

  if (!currentQuestion) {
    return;
  }

  loadingAnswer.value = true;
  errorMessage.value = '';

  transcript.value = [
    ...transcript.value,
    { role: 'user', text: currentQuestion },
  ];

  try {
    const result = await sendDiabetesQuestion({
      question: currentQuestion,
      state: conversationState.value,
      openAiApiKey: openAiApiKey.value || undefined,
    });

    assistant.value = result;
    // If the query returned no data, revert filters to what they were before
    // so bad filters don't carry into the next question.
    const hasBreakdownData = (result.breakdown?.data.length ?? 0) > 0;
    if (result.series.length === 0 && !hasBreakdownData) {
      conversationState.value = {
        ...result.state,
        filters: conversationState.value?.filters ?? {},
      };
      assistant.value = {
        ...result,
        appliedFilters: conversationState.value?.filters ?? {},
      };
    } else {
      conversationState.value = result.state;
    }
    question.value = currentQuestion;
    transcript.value = [
      ...transcript.value,
      { role: 'assistant', text: result.answer },
    ];
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message
        : 'Unable to run the diabetes query';
    errorMessage.value = msg;
    transcript.value = [
      ...transcript.value,
      { role: 'assistant', text: `Sorry, I ran into an error: ${msg}` },
    ];
  } finally {
    loadingAnswer.value = false;
    question.value = '';
  }
}

function usePrompt(promptText: string) {
  question.value = promptText;
  void askQuestion(promptText);
}

function removeFilter(key: string) {
  if (!conversationState.value) return;
  const newFilters = { ...conversationState.value.filters };
  delete newFilters[key as keyof typeof newFilters];
  conversationState.value = { ...conversationState.value, filters: newFilters };
  if (assistant.value) {
    assistant.value = { ...assistant.value, appliedFilters: newFilters };
  }
}

function submitApiKey() {
  const nextKey = apiKeyDraft.value.trim();

  if (!nextKey) {
    setupError.value = 'Paste an API key or continue without one.';
    return;
  }

  setupError.value = '';
  openAiApiKey.value = nextKey;
  saveSessionApiKey(nextKey);
  apiKeyDraft.value = '';
  void initializeApp();
}

function continueWithoutApiKey() {
  setupError.value = '';
  openAiApiKey.value = '';
  removeSessionApiKey();
  void initializeApp();
}

function clearApiKeyAndRestart() {
  removeSessionApiKey();
  window.location.reload();
}

onMounted(async () => {
  const storedApiKey = readSessionApiKey();

  if (storedApiKey) {
    openAiApiKey.value = storedApiKey;
    apiKeyDraft.value = '';
    await initializeApp();
  }
});
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

    <section
      v-if="setupVisible"
      class="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10 lg:px-10"
    >
      <Card
        class="w-full border-slate-200/80 bg-white/90 text-slate-900 shadow-2xl shadow-slate-950/20 backdrop-blur-xl"
      >
        <div class="grid gap-8 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
          <div class="space-y-6">
            <Badge class="border-cyan-500/20 bg-cyan-500/10 text-cyan-900">
              Session setup · OpenAI key is optional
            </Badge>

            <div class="space-y-4">
              <h1 class="text-4xl font-semibold tracking-tight text-slate-900">
                Paste your API key to enable OpenAI planning for this browser
                session.
              </h1>
              <p
                class="max-w-2xl text-base leading-8 text-slate-700 sm:text-lg"
              >
                When you submit a key, the app stores it in session storage so
                only this tab can use it. Each chat request sends that key to
                the backend, which can then use OpenAI to interpret the question
                and choose the right filters or chart mode.
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div
                class="rounded-3xl border border-slate-200 bg-slate-50/90 p-4"
              >
                <div
                  class="flex items-center gap-2 text-sm font-medium text-slate-900"
                >
                  <ShieldCheck class="h-4 w-4 text-emerald-600" />
                  What OpenAI does here
                </div>
                <p class="mt-3 text-sm leading-7 text-slate-700">
                  It helps the planner understand your question and return a
                  structured response. The actual dataset still comes from the
                  backend database.
                </p>
              </div>
              <div
                class="rounded-3xl border border-slate-200 bg-slate-50/90 p-4"
              >
                <div
                  class="flex items-center gap-2 text-sm font-medium text-slate-900"
                >
                  <Lock class="h-4 w-4 text-cyan-600" />
                  What happens without a key
                </div>
                <p class="mt-3 text-sm leading-7 text-slate-700">
                  The app keeps working. It falls back to a local planner, so
                  you can still ask questions and explore the chart without
                  OpenAI.
                </p>
              </div>
            </div>

            <div class="rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
              <div
                class="flex items-center gap-2 text-sm font-medium text-slate-900"
              >
                <KeyRound class="h-4 w-4 text-cyan-600" />
                Change the key later
              </div>
              <p class="mt-3 text-sm leading-7 text-slate-700">
                Use the clear button in the main app to remove the saved key and
                restart the session. That returns you to this screen so you can
                paste a different key.
              </p>
            </div>
          </div>

          <div
            class="space-y-4 rounded-[2rem] border border-slate-200 bg-slate-50/90 p-5 text-slate-900 sm:p-6"
          >
            <div>
              <p
                class="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-800"
              >
                OpenAI API key
              </p>
              <h2 class="mt-2 text-2xl font-semibold text-slate-900">
                Start with your preferred session mode
              </h2>
              <p class="mt-3 text-sm leading-7 text-slate-700">
                <span class="font-medium text-slate-900">Session storage</span>
                keeps the key in this tab only. Close the tab and the saved key
                is gone.
              </p>
            </div>

            <form class="space-y-4" @submit.prevent="submitApiKey">
              <label class="block space-y-2">
                <span class="text-sm font-medium text-slate-700">API key</span>
                <input
                  v-model="apiKeyDraft"
                  type="password"
                  autocomplete="off"
                  spellcheck="false"
                  class="w-full rounded-3xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  placeholder="sk-..."
                />
              </label>

              <div class="flex flex-wrap gap-3">
                <Button type="submit" class="min-w-[180px]">
                  Continue with OpenAI
                </Button>
                <Button
                  variant="outline"
                  class="border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  @click.prevent="continueWithoutApiKey"
                >
                  Use local fallback
                </Button>
              </div>
            </form>

            <div
              v-if="setupError"
              class="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
            >
              {{ setupError }}
            </div>

            <div class="rounded-3xl border border-slate-200 bg-white p-4">
              <p class="text-sm font-medium text-slate-900">
                What this means for OpenAI
              </p>
              <p class="mt-2 text-sm leading-7 text-slate-700">
                OpenAI is only used as the planner. Your key is not stored in
                localStorage or sent anywhere except the backend request that
                needs it. If you skip this step, the app still works using its
                built-in fallback. That fallback uses simple rules on the server
                to guess the right filters from your question, so you can still
                use the app without entering a key.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </section>

    <section
      v-else
      class="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-6 py-10 lg:px-10"
    >
      <header class="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
        <div class="space-y-5">
          <div class="flex flex-wrap items-center gap-3">
            <Badge class="border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
              Diabetes dataset explorer
            </Badge>
            <Badge class="border-white/10 bg-white/5 text-slate-200">
              {{ sessionModeLabel }}
            </Badge>
            <Button
              v-if="hasOpenAiApiKey"
              variant="outline"
              size="sm"
              class="border-white/15 bg-white/5 text-white hover:bg-white/10"
              @click="clearApiKeyAndRestart"
            >
              Clear key and restart
            </Button>
          </div>

          <div class="max-w-4xl space-y-4">
            <h1
              class="text-4xl font-semibold tracking-tight text-white sm:text-6xl"
            >
              Ask natural-language questions about U.S. diabetes data and
              explore trend charts with context-aware follow-ups.
            </h1>
          </div>
        </div>

        <Card
          class="border-white/10 bg-white/5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl"
        >
          <div class="space-y-4 p-4 sm:p-5">
            <div class="grid grid-cols-2 gap-3">
              <div
                v-for="item in summaryCards"
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
                  v-for="indicator in overview?.indicators ?? []"
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
                The current assistant state is preserved on every request and
                shown back in the interface.
              </p>
            </div>
          </div>
        </Card>
      </header>

      <section class="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
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
                <h2 class="text-2xl font-semibold text-slate-800">
                  Ask the dataset
                </h2>
              </div>
            </div>

            <form class="space-y-4" @submit.prevent="askQuestion()">
              <textarea
                v-model="question"
                rows="4"
                :disabled="loadingAnswer"
                :aria-busy="loadingAnswer"
                class="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-base leading-7 text-white outline-none transition placeholder:text-slate-300 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:border-cyan-300/25 disabled:bg-slate-900/80 disabled:text-slate-400"
                :placeholder="
                  loadingAnswer
                    ? 'Running query... input is temporarily locked.'
                    : 'Ask for a trend, a comparison, or a follow-up filter...'
                "
                @keydown.enter.exact.prevent="askQuestion()"
              />

              <p v-if="loadingAnswer" class="text-sm font-medium text-red-600">
                Query in progress. You can type again after this response
                finishes.
              </p>

              <div class="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  :disabled="loadingAnswer"
                  class="min-w-[180px]"
                >
                  <RefreshCcw
                    class="mr-2 h-4 w-4"
                    :class="{ 'animate-spin': loadingAnswer }"
                  />
                  {{ loadingAnswer ? 'Analyzing...' : 'Run query' }}
                </Button>

                <Button
                  variant="outline"
                  class="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  @click.prevent="usePrompt('Show age-adjusted estimates')"
                >
                  <ArrowRight class="mr-2 h-4 w-4" />
                  Age-adjusted
                </Button>
                <Button
                  variant="outline"
                  class="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  @click.prevent="usePrompt('Compare male and female trends')"
                >
                  <ArrowRight class="mr-2 h-4 w-4" />
                  Sex comparison
                </Button>
              </div>
            </form>

            <div class="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
              <div
                class="flex items-center gap-2 text-sm font-medium text-slate-200"
              >
                <Activity class="h-4 w-4 text-cyan-300" />
                Current conversation state
              </div>
              <div
                v-if="conversationState"
                class="mt-4 space-y-3 text-sm text-slate-300"
              >
                <p>Turns: {{ conversationState.turnCount }}</p>
                <p v-if="conversationState.lastQuestion">
                  Last question: {{ conversationState.lastQuestion }}
                </p>
                <p v-if="conversationState.lastAnswer">
                  Last answer: {{ conversationState.lastAnswer }}
                </p>
              </div>
              <p v-else class="mt-4 text-sm text-slate-400">
                Ask a question to create the first state snapshot.
              </p>
            </div>

            <div class="space-y-3">
              <p
                class="text-xs font-semibold uppercase tracking-[0.22em] text-black"
              >
                Quick follow-ups:
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="prompt in quickPrompts"
                  :key="prompt"
                  class="rounded-full border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-200"
                  @click.prevent="usePrompt(prompt)"
                >
                  {{ prompt }}
                </button>
              </div>
            </div>

            <div
              class="space-y-3 rounded-3xl border border-white/10 bg-slate-950/60 p-4"
            >
              <div class="flex items-center gap-2">
                <Sparkles class="h-4 w-4 text-cyan-300" />
                <p
                  class="text-xs font-semibold uppercase tracking-[0.22em] text-black"
                >
                  Not sure what to ask?
                </p>
              </div>
              <p class="text-xs text-slate-400">
                One demographic breakdown (age, sex, race, or education) works
                per question. Sex, race, and education comparisons automatically
                use age-adjusted rates.
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
                        class="text-left text-xs text-slate-300 underline decoration-dotted underline-offset-2 hover:text-cyan-200"
                        @click.prevent="usePrompt(example)"
                      >
                        {{ example }}
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div v-if="activeFilters.length > 0" class="space-y-3">
              <p
                class="text-xs font-semibold uppercase tracking-[0.22em] text-black"
              >
                Applied filters
              </p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="filter in activeFilters"
                  :key="`${filter.label}:${filter.value}`"
                  class="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800"
                >
                  {{ filter.label }}: {{ filter.value }}
                  <button
                    type="button"
                    class="ml-1 rounded-full hover:text-red-600"
                    :aria-label="`Remove ${filter.label} filter`"
                    @click="removeFilter(filter.key)"
                  >
                    &times;
                  </button>
                </span>
              </div>
            </div>

            <div
              v-if="errorMessage"
              class="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {{ errorMessage }}
            </div>

            <div v-if="loadingOverview" class="text-sm text-slate-400">
              Loading dataset metadata...
            </div>
          </div>
        </Card>

        <div class="space-y-6">
          <SeriesChart
            :series="assistant?.series ?? []"
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
                v-if="!assistant"
                class="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-6 text-sm text-slate-400"
              >
                The first answer will appear here after the initial query runs.
              </div>
            </div>
          </Card>
        </div>
      </section>
    </section>
  </main>
</template>
