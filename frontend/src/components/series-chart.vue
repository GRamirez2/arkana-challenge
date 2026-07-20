<script setup lang="ts">
import { computed } from 'vue';

import { cn } from '@/lib/utils';

type SeriesPoint = {
  year: number;
  estimate: number | null;
  rowCount: number;
};

const props = withDefaults(
  defineProps<{
    series: SeriesPoint[];
    title?: string;
    subtitle?: string;
    class?: string;
  }>(),
  {
    title: 'Trend',
    subtitle: '',
    class: '',
  }
);

const width = 800;
const height = 340;
const padding = { top: 24, right: 24, bottom: 44, left: 56 };

const points = computed(() =>
  props.series.filter((point) => typeof point.estimate === 'number')
);

const metrics = computed(() => {
  const values = points.value.map((point) => point.estimate as number);

  if (values.length === 0) {
    return {
      min: 0,
      max: 1,
      span: 1,
      ticks: [0, 0.25, 0.5, 0.75, 1],
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const paddingAmount = Math.max((max - min) * 0.12, 0.5);
  const paddedMin = Math.max(min - paddingAmount, 0);
  const paddedMax = max + paddingAmount;
  const span = paddedMax - paddedMin || 1;
  const ticks = Array.from(
    { length: 5 },
    (_, index) => paddedMin + (span / 4) * index
  ).reverse();

  return {
    min: paddedMin,
    max: paddedMax,
    span,
    ticks,
  };
});

const xPositions = computed(() => {
  const innerWidth = width - padding.left - padding.right;
  const count = Math.max(points.value.length - 1, 1);

  return points.value.map((point, index) => ({
    ...point,
    x: padding.left + (innerWidth / count) * index,
  }));
});

const linePath = computed(() => {
  if (xPositions.value.length === 0) {
    return '';
  }

  return xPositions.value
    .map((point, index) => {
      const y = yValue(point.estimate as number);
      return `${index === 0 ? 'M' : 'L'} ${point.x} ${y}`;
    })
    .join(' ');
});

const areaPath = computed(() => {
  if (xPositions.value.length === 0) {
    return '';
  }

  const baseline = height - padding.bottom;
  const startX = xPositions.value[0]?.x ?? padding.left;
  const endX = xPositions.value[xPositions.value.length - 1]?.x ?? startX;
  const lineSegments = xPositions.value
    .map((point, index) => {
      const y = yValue(point.estimate as number);
      return `${index === 0 ? 'L' : 'L'} ${point.x} ${y}`;
    })
    .join(' ');

  return `M ${startX} ${baseline} ${lineSegments} L ${endX} ${baseline} Z`;
});

const yLabels = computed(() =>
  metrics.value.ticks.map((tick) => ({
    value: tick,
    y: yValue(tick),
  }))
);

function yValue(value: number) {
  const innerHeight = height - padding.top - padding.bottom;
  const normalized = (value - metrics.value.min) / metrics.value.span;
  return height - padding.bottom - normalized * innerHeight;
}
</script>

<template>
  <div
    :class="
      cn(
        'rounded-3xl border border-slate-200 bg-slate-950/95 text-white shadow-2xl shadow-slate-950/20',
        props.class
      )
    "
  >
    <div
      class="flex items-start justify-between gap-6 border-b border-white/10 px-5 py-4 sm:px-6"
    >
      <div>
        <p
          class="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80"
        >
          {{ title }}
        </p>
        <p v-if="subtitle" class="mt-2 text-sm leading-6 text-slate-300">
          {{ subtitle }}
        </p>
      </div>
      <div
        class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300"
      >
        {{ points.length }} points
      </div>
    </div>

    <div
      v-if="points.length === 0"
      class="px-6 py-16 text-center text-slate-300"
    >
      No series data matched the current filters.
    </div>

    <div v-else class="px-3 pb-4 pt-3 sm:px-4">
      <svg
        class="h-[340px] w-full"
        viewBox="0 0 800 340"
        role="img"
        aria-label="Diabetes trend chart"
      >
        <defs>
          <linearGradient id="series-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(34, 211, 238, 0.34)" />
            <stop offset="100%" stop-color="rgba(34, 211, 238, 0.02)" />
          </linearGradient>
        </defs>

        <g stroke="rgba(255,255,255,0.08)" stroke-width="1">
          <line
            v-for="tick in yLabels"
            :key="tick.value"
            :x1="padding.left"
            :x2="width - padding.right"
            :y1="tick.y"
            :y2="tick.y"
          />
        </g>

        <path v-if="areaPath" :d="areaPath" fill="url(#series-fill)" />

        <path
          v-if="linePath"
          :d="linePath"
          fill="none"
          stroke="rgb(125 211 252)"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <g>
          <circle
            v-for="point in xPositions"
            :key="point.year"
            :cx="point.x"
            :cy="yValue(point.estimate ?? 0)"
            r="4.5"
            fill="rgb(167 243 208)"
            stroke="rgb(15 23 42)"
            stroke-width="2"
          />
        </g>

        <g fill="rgba(255,255,255,0.9)" font-size="12" font-weight="600">
          <text
            v-for="tick in yLabels"
            :key="tick.value"
            x="18"
            :y="tick.y + 4"
          >
            {{ tick.value.toFixed(1) }}
          </text>
        </g>

        <g fill="rgba(226,232,240,0.9)" font-size="12" font-weight="600">
          <text
            v-for="point in xPositions"
            :key="point.year"
            :x="point.x"
            :y="height - 16"
            text-anchor="middle"
          >
            {{ point.year }}
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>
