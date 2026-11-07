/**
 * CSVの書き出し（要件定義書 F-DATA-07、基本設計書 4.6）。1行が1品目。
 * Excelで文字化けしないよう、このCSVファイルに限りBOMを付ける。
 */
import { format } from 'date-fns';
import { MEAL_TYPE_LABELS } from './mealType';
import type { ItemSource, Meal } from './types';

const SOURCE_LABELS: Record<ItemSource, string> = {
  photo: '写真',
  text: '文章',
  favorite: 'よく食べるもの',
  manual: '手入力',
};

const HEADER = [
  '記録日',
  '食べた日時',
  '区分',
  '品目',
  '量',
  '単位',
  'カロリー（kcal）',
  'たんぱく質（g）',
  '脂質（g）',
  '炭水化物（g）',
  '食物繊維（g）',
  '食塩相当量（g）',
  '記録の方法',
];

/** カンマ・改行・ダブルクォートを含む値を、CSVの決まりどおりに囲む */
function cell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const one = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

/** 食事の記録をCSVにする。削除済みと読み取り待ちは含めない */
export function buildMealsCsv(meals: readonly Meal[]): string {
  const rows = [HEADER.map(cell).join(',')];
  const sorted = meals.filter((m) => m.deleted === 0 && m.status === 'done').sort((a, b) => a.eatenAt - b.eatenAt);
  for (const m of sorted) {
    for (const item of m.items) {
      const n = item.nutrients;
      rows.push(
        [
          m.localDate,
          format(m.eatenAt, 'yyyy-MM-dd HH:mm'),
          MEAL_TYPE_LABELS[m.mealType],
          item.name,
          Math.round(item.amount * 10) / 10,
          item.unit,
          Math.round(n.kcal),
          one(n.protein),
          one(n.fat),
          one(n.carbs),
          one(n.fiber),
          one(n.salt),
          SOURCE_LABELS[item.source],
        ]
          .map(cell)
          .join(','),
      );
    }
  }
  return '﻿' + rows.join('\r\n') + '\r\n';
}
