import type {
  BreakdownDimension,
  DiabetesBreakdownPoint,
  DiabetesFilters,
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

export type ChartKind = 'line' | 'bar' | 'pie';
export type ValueFormat = 'percentage' | 'rate' | 'number';

export type ChartRenderSpec = VisualizationSpec & {
  chartKind: ChartKind;
  metricLabel: string;
  valueFormat: ValueFormat;
  subtitle?: string;
};

export type BreakdownPayload = {
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

export type PlannerResult = {
  answer?: string;
  filters?: DiabetesFilters;
  render?: VisualizationSpec;
};
