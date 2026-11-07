import { describe, expect, it } from 'vitest';
import { dayMark, formatNutrient, nutrientStatus, remaining, rescaleForAmount, sumMeals } from './nutrition';
import type { MealItem } from './types';

const item = (kcal: number, salt = 0): MealItem => ({
  id: 'i',
  name: 'x',
  amount: 1,
  unit: '杯',
  nutrients: { kcal, protein: 1.04, fat: 0, carbs: 0, fiber: 0, salt },
  source: 'manual',
  favoriteId: null,
  model: null,
});

describe('摂取量の合計（基本設計書 5.4）', () => {
  it('削除済みと読み取り待ちは数えない', () => {
    const total = sumMeals([
      { items: [item(100), item(50.4)], deleted: 0, status: 'done' },
      { items: [item(999)], deleted: 1, status: 'done' },
      { items: [], deleted: 0, status: 'pending' },
    ]);
    expect(total.kcal).toBeCloseTo(150.4, 5);
    expect(total.protein).toBeCloseTo(2.08, 5);
  });

  it('表示の丸め', () => {
    expect(formatNutrient('kcal', 1250.4)).toBe('1,250');
    expect(formatNutrient('protein', 37.6)).toBe('38');
    expect(formatNutrient('salt', 7.84)).toBe('7.8');
    expect(formatNutrient('protein', 3.84, true)).toBe('3.8');
  });
});

describe('状態の判定（基本設計書 5.5）', () => {
  it('カロリーは目標を超えたら超過。ちょうどは超過でない', () => {
    expect(nutrientStatus('kcal', 1824, 1824)).toBe('normal');
    expect(nutrientStatus('kcal', 1824.6, 1824)).toBe('over');
  });

  it('たんぱく質は目標以上で達成', () => {
    expect(nutrientStatus('protein', 111.6, 112)).toBe('achieved');
    expect(nutrientStatus('protein', 111.4, 112)).toBe('normal');
  });

  it('食塩は目標ちょうどでも超過（目標は未満）', () => {
    expect(nutrientStatus('salt', 7.5, 7.5)).toBe('over');
    expect(nutrientStatus('salt', 7.44, 7.5)).toBe('normal');
    expect(nutrientStatus('salt', 7.46, 7.5)).toBe('over');
  });

  it('残りは丸めた値で計算する', () => {
    expect(remaining('kcal', 1250.4, 1824)).toBe(574);
    expect(remaining('salt', 7.8, 7.5)).toBe(-0.3);
  });
});

describe('カレンダーの印（基本設計書 5.5）', () => {
  it('目標1,824kcalの範囲内は1,642〜2,006kcal', () => {
    expect(dayMark(1641, 1824)).toBe('under');
    expect(dayMark(1642, 1824)).toBe('within');
    expect(dayMark(2006, 1824)).toBe('within');
    expect(dayMark(2007, 1824)).toBe('over');
  });

  it('ちょうど90%と110%は範囲内', () => {
    expect(dayMark(1800, 2000)).toBe('within');
    expect(dayMark(2200, 2000)).toBe('within');
  });
});

describe('量を変えたときの栄養価（基本設計書 5.7）', () => {
  it('白ごはん150g・234kcalを200gにすると312kcal', () => {
    const n = rescaleForAmount({ kcal: 234, protein: 3.8, fat: 0.5, carbs: 55.7, fiber: 0.5, salt: 0 }, 150, 200);
    expect(n.kcal).toBeCloseTo(312, 5);
  });

  it('今の量が0なら変えない', () => {
    const n = { kcal: 10, protein: 0, fat: 0, carbs: 0, fiber: 0, salt: 0 };
    expect(rescaleForAmount(n, 0, 5)).toBe(n);
  });
});
