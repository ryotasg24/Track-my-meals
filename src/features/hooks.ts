/**
 * 画面からデータを読むための仕組み。データが変わると画面が自動で更新される（useLiveQuery）。
 * 読み込み中は undefined を返す。個人利用でデータ量が少ないため、まとめて読む。
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import { targetForDate, type DayTarget } from '../domain/day';
import { toRecordDate } from '../domain/date';
import { sumMeals } from '../domain/nutrition';
import type { ModelCooldown } from '../domain/quota';
import type { Meal, Nutrients } from '../domain/types';

export function useSettings() {
  return useLiveQuery(() => db.settings.get('app'));
}

/** APIキーが設定されているか（キーそのものは画面に渡さない） */
export function useApiKeyInfo() {
  return useLiveQuery(async () => {
    const s = await db.secrets.get('gemini');
    return s ? { hasKey: true, last4: s.apiKey.slice(-4), verifiedAt: s.verifiedAt } : { hasKey: false, last4: '', verifiedAt: null };
  });
}

export function useMeta() {
  return useLiveQuery(async () => {
    const records = await db.meta.toArray();
    const get = <T,>(key: string) => (records.find((r) => r.key === key)?.value as T | undefined) ?? null;
    return {
      firstLaunchAt: get<number>('firstLaunchAt'),
      lastBackupAt: get<number>('lastBackupAt'),
      lastReviewCheckedDate: get<string>('lastReviewCheckedDate'),
      modelCooldown: get<ModelCooldown>('modelCooldown') ?? {},
    };
  });
}

/** すべての食事（削除済みも含む） */
export function useAllMeals() {
  return useLiveQuery(() => db.meals.toArray());
}

/** 指定した記録日の、削除されていない食事（食べた時刻の順） */
export function useMealsOn(localDate: string | null) {
  return useLiveQuery(
    async () =>
      localDate
        ? (await db.meals.where('localDate').equals(localDate).toArray())
            .filter((m) => m.deleted === 0)
            .sort((a, b) => a.eatenAt - b.eatenAt)
        : [],
    [localDate],
  );
}

export function useMeal(id: string | undefined) {
  return useLiveQuery(async () => (id ? ((await db.meals.get(id)) ?? null) : null), [id]);
}

export function useFavorites() {
  return useLiveQuery(async () =>
    (await db.favorites.toArray()).filter((f) => f.deleted === 0).sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name, 'ja')),
  );
}

export function useWeights() {
  return useLiveQuery(async () => (await db.weightLogs.toArray()).filter((w) => w.deleted === 0).sort((a, b) => b.date.localeCompare(a.date)));
}

export function useActivities() {
  return useLiveQuery(async () => (await db.activityLogs.toArray()).filter((a) => a.deleted === 0));
}

export function useReview(localDate: string | undefined) {
  return useLiveQuery(
    async () => (localDate ? ((await db.reviews.where('localDate').equals(localDate).toArray()).find((r) => r.deleted === 0) ?? null) : null),
    [localDate],
  );
}

export function usePlans() {
  return useLiveQuery(() => db.targetPlans.toArray());
}

/**
 * 現在時刻。指定した間隔と、アプリが前面に戻ったときに更新する。
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') update();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

/** 今日の記録日（区切りの時刻を考慮。1分ごとに更新） */
export function useToday(): string | undefined {
  const settings = useSettings();
  const now = useNow(60_000);
  return settings ? toRecordDate(now, settings.dayBoundaryHour) : undefined;
}

export interface DayData {
  meals: Meal[];
  intake: Nutrients;
  target: DayTarget;
}

/** 指定した記録日の、食事・摂取量・目標 */
export function useDay(localDate: string | undefined): DayData | undefined {
  const settings = useSettings();
  const meals = useMealsOn(localDate ?? null);
  const plans = usePlans();
  const weights = useWeights();
  const activities = useActivities();
  return useMemo(() => {
    if (!localDate || !settings || !meals || !plans || !weights || !activities) return undefined;
    return {
      meals,
      intake: sumMeals(meals),
      target: targetForDate(localDate, settings, plans, weights, activities),
    };
  }, [localDate, settings, meals, plans, weights, activities]);
}
