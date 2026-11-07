/**
 * AIへの指示文と回答の形（基本設計書 6.3）。指示文はこのファイルにまとめる（要件定義書 5章 保守性）。
 * 名前・ニックネーム・生年月日などの個人の情報は送らない（要件定義書 1.3 方針4）。
 */
import { MEAL_TYPE_LABELS } from '../domain/mealType';
import { formatNutrient } from '../domain/nutrition';
import type { MealType, Nutrients } from '../domain/types';

export const SYSTEM_INSTRUCTION = [
  'あなたは食事管理アプリのアシスタントです。必ず日本語で答えてください。',
  '栄養価は、日本の一般的な料理・市販品の値を目安に推定してください。',
  '提案は一般的な食事の目安にとどめ、病気の治療や医療に関する助言はしないでください。',
  '親しみやすく前向きな言葉で、短くわかりやすく書いてください。',
].join('\n');

/** analyzeMeal の回答の形 */
export const ANALYZE_SCHEMA = {
  type: 'object',
  properties: {
    isFood: { type: 'boolean' },
    reason: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'number' },
          unit: { type: 'string' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          fat: { type: 'number' },
          carbs: { type: 'number' },
          fiber: { type: 'number' },
          salt: { type: 'number' },
        },
        required: ['name', 'amount', 'unit', 'kcal', 'protein', 'fat', 'carbs', 'fiber', 'salt'],
      },
    },
    advice: { type: 'string' },
  },
  required: ['isFood', 'reason', 'items', 'advice'],
};

/** writeAdvice の回答の形 */
export const ADVICE_SCHEMA = {
  type: 'object',
  properties: { advice: { type: 'string' } },
  required: ['advice'],
};

/** 栄養価6項目を1行にする。例：カロリー1,250kcal、たんぱく質38g、… */
function nutrientLine(n: Nutrients): string {
  return (
    `カロリー${formatNutrient('kcal', n.kcal)}kcal、たんぱく質${formatNutrient('protein', n.protein)}g、` +
    `脂質${formatNutrient('fat', n.fat)}g、炭水化物${formatNutrient('carbs', n.carbs)}g、` +
    `食物繊維${formatNutrient('fiber', n.fiber)}g、食塩相当量${formatNutrient('salt', n.salt)}g`
  );
}

/** 目標の1行（食物繊維は以上、食塩は未満） */
function targetLine(t: Nutrients): string {
  return (
    `カロリー${formatNutrient('kcal', t.kcal)}kcal、たんぱく質${formatNutrient('protein', t.protein)}g、` +
    `脂質${formatNutrient('fat', t.fat)}g、炭水化物${formatNutrient('carbs', t.carbs)}g、` +
    `食物繊維${formatNutrient('fiber', t.fiber)}g以上、食塩相当量${formatNutrient('salt', t.salt)}g未満`
  );
}

export interface DayContext {
  /** 今日の目標（体重がなく計算できない場合はnull） */
  target: Nutrients | null;
  /** この食事より前（または保存後）の今日の摂取量 */
  intake: Nutrients;
  /** 食べた時刻（H:mm）と区分 */
  time: string;
  mealType: MealType;
  remaining: MealType[];
  preferences: string;
}

function contextLines(c: DayContext, intakeLabel: string): string[] {
  const lines = [
    `状況：${MEAL_TYPE_LABELS[c.mealType]}（${c.time}）。`,
    c.target ? `今日の目標：${targetLine(c.target)}。` : '今日の目標：未設定。',
    `${intakeLabel}：${nutrientLine(c.intake)}。`,
    `今日これから残っている食事：${c.remaining.length ? c.remaining.map((t) => MEAL_TYPE_LABELS[t]).join('、') : 'なし（明日の朝食）'}。`,
  ];
  if (c.preferences.trim()) lines.push(`好み・事情：${c.preferences.trim()}。`);
  return lines;
}

/** 写真・文章から推定し、同時におすすめを作る指示（analyzeMeal） */
export function buildAnalyzePrompt(c: DayContext, inputText: string | null): string {
  return [
    '食事の写真（または文章）から、品目ごとに名前・量・単位と、栄養価（kcal、たんぱく質g、脂質g、炭水化物g、食物繊維g、食塩相当量g）を推定してください。',
    '量は写真の器の大きさなどから推定し、単位は g、ml、杯、個、枚、本、皿、人前 などを使ってください。',
    '料理や食品が含まれていない場合は isFood を false にし、reason に理由を書き、items は空にしてください。',
    ...contextLines(c, 'この食事より前の今日の摂取量'),
    'advice には、この食事を含めた今日の摂取量を踏まえて、次の食事のおすすめを書いてください。不足している栄養素・控えるべき栄養素と、具体的な献立の例を2〜3案、400文字程度で。',
    inputText ? `食事の内容（利用者が入力した文章）：${inputText}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** よく食べるもの・手入力で記録したあとの、次の食事のおすすめ */
export function buildNextMealPrompt(c: DayContext): string {
  return [
    ...contextLines(c, '今日のこれまでの摂取量'),
    '次の食事のおすすめを advice に書いてください。不足している栄養素・控えるべき栄養素と、具体的な献立の例を2〜3案、400文字程度で。',
  ].join('\n');
}

export interface DayReviewContext {
  /** ふりかえる記録日の目標・摂取量 */
  target: Nutrients | null;
  intake: Nutrients;
  /** その日の品目名の一覧 */
  itemNames: string[];
  /** today：前日のふりかえりから「今日の調整案」、tomorrow：今日をしめるから「明日の調整案」 */
  forDay: 'today' | 'tomorrow';
  preferences: string;
}

/** ふりかえりと調整案（F-ADV-02、03） */
export function buildReviewPrompt(c: DayReviewContext): string {
  const label = c.forDay === 'today' ? '前日' : '今日';
  const next = c.forDay === 'today' ? '今日' : '明日';
  return [
    `${label}の食事のふりかえりです。`,
    c.target ? `${label}の目標：${targetLine(c.target)}。` : `${label}の目標：未設定。`,
    `${label}の摂取量：${nutrientLine(c.intake)}。`,
    `${label}食べたもの：${c.itemNames.length ? c.itemNames.join('、') : '記録なし'}。`,
    c.preferences.trim() ? `好み・事情：${c.preferences.trim()}。` : '',
    `advice に、${label}の良かった点と課題を短くまとめ、${next}の食事の調整案（朝・昼・夕の具体的な献立の例を含む）を600文字程度で書いてください。`,
  ]
    .filter(Boolean)
    .join('\n');
}
