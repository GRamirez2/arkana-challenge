<script setup lang="ts">
import { computed } from 'vue';

import { cn } from '@/lib/utils';

type SeriesPoint = {
  year: number;
  estimate: number | null;
  rowCount: number;
};

type BreakdownPoint = {
  label: string;
  estimate: number;
  rowCount: number;
};

const props = withDefaults(
  defineProps<{
    series: SeriesPoint[];
    breakdown?: {
      dimension: string;
      year: number | null;
      data: BreakdownPoint[];
    } | null;
    chartKind?: 'line' | 'bar' | 'pie';
    metricLabel?: string;
    valueFormat?: 'percentage' | 'rate' | 'number';
    title?: string;
    subtitle?: string;
    class?: string;
  }>(),
  {
    breakdown: null,
    chartKind: 'line',
    metricLabel: 'Estimated value',
    valueFormat: 'number',
    title: 'Trend',
    subtitle: '',
    class: '',
  }
);

const width = 800;
const height = 340;
const padding = { top: 24, right: 24, bottom: 44, left: 72 };
const chartColors = [
  '#22d3ee',
  '#34d399',
  '#60a5fa',
  '#f59e0b',
  '#fb7185',
  '#a78bfa',
  '#94a3b8',
];

const points = computed(() =>
  props.series.filter((point) => typeof point.estimate === 'number')
);

const breakdownData = computed(() => props.breakdown?.data ?? []);

const pieData = computed(() => {
  if (breakdownData.value.length <= 6) {
    return breakdownData.value;
  }

  const top = breakdownData.value.slice(0, 6);
  const otherEstimate = breakdownData.value
    .slice(6)
    .reduce((sum, item) => sum + item.estimate, 0);

  return [
    ...top,
    {
      label: 'Other',
      estimate: Number(otherEstimate.toFixed(2)),
      rowCount: breakdownData.value
        .slice(6)
        .reduce((sum, item) => sum + item.rowCount, 0),
    },
  ];
});

const barData = computed(() => {
  if (props.breakdown && breakdownData.value.length > 0) {
    return breakdownData.value.map((item) => ({
      label: item.label,
      value: item.estimate,
    }));
  }

  return points.value.map((item) => ({
    label: String(item.year),
    value: item.estimate as number,
  }));
});

const activeChartKind = computed(() => {
  if (props.chartKind === 'pie' && pieData.value.length >= 2) {
    return 'pie';
  }
  if (props.chartKind === 'bar') {
    return 'bar';
  }
  if (props.chartKind === 'line' && points.value.length >= 2) {
    return 'line';
  }

  if (barData.value.length > 0) {
    return 'bar';
  }

  return 'line';
});

