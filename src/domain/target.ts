/**
 * 1日の目標の計算（要件定義書 3.5、基本設計書 5.3）。
 */
import { ageOn } from './date';
import type { Goal, Nutrients, Sex, TargetPlan } from './types';

export const GOAL_LABELS: Record<Goal, string> = { lose: '減量', keep: '維持', gain: '増量' };

/** 目的による増減の初期値（kcal） */
export const DEFAULT_GOAL_ADJUST: Record<Goal, number> = { lose: -500, keep: 0, gain: 300 };

/** 活動係数の選択肢（日本人の食事摂取基準の身体活動レベル） */
export const ACTIVITY_FACTORS = [
  { value: 1.5, label: '低い（座っていることが多い）' },
  { value: 1.75, label: 'ふつう（立ち仕事・移動が多い）' },
  { value: 2.0, label: '高い（体を動かす仕事など）' },
] as const;

/** 目標の設定の初期値（要件定義書 3.5。2026-11-07 決定） */
export const DEFAULT_TARGET_PLAN = {
  goal: 'lose' as Goal,
  activityFactor: 1.5,
  goalAdjustKcal: DEFAULT_GOAL_ADJUST.lose,
  proteinPerKg: 1.6,
  fatRatio: 0.25,
  typicalActiveKcal: 300,
};

/** 目標の計算に必要な値 */
export interface TargetInput {
  plan: Pick<
    TargetPlan,
    'activityFactor' | 'goalAdjustKcal' | 'proteinPerKg' | 'fatRatio' | 'typicalActiveKcal' | 'overrides'
  >;
  sex: Sex;
  /** 計算する記録日の満年齢 */
  age: number;
  heightCm: number;
  weightKg: number;
  /** その日のアクティブエネルギー（取り込んでいなければnull） */
  activeKcal: number | null;
}

/** 目標と、計算の内訳（目標の画面に出す。F-TGT-04） */
export interface TargetResult {
  target: Nutrients;
  bmr: number;
  baseKcal: number;
  exerciseKcal: number;
  /** 基本の目標が基礎代謝を下回り、基礎代謝の値にしたか */
  isFloorApplied: boolean;
  /** 炭水化物が0未満になり、0にしたか（設定を見直す必要がある） */
  isCarbsClamped: boolean;
}

/**
 * 基礎代謝（kcal/日）。国立健康・栄養研究所の式。1kcal単位に四捨五入する。
 */
export function calcBmr(sex: Sex, age: number, heightCm: number, weightKg: number): number {
  const constant = sex === 'male' ? 0.4235 : 0.9708;
  return Math.round(((0.0481 * weightKg + 0.0234 * heightCm - 0.0138 * age - constant) * 1000) / 4.186);
}

/**
 * 食物繊維と食塩相当量の目標（日本人の食事摂取基準 2025年版。基本設計書 5.3の表）。
 * 食物繊維は「以上」、食塩相当量は「未満」の目標。
 */
export function fiberAndSaltTarget(sex: Sex, age: number): { fiber: number; salt: number } {
  const salt = sex === 'male' ? 7.5 : 6.5;
  if (sex === 'male') {
    if (age < 30) return { fiber: 20, salt };
    if (age < 65) return { fiber: 22, salt };
    if (age < 75) return { fiber: 21, salt };
    return { fiber: 20, salt };
  }
  if (age < 75) return { fiber: 18, salt };
  return { fiber: 17, salt };
}

/**
 * 1日の目標を計算する。端数は最後の目標カロリーでだけ丸め、g の値は端数を残す（表示時に丸める）。
 */
export function calcTarget(input: TargetInput): TargetResult {
  const { plan, sex, age, heightCm, weightKg, activeKcal } = input;
  const bmr = calcBmr(sex, age, heightCm, weightKg);

  let baseKcal = bmr * plan.activityFactor + plan.goalAdjustKcal;
  const isFloorApplied = baseKcal < bmr;
  if (isFloorApplied) baseKcal = bmr;

  const exerciseKcal = activeKcal === null ? 0 : Math.max(0, activeKcal - plan.typicalActiveKcal);
  const kcal = plan.overrides.kcal ?? Math.round(baseKcal + exerciseKcal);

  const protein = plan.overrides.protein ?? weightKg * plan.proteinPerKg;
  const fatKcal = kcal * plan.fatRatio;
  const fat = plan.overrides.fat ?? fatKcal / 9;
  const carbsRaw = (kcal - protein * 4 - fatKcal) / 4;
  const isCarbsClamped = plan.overrides.carbs === null && carbsRaw < 0;
  const carbs = plan.overrides.carbs ?? Math.max(0, carbsRaw);

  const fs = fiberAndSaltTarget(sex, age);
  return {
    target: {
      kcal,
      protein,
      fat,
      carbs,
      fiber: plan.overrides.fiber ?? fs.fiber,
      salt: plan.overrides.salt ?? fs.salt,
    },
    bmr,
    baseKcal,
    exerciseKcal,
    isFloorApplied,
    isCarbsClamped,
  };
}

/**
 * 記録日Dに使う設定を選ぶ。effectiveFrom がD以前で最も新しいもの（基本設計書 5.3）。
 * D以前のものがなければ、最も古い設定を使う（初回より前の日を開いた場合）。
 */
export function pickPlan<T extends Pick<TargetPlan, 'effectiveFrom' | 'deleted'>>(
  plans: readonly T[],
  localDate: string,
): T | null {
  const alive = plans.filter((p) => p.deleted === 0).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  let picked: T | null = alive[0] ?? null;
  for (const p of alive) {
    if (p.effectiveFrom <= localDate) picked = p;
  }
  return picked;
}

/**
 * 記録日D以前で最も新しい体重（F-TGT-02）。D以前に1件もなければnull。
 */
export function pickWeight<T extends { date: string; deleted: 0 | 1 }>(logs: readonly T[], localDate: string): T | null {
  let picked: T | null = null;
  for (const log of logs) {
    if (log.deleted === 1 || log.date > localDate) continue;
    if (!picked || log.date > picked.date) picked = log;
  }
  return picked;
}

export { ageOn };
