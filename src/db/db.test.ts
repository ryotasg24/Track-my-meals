import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { legacyPhotoId } from '../domain/mealPhotos';
import { exportBackup, restoreBackup } from './backup';
import { MealsDb } from './db';
import {
  addFavorite,
  addMeal,
  addPhotoToMeal,
  changeDayBoundary,
  removePhoto,
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

/** 保存する写真（中身は数バイトの仮のもの） */
const photo = (bytes: number[] = [1, 2, 3]) => ({
  thumbnail: new Uint8Array(bytes).buffer,
  image: new Uint8Array([...bytes, 0]).buffer,
  mimeType: 'image/jpeg',
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

  it('読み取り待ちの食事を完了すると、AIに送る写真が消えて記録済みになる', async () => {
    const d = open();
    dbs.push(d);
    const meal = await addMeal(
      d,
      { eatenAt: new Date('2026-11-08T01:30:00').getTime(), mealType: 'dinner', boundaryHour: 4, items: [item()], status: 'pending', photo: photo() },
      1,
    );
    expect(meal.localDate).toBe('2026-11-07');
    expect(meal.photos).toHaveLength(1);
    expect(meal.photos[0]?.isPending).toBe(true);
    expect(await d.photoImages.count()).toBe(1);
    await completeMealAnalysis(d, meal.id, meal.photos[0]!.id, [item({ id: 'i2', source: 'photo' })], { text: 'a', model: 'm', createdAt: 2 }, 2);
    const saved = await d.meals.get(meal.id);
    expect(saved?.status).toBe('done');
    expect(saved?.items).toHaveLength(2);
    expect(saved?.photos[0]?.isPending).toBe(false);
    expect(await d.photoImages.count()).toBe(0);
  });

  it('記録済みの食事に写真を追加すると、その写真だけが読み取り待ちになる（F-REC-12）', async () => {
    const d = open();
    dbs.push(d);
    const meal = await addMeal(d, { eatenAt: 0, mealType: 'dinner', boundaryHour: 4, items: [item()], status: 'done' }, 1);
    const photoId = await addPhotoToMeal(d, meal.id, { photo: photo(), items: [item({ id: 'i3' })] }, 2);
    const saved = await d.meals.get(meal.id);
    expect(saved?.status).toBe('done');
    expect(saved?.photos.map((p) => p.isPending)).toEqual([true]);
    expect(saved?.items).toHaveLength(2);
    expect(await d.photoImages.get(photoId!)).toBeDefined();
    await removePhoto(d, meal.id, photoId!, 3);
    expect((await d.meals.get(meal.id))?.photos).toHaveLength(0);
    expect(await d.photoImages.count()).toBe(0);
  });

  it('写真は1つの食事に6枚まで', async () => {
    const d = open();
    dbs.push(d);
    const meal = await addMeal(d, { eatenAt: 0, mealType: 'dinner', boundaryHour: 4, items: [], status: 'done' }, 1);
    for (let i = 0; i < 6; i++) expect(await addPhotoToMeal(d, meal.id, { photo: photo(), items: [] }, 2)).not.toBeNull();
    expect(await addPhotoToMeal(d, meal.id, { photo: photo(), items: [] }, 2)).toBeNull();
  });

  it('版1のデータベースを開くと、写真を新しい形に移す（基本設計書 4.4）', async () => {
    const name = `test-${++counter}`;
    const old = new Dexie(name);
    old.version(1).stores({
      meals: 'id, localDate, eatenAt, status, deleted',
      mealImages: 'mealId',
      favorites: 'id, useCount, deleted',
      weightLogs: 'id, date',
      activityLogs: 'id, localDate',
      reviews: 'id, localDate',
      targetPlans: 'id, effectiveFrom',
      settings: 'key',
      secrets: 'key',
      meta: 'key',
    });
    const base = { createdAt: 5, updatedAt: 5, deleted: 0, eatenAt: 0, localDate: '2026-11-07', mealType: 'dinner', inputText: null, items: [], advice: null };
    await old.table('meals').bulkPut([
      { ...base, id: 'done1', status: 'done', thumbnail: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }) },
      { ...base, id: 'pend1', status: 'pending', thumbnail: new Blob([new Uint8Array([2])], { type: 'image/jpeg' }) },
      { ...base, id: 'text1', status: 'pending', inputText: '牛丼', thumbnail: null },
    ]);
    await old.table('mealImages').put({ mealId: 'pend1', image: new Blob([new Uint8Array([9])], { type: 'image/jpeg' }) });
    old.close();

    const d = new MealsDb(name);
    dbs.push(d);
    const done1 = await d.meals.get('done1');
    expect(done1?.photos).toHaveLength(1);
    expect(done1?.photos[0]).toMatchObject({ id: legacyPhotoId('done1'), isPending: false, mimeType: 'image/jpeg', createdAt: 5 });
    expect('thumbnail' in (done1 ?? {})).toBe(false);
    expect((await d.meals.get('pend1'))?.photos[0]?.isPending).toBe(true);
    expect((await d.meals.get('text1'))?.photos).toEqual([]);
    const img = await d.photoImages.get(legacyPhotoId('pend1'));
    expect(img?.mealId).toBe('pend1');
    expect(d.tables.map((t) => t.name)).not.toContain('mealImages');
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
      { eatenAt: 0, mealType: 'lunch', boundaryHour: 4, items: [item()], status: 'pending', photo: photo([1, 2, 3]) },
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
    const thumb = meals[0]?.photos[0]?.thumbnail;
    expect(thumb).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(thumb as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    // 読み取り待ちの写真（AIに送る大きさ）も戻る
    expect(await dst.photoImages.count()).toBe(1);
    expect(await getApiKey(dst)).toBe('DST-KEY');
  });
});
