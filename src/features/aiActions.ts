/**
 * 記録とAIの流れ（基本設計書 3.2、6.3、6.4）。画面から呼ぶ。
 * - 写真・文章：先に「読み取り待ち」として保存してからAIに送る（失敗しても写真を失わない）
 * - よく食べるもの・手入力：保存したあとで、次の食事のおすすめを作る（毎回。2026-11-07 決定）
 */
import { analyzeMeal, writeAdvice, type AiConfig } from '../ai/service';
import { failureMessage, type FailureKind } from '../ai/fallback';
import type { DayContext, DayReviewContext } from '../ai/prompts';
import { db } from '../db/db';
import {
  addMeal,
  completeMealAnalysis,
  discardMeal,
  getApiKey,
  getModelCooldown,
  getPendingImage,
  newId,
  setMealAdvice,
  setMeta,
  upsertReview,
} from '../db/repositories';
import { adviceToText } from '../domain/advice';
import { targetForDate } from '../domain/day';
import { formatTime } from '../domain/format';
import { remainingMealTypes } from '../domain/mealType';
import { addNutrients, mealTotal, sumMeals } from '../domain/nutrition';
import { nextQuotaReset } from '../domain/quota';
import type { MealItem, MealType, Nutrients } from '../domain/types';
import { preparePhoto } from '../platform/image';

/** AIを使う準備。APIキーがなければnull */
async function loadAiConfig(signal?: AbortSignal): Promise<AiConfig | null> {
  const [apiKey, settings, cooldown] = await Promise.all([getApiKey(db), db.settings.get('app'), getModelCooldown(db)]);
  if (!apiKey || !settings) return null;
  return {
    apiKey,
    primaryModel: settings.primaryModel,
    fallbackModel: settings.fallbackModel,
    cooldown,
    now: () => Date.now(),
    signal,
  };
}

/** その記録日の目標と摂取量（指定した食事を除く） */
async function dayState(localDate: string, excludeMealId: string | null): Promise<{ target: Nutrients | null; intake: Nutrients; preferences: string }> {
  const [settings, meals, plans, weights, activities] = await Promise.all([
    db.settings.get('app'),
    db.meals.where('localDate').equals(localDate).toArray(),
    db.targetPlans.toArray(),
    db.weightLogs.toArray(),
    db.activityLogs.toArray(),
  ]);
  const t = settings ? targetForDate(localDate, settings, plans, weights, activities) : null;
  return {
    target: t?.ok ? t.result.target : null,
    intake: sumMeals(meals.filter((m) => m.id !== excludeMealId)),
    preferences: settings?.advicePreferences ?? '',
  };
}

function failureText(kind: FailureKind): string {
  return failureMessage(kind, kind === 'quota' ? nextQuotaReset(Date.now()) : undefined);
}

export type RecordOutcome =
  | { kind: 'done'; mealId: string }
  | { kind: 'pending'; mealId: string; message: string }
  | { kind: 'notFood'; reason: string; keptMealId: string | null };

/**
 * 写真または文章で食事を記録する（F-REC-01〜03、F-AI-01〜08）。
 * @param preItems 先に追加した、よく食べるもの・手入力の品目（同じ食事にまとめる。F-REC-09）
 */
export async function recordWithAi(input: {
  file: Blob | null;
  text: string | null;
  eatenAt: number;
  mealType: MealType;
  preItems: MealItem[];
  signal?: AbortSignal;
}): Promise<RecordOutcome> {
  const settings = await db.settings.get('app');
  if (!settings) throw new Error('設定がありません');

  const photo = input.file ? await preparePhoto(input.file) : null;
  const meal = await addMeal(
    db,
    {
      eatenAt: input.eatenAt,
      mealType: input.mealType,
      boundaryHour: settings.dayBoundaryHour,
      items: input.preItems,
      status: 'pending',
      inputText: input.text,
      thumbnail: photo?.thumbnail ?? null,
      pendingImage: photo?.aiImage ?? null,
    },
    Date.now(),
  );
  return analyzePending(meal.id, input.signal);
}

/**
 * 読み取り待ちの食事を読み取る（新しく記録したとき、または［今すぐ読み取る］）。
 */
