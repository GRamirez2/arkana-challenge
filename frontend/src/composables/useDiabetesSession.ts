import { computed, onMounted, ref } from 'vue';

import {
  fetchDatasetOverview,
  sendDiabetesQuestion,
  type ConversationState,
  type DatasetOverview,
  type DiabetesAssistantResponse,
} from '@/lib/api';

const starterQuestion = 'Show diagnosed diabetes in Arkansas over time';
const openAiApiKeyStorageKey = 'arkana-openai-api-key';

export type SummaryCard = {
  label: string;
  value: string;
};

export type ActiveFilter = {
  key: string;
  label: string;
  value: string;
};

export type TranscriptEntry = {
  role: 'user' | 'assistant';
  text: string;
};

/**
 * Keeps the session state, prompt generation, and backend request flow in one
 * place so the page component can stay focused on composition.
 */
export function useDiabetesSession() {
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
  const transcript = ref<TranscriptEntry[]>([]);

  /** Returns the latest year in the loaded dataset, if one exists. */
  function getLatestYear() {
    return overview.value?.yearMax ?? null;
  }

  /**
   * Builds the comparison window used in quick prompts once the dataset range
   * is known.
   */
  function getComparisonYears() {
    const latest = getLatestYear();
    const earliest = overview.value?.yearMin ?? null;

    if (!latest || !earliest) {
      return null;
    }

    return {
      from: Math.max(earliest, latest - 5),
      to: latest,
    };
  }

  /** Formats a raw filter key into the label shown in the UI. */
  function formatFilterLabel(key: string) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (char) => char.toUpperCase());
  }

  /**
   * Builds the follow-up prompt list from the current dataset and conversation
   * state.
   */
  function buildQuickPrompts() {
    const latestYear = getLatestYear();
    const comparisonYears = getComparisonYears();
    const filters =
      assistant.value?.appliedFilters ?? conversationState.value?.filters ?? {};
    const breakdownDimension = assistant.value?.breakdown?.dimension;
    const hasStateFilter = Boolean(filters.state);

    const withYear = (text: string) =>
      latestYear ? text.replace('{year}', String(latestYear)) : text;
    const turnCount = conversationState.value?.turnCount ?? 0;
    const stateExtremesPrompt = withYear(
      turnCount % 2 === 0
        ? 'Which states are highest for this in {year}?'
        : 'Which states are lowest for this in {year}?'
    );

    const basePrompts = [
      withYear('Show the latest year only ({year})'),
      comparisonYears
        ? `Compare ${comparisonYears.from} to ${comparisonYears.to}`
        : 'Compare 2015 to 2020',
      comparisonYears
        ? `How did the 18-44 age group change from ${comparisonYears.from} to ${comparisonYears.to}?`
        : 'How did the 18-44 age group change over time?',
      'Break this down by age group',
      'Compare male vs female, age-adjusted',
      'How has the 65+ age group trended over time?',
      'Break this down by race/ethnicity, age-adjusted',
      stateExtremesPrompt,
    ];

    if (
      breakdownDimension === 'age' ||
      breakdownDimension === 'sex' ||
      breakdownDimension === 'race' ||
      breakdownDimension === 'education'
    ) {
      return [
        withYear('Show the latest year only ({year})'),
        comparisonYears
          ? `Compare ${comparisonYears.from} to ${comparisonYears.to}`
          : 'Compare 2015 to 2020',
        comparisonYears
          ? `How did the 18-44 age group change from ${comparisonYears.from} to ${comparisonYears.to}?`
          : 'How did the 18-44 age group change over time?',
        'Break this down by another demographic group',
        'Compare male vs female, age-adjusted',
        'How has the 65+ age group trended over time?',
        'Break this down by race/ethnicity, age-adjusted',
        stateExtremesPrompt,
      ];
    }

    if (breakdownDimension === 'state' || hasStateFilter) {
      return [
        withYear('Show the latest year only ({year})'),
        comparisonYears
          ? `Compare ${comparisonYears.from} to ${comparisonYears.to}`
          : 'Compare 2015 to 2020',
        'Break this down by age group',
        'Compare male vs female, age-adjusted',
        'Break this down by race/ethnicity, age-adjusted',
        stateExtremesPrompt,
      ];
    }

    return basePrompts;
  }

  const quickPrompts = computed(() => buildQuickPrompts());

  /** Converts the loaded overview into the summary cards shown at the top. */
  const summaryCards = computed<SummaryCard[]>(() => {
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

  const activeFilters = computed<ActiveFilter[]>(() => {
    const filters =
      assistant.value?.appliedFilters ?? conversationState.value?.filters ?? {};

    return Object.entries(filters)
      .filter(
        ([, value]) => value !== undefined && value !== null && value !== ''
      )
      .map(([key, value]) => ({
        key,
        label: formatFilterLabel(key),
        value: String(value),
      }));
  });

  const hasOpenAiApiKey = computed(() => openAiApiKey.value.trim().length > 0);

  const sessionModeLabel = computed(() =>
    hasOpenAiApiKey.value
      ? 'Session key detected · OpenAI requested'
      : 'No session key · local fallback mode'
  );

  /** Reads the optional session key from browser storage. */
  function readSessionApiKey() {
    try {
      return sessionStorage.getItem(openAiApiKeyStorageKey) ?? '';
    } catch {
      return '';
    }
  }

  /** Saves the session key for the current browser tab only. */
  function saveSessionApiKey(nextKey: string) {
    try {
      sessionStorage.setItem(openAiApiKeyStorageKey, nextKey);
    } catch {
      // Session storage may be unavailable in locked-down browser contexts.
    }
  }

  /** Removes the session key from browser storage. */
  function removeSessionApiKey() {
    try {
      sessionStorage.removeItem(openAiApiKeyStorageKey);
    } catch {
      // Session storage may be unavailable in locked-down browser contexts.
    }
  }

  /** Fetches the overview metadata and toggles the loading state around it. */
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

  /**
   * Runs the first-load flow once a session mode has been selected and the UI
   * is allowed to advance past setup.
   */
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

  /**
   * Sends a question to the backend and preserves the conversation state when
   * the query returns data.
   */
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

  /** Sets the text box and immediately submits the selected prompt. */
  function usePrompt(promptText: string) {
    question.value = promptText;
    void askQuestion(promptText);
  }

  /** Removes one filter from the active conversation state and assistant view. */
  function removeFilter(key: string) {
    if (!conversationState.value) return;
    const newFilters = { ...conversationState.value.filters };
    delete newFilters[key as keyof typeof newFilters];
    conversationState.value = {
      ...conversationState.value,
      filters: newFilters,
    };
    if (assistant.value) {
      assistant.value = { ...assistant.value, appliedFilters: newFilters };
    }
  }

  /** Stores the entered API key and starts the app flow. */
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

  /** Continues the app without a stored key and uses the fallback planner. */
  function continueWithoutApiKey() {
    setupError.value = '';
    openAiApiKey.value = '';
    removeSessionApiKey();
    void initializeApp();
  }

  /** Clears the key and reloads so the setup screen appears again. */
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

  return {
    overview,
    assistant,
    conversationState,
    question,
    loadingOverview,
    loadingAnswer,
    errorMessage,
    setupError,
    setupVisible,
    openAiApiKey,
    apiKeyDraft,
    transcript,
    quickPrompts,
    summaryCards,
    activeFilters,
    hasOpenAiApiKey,
    sessionModeLabel,
    loadOverview,
    initializeApp,
    askQuestion,
    usePrompt,
    removeFilter,
    submitApiKey,
    continueWithoutApiKey,
    clearApiKeyAndRestart,
  };
}
