import {
  getMetricContext,
  getDatasetOverview,
  getFilterVocabulary,
  queryCategoryBreakdown,
  queryYearlySeries,
  type BreakdownDimension,
  type DatasetOverview,
  type DiabetesBreakdownPoint,
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

type ChartKind = 'line' | 'bar' | 'pie';
type ValueFormat = 'percentage' | 'rate' | 'number';

type ChartRenderSpec = VisualizationSpec & {
  chartKind: ChartKind;
  metricLabel: string;
  valueFormat: ValueFormat;
  subtitle?: string;
};

type BreakdownPayload = {
  dimension: BreakdownDimension;
  year: number | null;
  data: DiabetesBreakdownPoint[];
};

export type DiabetesAssistantResponse = {
  answer: string;
  state: ConversationState;
  render: ChartRenderSpec;
  series: Array<{
    year: number;
    estimate: number | null;
    rowCount: number;
  }>;
  breakdown: BreakdownPayload | null;
  appliedFilters: DiabetesFilters;
};

type PlannerResult = {
  answer?: string;
  filters?: DiabetesFilters;
  render?: VisualizationSpec;
};

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
      /**
       * Matches a US state from either full-name aliases or direct candidate values.
       * Returns the state code when an alias is found and supported by available candidates.
       */
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
 * Infers whether the user is asking for a categorical breakdown and by which dimension.
 * Uses explicit wording first, then falls back to conservative defaults for comparison phrasing.
 */
function inferBreakdownDimension(
  question: string
): BreakdownDimension | undefined {
  const normalized = normalizeText(question);

  const asksForComparison =
    normalized.includes('compare') ||
    normalized.includes('comparison') ||
    normalized.includes(' versus ') ||
    normalized.includes(' vs ');
  const asksForBreakdown =
    normalized.includes('break down') || normalized.includes('breakdown');
  const explicitStateBreakdown =
    normalized.includes('by state') ||
    normalized.includes('across states') ||
    normalized.includes('which states');
  const explicitAgeBreakdown =
    normalized.includes('age group') ||
    normalized.includes('by age') ||
    normalized.includes('age breakdown');
  const explicitSexBreakdown =
    normalized.includes('by sex') ||
    normalized.includes('by gender') ||
    normalized.includes('sex breakdown') ||
    normalized.includes('gender breakdown');
  const explicitRaceBreakdown =
    normalized.includes('by race') ||
    normalized.includes('by ethnicity') ||
    normalized.includes('race breakdown') ||
    normalized.includes('ethnicity breakdown');
  const explicitEducationBreakdown =
    normalized.includes('by education') ||
    normalized.includes('education breakdown');
  const explicitIndicatorBreakdown =
    normalized.includes('by indicator') ||
    normalized.includes('indicator breakdown');

  const hasBreakdownIntent =
    asksForComparison ||
    asksForBreakdown ||
    explicitStateBreakdown ||
    explicitAgeBreakdown ||
    explicitSexBreakdown ||
    explicitRaceBreakdown ||
    explicitEducationBreakdown ||
    explicitIndicatorBreakdown;

  if (!hasBreakdownIntent) {
    return undefined;
  }

  if (explicitAgeBreakdown) {
    return 'age';
  }

  if (
    explicitSexBreakdown ||
    (asksForComparison &&
      (normalized.includes('male') ||
        normalized.includes('female') ||
        normalized.includes('men') ||
        normalized.includes('women')))
  ) {
    return 'sex';
  }

  if (explicitRaceBreakdown) {
    return 'race';
  }

  if (explicitEducationBreakdown) {
    return 'education';
  }

  if (explicitStateBreakdown) {
    return 'state';
  }

  if (
    explicitIndicatorBreakdown ||
    (asksForComparison &&
      (normalized.includes('type 1') || normalized.includes('type 2')))
  ) {
    return 'indicator';
  }

  if (asksForBreakdown || asksForComparison) {
    return 'age';
  }

  return undefined;
}

/**
 * Maps a metric unit string to the value formatting strategy used in responses and charts.
 */
function inferValueFormat(unit?: string): ValueFormat {
  if (!unit) {
    return 'number';
  }
  if (unit.toLowerCase().includes('percentage')) {
    return 'percentage';
  }
  if (unit.toLowerCase().includes('rate')) {
    return 'rate';
  }
  return 'number';
}

/**
 * Detects an explicitly requested chart type from the user question.
 */
function getRequestedChartKind(question: string): ChartKind | undefined {
  const normalized = normalizeText(question);
  if (normalized.includes('pie')) return 'pie';
  if (normalized.includes('bar')) return 'bar';
  if (normalized.includes('line')) return 'line';
  return undefined;
}

/**
 * Converts a breakdown dimension key into a human-readable label for UI text.
 */
function dimensionLabel(dimension: BreakdownDimension) {
  switch (dimension) {
    case 'age':
      return 'Age group';
    case 'sex':
      return 'Sex';
    case 'race':
      return 'Race/ethnicity';
    case 'education':
      return 'Education';
    case 'state':
      return 'State';
    case 'indicator':
      return 'Indicator';
  }
}

/**
 * Builds a deterministic fallback plan when no LLM plan is available.
 * Carries forward prior state filters and applies directly detectable values from the question.
 */
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

/**
 * Requests an LLM-generated planning object (answer/filter/render) for the current turn.
 * Returns null when no API key is available and throws for transport/protocol failures.
 */
async function planWithOpenAI(
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
            'IMPORTANT: only use exact values from the vocabulary lists below — never guess or invent values.',
            'Do NOT add a new filter unless the question explicitly names a specific value. For example, "show ages" should NOT add a filter; only "show 18-44" should add age: 18-44.',
            'DATA STRUCTURE CONSTRAINT: Specific age values (18-44, 45-64, etc.) only exist with race/sex/education all set to "All". Sex/race/education breakdowns only exist with age set to "Age-Adjusted" or "Crude". If user asks for sex/race/education breakdown with a specific age range, automatically switch age to Age-Adjusted.',
            'Each filter field must be a single string or number value, never an array or object — this dataset only supports viewing one demographic slice at a time. For a "compare X vs Y" question, pick ONE of the values (e.g. just "Male") and mention in the answer that the user can ask about the other value separately.',
            'The answer field is a short planning note only — actual data insights will be added after the query runs, so do NOT write vague summaries like "summary is provided". Instead briefly confirm which filters you applied.',
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

/**
 * Builds a narrative summary from yearly time-series results.
 * Includes coverage range, latest estimate, and trend direction/magnitude when comparable points exist.
 */
function buildDataAnswer(
  filters: DiabetesFilters,
  series: Array<{ year: number; estimate: number | null; rowCount: number }>,
  valueFormat: ValueFormat
): string {
  const formatEstimate = (value: number) => {
    if (valueFormat === 'percentage') {
      return `${value.toFixed(1)}%`;
    }
    if (valueFormat === 'rate') {
      return `${value.toFixed(1)} per 1,000`;
    }
    return value.toFixed(1);
  };

  const formatAbsoluteChange = (value: number) => {
    const abs = Math.abs(value).toFixed(1);
    if (valueFormat === 'percentage') {
      return `${abs} percentage points`;
    }
    if (valueFormat === 'rate') {
      return `${abs} per 1,000`;
    }
    return abs;
  };

  if (series.length === 0) {
    const filterSummary = Object.entries(filters)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return (
      `No data found for the current filters${filterSummary ? ` (${filterSummary})` : ''}.` +
      ' Try broadening your search or removing a filter.'
    );
  }

  const sortedSeries = [...series].sort((a, b) => a.year - b.year);
  const years = sortedSeries.map((s) => s.year);
  const estimates = sortedSeries
    .map((s) => s.estimate)
    .filter((e): e is number => e !== null);

  const yearRange =
    years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : `${years[0]}`;

  let trendDesc = '';
  if (estimates.length >= 2) {
    const first = estimates[0]!;
    const last = estimates[estimates.length - 1]!;
    const diff = last - first;

    if (Math.abs(diff) < 0.05) {
      trendDesc = 'The trend is relatively flat over this period.';
    } else if (Math.abs(first) < 1e-9) {
      trendDesc =
        diff > 0
          ? `The estimate increased by ${formatAbsoluteChange(diff)} from ${formatEstimate(first)} to ${formatEstimate(last)}.`
          : `The estimate decreased by ${formatAbsoluteChange(diff)} from ${formatEstimate(first)} to ${formatEstimate(last)}.`;
    } else if (diff > 0) {
      const absPct = Math.abs((diff / first) * 100).toFixed(1);
      trendDesc = `The estimate rose by ${absPct}% (${formatAbsoluteChange(diff)}) from ${formatEstimate(first)} to ${formatEstimate(last)}.`;
    } else {
      const absPct = Math.abs((diff / first) * 100).toFixed(1);
      trendDesc = `The estimate fell by ${absPct}% (${formatAbsoluteChange(diff)}) from ${formatEstimate(first)} to ${formatEstimate(last)}.`;
    }
  }

  const latest = sortedSeries[sortedSeries.length - 1]!;
  const latestEst =
    latest.estimate !== null ? formatEstimate(latest.estimate) : 'N/A';

  const filterParts: string[] = [];
  if (filters.indicator) filterParts.push(filters.indicator);
  if (filters.state) filterParts.push(`in ${filters.state}`);
  if (filters.race) filterParts.push(filters.race);
  if (filters.sex) filterParts.push(filters.sex);
  if (filters.age) filterParts.push(`age: ${filters.age}`);
  if (filters.population) filterParts.push(filters.population);

  const subject = filterParts.length
    ? filterParts.join(', ')
    : 'the selected view';

  return (
    `Found ${series.length} yearly data point${series.length !== 1 ? 's' : ''} for ${subject} (${yearRange}). ` +
    `Most recent estimate (${latest.year}): ${latestEst}. ` +
    trendDesc
  ).trim();
}

/**
 * Builds a concise summary for categorical breakdown results.
 * Highlights the number of categories and the top category in the selected year/scope.
 */
function buildBreakdownAnswer(input: {
  filters: DiabetesFilters;
  breakdown: BreakdownPayload;
  valueFormat: ValueFormat;
}) {
  const { breakdown } = input;

  if (breakdown.data.length === 0) {
    const filterSummary = Object.entries(input.filters)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return (
      `No breakdown data found${filterSummary ? ` (${filterSummary})` : ''}. ` +
      'Try broadening your search or removing a filter.'
    );
  }

  const top = breakdown.data[0]!;
  const valueSuffix =
    input.valueFormat === 'percentage'
      ? '%'
      : input.valueFormat === 'rate'
        ? ' per 1,000'
        : '';
  const yearText = breakdown.year ? ` for ${breakdown.year}` : '';

  return `Showing ${breakdown.data.length} ${dimensionLabel(breakdown.dimension).toLowerCase()} categories${yearText}. Top category: ${top.label} at ${top.estimate.toFixed(1)}${valueSuffix}.`;
}

/**
 * Composes the display label for the metric shown in charts based on active filters.
 */
function buildMetricLabel(filters: DiabetesFilters) {
  const metric = getMetricContext(filters);
  const base = metric.indicator ? metric.indicator : 'Estimated value';
  const unitPart = metric.unit ? ` (${metric.unit})` : '';
  const popPart = metric.population ? ` - ${metric.population}` : '';
  return `${base}${unitPart}${popPart}`;
}

/**
 * Chooses the most appropriate chart kind for the requested view and available data shape.
 * Prevents unsupported pie charts and defaults to readable fallbacks.
 */
function resolveChartKind(input: {
  question: string;
  seriesLength: number;
  breakdown: BreakdownPayload | null;
}): ChartKind {
  const requested = getRequestedChartKind(input.question);
  const allowPie =
    input.breakdown !== null &&
    input.breakdown.data.every((point) => point.estimate >= 0);

  if (
    requested === 'pie' &&
    allowPie &&
    input.breakdown &&
    input.breakdown.data.length >= 2
  ) {
    return input.breakdown.data.length <= 6 ? 'pie' : 'bar';
  }

  if (input.breakdown && input.breakdown.data.length >= 2) {
    if (!allowPie) return 'bar';
    if (requested === 'bar') return 'bar';
    if (requested === 'line') return 'bar';
    return input.breakdown.data.length <= 6 ? 'pie' : 'bar';
  }

  if (requested === 'bar') return 'bar';
  if (requested === 'line') return 'line';

  if (input.seriesLength <= 5) {
    return 'bar';
  }

  return 'line';
}

/**
 * Orchestrates one assistant turn end-to-end.
 * Plans filters, sanitizes planner output, queries data, selects render settings,
 * and returns the response payload plus updated conversation state.
 */
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
    vocabulary,
    input.openAiApiKey
  ).catch(() => null);
  const planned =
    plannerResult ??
    heuristicPlan(input.question, input.state, overview, vocabulary);

  // Sanitize planner output before merging into state. The planner's response
  // is only type-checked by TypeScript at compile time — at runtime (especially
  // from OpenAI's JSON) fields can arrive as arrays, numbers-as-strings, empty
  // strings, or null. Any of those would crash Prisma's typed `where` clause
  // (e.g. sex: ["Male", "Female"] for a "compare" question) and surface as a
  // 500. Coerce to a single valid string/number per field, or drop it.
  const TEXT_FILTER_KEYS = [
    'state',
    'topic',
    'indicator',
    'population',
    'age',
    'race',
    'sex',
    'education',
    'otherStratification',
  ] as const;

  /**
   * Normalizes a text filter value from planner output to a single non-empty string.
   * Accepts accidental arrays by taking the first element.
   */
  function sanitizeTextValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (Array.isArray(value)) {
      return sanitizeTextValue(value[0]);
    }
    return undefined;
  }

  /**
   * Normalizes a year filter value to a finite number.
   * Accepts numeric strings and accidental arrays by taking the first element.
   */
  function sanitizeYearValue(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    if (Array.isArray(value)) {
      return sanitizeYearValue(value[0]);
    }
    return undefined;
  }

  const rawFilters = (planned.filters ?? {}) as Record<string, unknown>;
  const sanitizedFilters: DiabetesFilters = {};
  for (const key of TEXT_FILTER_KEYS) {
    const value = sanitizeTextValue(rawFilters[key]);
    if (value !== undefined) {
      sanitizedFilters[key] = value;
    }
  }
  const yearMin = sanitizeYearValue(rawFilters.yearMin);
  if (yearMin !== undefined) sanitizedFilters.yearMin = yearMin;
  const yearMax = sanitizeYearValue(rawFilters.yearMax);
  if (yearMax !== undefined) sanitizedFilters.yearMax = yearMax;

  const mergedState: ConversationState = {
    filters: {
      ...input.state?.filters,
      ...sanitizedFilters,
    },
    lastQuestion: input.question,
    lastAnswer: planned.answer,
    lastRender: planned.render?.type ?? input.state?.lastRender ?? 'chart',
    turnCount: (input.state?.turnCount ?? 0) + 1,
  };

  const appliedFilters = mergedState.filters;
  const breakdownDimension = inferBreakdownDimension(input.question);
  const breakdownYear =
    appliedFilters.yearMin !== undefined &&
    appliedFilters.yearMax !== undefined &&
    appliedFilters.yearMin === appliedFilters.yearMax
      ? appliedFilters.yearMin
      : undefined;

  const series = await queryYearlySeries(appliedFilters);
  const breakdown = breakdownDimension
    ? await queryCategoryBreakdown({
        filters: appliedFilters,
        dimension: breakdownDimension,
        ...(breakdownYear !== undefined ? { year: breakdownYear } : {}),
      })
    : null;

  const valueFormat = inferValueFormat(getMetricContext(appliedFilters).unit);
  const chartKind = resolveChartKind({
    question: input.question,
    seriesLength: series.length,
    breakdown,
  });
  const metricLabel = buildMetricLabel(appliedFilters);
  const renderTitle =
    breakdown && breakdown.data.length > 0
      ? `${dimensionLabel(breakdown.dimension)} breakdown`
      : (planned.render?.title ?? 'Diabetes trend over time');

  const answer =
    breakdown && chartKind !== 'line'
      ? buildBreakdownAnswer({
          filters: appliedFilters,
          breakdown,
          valueFormat,
        })
      : buildDataAnswer(appliedFilters, series, valueFormat);

  const renderSubtitle =
    breakdown && breakdown.year
      ? `Snapshot year: ${breakdown.year}`
      : series.length > 0
        ? `Years: ${series[0]?.year} to ${series[series.length - 1]?.year}`
        : undefined;

  return {
    answer,
    state: mergedState,
    render: {
      type: 'chart',
      title: renderTitle,
      chartKind,
      metricLabel,
      valueFormat,
      ...(renderSubtitle ? { subtitle: renderSubtitle } : {}),
    },
    series,
    breakdown,
    appliedFilters,
  } satisfies DiabetesAssistantResponse;
}
