/**
 * データの読み書き（基本設計書 4章）。画面からはここの関数だけを使う。
 * 時刻（now）は引数で受け取る。複数のテーブルを変える処理は1つのトランザクションで行う。
 */
import type { AdviceContent } from '../domain/advice';
import { toRecordDate } from '../domain/date';
import { MAX_PHOTOS } from '../domain/mealPhotos';
import { DEFAULT_MEAL_TYPE_STARTS } from '../domain/mealType';
import { DEFAULT_TARGET_PLAN } from '../domain/target';
import type {
  Advice,
  Favorite,
  Meal,
  MealItem,
  MealPhoto,
  MealType,
  Nutrients,
  PhotoImage,
  Settings,
  TargetPlan,
} from '../domain/types';
import type { ModelCooldown } from '../domain/quota';
import type { MealsDb } from './db';

export const newId = (): string => crypto.randomUUID();

const sync = (now: number) => ({ id: newId(), createdAt: now, updatedAt: now, deleted: 0 as const });

// ---------- 設定 ----------

export const DEFAULT_SETTINGS: Omit<Settings, 'updatedAt'> = {
  key: 'app',
  nickname: '',
  sex: null,
  birthDate: null,
  heightCm: null,
  dayBoundaryHour: 4,
  mealTypeStarts: DEFAULT_MEAL_TYPE_STARTS,
  primaryModel: 'gemini-3.5-flash-lite',
  fallbackModel: 'gemini-3.8-flash',
  advicePreferences: '',
  healthEnabled: true,
  shortcutName: 'ごはんくんにアクティブエネルギーを渡す',
  backupReminderDays: 7,
  weightReminderDays: 7,
  onboardingDone: false,
};

/** 初回起動の準備。設定と初回起動の時刻がなければ作る */
export async function initializeDb(database: MealsDb, now: number): Promise<void> {
  await database.transaction('rw', [database.settings, database.meta], async () => {
    if (!(await database.settings.get('app'))) {
      await database.settings.put({ ...DEFAULT_SETTINGS, updatedAt: now });
    }
    if (!(await database.meta.get('firstLaunchAt'))) {
      await database.meta.put({ key: 'firstLaunchAt', value: now });
    }
    if (!(await database.meta.get('schemaVersion'))) {
      await database.meta.put({ key: 'schemaVersion', value: 1 });
    }
  });
}

export async function updateSettings(database: MealsDb, patch: Partial<Omit<Settings, 'key'>>, now: number): Promise<void> {
  await database.settings.update('app', { ...patch, updatedAt: now });
}

/**
 * 記録日の区切りの時刻を変える。食事の記録日を全件計算し直す（基本設計書 5.1）。
 */
export async function changeDayBoundary(database: MealsDb, hour: number, now: number): Promise<void> {
  await database.transaction('rw', [database.settings, database.meals], async () => {
    await database.settings.update('app', { dayBoundaryHour: hour, updatedAt: now });
    await database.meals.toCollection().modify((m) => {
      m.localDate = toRecordDate(m.eatenAt, hour);
    });
  });
}

// ---------- APIキー（バックアップに含めない） ----------

export async function getApiKey(database: MealsDb): Promise<string | null> {
  return (await database.secrets.get('gemini'))?.apiKey ?? null;
}

export async function saveApiKey(database: MealsDb, apiKey: string, verifiedAt: number | null): Promise<void> {
  await database.secrets.put({ key: 'gemini', apiKey, verifiedAt });
}

export async function deleteApiKey(database: MealsDb): Promise<void> {
  await database.secrets.delete('gemini');
}

// ---------- 管理用の値 ----------

export async function getMeta<T>(database: MealsDb, key: string): Promise<T | null> {
  return ((await database.meta.get(key))?.value as T | undefined) ?? null;
}

export async function setMeta(database: MealsDb, key: string, value: unknown): Promise<void> {
  await database.meta.put({ key, value });
}

export async function getModelCooldown(database: MealsDb): Promise<ModelCooldown> {
  return (await getMeta<ModelCooldown>(database, 'modelCooldown')) ?? {};
}

// ---------- 食事 ----------

/** 保存する写真（バイト列にしたもの） */
export interface NewPhoto {
  /** 縮小した写真（長い辺320px） */
  thumbnail: ArrayBuffer;
  /** AIに送る大きさの写真（長い辺1024px）。読み取り待ちのあいだだけ保存する */
  image: ArrayBuffer;
  mimeType: string;
}

export interface NewMealInput {
  eatenAt: number;
  mealType: MealType;
  boundaryHour: number;
  items: MealItem[];
  status: Meal['status'];
  inputText?: string | null;
  /** 写真（読み取り待ちとして保存する） */
  photo?: NewPhoto | null;
}

function pendingPhoto(photo: NewPhoto, now: number): MealPhoto {
  return { id: newId(), thumbnail: photo.thumbnail, mimeType: photo.mimeType, isPending: true, createdAt: now };
}

