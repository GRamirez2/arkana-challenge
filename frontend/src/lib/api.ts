const defaultBaseUrl = 'http://localhost:3000';

export type DiabetesFilters = Partial<{
  state: string | undefined;
  topic: string | undefined;
  indicator: string | undefined;
  population: string | undefined;
  age: string | undefined;
  race: string | undefined;
  sex: string | undefined;
  education: string | undefined;
  otherStratification: string | undefined;
  yearMin: number | undefined;
  yearMax: number | undefined;
}>;

export type ConversationState = {
  filters: DiabetesFilters;
  lastQuestion?: string | undefined;
  lastAnswer?: string | undefined;
  lastRender?: 'chart' | 'table' | undefined;
  turnCount: number;
};

export type DiabetesSeriesPoint = {
  year: number;
  estimate: number | null;
  rowCount: number;
};

export type DatasetOverview = {
  rowCount: number;
  yearMin: number | null;
  yearMax: number | null;
  indicatorCount: number;
  stateCount: number;
  indicators: string[];
  states: string[];
  sampleFilters: {
    age: string[];
    race: string[];
    sex: string[];
    education: string[];
  };
};

export type DiabetesAssistantResponse = {
  answer: string;
  state: ConversationState;
  render: {
    type: 'chart' | 'table';
    title: string;
  };
  series: DiabetesSeriesPoint[];
  appliedFilters: DiabetesFilters;
};

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL ?? defaultBaseUrl).replace(
    /\/$/,
    ''
  );
}

export async function fetchHealth() {
  const response = await fetch(`${getApiBaseUrl()}/health`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Backend health check failed with ${response.status}`);
  }

  return response.json() as Promise<{ ok: boolean }>;
}

export async function fetchDatasetOverview() {
  const response = await fetch(`${getApiBaseUrl()}/api/diabetes/overview`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Dataset overview request failed with ${response.status}`);
  }

  return response.json() as Promise<{ overview: DatasetOverview }>;
}

export async function sendDiabetesQuestion(payload: {
  question: string;
  state?: ConversationState;
  openAiApiKey?: string;
}) {
  const response = await fetch(`${getApiBaseUrl()}/api/diabetes/chat`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed with ${response.status}`);
  }

  return response.json() as Promise<DiabetesAssistantResponse>;
}
