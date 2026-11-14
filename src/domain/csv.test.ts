import { describe, expect, it } from 'vitest';
import { buildMealsCsv } from './csv';
import type { Meal } from './types';

const meal = (over: Partial<Meal>): Meal => ({
  id: 'm',
  createdAt: 0,
  updatedAt: 0,
  deleted: 0,
  eatenAt: new Date('2026-11-07T12:30:00').getTime(),
  localDate: '2026-11-07',
  mealType: 'lunch',
  status: 'done',
  inputText: null,
  photos: [],
  advice: null,
  items: [
    {
      id: 'i',
      name: '牛丼（並盛）',
      amount: 1,
      unit: '杯',
      nutrients: { kcal: 733.4, protein: 23.14, fat: 24.8, carbs: 101.4, fiber: 2.1, salt: 3.04 },
      source: 'photo',
      favoriteId: null,
      model: null,
    },
  ],
  ...over,
});

describe('CSV（基本設計書 4.6）', () => {
  it('BOM付きで、1行が1品目', () => {
    const csv = buildMealsCsv([meal({})]);
    expect(csv.startsWith('﻿記録日,')).toBe(true);
    expect(csv).toContain('2026-11-07,2026-11-07 12:30,昼食,牛丼（並盛）,1,杯,733,23.1,24.8,101.4,2.1,3.0,写真');
  });

  it('削除済み・読み取り待ちは含めない。カンマを含む名前は囲む', () => {
    const csv = buildMealsCsv([
      meal({ deleted: 1 }),
      meal({ status: 'pending' }),
      meal({ items: [{ ...meal({}).items[0]!, name: 'A,B' }] }),
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"A,B"');
  });
});
