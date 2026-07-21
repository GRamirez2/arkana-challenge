import {
  getMetricContext,
  type BreakdownDimension,
  type DiabetesFilters,
} from './diabetes-store.js';
import type {
  BreakdownPayload,
  ChartKind,
  ValueFormat,
} from './assistant-types.js';

/**
 * Normalizes free-text input for lightweight intent and token matching.
 */
function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+ ]/g, ' ');
}

/**
 * Infers whether the user is asking for a categorical breakdown and by which dimension.
 * Uses explicit wording first, then falls back to conservative defaults for comparison phrasing.
 */
export function inferBreakdownDimension(
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
export function inferValueFormat(unit?: string): ValueFormat {
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
 * Builds a narrative summary from yearly time-series results.
 * Includes coverage range, latest estimate, and trend direction/magnitude when comparable points exist.
 */
export function buildDataAnswer(
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
    years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : `${years[0]}`;

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
export function buildBreakdownAnswer(input: {
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
export function buildMetricLabel(filters: DiabetesFilters) {
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
export function resolveChartKind(input: {
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
