import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { exportBackup, restoreBackup } from './backup';
import { MealsDb } from './db';
import {
  addFavorite,
  addMeal,
  changeDayBoundary,
  completeMealAnalysis,
  initializeDb,
  saveApiKey,
  saveTargetPlan,
  DEFAULT_PLAN_VALUES,
  upsertWeight,
  getApiKey,
} from './repositories';
import type { MealItem } from '../domain/types';

let counter = 0;
const open = () => new MealsDb(`test-${++counter}`);
const dbs: MealsDb[] = [];
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete();
});

const item = (over: Partial<MealItem> = {}): MealItem => ({
  id: 'i1',
  name: '白ごはん',
  amount: 150,
  unit: 'g',
  nutrients: { kcal: 234, protein: 3.8, fat: 0.5, carbs: 55.7, fiber: 0.5, salt: 0 },
  source: 'manual',
  favoriteId: null,
  model: null,
  ...over,
});

describe('データの保存', () => {
  it('初回起動で設定が作られる', async () => {
    const d = open();
    dbs.push(d);
    await initializeDb(d, 100);
    const s = await d.settings.get('app');
    expect(s?.dayBoundaryHour).toBe(4);
    expect(s?.primaryModel).toBe('gemini-3.5-flash-lite');
  });

  it('読み取り待ちの食事を完了すると、写真が消えて記録済みになる', async () => {
    const d = open();
    dbs.push(d);
    const meal = await addMeal(
      d,
      { eatenAt: new Date('2026-11-08T01:30:00').getTime(), mealType: 'dinner', boundaryHour: 4, items: [item()], status: 'pending', pendingImage: new Blob(['x']) },
      1,
    );
    expect(meal.localDate).toBe('2026-11-07');
    expect(await d.mealImages.count()).toBe(1);
    await completeMealAnalysis(d, meal.id, [item({ id: 'i2', source: 'photo' })], { text: 'a', model: 'm', createdAt: 2 }, 2);
    const saved = await d.meals.get(meal.id);
    expect(saved?.status).toBe('done');
    expect(saved?.items).toHaveLength(2);
    expect(await d.mealImages.count()).toBe(0);
  });

  it('よく食べるものから記録すると使った回数が増える', async () => {
    const d = open();
    dbs.push(d);
    const fav = await addFavorite(d, { name: '味噌汁', amount: 1, unit: '杯', nutrients: item().nutrients }, 1);
    await addMeal(d, { eatenAt: 0, mealType: 'lunch', boundaryHour: 4, items: [item({ favoriteId: fav.id })], status: 'done' }, 5);
    expect((await d.favorites.get(fav.id))?.useCount).toBe(1);
  });

  it('記録日の区切りを変えると、記録日を計算し直す', async () => {
    const d = open();
    dbs.push(d);
    await initializeDb(d, 0);
    const meal = await addMeal(d, { eatenAt: new Date('2026-11-08T01:30:00').getTime(), mealType: 'dinner', boundaryHour: 4, items: [], status: 'done' }, 1);
    await changeDayBoundary(d, 0, 2);
    expect((await d.meals.get(meal.id))?.localDate).toBe('2026-11-08');
  });

  it('同じ日の体重と目標の設定は上書きする', async () => {
    const d = open();
    dbs.push(d);
    await upsertWeight(d, '2026-11-07', 70, 1);
    await upsertWeight(d, '2026-11-07', 69.5, 2);
    expect(await d.weightLogs.count()).toBe(1);
    await saveTargetPlan(d, '2026-11-07', DEFAULT_PLAN_VALUES, 1);
    await saveTargetPlan(d, '2026-11-07', { ...DEFAULT_PLAN_VALUES, goal: 'keep' }, 2);
    expect(await d.targetPlans.count()).toBe(1);
  });
});

describe('バックアップと復元（基本設計書 4.5）', () => {
  it('写真を含めて書き出し・復元でき、APIキーは含めずに残す', async () => {
    const src = open();
    const dst = open();
    dbs.push(src, dst);
    await initializeDb(src, 0);
    await saveApiKey(src, 'SECRET-KEY', null);
    await addMeal(
      src,
      { eatenAt: 0, mealType: 'lunch', boundaryHour: 4, items: [item()], status: 'done', thumbnail: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }) },
      1,
    );
    const file = await exportBackup(src, 10);
    const json = JSON.parse(JSON.stringify(file));
    expect(JSON.stringify(json)).not.toContain('SECRET-KEY');

    await initializeDb(dst, 0);
    await saveApiKey(dst, 'DST-KEY', null);
    await restoreBackup(dst, json);
    const meals = await dst.meals.toArray();
    expect(meals).toHaveLength(1);
    const thumb = meals[0]?.thumbnail;
    expect(thumb).toBeInstanceOf(Blob);
    expect(new Uint8Array(await thumb!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(await getApiKey(dst)).toBe('DST-KEY');
  });
});
