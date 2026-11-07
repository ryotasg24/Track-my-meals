/**
 * 記録日ごとのまとめ（カレンダーの印とグラフに使う）。
 */
import { useMemo } from 'react';
import { targetForDate } from '../domain/day';
import { shiftDate } from '../domain/date';
import { sumMeals } from '../domain/nutrition';
import type { DaySummary } from '../domain/stats';
import { useActivities, useAllMeals, usePlans, useSettings, useWeights } from './hooks';

/**
 * 指定した範囲（記録日）の各日のまとめ。範囲のすべての日を返す。
 */
export function useDaySummaries(from: string, to: string): DaySummary[] | undefined {
  const settings = useSettings();
  const meals = useAllMeals();
  const plans = usePlans();
  const weights = useWeights();
  const activities = useActivities();
  return useMemo(() => {
    if (!settings || !meals || !plans || !weights || !activities) return undefined;
    const byDate = new Map<string, typeof meals>();
    for (const m of meals) {
      if (m.deleted === 1 || m.localDate < from || m.localDate > to) continue;
      byDate.set(m.localDate, [...(byDate.get(m.localDate) ?? []), m]);
    }
    // 目標の線を引くため、範囲のすべての日を返す（記録のない日は hasMeals が false）
    const dates: string[] = [];
    for (let d = from; d <= to; d = shiftDate(d, 1)) dates.push(d);
    return dates.map((localDate) => {
      const dayMeals = byDate.get(localDate) ?? [];
      const t = targetForDate(localDate, settings, plans, weights, activities);
      return {
        localDate,
        hasMeals: dayMeals.some((m) => m.status === 'done'),
        intake: sumMeals(dayMeals),
        target: t.ok ? t.result.target : null,
        weightKg: weights.find((w) => w.date === localDate)?.weightKg ?? null,
      };
    });
  }, [settings, meals, plans, weights, activities, from, to]);
}
