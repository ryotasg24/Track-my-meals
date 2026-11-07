/**
 * 食事の区分（要件定義書 F-REC-06、基本設計書 5.2）。
 */
import { format } from 'date-fns';
import type { MealType, MealTypeStarts } from './types';

export const DEFAULT_MEAL_TYPE_STARTS: MealTypeStarts = {
  breakfast: '04:00',
  lunch: '11:00',
  snack: '15:00',
  dinner: '17:00',
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  snack: '間食',
  dinner: '夕食',
};

/** 1日の中での並び順（朝食→昼食→間食→夕食） */
export const MEAL_TYPE_ORDER: readonly MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/** HH:mm を、0時からの分に直す */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/**
 * 食べた時刻から区分を決める。開始時刻が最も遅い区分のうち、時刻がその開始以降のものを選ぶ。
 * どの開始時刻より前（例：2時）は、最後の区分（夕食）の続きとして扱う。
 * @param ms 食べた時刻
 * @param starts 区分の開始時刻
 */
export function mealTypeAt(ms: number, starts: MealTypeStarts): MealType {
  const minutes = toMinutes(format(ms, 'HH:mm'));
  const sorted = MEAL_TYPE_ORDER.map((type) => ({ type, start: toMinutes(starts[type]) })).sort(
    (a, b) => a.start - b.start,
  );
  let result = sorted[sorted.length - 1]!.type;
  for (const s of sorted) {
    if (minutes >= s.start) result = s.type;
  }
  return result;
}

/**
 * 今日の記録日のうち、まだ来ていない区分（AIへの「残っている区分」。基本設計書 6.3）。
 * @param current 今の区分
 */
export function remainingMealTypes(current: MealType): MealType[] {
  const index = MEAL_TYPE_ORDER.indexOf(current);
  return MEAL_TYPE_ORDER.slice(index + 1);
}
