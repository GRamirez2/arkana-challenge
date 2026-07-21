import type { DiabetesFilters } from './diabetes-store.js';
import type { ConversationState, PlannerResult } from './assistant-types.js';

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

/**
 * Sanitizes planner-provided filters before they are merged into state and passed to Prisma.
 */
export function sanitizePlannerFilters(
  planned: PlannerResult
): DiabetesFilters {
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

  return sanitizedFilters;
}

/**
 * Merges state for the next assistant turn while preserving prior filters unless overridden.
 */
export function mergeConversationState(input: {
  previousState: ConversationState | undefined;
  question: string;
  planned: PlannerResult;
  sanitizedFilters: DiabetesFilters;
}): ConversationState {
  return {
    filters: {
      ...input.previousState?.filters,
      ...input.sanitizedFilters,
    },
    lastQuestion: input.question,
    lastAnswer: input.planned.answer,
    lastRender:
      input.planned.render?.type ?? input.previousState?.lastRender ?? 'chart',
    turnCount: (input.previousState?.turnCount ?? 0) + 1,
  };
}
