import { describe, expect, it } from 'vitest';
import { DEFAULT_MEAL_TYPE_STARTS, mealTypeAt, remainingMealTypes } from './mealType';

const at = (hhmm: string) => new Date(`2026-11-07T${hhmm}:00`).getTime();

describe('食事の区分（基本設計書 5.2）', () => {
  it('時刻から区分を決める', () => {
    expect(mealTypeAt(at('07:30'), DEFAULT_MEAL_TYPE_STARTS)).toBe('breakfast');
    expect(mealTypeAt(at('10:59'), DEFAULT_MEAL_TYPE_STARTS)).toBe('breakfast');
    expect(mealTypeAt(at('11:00'), DEFAULT_MEAL_TYPE_STARTS)).toBe('lunch');
    expect(mealTypeAt(at('15:30'), DEFAULT_MEAL_TYPE_STARTS)).toBe('snack');
    expect(mealTypeAt(at('23:30'), DEFAULT_MEAL_TYPE_STARTS)).toBe('dinner');
  });

  it('区切りより前の深夜は夕食', () => {
    expect(mealTypeAt(at('02:00'), DEFAULT_MEAL_TYPE_STARTS)).toBe('dinner');
    expect(mealTypeAt(at('03:59'), DEFAULT_MEAL_TYPE_STARTS)).toBe('dinner');
  });

  it('残っている区分', () => {
    expect(remainingMealTypes('lunch')).toEqual(['snack', 'dinner']);
    expect(remainingMealTypes('dinner')).toEqual([]);
  });
});
