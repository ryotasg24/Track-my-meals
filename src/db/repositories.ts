/**
 * データの読み書き（基本設計書 4章）。画面からはここの関数だけを使う。
 * 時刻（now）は引数で受け取る。複数のテーブルを変える処理は1つのトランザクションで行う。
 */
import type { AdviceContent } from '../domain/advice';
import { toRecordDate } from '../domain/date';
import { DEFAULT_MEAL_TYPE_STARTS } from '../domain/mealType';
import { DEFAULT_TARGET_PLAN } from '../domain/target';
import type {
  Advice,
  Favorite,
  Meal,
  MealItem,
  MealType,
  Nutrients,
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

export interface NewMealInput {
  eatenAt: number;
  mealType: MealType;
  boundaryHour: number;
  items: MealItem[];
  status: Meal['status'];
  inputText?: string | null;
  thumbnail?: Blob | null;
  /** 読み取り待ちのときに保存する、AIに送る大きさの写真 */
  pendingImage?: Blob | null;
}

/** 食事を新しく保存する。読み取り待ちの写真があれば同じトランザクションで保存する */
export async function addMeal(database: MealsDb, input: NewMealInput, now: number): Promise<Meal> {
  const meal: Meal = {
    ...sync(now),
    eatenAt: input.eatenAt,
    localDate: toRecordDate(input.eatenAt, input.boundaryHour),
    mealType: input.mealType,
    status: input.status,
    inputText: input.inputText ?? null,
    thumbnail: input.thumbnail ?? null,
    items: input.items,
    advice: null,
  };
  await database.transaction('rw', [database.meals, database.mealImages, database.favorites], async () => {
    await database.meals.add(meal);
    if (input.pendingImage) await database.mealImages.put({ mealId: meal.id, image: input.pendingImage });
    await countFavoriteUse(database, input.items, now);
  });
  return meal;
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
 * 読み取りが終わった食事を記録済みにする。品目を加え、読み取り待ちの写真を消す（基本設計書 6.4）。
 * 既存の品目（よく食べるものなど）の後ろに、AIの品目を足す。
 */
export async function completeMealAnalysis(
  database: MealsDb,
  mealId: string,
  aiItems: MealItem[],
  advice: Advice | null,
  now: number,
): Promise<void> {
  await database.transaction('rw', [database.meals, database.mealImages], async () => {
    const meal = await database.meals.get(mealId);
    if (!meal) return;
    await database.meals.update(mealId, {
      items: [...meal.items, ...aiItems],
      status: 'done',
      advice: advice ?? meal.advice,
      updatedAt: now,
    });
    await database.mealImages.delete(mealId);
  });
}

/** 料理が読み取れなかった食事を消す（F-AI-03：保存しない） */
export async function discardMeal(database: MealsDb, mealId: string): Promise<void> {
  await database.transaction('rw', [database.meals, database.mealImages], async () => {
    await database.meals.delete(mealId);
    await database.mealImages.delete(mealId);
  });
}

export async function getPendingImage(database: MealsDb, mealId: string): Promise<Blob | null> {
  return (await database.mealImages.get(mealId))?.image ?? null;
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
  await database.transaction('rw', [database.meals, database.mealImages], async () => {
    await database.meals.update(mealId, { deleted: 1, updatedAt: now });
    await database.mealImages.delete(mealId);
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
