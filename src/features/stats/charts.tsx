/**
 * グラフ（デザイン仕様書 7.5）。
 * - 推移：マーカー付きの折れ線（データラベル付き）。目標は破線で重ねる。記録のない日は点を置かず、線もつながない
 * - PFC：積み上げ棒グラフ
 * データラベルは、外部のプラグインを入れずに、Chart.js の描画の仕組みで点の上に値を書く。
 */
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
  type Plugin,
  type ScriptableContext,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, BarElement, Filler, Tooltip, Legend);

/** CSS変数の色を読む（ダークモードに合わせるため） */
export function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** #RRGGBB を、透明度つきの rgba() にする */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const FONT = "ui-rounded, 'Hiragino Maru Gothic ProN', -apple-system, 'Hiragino Sans', sans-serif";

/** 1つめの線の点の上に値を書く。点が多いときは1つおきにする */
function dataLabelPlugin(color: string, fontSize: number, decimals: number, everyOther: boolean): Plugin<'line'> {
  return {
    id: 'pointValueLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      const data = chart.data.datasets[0]?.data ?? [];
      ctx.save();
      ctx.font = `700 ${fontSize}px ${FONT}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      let shown = 0;
      meta.data.forEach((point, i) => {
        const value = data[i];
        if (typeof value !== 'number') return;
        shown += 1;
        if (everyOther && shown % 2 === 0) return;
        ctx.fillText(value.toLocaleString('ja-JP', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }), point.x, point.y - 8);
      });
      ctx.restore();
    },
  };
}

function baseScales(textColor: string, gridColor: string, count: number, beginAtZero: boolean) {
  return {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: textColor, maxRotation: 0, autoSkip: count > 7, autoSkipPadding: 12, font: { size: 11 } },
    },
    y: {
      beginAtZero,
      grace: '15%',
      border: { display: false },
      grid: { color: withAlpha(gridColor, 0.8) },
      ticks: { color: textColor, maxTicksLimit: 5, font: { size: 11 } },
    },
  };
}

interface TrendProps {
  labels: string[];
  values: (number | null)[];
  target?: (number | null)[];
  /** 線の色（CSS変数の名前） */
  colorVar: string;
  unit: string;
  decimals?: number;
  /** 体重のように0から始めない値 */
  beginAtZero?: boolean;
}

export function TrendChart({ labels, values, target, colorVar, unit, decimals = 0, beginAtZero = true }: TrendProps) {
  const line = cssColor(colorVar);
  const surface = cssColor('--color-surface');
  const sub = cssColor('--color-text-sub');
  const text = cssColor('--color-text');
  const grid = cssColor('--color-border');
  const dense = labels.length > 12;

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 24, left: 4, right: 8 } },
    animation: { duration: 500, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    spanGaps: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: text,
        titleColor: surface,
        bodyColor: surface,
        padding: 10,
        cornerRadius: 12,
        displayColors: false,
        callbacks: { label: (item) => `${item.dataset.label ?? ''} ${item.formattedValue} ${unit}` },
      },
    },
    scales: baseScales(sub, grid, labels.length, beginAtZero),
  };

  return (
    <Line
      options={options}
      plugins={[dataLabelPlugin(text, dense ? 10 : 12, decimals, dense)]}
      data={{
        labels,
        datasets: [
          {
            label: '実績',
            data: values,
            borderColor: line,
            borderWidth: 2.5,
            tension: 0.35,
            cubicInterpolationMode: 'monotone',
            fill: true,
            backgroundColor: (context: ScriptableContext<'line'>) => {
              const { ctx, chartArea } = context.chart;
              if (!chartArea) return withAlpha(line, 0.2);
              const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              g.addColorStop(0, withAlpha(line, 0.35));
              g.addColorStop(1, withAlpha(line, 0));
              return g;
            },
            pointRadius: dense ? 2.5 : 4,
            pointHoverRadius: dense ? 5 : 7,
            pointBackgroundColor: surface,
            pointBorderColor: line,
            pointBorderWidth: 2,
          },
          ...(target
            ? [
                {
                  label: '目標',
                  data: target,
                  borderColor: sub,
                  borderWidth: 1.5,
                  borderDash: [6, 4],
                  pointRadius: 0,
                  fill: false,
                  tension: 0,
                },
              ]
            : []),
        ],
      }}
    />
  );
}

interface PfcProps {
  labels: string[];
  protein: (number | null)[];
  fat: (number | null)[];
  carbs: (number | null)[];
}

export function PfcChart({ labels, protein, fat, carbs }: PfcProps) {
  const surface = cssColor('--color-surface');
  const sub = cssColor('--color-text-sub');
  const text = cssColor('--color-text');
  const grid = cssColor('--color-border');
  const scales = baseScales(sub, grid, labels.length, true);

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: { color: text, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: text,
        titleColor: surface,
        bodyColor: surface,
        padding: 10,
        cornerRadius: 12,
        callbacks: { label: (item) => `${item.dataset.label ?? ''} ${item.formattedValue} g` },
      },
    },
    scales: { x: { ...scales.x, stacked: true }, y: { ...scales.y, stacked: true } },
  };
  const ds = (label: string, data: (number | null)[], colorVar: string, isTop: boolean) => ({
    label,
    data,
    backgroundColor: cssColor(colorVar),
    borderRadius: isTop ? { topLeft: 6, topRight: 6 } : 0,
    borderSkipped: false as const,
    maxBarThickness: 28,
  });
  return (
    <Bar
      options={options}
      data={{
        labels,
        datasets: [
          ds('たんぱく質', protein, '--color-nut-protein', false),
          ds('脂質', fat, '--color-nut-fat', false),
          ds('炭水化物', carbs, '--color-nut-carbs', true),
        ],
      }}
    />
  );
}
