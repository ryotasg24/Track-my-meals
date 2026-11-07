/**
 * IndexedDBの定義（基本設計書 4.1〜4.4）。
 * データベースの読み書きは db/ の中だけで行い、画面から直接 Dexie を操作しないこと。
 */
import Dexie, { type EntityTable } from 'dexie';
import type {
  ActivityLog,
  Favorite,
  Meal,
  MealImage,
  MetaRecord,
  Review,
  SecretRecord,
  Settings,
  TargetPlan,
  WeightLog,
} from '../domain/types';

/**
 * データベース名。同じドメイン（ryotasg24.github.io）のtraining-app（dat-）などと
 * 衝突しないよう、このアプリ専用の接頭辞 tmm- を付ける（要件定義書 7.1）。
 */
export const DB_NAME = 'tmm-meals';

/**
 * 現在のデータ形式の版。stores や保存する値の形を変えたら1つ上げ、upgrade で移行処理を書くこと（4.4）。
 */
export const SCHEMA_VERSION = 1;

export class MealsDb extends Dexie {
  meals!: EntityTable<Meal, 'id'>;
  mealImages!: EntityTable<MealImage, 'mealId'>;
  favorites!: EntityTable<Favorite, 'id'>;
  weightLogs!: EntityTable<WeightLog, 'id'>;
  activityLogs!: EntityTable<ActivityLog, 'id'>;
  reviews!: EntityTable<Review, 'id'>;
  targetPlans!: EntityTable<TargetPlan, 'id'>;
  settings!: EntityTable<Settings, 'key'>;
  secrets!: EntityTable<SecretRecord, 'key'>;
  meta!: EntityTable<MetaRecord, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    // 最初の項目が主キー、2番目以降が索引（検索を速くする項目）
    this.version(1).stores({
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
  }

  /** バックアップと復元の対象になるテーブル（secrets と meta は含めない） */
  get backupTables() {
    return [
      this.meals,
      this.mealImages,
      this.favorites,
      this.weightLogs,
      this.activityLogs,
      this.reviews,
      this.targetPlans,
      this.settings,
    ];
  }
}

/** アプリ全体で使うデータベース */
export const db = new MealsDb();
