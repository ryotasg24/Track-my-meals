/**
 * 摂取量の合計・目標との比較・量の変更（基本設計書 5.4〜5.7）。
 */
import { NUTRIENT_KEYS, type Meal, type NutrientKey, type Nutrients } from './types';

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  kcal: 'カロリー',
  protein: 'たんぱく質',
  fat: '脂質',
  carbs: '炭水化物',
  fiber: '食物繊維',
  salt: '食塩相当量',
};

export const NUTRIENT_UNITS: Record<NutrientKey, string> = {
  kcal: 'kcal',
  protein: 'g',
  fat: 'g',
  carbs: 'g',
  fiber: 'g',
  salt: 'g',
};

export const ZERO_NUTRIENTS: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, salt: 0 };

/** 栄養価を足し合わせる（端数は残す） */
export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    fiber: a.fiber + b.fiber,
    salt: a.salt + b.salt,
  };
}

/** 栄養価を同じ割合で増減する */
export function scaleNutrients(n: Nutrients, ratio: number): Nutrients {
  return {
    kcal: n.kcal * ratio,
    protein: n.protein * ratio,
    fat: n.fat * ratio,
    carbs: n.carbs * ratio,
    fiber: n.fiber * ratio,
    salt: n.salt * ratio,
  };
}

/** 1つの食事の合計 */
export function mealTotal(meal: Pick<Meal, 'items'>): Nutrients {
  return meal.items.reduce((sum, item) => addNutrients(sum, item.nutrients), ZERO_NUTRIENTS);
}

/**
 * 食事の合計。削除されておらず、記録済み（読み取り待ちでない）の食事だけを数える（基本設計書 5.4）。
 */
export function sumMeals(meals: readonly Pick<Meal, 'items' | 'deleted' | 'status'>[]): Nutrients {
  return meals
    .filter((m) => m.deleted === 0 && m.status === 'done')
    .reduce((sum, m) => addNutrients(sum, mealTotal(m)), ZERO_NUTRIENTS);
}

/**
 * 表示用に丸める。カロリーは1kcal、PFC・食物繊維は1g、食塩相当量は0.1g（基本設計書 5.4）。
 * @param detail true なら品目ごとの表示（g の値を0.1g単位にする）
 */
export function roundForDisplay(key: NutrientKey, value: number, detail = false): number {
  if (key === 'kcal') return Math.round(value);
  if (key === 'salt' || detail) return Math.round(value * 10) / 10;
  return Math.round(value);
}

/** 表示用の文字。例：1,250 / 7.8 */
export function formatNutrient(key: NutrientKey, value: number, detail = false): string {
  const v = roundForDisplay(key, value, detail);
  if (key === 'salt' || detail) return v.toFixed(1);
  return v.toLocaleString('ja-JP');
}

/** 目標との比較の状態（基本設計書 5.5） */
export type NutrientStatus = 'normal' | 'achieved' | 'over';

/**
 * 状態を判定する。表示と同じ単位に丸めた値どうしで比べる。
 * - カロリー・脂質・炭水化物：摂取 ＞ 目標 で超過
 * - たんぱく質・食物繊維：摂取 ≧ 目標 で達成（目標は「以上」）
 * - 食塩相当量：摂取 ≧ 目標 で超過（目標は「未満」）
 */
export function nutrientStatus(key: NutrientKey, intake: number, target: number): NutrientStatus {
  const i = roundForDisplay(key, intake);
  const t = roundForDisplay(key, target);
  switch (key) {
    case 'protein':
    case 'fiber':
      return i >= t ? 'achieved' : 'normal';
    case 'salt':
      return i >= t ? 'over' : 'normal';
    default:
      return i > t ? 'over' : 'normal';
  }
}

/** 残り（目標 − 摂取）。表示と同じ単位に丸めた値で計算する。負なら超過 */
export function remaining(key: NutrientKey, intake: number, target: number): number {
  const r = roundForDisplay(key, target) - roundForDisplay(key, intake);
  return key === 'salt' ? Math.round(r * 10) / 10 : r;
}

/** カレンダーの印（基本設計書 5.5、F-HIS-01） */
export type DayMark = 'within' | 'under' | 'over';

/**
 * 摂取カロリーと目標カロリーから印を決める。範囲内は目標の90%以上110%以下。
 * 摂取は表示と同じく1kcal単位で比べる。
 */
export function dayMark(intakeKcal: number, targetKcal: number): DayMark {
  const intake = Math.round(intakeKcal);
  if (intake < targetKcal * 0.9) return 'under';
  if (intake > targetKcal * 1.1) return 'over';
  return 'within';
}

/**
 * 量を変えたときの栄養価（基本設計書 5.7）。今の量が0以下の場合は変えない。
 */
export function rescaleForAmount(nutrients: Nutrients, currentAmount: number, newAmount: number): Nutrients {
  if (currentAmount <= 0 || newAmount <= 0) return nutrients;
  return scaleNutrients(nutrients, newAmount / currentAmount);
}

/** 不足・超過の一覧（AIが使えないときに表示する。F-ADV-05） */
export function gapSummary(intake: Nutrients, target: Nutrients): { key: NutrientKey; status: NutrientStatus; remaining: number }[] {
  return NUTRIENT_KEYS.map((key) => ({
    key,
    status: nutrientStatus(key, intake[key], target[key]),
    remaining: remaining(key, intake[key], target[key]),
  }));
}
