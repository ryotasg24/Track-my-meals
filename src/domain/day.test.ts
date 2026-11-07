import { describe, expect, it } from 'vitest';
import { targetForDate } from './day';
import { DEFAULT_TARGET_PLAN } from './target';
import type { ActivityLog, TargetPlan, WeightLog } from './types';

const sync = { id: 'x', createdAt: 0, updatedAt: 0, deleted: 0 as const };
const plan: TargetPlan = {
  ...sync,
  effectiveFrom: '2026-11-01',
  ...DEFAULT_TARGET_PLAN,
  overrides: { kcal: null, protein: null, fat: null, carbs: null, fiber: null, salt: null },
};
const profile = { sex: 'male' as const, birthDate: '1991-04-01', heightCm: 172 };
const weights: WeightLog[] = [{ ...sync, date: '2026-11-01', weightKg: 70 }];
const activities: ActivityLog[] = [{ ...sync, localDate: '2026-11-07', activeKcal: 520, source: 'shortcut' }];

describe('記録日ごとの目標', () => {
  it('プロフィール・設定・体重・アクティブエネルギーから計算する（基本設計書 5.3 の例）', () => {
    const r = targetForDate('2026-11-07', profile, [plan], weights, activities);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.target.kcal).toBe(2044);
      expect(r.activeKcal).toBe(520);
    }
    const noExercise = targetForDate('2026-11-06', profile, [plan], weights, activities);
    expect(noExercise.ok && noExercise.result.target.kcal).toBe(1824);
  });

  it('足りないものを返す', () => {
    expect(targetForDate('2026-11-07', { sex: null, birthDate: null, heightCm: null }, [plan], weights, [])).toEqual({ ok: false, missing: 'profile' });
    expect(targetForDate('2026-11-07', profile, [], weights, [])).toEqual({ ok: false, missing: 'plan' });
    expect(targetForDate('2026-10-31', profile, [plan], weights, [])).toEqual({ ok: false, missing: 'weight' });
  });
});
