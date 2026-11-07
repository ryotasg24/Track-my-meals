import { describe, expect, it } from 'vitest';
import { calcBmr, calcTarget, DEFAULT_TARGET_PLAN, fiberAndSaltTarget, pickPlan, pickWeight, type TargetInput } from './target';

const noOverrides = { kcal: null, protein: null, fat: null, carbs: null, fiber: null, salt: null };

/** 基本設計書 5.3 の計算例（男性・35歳・172cm・70kg・活動係数1.50・減量−500） */
const example: TargetInput = {
  plan: { ...DEFAULT_TARGET_PLAN, overrides: noOverrides },
  sex: 'male',
  age: 35,
  heightCm: 172,
  weightKg: 70,
  activeKcal: null,
};

describe('基礎代謝（基本設計書 5.3）', () => {
  it('男性の計算例は1,549kcal', () => {
    expect(calcBmr('male', 35, 172, 70)).toBe(1549);
  });

  it('女性の参考例は1,184kcal', () => {
    expect(calcBmr('female', 30, 158, 55)).toBe(1184);
  });
});

describe('目標（基本設計書 5.3の計算例）', () => {
  it('運動しない日は1,824kcal、たんぱく質112g、脂質51g、炭水化物230g', () => {
    const r = calcTarget(example);
    expect(r.target.kcal).toBe(1824);
    expect(r.target.protein).toBeCloseTo(112, 5);
    expect(Math.round(r.target.fat)).toBe(51);
    expect(r.target.carbs).toBeCloseTo(230, 5);
    expect(r.target.fiber).toBe(22);
    expect(r.target.salt).toBe(7.5);
    expect(r.exerciseKcal).toBe(0);
  });

  it('アクティブエネルギー520kcalの日は220kcalを上乗せして2,044kcal', () => {
    const r = calcTarget({ ...example, activeKcal: 520 });
    expect(r.exerciseKcal).toBe(220);
    expect(r.target.kcal).toBe(2044);
    expect(Math.round(r.target.fat)).toBe(57);
    expect(Math.round(r.target.carbs)).toBe(271);
  });

  it('普段より少ない日は上乗せしない', () => {
    expect(calcTarget({ ...example, activeKcal: 200 }).exerciseKcal).toBe(0);
  });

  it('基礎代謝を下回る場合は基礎代謝にする', () => {
    const r = calcTarget({ ...example, plan: { ...example.plan, goalAdjustKcal: -1000 } });
    expect(r.isFloorApplied).toBe(true);
    expect(r.target.kcal).toBe(1549);
  });

  it('自分で決めた値で上書きでき、脂質と炭水化物はそのカロリーで計算する', () => {
    const r = calcTarget({ ...example, plan: { ...example.plan, overrides: { ...noOverrides, kcal: 2000, salt: 6 } } });
    expect(r.target.kcal).toBe(2000);
    expect(r.target.fat).toBeCloseTo(2000 * 0.25 / 9, 5);
    expect(r.target.salt).toBe(6);
  });

  it('炭水化物が0未満になる場合は0にする', () => {
    const r = calcTarget({ ...example, plan: { ...example.plan, proteinPerKg: 2.5, overrides: { ...noOverrides, kcal: 800 } } });
    expect(r.target.carbs).toBe(0);
    expect(r.isCarbsClamped).toBe(true);
  });
});

describe('食物繊維・食塩相当量の目標（2025年版）', () => {
  it('年齢と性別で決まる', () => {
    expect(fiberAndSaltTarget('male', 29)).toEqual({ fiber: 20, salt: 7.5 });
    expect(fiberAndSaltTarget('male', 30)).toEqual({ fiber: 22, salt: 7.5 });
    expect(fiberAndSaltTarget('male', 65)).toEqual({ fiber: 21, salt: 7.5 });
    expect(fiberAndSaltTarget('male', 75)).toEqual({ fiber: 20, salt: 7.5 });
    expect(fiberAndSaltTarget('female', 74)).toEqual({ fiber: 18, salt: 6.5 });
    expect(fiberAndSaltTarget('female', 75)).toEqual({ fiber: 17, salt: 6.5 });
  });
});

describe('記録日に使う設定と体重', () => {
  const plan = (effectiveFrom: string, deleted: 0 | 1 = 0) => ({ effectiveFrom, deleted });

  it('記録日以前で最も新しい設定を使う', () => {
    const plans = [plan('2026-11-01'), plan('2026-11-05'), plan('2026-11-10')];
    expect(pickPlan(plans, '2026-11-07')?.effectiveFrom).toBe('2026-11-05');
    expect(pickPlan(plans, '2026-11-10')?.effectiveFrom).toBe('2026-11-10');
  });

  it('最初の設定より前の日は最も古い設定を使う', () => {
    expect(pickPlan([plan('2026-11-05')], '2026-11-01')?.effectiveFrom).toBe('2026-11-05');
  });

  it('記録日以前の最新の体重。なければnull', () => {
    const logs = [
      { date: '2026-11-01', weightKg: 71, deleted: 0 as const },
      { date: '2026-11-06', weightKg: 70, deleted: 0 as const },
      { date: '2026-11-07', weightKg: 69, deleted: 1 as const },
    ];
    expect(pickWeight(logs, '2026-11-07')?.weightKg).toBe(70);
    expect(pickWeight(logs, '2026-10-31')).toBeNull();
  });
});
