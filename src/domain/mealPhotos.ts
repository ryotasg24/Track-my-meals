/**
 * 食事の写真（複数）と、同じ区分の食事へのまとめ方（要件定義書 F-REC-11、12、基本設計書 4.3、5.15）。
 */
import type { Meal, MealType, PhotoData } from './types';

/** 1つの食事に付けられる写真の上限 */
export const MAX_PHOTOS = 6;

/** 読み取り待ちのもの（まだ読み取っていない食事、または追加した写真）があるか */
export function hasPendingInput(meal: Pick<Meal, 'status' | 'photos'>): boolean {
  return meal.status === 'pending' || meal.photos.some((p) => p.isPending);
}

/**
 * 写真を追加する先の食事を探す（F-REC-12）。同じ記録日・同じ区分の、削除していない食事のうち、
 * 写真が上限に達していない、いちばん新しいもの。
 * @returns 見つからなければnull（新しい食事として記録する）
 */
export function findMergeTarget<T extends Pick<Meal, 'id' | 'localDate' | 'mealType' | 'deleted' | 'eatenAt' | 'photos'>>(
  meals: readonly T[],
  localDate: string,
  mealType: MealType,
): T | null {
  const candidates = meals
    .filter((m) => m.deleted === 0 && m.localDate === localDate && m.mealType === mealType && m.photos.length < MAX_PHOTOS)
    .sort((a, b) => b.eatenAt - a.eatenAt);
  return candidates[0] ?? null;
}

/** 版1の写真（1枚）を移したときの写真のID。データベースの移行とバックアップの移行で同じ値にする */
export function legacyPhotoId(mealId: string): string {
  return `${mealId}-photo-1`;
}

/**
 * 版1の食事（thumbnail が1枚）を、版2の形（photos）に直す（基本設計書 4.4）。
 * 写真のデータの形（Blob、データURLの文字列）はそのまま移す。
 * @param hasPendingImage 読み取り待ちの写真（AIに送る大きさ）があるか
 */
export function migrateLegacyMeal<T>(
  meal: Record<string, unknown> & { id: string; thumbnail?: T | null; createdAt?: number },
  hasPendingImage: boolean,
  mimeType: string,
): Record<string, unknown> {
  const { thumbnail, ...rest } = meal;
  const photos =
    thumbnail != null
      ? [
          {
            id: legacyPhotoId(meal.id),
            thumbnail,
            mimeType,
            isPending: hasPendingImage && meal.status === 'pending',
            createdAt: typeof meal.createdAt === 'number' ? meal.createdAt : 0,
          },
        ]
      : [];
  return { ...rest, photos };
}

/** 保存した写真のデータを、表示・送信に使えるBlobにする（毎回メモリ上で作るため、iPhoneでも表示できる） */
export function photoBlob(data: PhotoData, mimeType: string): Blob {
  return data instanceof Blob ? data : new Blob([data], { type: mimeType || 'image/jpeg' });
}