const metrics = computed(() => {
  const values =
    activeChartKind.value === 'line'
      ? points.value.map((point) => point.estimate as number)
      : barData.value.map((point) => point.value);

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

const barLayout = computed(() => {
  const data = barData.value;
  const innerWidth = width - padding.left - padding.right;
  const barCount = Math.max(data.length, 1);
  const gap = Math.min(18, innerWidth * 0.03);
  const barWidth = Math.max(16, (innerWidth - gap * (barCount - 1)) / barCount);

  return data.map((item, index) => {
    const x = padding.left + index * (barWidth + gap);
    const y = yValue(item.value);
    const h = Math.max(0, height - padding.bottom - y);
    return {
      ...item,
      color: chartColors[index % chartColors.length],
      x,
      y,
      height: h,
      width: barWidth,
      centerX: x + barWidth / 2,
    };
  });
});

const pieTotal = computed(() =>
  pieData.value.reduce((sum, slice) => sum + Math.max(0, slice.estimate), 0)
);

const pieSlices = computed(() => {
  const total = pieTotal.value;
  if (total <= 0) {
    return [];
  }

  const cx = width / 2;
  const cy = height / 2 + 22;
  const radius = 110;
  let startAngle = -Math.PI / 2;

  return pieData.value.map((slice, index) => {
    const value = Math.max(0, slice.estimate);
    const angle = (value / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    const midAngle = startAngle + angle / 2;
    const labelX = cx + (radius + 20) * Math.cos(midAngle);
    const labelY = cy + (radius + 20) * Math.sin(midAngle);
    const percent = (value / total) * 100;

    startAngle = endAngle;

    return {
      ...slice,
      path,
      percent,
      labelX,
      labelY,
      color: chartColors[index % chartColors.length],
    };
  });
});

const chartLegendItems = computed(() => {
  if (activeChartKind.value === 'pie') {
    return pieSlices.value.map((slice) => ({
      label: slice.label,
      value: formatValue(slice.estimate),
      secondary: `${slice.percent.toFixed(0)}%`,
      color: slice.color,
    }));
  }

  if (activeChartKind.value === 'bar') {
    return barLayout.value.map((bar) => ({
      label: bar.label,
      value: formatValue(bar.value),
      secondary: '',
      color: bar.color,
    }));
  }

  return [];
});

const chartModeLabel = computed(() => {
  if (activeChartKind.value === 'pie') return 'Pie chart';
  if (activeChartKind.value === 'bar') return 'Bar chart';
  return 'Line chart';
});

function formatValue(value: number) {
  if (props.valueFormat === 'percentage') {
    return `${value.toFixed(1)}%`;
  }
  if (props.valueFormat === 'rate') {
    return `${value.toFixed(1)}`;
  }
  return value.toFixed(1);
}

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
        {{ chartModeLabel }}
      </div>
    </div>

    <div
      v-if="points.length === 0 && breakdownData.length === 0"
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
        <defs v-if="activeChartKind === 'line'">
          <linearGradient id="series-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(34, 211, 238, 0.34)" />
            <stop offset="100%" stop-color="rgba(34, 211, 238, 0.02)" />
          </linearGradient>
        </defs>

        <template
          v-if="activeChartKind === 'line' || activeChartKind === 'bar'"
        >
          <g stroke="rgba(255,255,255,0.08)" stroke-width="1">
            <line
              v-for="tick in yLabels"
              :key="`grid-${tick.value}`"
              :x1="padding.left"
              :x2="width - padding.right"
              :y1="tick.y"
              :y2="tick.y"
            />
          </g>

          <text
            x="12"
            :y="height / 2"
            fill="rgba(255,255,255,0.88)"
            font-size="12"
            font-weight="700"
            transform="rotate(-90 12,170)"
          >
            {{ metricLabel }}
          </text>

          <g fill="rgba(255,255,255,0.9)" font-size="12" font-weight="600">
            <text
              v-for="tick in yLabels"
              :key="`ytick-${tick.value}`"
              x="40"
              :y="tick.y + 4"
            >
              {{ formatValue(tick.value) }}
            </text>
          </g>
        </template>

        <template v-if="activeChartKind === 'line'">
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
              :key="`line-point-${point.year}`"
              :cx="point.x"
              :cy="yValue(point.estimate ?? 0)"
              r="4.5"
              fill="rgb(167 243 208)"
              stroke="rgb(15 23 42)"
              stroke-width="2"
            />
          </g>
          <g fill="rgba(226,232,240,0.9)" font-size="12" font-weight="600">
            <text
              v-for="point in xPositions"
              :key="`line-label-${point.year}`"
              :x="point.x"
              :y="height - 16"
              text-anchor="middle"
            >
              {{ point.year }}
            </text>
          </g>
        </template>

        <template v-else-if="activeChartKind === 'bar'">
          <g>
            <rect
              v-for="bar in barLayout"
              :key="`bar-${bar.label}`"
              :x="bar.x"
              :y="bar.y"
              :width="bar.width"
              :height="bar.height"
              rx="6"
              :fill="bar.color"
            />
          </g>
          <g fill="rgba(226,232,240,0.92)" font-size="12" font-weight="600">
            <text
              v-for="bar in barLayout"
              :key="`bar-label-${bar.label}`"
              :x="bar.centerX"
              :y="height - 16"
              text-anchor="middle"
            >
              {{
                bar.label.length > 15
                  ? `${bar.label.slice(0, 12)}...`
                  : bar.label
              }}
            </text>
          </g>
        </template>

        <template v-else>
          <g>
            <path
              v-for="slice in pieSlices"
              :key="`slice-${slice.label}`"
              :d="slice.path"
              :fill="slice.color"
              stroke="rgba(15,23,42,0.88)"
              stroke-width="1.5"
            />
          </g>

          <g fill="rgba(255,255,255,0.9)" font-size="12" font-weight="700">
            <text
              v-for="slice in pieSlices"
              :key="`slice-label-${slice.label}`"
              :x="slice.labelX"
              :y="slice.labelY"
              text-anchor="middle"
            >
              {{ slice.percent.toFixed(0) }}%
            </text>
          </g>

          <g>
            <rect
              x="24"
              y="22"
              width="286"
              height="18"
              rx="8"
              fill="rgba(15,23,42,0.54)"
            />
            <text
              x="34"
              y="35"
              fill="rgba(255,255,255,0.95)"
              font-size="12"
              font-weight="700"
            >
              {{ metricLabel }}
            </text>
          </g>
        </template>
      </svg>

      <div
        v-if="chartLegendItems.length > 0"
        class="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2"
      >
        <div
          v-for="item in chartLegendItems"
          :key="`legend-${item.label}`"
          class="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1"
        >
          <span
            class="inline-block h-2.5 w-2.5 rounded-full"
            :style="{ backgroundColor: item.color }"
          />
          <span class="font-semibold text-slate-100">{{ item.label }}</span>
          <span class="text-slate-300">{{ item.value }}</span>
          <span v-if="item.secondary" class="text-slate-400">
            {{ item.secondary }}
          </span>
        </div>
      </div>

      <p class="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-100/80">
        Metric: {{ metricLabel }}
      </p>
    </div>
  </div>
</template>
