/**
 * バックアップファイル（JSON）の形式と、読み込んだファイルの確認（基本設計書 4.5）。
 * 写真（Blob）は、データURL（Base64の文字列）にして入れる。変換は db/backup.ts で行う。
 * APIキー（secrets）は含めない（F-KEY-05）。
 */
import { format } from 'date-fns';
import { legacyPhotoId, migrateLegacyMeal } from './mealPhotos';

export const BACKUP_APP_ID = 'tmm-meals';
export const BACKUP_FORMAT = 1;

/** バックアップに含めるテーブル */
export const BACKUP_TABLES = [
  'meals',
  'photoImages',
  'favorites',
  'weightLogs',
  'activityLogs',
  'reviews',
  'targetPlans',
  'settings',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupData = Record<BackupTable, Record<string, unknown>[]>;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: number;
  data: BackupData;
}

export function buildBackupFile(data: BackupData, schemaVersion: number, now: number): BackupFile {
  return { app: BACKUP_APP_ID, format: BACKUP_FORMAT, schemaVersion, exportedAt: now, data };
}

/** 例：meals-backup-20261107-2130.json */
export function backupFileName(now: number): string {
  return `meals-backup-${format(now, 'yyyyMMdd-HHmm')}.json`;
}

/** 復元前の確認画面に出す内容 */
export interface BackupSummary {
  mealCount: number;
  firstDate: string | null;
  lastDate: string | null;
  exportedAt: number;
}

export type BackupCheckResult = { ok: true; file: BackupFile; summary: BackupSummary } | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 読み込んだJSONが、このアプリのバックアップファイルとして正しいかを確かめる。
 * @param currentSchemaVersion アプリが対応しているデータ形式の版
 */
export function checkBackupFile(json: unknown, currentSchemaVersion: number): BackupCheckResult {
  if (!isObject(json) || json.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'このアプリのバックアップファイルではありません。' };
  }
  if (json.format !== BACKUP_FORMAT) return { ok: false, error: '対応していない形式のバックアップファイルです。' };
  if (typeof json.schemaVersion !== 'number' || typeof json.exportedAt !== 'number') {
    return { ok: false, error: 'バックアップファイルが壊れています。' };
  }
  if (json.schemaVersion > currentSchemaVersion) {
    return { ok: false, error: 'より新しい版のアプリで作られたファイルです。アプリを更新してから読み込んでください。' };
  }
  const data = json.data;
  // 版1のファイルは photoImages の代わりに mealImages を持つ
  const tables: readonly string[] = json.schemaVersion < 2 ? BACKUP_TABLES.map((t) => (t === 'photoImages' ? 'mealImages' : t)) : BACKUP_TABLES;
  if (!isObject(data) || !tables.every((name) => Array.isArray(data[name]))) {
    return { ok: false, error: 'バックアップファイルが壊れています。' };
  }
  const file = migrateBackupFile(json as unknown as BackupFile);
  const dates = file.data.meals
    .filter((m) => m.deleted === 0 && typeof m.localDate === 'string')
    .map((m) => m.localDate as string)
    .sort();
  return {
    ok: true,
    file,
    summary: { mealCount: dates.length, firstDate: dates[0] ?? null, lastDate: dates[dates.length - 1] ?? null, exportedAt: file.exportedAt },
  };
}

/**
 * 古い版のバックアップファイルを、今の形に直す（基本設計書 4.4、4.5）。
 * 版1→2：食事の写真を1枚（thumbnail）から配列（photos）に、読み取り待ちの写真を食事ごと（mealImages）から写真ごと（photoImages）に。
 */
export function migrateBackupFile(file: BackupFile): BackupFile {
  if (file.schemaVersion >= 2) return file;
  const raw = file.data as unknown as Record<string, Record<string, unknown>[]>;
  const images = (raw.mealImages ?? []).filter((i) => typeof i.mealId === 'string' && typeof i.image === 'string');
  const pendingMealIds = new Set(images.map((i) => i.mealId as string));
  const meals = (raw.meals ?? []).map((m) => {
    const thumb = typeof m.thumbnail === 'string' ? m.thumbnail : null;
    const mime = /^data:([^;,]+);/.exec(thumb ?? '')?.[1] ?? 'image/jpeg';
    return migrateLegacyMeal(m as Record<string, unknown> & { id: string; thumbnail?: string | null }, pendingMealIds.has(m.id as string), mime);
  });
  const photoIds = new Set(meals.flatMap((m) => (m.photos as { id: string }[]).map((p) => p.id)));
  const photoImages = images
    .filter((i) => photoIds.has(legacyPhotoId(i.mealId as string)))
    .map((i) => ({
      photoId: legacyPhotoId(i.mealId as string),
      mealId: i.mealId,
      image: i.image,
      mimeType: /^data:([^;,]+);/.exec(i.image as string)?.[1] ?? 'image/jpeg',
    }));
  const { mealImages: _old, ...rest } = raw;
  void _old;
  return { ...file, schemaVersion: 2, data: { ...(rest as unknown as BackupData), meals, photoImages } };
}
