import type {
  DatasetOverview,
  DiabetesFilters,
  FilterVocabulary,
} from './diabetes-store.js';
import type {
  ConversationState,
  PlannerResult,
  VisualizationSpec,
} from './assistant-types.js';

/**
 * Normalizes free-text input for lightweight intent and token matching.
 * Converts to lowercase and strips punctuation while preserving spaces and '+' tokens.
 */
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

/**
 * Finds the best matching candidate string in a question.
 * Short single-token candidates (for example state codes) are matched on word boundaries.
 */
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

/**
 * Matches a US state from either full-name aliases or direct candidate values.
 * Returns the state code when an alias is found and supported by available candidates.
 */
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

/**
 * Extracts year filtering intent from the question.
 * Supports explicit years, ranges, "latest/recent", and "since YYYY" patterns.
 */
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

/**
 * Builds a deterministic fallback plan when no LLM plan is available.
 * Carries forward prior state filters and applies directly detectable values from the question.
 */
export function heuristicPlan(
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

/**
 * Requests an LLM-generated planning object (answer/filter/render) for the current turn.
 * Returns null when no API key is available and throws for transport/protocol failures.
 */
export async function planWithOpenAI(
  question: string,
  state: ConversationState | undefined,
  overview: DatasetOverview,
  vocabulary: FilterVocabulary,
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
            'IMPORTANT: only use exact values from the vocabulary lists below - never guess or invent values.',
            'Do NOT add a new filter unless the question explicitly names a specific value. For example, "show ages" should NOT add a filter; only "show 18-44" should add age: 18-44.',
            'DATA STRUCTURE CONSTRAINT: Specific age values (18-44, 45-64, etc.) only exist with race/sex/education all set to "All". Sex/race/education breakdowns only exist with age set to "Age-Adjusted" or "Crude". If user asks for sex/race/education breakdown with a specific age range, automatically switch age to Age-Adjusted.',
            'Each filter field must be a single string or number value, never an array or object - this dataset only supports viewing one demographic slice at a time. For a "compare X vs Y" question, pick ONE of the values (e.g. just "Male") and mention in the answer that the user can ask about the other value separately.',
            'The answer field is a short planning note only - actual data insights will be added after the query runs, so do NOT write vague summaries like "summary is provided". Instead briefly confirm which filters you applied.',
            `Indicators: ${overview.indicators.join(', ')}`,
            `States: ${overview.states.join(', ')}`,
            `Race values: ${vocabulary.race.join(', ')}`,
            `Age values: ${vocabulary.age.join(', ')}`,
            `Sex values: ${vocabulary.sex.join(', ')}`,
            `Education values: ${vocabulary.education.join(', ')}`,
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
