import { describe, expect, it } from 'vitest';
import { checkAdviceResult, checkAnalyzeResult } from './aiResult';

const goodAdvice = {
  summary: '夕食は魚がおすすめ',
  categories: [{ category: 'fish', level: 'recommend', reason: 'たんぱく質' }],
  menus: [{ label: '案1', dishes: ['鮭の塩焼き'] }],
  points: [],
};

const goodItem = { name: '白ご飯', amount: 150, unit: 'g', kcal: 234, protein: 3.8, fat: 0.5, carbs: 55.7, fiber: 0.5, salt: 0 };

describe('AIの回答のチェック（基本設計書 5.8）', () => {
  it('正しい回答は通る', () => {
    const r = checkAnalyzeResult({ isFood: true, reason: '', items: [goodItem], advice: goodAdvice });
    expect(r.ok).toBe(true);
    if (r.ok && r.value.isFood) {
      expect(r.value.items[0]?.nutrients.kcal).toBe(234);
      expect(r.value.advice).toEqual(goodAdvice);
    }
  });

  it('料理でない場合は理由を返す', () => {
    const r = checkAnalyzeResult({ isFood: false, reason: '料理が写っていません', items: [], advice: '' });
    expect(r).toEqual({ ok: true, value: { isFood: false, reason: '料理が写っていません', advice: null } });
  });

  it('おすすめの形がおかしくても、推定の結果は通す（おすすめはnull）', () => {
    const r = checkAnalyzeResult({ isFood: true, reason: '', items: [goodItem], advice: { summary: '' } });
    expect(r.ok && r.value.advice).toBeNull();
  });

  it('料理なのに品目が0はエラー', () => {
    expect(checkAnalyzeResult({ isFood: true, items: [], advice: '' }).ok).toBe(false);
    // 記録済みの食事に写真を追加したときは、新しい料理がなくてもよい（F-REC-12）
    expect(checkAnalyzeResult({ isFood: true, items: [], advice: '' }, true).ok).toBe(true);
  });

  it('品目が21個以上はエラー', () => {
    expect(checkAnalyzeResult({ isFood: true, items: Array(21).fill(goodItem), advice: '' }).ok).toBe(false);
  });

  it('5,000kcalを超える品目はエラー。5,000ちょうどは通る', () => {
    expect(checkAnalyzeResult({ isFood: true, items: [{ ...goodItem, kcal: 5001 }], advice: '' }).ok).toBe(false);
    expect(checkAnalyzeResult({ isFood: true, items: [{ ...goodItem, kcal: 5000 }], advice: '' }).ok).toBe(true);
  });

  it('マイナスの値、量0、数字でない値はエラー', () => {
    expect(checkAnalyzeResult({ isFood: true, items: [{ ...goodItem, salt: -0.1 }], advice: '' }).ok).toBe(false);
    expect(checkAnalyzeResult({ isFood: true, items: [{ ...goodItem, amount: 0 }], advice: '' }).ok).toBe(false);
    expect(checkAnalyzeResult({ isFood: true, items: [{ ...goodItem, fat: '1' }], advice: '' }).ok).toBe(false);
  });

  it('食塩50g超・食物繊維100g超はエラー', () => {
    expect(checkAnalyzeResult({ isFood: true, items: [{ ...goodItem, salt: 50.1 }], advice: '' }).ok).toBe(false);
    expect(checkAnalyzeResult({ isFood: true, items: [{ ...goodItem, fiber: 100.1 }], advice: '' }).ok).toBe(false);
  });

  it('長い名前は40文字で切る', () => {
    const r = checkAnalyzeResult({ isFood: true, items: [{ ...goodItem, name: 'あ'.repeat(50) }], advice: '' });
    expect(r.ok && r.value.isFood && r.value.items[0]?.name.length).toBe(40);
  });

  it('形が違う回答はエラー', () => {
    expect(checkAnalyzeResult(null).ok).toBe(false);
    expect(checkAnalyzeResult({ items: [] }).ok).toBe(false);
  });

  it('おすすめのチェック', () => {
    expect(checkAdviceResult({ advice: goodAdvice })).toEqual({ ok: true, value: goodAdvice });
    expect(checkAdviceResult({ advice: '夕食は魚を' }).ok).toBe(false);
    expect(checkAdviceResult({ advice: { ...goodAdvice, categories: [], menus: [] } }).ok).toBe(false);
  });
});
