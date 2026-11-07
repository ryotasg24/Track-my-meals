/**
 * グラフの集計（要件定義書 F-GRA-01〜04、基本設計書 5.11）。
 * 平均は記録のある日だけで割る（記録していない日を0kcalとして数えないため）。
 */
import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { ja } from 'date-fns/locale';
import { dayMark } from './nutrition';
import type { Nutrients } from './types';

export type Period = 'week' | 'month' | 'year';

/** 1日分のまとめ（画面側で記録日ごとに作って渡す） */
export interface DaySummary {
  localDate: string;
  /** 記録済みの食事が1件以上あるか */
  hasMeals: boolean;
  intake: Nutrients;
  /** その日の目標（体重がなく計算できない日はnull） */
  target: Nutrients | null;
  /** その日の体重（記録がなければnull） */
  weightKg: number | null;
}

/** グラフの1点（週・月は1日、年は1か月） */
export interface Bucket {
  label: string;
  /** 範囲の最初と最後の記録日 */
  from: string;
  to: string;
  /** 記録のある日の平均（記録がなければnull：点を置かない） */
  intake: Nutrients | null;
  targetKcal: number | null;
  targetFiber: number | null;
  targetSalt: number | null;
  weightKg: number | null;
}

/**
 * 期間の範囲。週は月曜始まり。
 * @param anchor 期間に含まれる記録日
 */
export function periodRange(period: Period, anchor: string): { from: string; to: string } {
  const d = parseISO(anchor);
  const fmt = (x: Date) => format(x, 'yyyy-MM-dd');
  if (period === 'week') {
    const s = startOfWeek(d, { weekStartsOn: 1 });
    return { from: fmt(s), to: fmt(addDays(s, 6)) };
  }
  if (period === 'month') return { from: fmt(startOfMonth(d)), to: fmt(endOfMonth(d)) };
  const s = startOfYear(d);
  return { from: fmt(s), to: fmt(addDays(addMonths(s, 12), -1)) };
}

/** 期間を前後に動かす */
export function shiftPeriod(period: Period, anchor: string, step: number): string {
  const d = parseISO(anchor);
  const moved = period === 'week' ? addDays(d, 7 * step) : period === 'month' ? addMonths(d, step) : addMonths(d, 12 * step);
  return format(moved, 'yyyy-MM-dd');
}

/** 期間の見出し。例：11/2(月)〜11/8(日)、2026年11月、2026年 */
export function periodLabel(period: Period, anchor: string): string {
  const { from, to } = periodRange(period, anchor);
  if (period === 'week') {
    return `${format(parseISO(from), 'M/d(E)', { locale: ja })}〜${format(parseISO(to), 'M/d(E)', { locale: ja })}`;
  }
  if (period === 'month') return format(parseISO(from), 'yyyy年M月');
  return format(parseISO(from), 'yyyy年');
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function averageNutrients(list: Nutrients[]): Nutrients | null {
  if (list.length === 0) return null;
  const avg = (k: keyof Nutrients) => list.reduce((s, n) => s + n[k], 0) / list.length;
  return { kcal: avg('kcal'), protein: avg('protein'), fat: avg('fat'), carbs: avg('carbs'), fiber: avg('fiber'), salt: avg('salt') };
}

function summarize(label: string, from: string, to: string, days: DaySummary[]): Bucket {
  const recorded = days.filter((d) => d.hasMeals);
  const targets = days.filter((d) => d.target !== null).map((d) => d.target as Nutrients);
  return {
    label,
    from,
    to,
    intake: averageNutrients(recorded.map((d) => d.intake)),
    targetKcal: average(targets.map((t) => t.kcal)),
    targetFiber: average(targets.map((t) => t.fiber)),
    targetSalt: average(targets.map((t) => t.salt)),
    weightKg: average(days.filter((d) => d.weightKg !== null).map((d) => d.weightKg as number)),
  };
}

/**
 * グラフの点を作る。週・月は日ごと、年は月ごと（1日あたりの平均）。
 * @param summaries 期間内の各日のまとめ（記録日で検索する）
 */
export function buildBuckets(period: Period, anchor: string, summaries: readonly DaySummary[]): Bucket[] {
  const { from, to } = periodRange(period, anchor);
  const byDate = new Map(summaries.map((s) => [s.localDate, s]));
  const empty = (localDate: string): DaySummary => ({
    localDate,
    hasMeals: false,
    intake: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, salt: 0 },
    target: null,
    weightKg: null,
  });

  if (period !== 'year') {
    const buckets: Bucket[] = [];
    for (let d = parseISO(from); format(d, 'yyyy-MM-dd') <= to; d = addDays(d, 1)) {
      const key = format(d, 'yyyy-MM-dd');
      const label = period === 'week' ? format(d, 'd(E)', { locale: ja }) : format(d, 'd');
      buckets.push(summarize(label, key, key, [byDate.get(key) ?? empty(key)]));
    }
    return buckets;
  }

  const buckets: Bucket[] = [];
  for (let m = 0; m < 12; m++) {
    const start = addMonths(parseISO(from), m);
    const mFrom = format(start, 'yyyy-MM-dd');
    const mTo = format(endOfMonth(start), 'yyyy-MM-dd');
    const days = summaries.filter((s) => s.localDate >= mFrom && s.localDate <= mTo);
    buckets.push(summarize(`${m + 1}月`, mFrom, mTo, days));
  }
  return buckets;
}

/** 期間のまとめ（F-GRA-04） */
export interface PeriodSummary {
  /** 1日あたりの平均（記録のある日だけ） */
  average: Nutrients | null;
  recordedDays: number;
  /** カロリーが範囲内（±10%）だった日数 */
  withinDays: number;
}

export function summarizePeriod(period: Period, anchor: string, summaries: readonly DaySummary[]): PeriodSummary {
  const { from, to } = periodRange(period, anchor);
  const days = summaries.filter((s) => s.localDate >= from && s.localDate <= to && s.hasMeals);
  return {
    average: averageNutrients(days.map((d) => d.intake)),
    recordedDays: days.length,
    withinDays: days.filter((d) => d.target !== null && dayMark(d.intake.kcal, d.target.kcal) === 'within').length,
  };
}