export async function analyzePending(mealId: string, signal?: AbortSignal): Promise<RecordOutcome> {
  const meal = await db.meals.get(mealId);
  if (!meal) throw new Error('食事が見つかりません');
  const config = await loadAiConfig(signal);
  if (!config) return { kind: 'pending', mealId, message: 'APIキーが設定されていないため、読み取り待ちとして保存しました。' };

  const image = await getPendingImage(db, mealId);
  const state = await dayState(meal.localDate, mealId);
  const context: DayContext = {
    target: state.target,
    intake: addNutrients(state.intake, mealTotal(meal)),
    time: formatTime(meal.eatenAt),
    mealType: meal.mealType,
    remaining: remainingMealTypes(meal.mealType),
    preferences: state.preferences,
  };
  const { result, cooldown } = await analyzeMeal(config, { image, text: meal.inputText }, context);
  await setMeta(db, 'modelCooldown', cooldown);

  if (!result.ok) {
    return { kind: 'pending', mealId, message: `${failureText(result.kind)}（読み取り待ちとして保存しました）` };
  }
  const now = Date.now();
  if (!result.value.isFood) {
    // 料理でなければ保存しない（F-AI-03）。先に追加した品目があれば、それだけで記録済みにする
    if (meal.items.length > 0) {
      await completeMealAnalysis(db, mealId, [], null, now);
      return { kind: 'notFood', reason: result.value.reason, keptMealId: mealId };
    }
    await discardMeal(db, mealId);
    return { kind: 'notFood', reason: result.value.reason, keptMealId: null };
  }
  const source = image ? 'photo' : 'text';
  const items: MealItem[] = result.value.items.map((i) => ({
    id: newId(),
    name: i.name,
    amount: i.amount,
    unit: i.unit,
    nutrients: i.nutrients,
    source,
    favoriteId: null,
    model: result.model,
  }));
  const content = result.value.advice;
  const advice = content ? { text: adviceToText(content), content, model: result.model, createdAt: now } : null;
  await completeMealAnalysis(db, mealId, items, advice, now);
  return { kind: 'done', mealId };
}

/**
 * 記録済みの食事について、次の食事のおすすめを作って保存する（F-ADV-01、06）。
 * よく食べるもの・手入力での保存のあとと、［おすすめを作り直す］で使う。
 * @returns 失敗したときの文言（成功ならnull）
 */
export async function refreshMealAdvice(mealId: string): Promise<string | null> {
  const meal = await db.meals.get(mealId);
  if (!meal) return null;
  const config = await loadAiConfig();
  if (!config) return 'APIキーが設定されていないため、数値だけを表示しています。';
  const state = await dayState(meal.localDate, null);
  const { result, cooldown } = await writeAdvice(config, {
    kind: 'nextMeal',
    context: {
      target: state.target,
      intake: state.intake,
      time: formatTime(meal.eatenAt),
      mealType: meal.mealType,
      remaining: remainingMealTypes(meal.mealType),
      preferences: state.preferences,
    },
  });
  await setMeta(db, 'modelCooldown', cooldown);
  if (!result.ok) return failureText(result.kind);
  await setMealAdvice(db, mealId, { text: adviceToText(result.value), content: result.value, model: result.model, createdAt: Date.now() }, Date.now());
  return null;
}

/**
 * ふりかえりと調整案を作って保存する（F-ADV-02、03）。
 * @param localDate ふりかえる記録日
 * @param forDay today：前日のふりかえり（今日の調整案）、tomorrow：今日をしめる（明日の調整案）
 */
export async function createReview(localDate: string, forDay: DayReviewContext['forDay']): Promise<string | null> {
  const config = await loadAiConfig();
  if (!config) return 'APIキーが設定されていないため、数値だけを表示しています。';
  const state = await dayState(localDate, null);
  const meals = (await db.meals.where('localDate').equals(localDate).toArray()).filter((m) => m.deleted === 0 && m.status === 'done');
  const { result, cooldown } = await writeAdvice(config, {
    kind: 'review',
    context: {
      target: state.target,
      intake: state.intake,
      itemNames: meals.flatMap((m) => m.items.map((i) => i.name)),
      forDay,
      preferences: state.preferences,
    },
  });
  await setMeta(db, 'modelCooldown', cooldown);
  if (!result.ok) return failureText(result.kind);
  await upsertReview(db, localDate, adviceToText(result.value), result.value, result.model, Date.now());
  return null;
}
