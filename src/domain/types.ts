/**
 * データの型（基本設計書 4.1〜4.3）。
 * 時刻はエポックミリ秒（数値）、日付は記録日の YYYY-MM-DD 文字列で持つ。
 */

/** 同期の対象になるデータに共通の項目（F-DATA-08） */
export interface SyncFields {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** 削除済みの印。IndexedDBの索引は真偽値に対応していないため0と1にする */
  deleted: 0 | 1;
}

/** 栄養価（6項目）。g の値は端数を残して保存する（基本設計書 4.1、5.4） */
export interface Nutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  /** 食塩相当量（g） */
  salt: number;
}

export type NutrientKey = keyof Nutrients;

export const NUTRIENT_KEYS: readonly NutrientKey[] = ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'salt'];

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export type ItemSource = 'photo' | 'text' | 'favorite' | 'manual';

/** 食事の品目 */
export interface MealItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  nutrients: Nutrients;
  source: ItemSource;
  /** よく食べるものから記録した場合のID */
  favoriteId: string | null;
  /** AIで推定した場合のモデル名 */
  model: string | null;
}

/** AIの提案の文章 */
export interface Advice {
  text: string;
  model: string;
  createdAt: number;
}

/** 食事の記録（1回の食事が1件） */
export interface Meal extends SyncFields {
  eatenAt: number;
  /** 記録日（区切りの時刻を考慮した日付。基本設計書 5.1） */
  localDate: string;
  mealType: MealType;
  /** pending：読み取り待ち（品目はまだない）、done：記録済み */
  status: 'pending' | 'done';
  inputText: string | null;
  /** 縮小した写真（長い辺320px、JPEG） */
  thumbnail: Blob | null;
  items: MealItem[];
  advice: Advice | null;
}

/** 読み取り待ちの写真（AIに送る大きさのもの） */
export interface MealImage {
  mealId: string;
  image: Blob;
}

export interface Favorite extends SyncFields {
  name: string;
  amount: number;
  unit: string;
  nutrients: Nutrients;
  useCount: number;
  lastUsedAt: number | null;
}

export interface WeightLog extends SyncFields {
  /** 記録日（YYYY-MM-DD）。同じ日付は1件だけ */
  date: string;
  weightKg: number;
}

export interface ActivityLog extends SyncFields {
  localDate: string;
  activeKcal: number;
  source: 'shortcut' | 'manual';
}

export interface Review extends SyncFields {
  /** ふりかえりの対象の記録日 */
  localDate: string;
  kind: 'nextDay';
  text: string;
  model: string;
}

export type Goal = 'lose' | 'keep' | 'gain';

export type Sex = 'male' | 'female';

/** 目標の設定の履歴（基本設計書 4.3 targetPlans） */
export interface TargetPlan extends SyncFields {
  /** この設定を使い始める記録日 */
  effectiveFrom: string;
  goal: Goal;
  activityFactor: number;
  goalAdjustKcal: number;
  proteinPerKg: number;
  fatRatio: number;
  typicalActiveKcal: number;
  /** 自分で決めた目標。nullなら計算した値を使う（F-TGT-03） */
  overrides: { [K in NutrientKey]: number | null };
}

export interface MealTypeStarts {
  breakfast: string;
  lunch: string;
  snack: string;
  dinner: string;
}

export interface Settings {
  key: 'app';
  nickname: string;
  sex: Sex | null;
  birthDate: string | null;
  heightCm: number | null;
  dayBoundaryHour: number;
  mealTypeStarts: MealTypeStarts;
  primaryModel: string;
  fallbackModel: string | null;
  advicePreferences: string;
  healthEnabled: boolean;
  shortcutName: string;
  backupReminderDays: number;
  weightReminderDays: number;
  onboardingDone: boolean;
  updatedAt: number;
}

export interface SecretRecord {
  key: 'gemini';
  apiKey: string;
  verifiedAt: number | null;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}
