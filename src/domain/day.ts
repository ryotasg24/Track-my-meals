/**
 * 記録日ごとの目標を、保存された記録から求める（基本設計書 5.3 の「使う値」の表）。
 */
import { ageOn } from './date';
import { calcTarget, pickPlan, pickWeight, type TargetResult } from './target';
import type { ActivityLog, Settings, TargetPlan, WeightLog } from './types';

export type DayTarget =
  | { ok: true; result: TargetResult; weightKg: number; activeKcal: number | null; plan: TargetPlan }
  | { ok: false; missing: 'profile' | 'weight' | 'plan' };

/**
 * 記録日Dの目標を求める。
 * @returns 計算できない場合は、足りないもの（プロフィール・体重・設定）
 */
export function targetForDate(
  localDate: string,
  settings: Pick<Settings, 'sex' | 'birthDate' | 'heightCm'>,
  plans: readonly TargetPlan[],
  weights: readonly WeightLog[],
  activities: readonly ActivityLog[],
): DayTarget {
  if (!settings.sex || !settings.birthDate || !settings.heightCm) return { ok: false, missing: 'profile' };
  const plan = pickPlan(plans, localDate);
  if (!plan) return { ok: false, missing: 'plan' };
  const weight = pickWeight(weights, localDate);
  if (!weight) return { ok: false, missing: 'weight' };
  const activity = activities.find((a) => a.localDate === localDate && a.deleted === 0) ?? null;
  const result = calcTarget({
    plan,
    sex: settings.sex,
    age: ageOn(settings.birthDate, localDate),
    heightCm: settings.heightCm,
    weightKg: weight.weightKg,
    activeKcal: activity?.activeKcal ?? null,
  });
  return { ok: true, result, weightKg: weight.weightKg, activeKcal: activity?.activeKcal ?? null, plan };
}
