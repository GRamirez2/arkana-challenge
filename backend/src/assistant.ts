import {
  getDatasetOverview,
  getFilterVocabulary,
  queryYearlySeries,
  type DatasetOverview,
  type FilterVocabulary,
  type DiabetesFilters,
} from './diabetes-store.js';

export type ConversationState = {
  filters: DiabetesFilters;
  lastQuestion?: string | undefined;
  lastAnswer?: string | undefined;
  lastRender?: 'chart' | 'table' | undefined;
  turnCount: number;
};

export type VisualizationSpec = {
  type: 'chart' | 'table';
  title: string;
};

export type DiabetesAssistantResponse = {
  answer: string;
  state: ConversationState;
  render: VisualizationSpec;
  series: Array<{
    year: number;
    estimate: number | null;
    rowCount: number;
  }>;
  appliedFilters: DiabetesFilters;
};

type PlannerResult = {
  answer?: string;
  filters?: DiabetesFilters;
  render?: VisualizationSpec;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+ ]/g, ' ');
}

const US_STATE_ALIASES: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
};

function matchesCandidate(question: string, candidates: string[]) {
  const normalizedQuestion = normalizeText(question);
  const orderedCandidates = [...candidates].sort(
    (left, right) => right.length - left.length
  );

  return orderedCandidates.find((candidate) => {
    const normalizedCandidate = normalizeText(candidate).trim();

    if (!normalizedCandidate) {
      return false;
    }

    if (normalizedCandidate.length <= 3 && !normalizedCandidate.includes(' ')) {
      return new RegExp(`(?:^|\\s)${normalizedCandidate}(?:\\s|$)`).test(
        normalizedQuestion
      );
    }

    return normalizedQuestion.includes(normalizedCandidate);
  });
}

function matchStateCandidate(question: string, candidates: string[]) {
  const normalizedQuestion = normalizeText(question);
  const availableStates = new Set(candidates);

  const aliasEntries = Object.entries(US_STATE_ALIASES).sort(
    ([left], [right]) => right.length - left.length
  );

  for (const [alias, code] of aliasEntries) {
    if (normalizedQuestion.includes(alias) && availableStates.has(code)) {
      return code;
    }
  }

  return matchesCandidate(question, candidates);
}

function parseYearRange(question: string, overview: DatasetOverview) {
  const years = question.match(/\b(19|20)\d{2}\b/g)?.map(Number) ?? [];

  if (years.length >= 2) {
    return {
      yearMin: Math.min(...years),
      yearMax: Math.max(...years),
    };
  }

  const singleYear = years[0];
  if (singleYear) {
    return {
      yearMin: singleYear,
      yearMax: singleYear,
    };
  }

  const normalizedQuestion = normalizeText(question);
  if (
    normalizedQuestion.includes('latest') ||
    normalizedQuestion.includes('recent')
  ) {
    return {
      yearMin: overview.yearMax ?? undefined,
      yearMax: overview.yearMax ?? undefined,
    };
  }

  const sinceMatch = normalizedQuestion.match(/since\s+(19|20)\d{2}/);
  if (sinceMatch) {
    const year = Number(sinceMatch[0].match(/\d{4}/)?.[0]);
    return Number.isFinite(year)
      ? {
          yearMin: year,
        }
      : {};
  }

  return {};
}

function heuristicPlan(
  question: string,
  state: ConversationState | undefined,
  overview: DatasetOverview,
  vocabulary: FilterVocabulary
): PlannerResult {
  const baseFilters: DiabetesFilters = {
    ...state?.filters,
  };

  const indicator = matchesCandidate(question, vocabulary.indicators);
  const stateName = matchStateCandidate(question, vocabulary.states);
  const age = matchesCandidate(question, vocabulary.age);
  const race = matchesCandidate(question, vocabulary.race);
  const sex = matchesCandidate(question, vocabulary.sex);
  const education = matchesCandidate(question, vocabulary.education);

  const normalizedQuestion = normalizeText(question);
  const render: VisualizationSpec = {
    type:
      normalizedQuestion.includes('table') ||
      normalizedQuestion.includes('list')
        ? 'table'
        : 'chart',
    title: 'Diabetes trend over time',
  };

  const filters: DiabetesFilters = {
    ...baseFilters,
    ...parseYearRange(question, overview),
    indicator: indicator ?? baseFilters.indicator ?? overview.indicators[0],
    state: stateName ?? baseFilters.state,
    age: age ?? baseFilters.age,
    race: race ?? baseFilters.race,
    sex: sex ?? baseFilters.sex,
    education: education ?? baseFilters.education,
  };

  const activeFilterLabels = Object.entries(filters)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`);

  return {
    answer: activeFilterLabels.length
      ? `I filtered the diabetes dataset by ${activeFilterLabels.join(', ')}.`
      : 'I used the default diabetes trend view.',
    filters,
    render,
  };
}

async function planWithOpenAI(
  question: string,
  state: ConversationState | undefined,
  overview: DatasetOverview,
  apiKeyOverride?: string
) {
  const apiKey = apiKeyOverride ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You help analyze a diabetes dataset with explicit conversational state.',
            'Return a JSON object with keys answer, filters, and render.',
            'Use only filter fields that exist in the dataset: state, topic, indicator, population, age, race, sex, education, otherStratification, yearMin, yearMax.',
            'Preserve prior filters unless the new question clearly overrides them.',
            'Keep answer short and specific.',
            `Known indicators: ${overview.indicators.slice(0, 8).join(', ')}`,
            `Known states sample: ${overview.states.slice(0, 8).join(', ')}`,
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({ question, state }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response did not include content');
  }

  return JSON.parse(content) as PlannerResult;
}

export async function answerDiabetesQuestion(input: {
  question: string;
  state: ConversationState | undefined;
  openAiApiKey: string | undefined;
}) {
  const [overview, vocabulary] = await Promise.all([
    getDatasetOverview(),
    getFilterVocabulary(),
  ]);
  const plannerResult = await planWithOpenAI(
    input.question,
    input.state,
    overview,
    input.openAiApiKey
  ).catch(() => null);
  const planned =
    plannerResult ??
    heuristicPlan(input.question, input.state, overview, vocabulary);

  const mergedState: ConversationState = {
    filters: {
      ...input.state?.filters,
      ...planned.filters,
    },
    lastQuestion: input.question,
    lastAnswer: planned.answer,
    lastRender: planned.render?.type ?? input.state?.lastRender ?? 'chart',
    turnCount: (input.state?.turnCount ?? 0) + 1,
  };

  const appliedFilters = mergedState.filters;
  const series = await queryYearlySeries(appliedFilters);

  return {
    answer:
      planned.answer ??
      `I found ${series.length} yearly points for the current diabetes view.`,
    state: mergedState,
    render: planned.render ?? {
      type: 'chart',
      title: 'Diabetes trend over time',
    },
    series,
    appliedFilters,
  } satisfies DiabetesAssistantResponse;
}
