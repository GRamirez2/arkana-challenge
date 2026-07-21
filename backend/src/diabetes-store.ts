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

export type BreakdownDimension =
  | 'age'
  | 'sex'
  | 'race'
  | 'education'
  | 'state'
  | 'indicator';

export type DiabetesBreakdownPoint = {
  label: string;
  estimate: number;
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

// Each indicator reports its estimate in multiple incompatible units (e.g. raw
// head counts alongside percentages), plus a "Median of States" aggregate row.
// Without pinning a single comparable unit, averaging across years silently
// blends these together into meaningless numbers. This maps each indicator to
// the unit that represents a comparable rate/percentage suitable for trends.
const INDICATOR_DEFAULT_UNIT: Record<string, string> = {
  'Diagnosed Diabetes': 'Percentage',
  'Diagnosed Type 1 Diabetes': 'Percentage',
  'Diagnosed Type 2 Diabetes': 'Percentage',
  'Newly Diagnosed Diabetes': 'Rate per 1,000',
};

// Type 1/Type 2 diabetes percentages are reported against two different
// populations (all adults vs. adults who already have diabetes). Default to
// the general-population prevalence view unless the caller asks otherwise.
const INDICATOR_DEFAULT_POPULATION: Record<string, string> = {
  'Diagnosed Type 1 Diabetes': 'Adults Aged 18+ Years',
  'Diagnosed Type 2 Diabetes': 'Adults Aged 18+ Years',
};

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

  const defaultUnit = filters.indicator
    ? INDICATOR_DEFAULT_UNIT[filters.indicator]
    : undefined;
  const defaultPopulation = filters.indicator
    ? INDICATOR_DEFAULT_POPULATION[filters.indicator]
    : undefined;

  return {
    estimate: { not: null },
    ...(filters.state ? { state: filters.state } : {}),
    ...(filters.topic ? { topic: filters.topic } : {}),
    ...(filters.indicator ? { indicator: filters.indicator } : {}),
    ...(filters.population
      ? { population: filters.population }
      : defaultPopulation
        ? { population: defaultPopulation }
        : {}),
    ...(defaultUnit ? { unit: defaultUnit } : {}),
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

function withFilterRemoved(
  filters: DiabetesFilters,
  key: keyof DiabetesFilters
) {
  const next = { ...filters };
  delete next[key];
  return next;
}

export function getMetricContext(filters: DiabetesFilters) {
  const indicator = filters.indicator;
  const unit = indicator ? INDICATOR_DEFAULT_UNIT[indicator] : undefined;
  const population = filters.population
    ? filters.population
    : indicator
      ? INDICATOR_DEFAULT_POPULATION[indicator]
      : undefined;

  return {
    indicator,
    unit,
    population,
  };
}

async function queryBreakdownByDimension(
  where: Prisma.DiabetesObservationWhereInput,
  dimension: BreakdownDimension
) {
  switch (dimension) {
    case 'age':
      return prisma.diabetesObservation.groupBy({
        by: ['age'],
        where,
        _avg: { estimate: true },
        _count: { _all: true },
      });
    case 'sex':
      return prisma.diabetesObservation.groupBy({
        by: ['sex'],
        where,
        _avg: { estimate: true },
        _count: { _all: true },
      });
    case 'race':
      return prisma.diabetesObservation.groupBy({
        by: ['race'],
        where,
        _avg: { estimate: true },
        _count: { _all: true },
      });
    case 'education':
      return prisma.diabetesObservation.groupBy({
        by: ['education'],
        where,
        _avg: { estimate: true },
        _count: { _all: true },
      });
    case 'state':
      return prisma.diabetesObservation.groupBy({
        by: ['state'],
        where,
        _avg: { estimate: true },
        _count: { _all: true },
      });
    case 'indicator':
      return prisma.diabetesObservation.groupBy({
        by: ['indicator'],
        where,
        _avg: { estimate: true },
        _count: { _all: true },
      });
    default:
      return [];
  }
}

function getDimensionValue(
  row:
    | { age: string }
    | { sex: string }
    | { race: string }
    | { education: string }
    | { state: string }
    | { indicator: string },
  dimension: BreakdownDimension
) {
  switch (dimension) {
    case 'age':
      return (row as { age: string }).age;
    case 'sex':
      return (row as { sex: string }).sex;
    case 'race':
      return (row as { race: string }).race;
    case 'education':
      return (row as { education: string }).education;
    case 'state':
      return (row as { state: string }).state;
    case 'indicator':
      return (row as { indicator: string }).indicator;
  }
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
  let rowCount: number;
  try {
    rowCount = await prisma.diabetesObservation.count();
  } catch {
    throw new Error(
      'Database table not found. Run `npm run dev:db:init` to apply the schema, then `npm run seed` to load the data.'
    );
  }

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

export async function queryCategoryBreakdown(input: {
  filters: DiabetesFilters;
  dimension: BreakdownDimension;
  year?: number;
}): Promise<{
  dimension: BreakdownDimension;
  year: number | null;
  data: DiabetesBreakdownPoint[];
}> {
  await ensureDatabaseReady();

  const filtersWithoutDimension = withFilterRemoved(
    input.filters,
    input.dimension
  );
  const baseWhere = buildWhere(filtersWithoutDimension);

  let targetYear = input.year;
  if (targetYear === undefined) {
    const yearAgg = await prisma.diabetesObservation.aggregate({
      where: baseWhere,
      _max: { year: true },
    });
    targetYear = yearAgg._max.year ?? undefined;
  }

  if (targetYear === undefined) {
    return {
      dimension: input.dimension,
      year: null,
      data: [],
    };
  }

  const whereForYear: Prisma.DiabetesObservationWhereInput = {
    ...baseWhere,
    year: { equals: targetYear },
  };

  const rows = await queryBreakdownByDimension(whereForYear, input.dimension);
  const data = rows
    .map((row) => {
      const value = row._avg.estimate;
      if (typeof value !== 'number') {
        return null;
      }

      const label = getDimensionValue(
        row as
          | { age: string }
          | { sex: string }
          | { race: string }
          | { education: string }
          | { state: string }
          | { indicator: string },
        input.dimension
      );

      return {
        label,
        estimate: Number(value.toFixed(2)),
        rowCount: row._count._all,
      };
    })
    .filter((point): point is DiabetesBreakdownPoint => point !== null)
    .sort((a, b) => b.estimate - a.estimate);

  return {
    dimension: input.dimension,
    year: targetYear,
    data,
  };
}
