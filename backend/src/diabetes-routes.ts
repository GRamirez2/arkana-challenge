import type { FastifyInstance } from 'fastify';

import {
  ensureDatabaseReady,
  getDatasetOverview,
  queryYearlySeries,
} from './diabetes-store.js';
import { answerDiabetesQuestion, type ConversationState } from './assistant.js';

function toOptionalText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalNumber(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

export function registerDiabetesRoutes(app: FastifyInstance) {
  app.get('/api/diabetes/overview', async () => {
    await ensureDatabaseReady();

    return {
      overview: await getDatasetOverview(),
    };
  });

  app.get('/api/diabetes/timeseries', async (request) => {
    await ensureDatabaseReady();

    const query = request.query as Record<string, unknown>;

    const filters = {
      state: toOptionalText(query.state),
      topic: toOptionalText(query.topic),
      indicator: toOptionalText(query.indicator),
      population: toOptionalText(query.population),
      age: toOptionalText(query.age),
      race: toOptionalText(query.race),
      sex: toOptionalText(query.sex),
      education: toOptionalText(query.education),
      otherStratification: toOptionalText(query.otherStratification),
      yearMin: toOptionalNumber(query.yearMin),
      yearMax: toOptionalNumber(query.yearMax),
    };

    return {
      filters,
      series: await queryYearlySeries(filters),
    };
  });

  app.post('/api/diabetes/chat', async (request) => {
    await ensureDatabaseReady();

    const body = request.body as {
      question?: string;
      state?: ConversationState;
      openAiApiKey?: string;
    };

    const question =
      typeof body.question === 'string' ? body.question.trim() : '';

    if (!question) {
      return {
        error: 'A question is required.',
      };
    }

    return answerDiabetesQuestion({
      question,
      state: body.state ?? undefined,
      openAiApiKey: toOptionalText(body.openAiApiKey),
    });
  });
}