/** 食事を新しく保存する。写真があれば、読み取り待ちの写真も同じトランザクションで保存する */
export async function addMeal(database: MealsDb, input: NewMealInput, now: number): Promise<Meal> {
  const photo = input.photo ? pendingPhoto(input.photo, now) : null;
  const meal: Meal = {
    ...sync(now),
    eatenAt: input.eatenAt,
    localDate: toRecordDate(input.eatenAt, input.boundaryHour),
    mealType: input.mealType,
    status: input.status,
    inputText: input.inputText ?? null,
    photos: photo ? [photo] : [],
    items: input.items,
    advice: null,
  };
  await database.transaction('rw', [database.meals, database.photoImages, database.favorites], async () => {
    await database.meals.add(meal);
    if (photo && input.photo) {
      await database.photoImages.put({ photoId: photo.id, mealId: meal.id, image: input.photo.image, mimeType: input.photo.mimeType });
    }
    await countFavoriteUse(database, input.items, now);
  });
  return meal;
}

/**
 * 記録済みの食事に写真を追加する（F-REC-12）。写真は読み取り待ちにする。
 * 先に追加した品目（よく食べるもの・手入力）があれば、同じ食事の品目に加える。
 * @returns 追加した写真のID。食事がない・写真が上限に達している場合はnull
 */
export async function addPhotoToMeal(
  database: MealsDb,
  mealId: string,
  input: { photo: NewPhoto; items: MealItem[] },
  now: number,
): Promise<string | null> {
  return database.transaction('rw', [database.meals, database.photoImages, database.favorites], async () => {
    const meal = await database.meals.get(mealId);
    if (!meal || meal.deleted === 1 || meal.photos.length >= MAX_PHOTOS) return null;
    const photo = pendingPhoto(input.photo, now);
    await database.meals.update(mealId, { photos: [...meal.photos, photo], items: [...meal.items, ...input.items], updatedAt: now });
    await database.photoImages.put({ photoId: photo.id, mealId, image: input.photo.image, mimeType: input.photo.mimeType });
    await countFavoriteUse(database, input.items, now);
    return photo.id;
  });
}

/** よく食べるものの使った回数を増やす（F-FAV-03） */
async function countFavoriteUse(database: MealsDb, items: readonly MealItem[], now: number): Promise<void> {
  for (const item of items) {
    if (!item.favoriteId) continue;
    await database.favorites
      .where('id')
      .equals(item.favoriteId)
      .modify((f) => {
        f.useCount += 1;
        f.lastUsedAt = now;
      });
  }
}

/**
 * 読み取りが終わったら、品目を加えて記録済みにする（基本設計書 6.4）。
 * 読み取った写真は読み取り待ちを外し、AIに送る大きさの写真を消す。
 * @param photoId 読み取った写真（文章だけの場合はnull）
 */
export async function completeMealAnalysis(
  database: MealsDb,
  mealId: string,
  photoId: string | null,
  aiItems: MealItem[],
  advice: Advice | null,
  now: number,
): Promise<void> {
  await database.transaction('rw', [database.meals, database.photoImages], async () => {
    const meal = await database.meals.get(mealId);
    if (!meal) return;
    await database.meals.update(mealId, {
      items: [...meal.items, ...aiItems],
      photos: meal.photos.map((p) => (p.id === photoId ? { ...p, isPending: false } : p)),
      status: 'done',
      advice: advice ?? meal.advice,
      updatedAt: now,
    });
    if (photoId) await database.photoImages.delete(photoId);
  });
}

/** 食事から写真を1枚外す（料理が写っていなかった追加の写真、または利用者が削除した写真）。品目はそのまま */
export async function removePhoto(database: MealsDb, mealId: string, photoId: string, now: number): Promise<void> {
  await database.transaction('rw', [database.meals, database.photoImages], async () => {
    const meal = await database.meals.get(mealId);
    if (meal) await database.meals.update(mealId, { photos: meal.photos.filter((p) => p.id !== photoId), updatedAt: now });
    await database.photoImages.delete(photoId);
  });
}

/** 料理が読み取れなかった食事を消す（F-AI-03：保存しない） */
export async function discardMeal(database: MealsDb, mealId: string): Promise<void> {
  await database.transaction('rw', [database.meals, database.photoImages], async () => {
    await database.meals.delete(mealId);
    await database.photoImages.where('mealId').equals(mealId).delete();
  });
}

/** 読み取り待ちの写真（AIに送る大きさ）を読む */
export async function getPhotoImage(database: MealsDb, photoId: string): Promise<PhotoImage | null> {
  return (await database.photoImages.get(photoId)) ?? null;
}

/** 食事を編集する。日時を変えたら記録日も計算し直す */
export async function updateMeal(
  database: MealsDb,
  mealId: string,
  patch: { eatenAt?: number; mealType?: MealType; items?: MealItem[] },
  boundaryHour: number,
  now: number,
): Promise<void> {
  const changes: Partial<Meal> = { ...patch, updatedAt: now };
  if (patch.eatenAt !== undefined) changes.localDate = toRecordDate(patch.eatenAt, boundaryHour);
  await database.meals.update(mealId, changes);
}

