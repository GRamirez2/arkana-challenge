import {
  getDatasetOverview,
  getFilterVocabulary,
  getMetricContext,
  queryCategoryBreakdown,
  queryYearlySeries,
} from './diabetes-store.js';
import { heuristicPlan, planWithOpenAI } from './assistant-planner.js';
import {
  buildBreakdownAnswer,
  buildDataAnswer,
  buildMetricLabel,
  inferBreakdownDimension,
  inferValueFormat,
  resolveChartKind,
} from './assistant-response.js';
import {
  mergeConversationState,
  sanitizePlannerFilters,
} from './assistant-state.js';
import type {
  ConversationState,
  DiabetesAssistantResponse,
} from './assistant-types.js';

export type {
  ConversationState,
  DiabetesAssistantResponse,
} from './assistant-types.js';

/**
 * Orchestrates one assistant turn end-to-end.
 * This module intentionally keeps only workflow glue:
 * planner selection, state merge, data fetch, and response assembly.
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

  const sanitizedFilters = sanitizePlannerFilters(planned);
  const mergedState = mergeConversationState({
    previousState: input.state,
    question: input.question,
    planned,
    sanitizedFilters,
  });

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
      ? `${humanizeBreakdownDimension(breakdown.dimension)} breakdown`
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

function humanizeBreakdownDimension(
  dimension: NonNullable<DiabetesAssistantResponse['breakdown']>['dimension']
) {
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
