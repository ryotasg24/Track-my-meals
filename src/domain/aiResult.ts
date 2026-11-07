/**
 * AIの回答のチェック（要件定義書 F-AI-06、基本設計書 5.8）。
 * AIの回答の形の指定では文字数などの細かい条件が無視されるため、保存する前に必ずここを通す。
 */
import { checkAdviceContent, type AdviceContent } from './advice';
import type { Nutrients } from './types';

/** AIが推定した品目 */
export interface AiItem {
  name: string;
  amount: number;
  unit: string;
  nutrients: Nutrients;
}

/** analyzeMeal の回答（基本設計書 6.3） */
export type AnalyzeResult =
  | { isFood: true; items: AiItem[]; advice: AdviceContent | null }
  | { isFood: false; reason: string; advice: AdviceContent | null };

export type CheckResult<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_ITEMS = 20;
const MAX_NAME = 40;

/** 1品目の値の上限（基本設計書 5.8） */
const LIMITS: Record<keyof Nutrients, number> = {
  kcal: 5000,
  protein: 500,
  fat: 500,
  carbs: 500,
  fiber: 100,
  salt: 50,
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * analyzeMeal の回答（JSONを読んだ結果）をチェックする。
 * 名前が長すぎる場合はエラーにせず40文字で切る。
 */
export function checkAnalyzeResult(json: unknown): CheckResult<AnalyzeResult> {
  if (!isObject(json) || typeof json.isFood !== 'boolean') return { ok: false, error: '回答の形が違います' };
  // おすすめの形がおかしくても、推定の結果は使う（おすすめは数値の一覧で代わりに表示する）
  const advice = checkAdviceContent(json.advice);

  if (!json.isFood) {
    const reason = typeof json.reason === 'string' && json.reason.trim() ? json.reason.trim() : '料理が見つかりませんでした';
    return { ok: true, value: { isFood: false, reason, advice } };
  }

  if (!Array.isArray(json.items)) return { ok: false, error: '品目がありません' };
  if (json.items.length === 0 || json.items.length > MAX_ITEMS) return { ok: false, error: '品目の数がおかしいです' };

  const items: AiItem[] = [];
  for (const raw of json.items) {
    if (!isObject(raw)) return { ok: false, error: '品目の形が違います' };
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) return { ok: false, error: '品目の名前がありません' };
    if (!isNum(raw.amount) || raw.amount <= 0) return { ok: false, error: '量がおかしいです' };
    const unit = typeof raw.unit === 'string' && raw.unit.trim() ? raw.unit.trim().slice(0, 10) : '人前';
    const nutrients = {} as Nutrients;
    for (const key of Object.keys(LIMITS) as (keyof Nutrients)[]) {
      const v = raw[key];
      if (!isNum(v) || v < 0 || v > LIMITS[key]) return { ok: false, error: `${name}の値がおかしいです` };
      nutrients[key] = v;
    }
    items.push({ name: name.slice(0, MAX_NAME), amount: raw.amount, unit, nutrients });
  }
  return { ok: true, value: { isFood: true, items, advice } };
}

/** writeAdvice の回答（{ advice: おすすめ }）をチェックする */
export function checkAdviceResult(json: unknown): CheckResult<AdviceContent> {
  const advice = isObject(json) ? checkAdviceContent(json.advice) : null;
  return advice ? { ok: true, value: advice } : { ok: false, error: '回答の形が違います' };
}
