import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'csv-parse/sync';

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const csvPath = join(
  backendRoot,
  'data',
  'USDSS_State_Burden_Magnitude_Diabetes_Indicators_20260716.csv'
);

const prisma = new PrismaClient();

export type DiabetesObservation = {
  state: string;
  year: number;
  topic: string;
  indicator: string;
  unit: string;
  estimate: number | null;
  seEstimate: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  estimateFootnote: string | null;
  dataSource: string;
  population: string;
  age: string;
  race: string;
  sex: string;
  education: string;
  otherStratification: string;
};

export type DiabetesFilters = {
  state?: string | undefined;
  topic?: string | undefined;
  indicator?: string | undefined;
  population?: string | undefined;
  age?: string | undefined;
  race?: string | undefined;
  sex?: string | undefined;
  education?: string | undefined;
  otherStratification?: string | undefined;
  yearMin?: number | undefined;
  yearMax?: number | undefined;
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

export type FilterVocabulary = {
  indicators: string[];
  states: string[];
  topics: string[];
  age: string[];
  race: string[];
  sex: string[];
  education: string[];
};

function toNullableNumber(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toText(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function toNullableText(value: unknown) {
  const text = toText(value);
  return text.length > 0 ? text : null;
}

function parseObservation(record: Record<string, string>): DiabetesObservation {
  return {
    state: toText(record.State),
    year: Number(record.Year),
    topic: toText(record.topic),
    indicator: toText(record.Indicator),
    unit: toText(record.Unit),
    estimate: toNullableNumber(record.Estimate),
    seEstimate: toNullableNumber(record['SE Estimate']),
    lowerLimit: toNullableNumber(record['Lower Limit']),
    upperLimit: toNullableNumber(record['Upper Limit']),
    estimateFootnote: toNullableText(record['Estimate Footnote']),
    dataSource: toText(record['Data Source']),
    population: toText(record.Population),
    age: toText(record.Age),
    race: toText(record.Race),
    sex: toText(record.Sex),
    education: toText(record.Education),
    otherStratification: toText(record['Other Stratification']),
  };
}

function loadObservationsFromCsv() {
  const fileContents = readFileSync(csvPath, 'utf8');
  const rows = parse(fileContents, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return rows.map(parseObservation);
}

function chunk<T>(values: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

function buildWhere(
  filters: DiabetesFilters
): Prisma.DiabetesObservationWhereInput {
  const year: Prisma.IntFilter = {};

  if (typeof filters.yearMin === 'number' && Number.isFinite(filters.yearMin)) {
    year.gte = filters.yearMin;
  }

  if (typeof filters.yearMax === 'number' && Number.isFinite(filters.yearMax)) {
    year.lte = filters.yearMax;
  }

  return {
    estimate: { not: null },
    ...(filters.state ? { state: filters.state } : {}),
    ...(filters.topic ? { topic: filters.topic } : {}),
    ...(filters.indicator ? { indicator: filters.indicator } : {}),
    ...(filters.population ? { population: filters.population } : {}),
    ...(filters.age ? { age: filters.age } : {}),
    ...(filters.race ? { race: filters.race } : {}),
    ...(filters.sex ? { sex: filters.sex } : {}),
    ...(filters.education ? { education: filters.education } : {}),
    ...(filters.otherStratification
      ? { otherStratification: filters.otherStratification }
      : {}),
    ...(Object.keys(year).length > 0 ? { year } : {}),
  };
}

async function insertObservations(observations: DiabetesObservation[]) {
  for (const observationChunk of chunk(observations, 500)) {
    await prisma.diabetesObservation.createMany({
      data: observationChunk,
    });
  }
}

async function readDistinctValues(
  field: 'indicator' | 'state' | 'topic' | 'age' | 'race' | 'sex' | 'education'
) {
  const rows = await prisma.diabetesObservation.findMany({
    distinct: [field],
    orderBy: {
      [field]: 'asc',
    } as Prisma.DiabetesObservationOrderByWithRelationInput,
    select: { [field]: true } as Record<typeof field, true>,
  });

  return rows.map((row) => row[field]);
}

export async function seedDatabaseFromCsv(options: { reset?: boolean } = {}) {
  if (options.reset) {
    await prisma.diabetesObservation.deleteMany();
  }

  const observations = loadObservationsFromCsv();
  await insertObservations(observations);

  return {
    rowCount: observations.length,
  };
}

export async function ensureDatabaseReady() {
  const rowCount = await prisma.diabetesObservation.count();

  if (rowCount === 0) {
    return seedDatabaseFromCsv();
  }

  return { rowCount };
}

export async function getDatasetOverview(): Promise<DatasetOverview> {
  await ensureDatabaseReady();

  const [
    rowCount,
    yearRange,
    indicators,
    states,
    ageRows,
    raceRows,
    sexRows,
    educationRows,
  ] = await Promise.all([
    prisma.diabetesObservation.count(),
    prisma.diabetesObservation.aggregate({
      _min: { year: true },
      _max: { year: true },
    }),
    readDistinctValues('indicator'),
    readDistinctValues('state'),
    readDistinctValues('age'),
    readDistinctValues('race'),
    readDistinctValues('sex'),
    readDistinctValues('education'),
  ]);

  return {
    rowCount,
    yearMin: yearRange._min.year,
    yearMax: yearRange._max.year,
    indicatorCount: indicators.length,
    stateCount: states.length,
    indicators: indicators.slice(0, 12),
    states: states.slice(0, 12),
    sampleFilters: {
      age: ageRows.slice(0, 12),
      race: raceRows.slice(0, 12),
      sex: sexRows.slice(0, 12),
      education: educationRows.slice(0, 12),
    },
  };
}

export async function getFilterVocabulary(): Promise<FilterVocabulary> {
  await ensureDatabaseReady();

  return {
    indicators: await readDistinctValues('indicator'),
    states: await readDistinctValues('state'),
    topics: await readDistinctValues('topic'),
    age: await readDistinctValues('age'),
    race: await readDistinctValues('race'),
    sex: await readDistinctValues('sex'),
    education: await readDistinctValues('education'),
  };
}

export async function queryYearlySeries(
  filters: DiabetesFilters
): Promise<DiabetesSeriesPoint[]> {
  await ensureDatabaseReady();

  const rows = await prisma.diabetesObservation.groupBy({
    by: ['year'],
    where: buildWhere(filters),
    _avg: { estimate: true },
    _count: { _all: true },
    orderBy: { year: 'asc' },
  });

  return rows.map((row) => ({
    year: row.year,
    estimate:
      typeof row._avg.estimate === 'number'
        ? Number(row._avg.estimate.toFixed(2))
        : null,
    rowCount: row._count._all,
  }));
}
