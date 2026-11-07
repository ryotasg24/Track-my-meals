/**
 * グラフ（基本設計書 3.3 画面9、5.11、F-GRA-01〜04）。
 */
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { formatNutrient } from '../../domain/nutrition';
import { buildBuckets, periodLabel, periodRange, shiftPeriod, summarizePeriod, type Period } from '../../domain/stats';
import { Card, Sub } from '../../ui/Card';
import { Chip, ChipGroup } from '../../ui/Chip';
import { NutrientIcon } from '../../ui/nutrition/NutrientIcon';
import { useToday } from '../hooks';
import { useDaySummaries } from '../summaries';
import calendarStyles from '../calendar/Calendar.module.css';
import styles from '../page.module.css';
import { PfcChart, TrendChart } from './charts';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: '週' },
  { id: 'month', label: '月' },
  { id: 'year', label: '年' },
];

export default function StatsPage() {
  const today = useToday();
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState<string | null>(null);
  const a = anchor ?? today ?? '';
  const range = a ? periodRange(period, a) : { from: '', to: '' };
  const summaries = useDaySummaries(range.from, range.to);
  if (!today || !summaries) return null;

  const buckets = buildBuckets(period, a, summaries);
  const sum = summarizePeriod(period, a, summaries);
  const labels = buckets.map((b) => b.label);
  const pick = (f: (b: (typeof buckets)[number]) => number | null, decimals = 0) =>
    buckets.map((b) => {
      const v = f(b);
      return v === null ? null : Math.round(v * 10 ** decimals) / 10 ** decimals;
    });

  return (
    <div className={styles.page}>
      <h1>グラフ</h1>
      <ChipGroup>
        {PERIODS.map((p) => (
          <Chip key={p.id} variant="tint" selected={period === p.id} onClick={() => setPeriod(p.id)}>
            {p.label}
          </Chip>
        ))}
      </ChipGroup>
      <div className={calendarStyles.header}>
        <button type="button" className={calendarStyles.navButton} onClick={() => setAnchor(shiftPeriod(period, a, -1))} aria-label="前の期間">
          <IconChevronLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>{periodLabel(period, a)}</h2>
        <button type="button" className={calendarStyles.navButton} onClick={() => setAnchor(shiftPeriod(period, a, 1))} aria-label="次の期間">
          <IconChevronRight size={24} />
        </button>
      </div>

      <Card title="期間のまとめ">
        {sum.average ? (
          <>
            <p className="num" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              1日あたり {formatNutrient('kcal', sum.average.kcal)} kcal
            </p>
            <Sub>
              たんぱく質 {formatNutrient('protein', sum.average.protein)}g・脂質 {formatNutrient('fat', sum.average.fat)}g・炭水化物{' '}
              {formatNutrient('carbs', sum.average.carbs)}g（記録のある日だけの平均）
            </Sub>
            <Sub>
              カロリーが範囲内（目標の±10%）だった日：{sum.withinDays}日 / 記録した日：{sum.recordedDays}日
            </Sub>
          </>
        ) : (
          <p className={styles.empty}>この期間の記録はありません</p>
        )}
      </Card>

      <div className={styles.columns}>
        <ChartCard title="摂取カロリー" icon={<NutrientIcon nutrient="kcal" size={18} />} legend="実線：摂取、破線：目標">
          <TrendChart labels={labels} values={pick((b) => b.intake?.kcal ?? null)} target={pick((b) => b.targetKcal)} colorVar="--color-primary-strong" unit="kcal" />
        </ChartCard>
        <ChartCard title="たんぱく質・脂質・炭水化物（g）">
          <PfcChart
            labels={labels}
            protein={pick((b) => b.intake?.protein ?? null)}
            fat={pick((b) => b.intake?.fat ?? null)}
            carbs={pick((b) => b.intake?.carbs ?? null)}
          />
        </ChartCard>
        <ChartCard title="体重（kg）">
          <TrendChart labels={labels} values={pick((b) => b.weightKg, 1)} colorVar="--color-text" unit="kg" decimals={1} beginAtZero={false} />
        </ChartCard>
        <ChartCard title="食物繊維（g）" icon={<NutrientIcon nutrient="fiber" size={18} />} legend="破線：目標（以上）">
          <TrendChart labels={labels} values={pick((b) => b.intake?.fiber ?? null)} target={pick((b) => b.targetFiber)} colorVar="--color-nut-fiber" unit="g" />
        </ChartCard>
        <ChartCard title="食塩相当量（g）" icon={<NutrientIcon nutrient="salt" size={18} />} legend="破線：目標（未満）">
          <TrendChart labels={labels} values={pick((b) => b.intake?.salt ?? null, 1)} target={pick((b) => b.targetSalt, 1)} colorVar="--color-nut-salt" unit="g" decimals={1} />
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, icon, legend, children }: { title: string; icon?: ReactNode; legend?: string; children: ReactNode }) {
  return (
    <Card
      title={
        <>
          {icon}
          {title}
        </>
      }
    >
      <div style={{ height: 220 }}>{children}</div>
      {legend && <Sub>{legend}</Sub>}
    </Card>
  );
}
