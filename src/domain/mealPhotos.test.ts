import { describe, expect, it } from 'vitest';
import { findMergeTarget, hasPendingInput, legacyPhotoId, MAX_PHOTOS, migrateLegacyMeal } from './mealPhotos';
import type { MealPhoto, MealType } from './types';

const photo = (isPending = false): MealPhoto => ({ id: 'p', thumbnail: new ArrayBuffer(1), mimeType: 'image/jpeg', isPending, createdAt: 0 });

interface TestMeal {
  id: string;
  localDate: string;
  mealType: MealType;
  deleted: 0 | 1;
  eatenAt: number;
  photos: MealPhoto[];
}

const meal = (over: Partial<TestMeal> = {}): TestMeal => ({
  id: 'm1',
  localDate: '2026-11-14',
  mealType: 'dinner',
  deleted: 0,
  eatenAt: 100,
  photos: [photo()],
  ...over,
});

describe('写真を追加する先（F-REC-12）', () => {
  it('同じ記録日・同じ区分の、いちばん新しい食事を選ぶ', () => {
    const meals = [meal({ id: 'a', eatenAt: 100 }), meal({ id: 'b', eatenAt: 200 }), meal({ id: 'c', mealType: 'lunch', eatenAt: 300 })];
    expect(findMergeTarget(meals, '2026-11-14', 'dinner')?.id).toBe('b');
  });

  it('別の日・削除済み・写真が上限の食事は選ばない', () => {
    const full = Array.from({ length: MAX_PHOTOS }, () => photo());
    expect(findMergeTarget([meal({ localDate: '2026-11-13' })], '2026-11-14', 'dinner')).toBeNull();
    expect(findMergeTarget([meal({ deleted: 1 })], '2026-11-14', 'dinner')).toBeNull();
    expect(findMergeTarget([meal({ photos: full })], '2026-11-14', 'dinner')).toBeNull();
    // 写真が5枚ならまだ追加できる
    expect(findMergeTarget([meal({ photos: full.slice(1) })], '2026-11-14', 'dinner')).not.toBeNull();
  });

  it('写真のない食事（よく食べるもの・手入力）にも追加できる', () => {
    expect(findMergeTarget([meal({ photos: [] })], '2026-11-14', 'dinner')?.id).toBe('m1');
  });
});

describe('読み取り待ちの判定', () => {
  it('まだ読み取っていない食事、または追加した写真が読み取り待ちなら true', () => {
    expect(hasPendingInput({ status: 'pending', photos: [] })).toBe(true);
    expect(hasPendingInput({ status: 'done', photos: [photo(false), photo(true)] })).toBe(true);
    expect(hasPendingInput({ status: 'done', photos: [photo(false)] })).toBe(false);
  });
});

describe('版1の食事の移行（基本設計書 4.4）', () => {
  it('写真1枚を photos に移し、読み取り待ちの写真があれば読み取り待ちにする', () => {
    const r = migrateLegacyMeal({ id: 'x', status: 'pending', createdAt: 7, thumbnail: 'data:image/jpeg;base64,AA==' }, true, 'image/jpeg');
    expect(r).toEqual({
      id: 'x',
      status: 'pending',
      createdAt: 7,
      photos: [{ id: legacyPhotoId('x'), thumbnail: 'data:image/jpeg;base64,AA==', mimeType: 'image/jpeg', isPending: true, createdAt: 7 }],
    });
  });

  it('写真がない食事は空の配列、記録済みなら読み取り待ちにしない', () => {
    expect(migrateLegacyMeal({ id: 'y', status: 'done', thumbnail: null }, false, 'image/jpeg').photos).toEqual([]);
    const done = migrateLegacyMeal({ id: 'z', status: 'done', thumbnail: 'data:image/jpeg;base64,AA==' }, true, 'image/jpeg');
    expect((done.photos as MealPhoto[])[0]?.isPending).toBe(false);
  });
});
