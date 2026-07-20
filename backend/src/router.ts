import { os } from '@orpc/server';
import { z } from 'zod';

import {
  ensureDatabaseReady,
  getDatasetOverview,
  queryYearlySeries,
  type DiabetesFilters,
} from './diabetes-store.js';
import { answerDiabetesQuestion, type ConversationState } from './assistant.js';

const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v));
const optionalNumberSchema = z.number().finite().optional();

const filtersSchema = z.object({
  state: optionalTextSchema,
  topic: optionalTextSchema,
  indicator: optionalTextSchema,
  population: optionalTextSchema,
  age: optionalTextSchema,
  race: optionalTextSchema,
  sex: optionalTextSchema,
  education: optionalTextSchema,
  otherStratification: optionalTextSchema,
  yearMin: optionalNumberSchema,
  yearMax: optionalNumberSchema,
});

const ping = os.handler(async () => 'pong');

const overview = os.handler(async () => {
  await ensureDatabaseReady();

  return {
    overview: await getDatasetOverview(),
  };
});

const timeseries = os.input(filtersSchema).handler(async ({ input }) => {
  await ensureDatabaseReady();

  const filters: DiabetesFilters = {
    state: input.state,
    topic: input.topic,
    indicator: input.indicator,
    population: input.population,
    age: input.age,
    race: input.race,
    sex: input.sex,
    education: input.education,
    otherStratification: input.otherStratification,
    yearMin: input.yearMin,
    yearMax: input.yearMax,
  };

  return {
    filters,
    series: await queryYearlySeries(filters),
  };
});

const chatStateSchema = z.object({
  filters: filtersSchema.default(() => ({
    state: undefined,
    topic: undefined,
    indicator: undefined,
    population: undefined,
    age: undefined,
    race: undefined,
    sex: undefined,
    education: undefined,
    otherStratification: undefined,
    yearMin: undefined,
    yearMax: undefined,
  })),
  lastQuestion: z.string().optional(),
  lastAnswer: z.string().optional(),
  lastRender: z.enum(['chart', 'table']).optional(),
  turnCount: z.number().int().nonnegative(),
});

const chat = os
  .input(
    z.object({
      question: z.string().trim().min(1),
      state: chatStateSchema.optional(),
      openAiApiKey: z.string().trim().min(1).optional(),
    })
  )
  .handler(async ({ input }) => {
    await ensureDatabaseReady();

    const state: ConversationState | undefined = input.state
      ? {
          filters: input.state.filters,
          lastQuestion: input.state.lastQuestion,
          lastAnswer: input.state.lastAnswer,
          lastRender: input.state.lastRender,
          turnCount: input.state.turnCount,
        }
      : undefined;

    return answerDiabetesQuestion({
      question: input.question,
      state,
      openAiApiKey: input.openAiApiKey,
    });
  });

export const router = {
  ping,
  diabetes: {
    overview,
    timeseries,
    chat,
  },
};