export async function setMealAdvice(database: MealsDb, mealId: string, advice: Advice, now: number): Promise<void> {
  await database.meals.update(mealId, { advice, updatedAt: now });
}

/** 食事を削除する（削除済みの印を付ける。読み取り待ちの写真は消す） */
export async function deleteMeal(database: MealsDb, mealId: string, now: number): Promise<void> {
  await database.transaction('rw', [database.meals, database.photoImages], async () => {
    await database.meals.update(mealId, { deleted: 1, updatedAt: now });
    await database.photoImages.where('mealId').equals(mealId).delete();
  });
}

// ---------- よく食べるもの ----------

export interface FavoriteInput {
  name: string;
  amount: number;
  unit: string;
  nutrients: Nutrients;
}

export async function addFavorite(database: MealsDb, input: FavoriteInput, now: number): Promise<Favorite> {
  const fav: Favorite = { ...sync(now), ...input, useCount: 0, lastUsedAt: null };
  await database.favorites.add(fav);
  return fav;
}

export async function updateFavorite(database: MealsDb, id: string, input: FavoriteInput, now: number): Promise<void> {
  await database.favorites.update(id, { ...input, updatedAt: now });
}

export async function deleteFavorite(database: MealsDb, id: string, now: number): Promise<void> {
  await database.favorites.update(id, { deleted: 1, updatedAt: now });
}

// ---------- 体重・アクティブエネルギー・ふりかえり ----------

/** 体重を記録する。同じ日付は上書きする（F-WGT-01） */
export async function upsertWeight(database: MealsDb, date: string, weightKg: number, now: number): Promise<void> {
  await database.transaction('rw', database.weightLogs, async () => {
    const existing = (await database.weightLogs.where('date').equals(date).toArray()).find((w) => w.deleted === 0);
    if (existing) await database.weightLogs.update(existing.id, { weightKg, updatedAt: now });
    else await database.weightLogs.add({ ...sync(now), date, weightKg });
  });
}

export async function deleteWeight(database: MealsDb, id: string, now: number): Promise<void> {
  await database.weightLogs.update(id, { deleted: 1, updatedAt: now });
}

/** アクティブエネルギーを記録する。同じ記録日は上書きする（F-HLT-01） */
export async function upsertActivity(
  database: MealsDb,
  localDate: string,
  activeKcal: number,
  source: 'shortcut' | 'manual',
  now: number,
): Promise<void> {
  await database.transaction('rw', database.activityLogs, async () => {
    const existing = (await database.activityLogs.where('localDate').equals(localDate).toArray()).find((a) => a.deleted === 0);
    if (existing) await database.activityLogs.update(existing.id, { activeKcal, source, updatedAt: now });
    else await database.activityLogs.add({ ...sync(now), localDate, activeKcal, source });
  });
}

export async function deleteActivity(database: MealsDb, localDate: string, now: number): Promise<void> {
  await database.activityLogs.where('localDate').equals(localDate).modify({ deleted: 1, updatedAt: now });
}

/** ふりかえりを保存する。同じ記録日は上書きする */
export async function upsertReview(
  database: MealsDb,
  localDate: string,
  text: string,
  content: AdviceContent,
  model: string,
  now: number,
): Promise<void> {
  await database.transaction('rw', database.reviews, async () => {
    const existing = (await database.reviews.where('localDate').equals(localDate).toArray()).find((r) => r.deleted === 0);
    if (existing) await database.reviews.update(existing.id, { text, content, model, updatedAt: now });
    else await database.reviews.add({ ...sync(now), localDate, kind: 'nextDay', text, content, model });
  });
}

// ---------- 目標の設定 ----------

export type TargetPlanValues = Omit<TargetPlan, keyof import('../domain/types').SyncFields | 'effectiveFrom'>;

export const DEFAULT_PLAN_VALUES: TargetPlanValues = {
  ...DEFAULT_TARGET_PLAN,
  overrides: { kcal: null, protein: null, fat: null, carbs: null, fiber: null, salt: null },
};

/**
 * 目標の設定を保存する。変えた日の記録日から使う。同じ記録日の行は上書きする（基本設計書 4.3）。
 */
export async function saveTargetPlan(database: MealsDb, effectiveFrom: string, values: TargetPlanValues, now: number): Promise<void> {
  await database.transaction('rw', database.targetPlans, async () => {
    const existing = (await database.targetPlans.where('effectiveFrom').equals(effectiveFrom).toArray()).find((p) => p.deleted === 0);
    if (existing) await database.targetPlans.update(existing.id, { ...values, updatedAt: now });
    else await database.targetPlans.add({ ...sync(now), effectiveFrom, ...values });
  });
}
