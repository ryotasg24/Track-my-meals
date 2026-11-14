/**
 * バックアップの書き出しと復元（要件定義書 F-DATA-03、04、基本設計書 4.5）。
 * 写真はデータURLの文字列にして書き出し、復元するときにバイト列に戻す。
 */
import { BACKUP_TABLES, buildBackupFile, type BackupData, type BackupFile } from '../domain/backupFormat';
import type { PhotoData } from '../domain/types';
import { SCHEMA_VERSION, type MealsDb } from './db';

/** 写真のデータ（バイト列またはBlob）を、データURL（data:image/jpeg;base64,...）にする */
async function photoToDataUrl(data: PhotoData, mimeType: string): Promise<string> {
  const buffer = new Uint8Array(data instanceof Blob ? await data.arrayBuffer() : data);
  let binary = '';
  // 大きな配列を一度に文字にすると失敗するため、少しずつ変換する
  for (let i = 0; i < buffer.length; i += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  }
  return `data:${mimeType || 'image/jpeg'};base64,${btoa(binary)}`;
}

/** データURLをバイト列に戻す（写真はバイト列で保存する。types.ts の PhotoData）。形が違えばnull */
export function dataUrlToBytes(dataUrl: unknown): { data: ArrayBuffer; mimeType: string } | null {
  if (typeof dataUrl !== 'string') return null;
  const m = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  const binary = atob(m[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { data: bytes.buffer, mimeType: m[1]! };
}

/** 全テーブルを読み、バックアップファイルを作る。削除済みのデータも含める */
export async function exportBackup(database: MealsDb, now: number): Promise<BackupFile> {
  const raw = await database.transaction('r', database.backupTables, async () => ({
    meals: await database.meals.toArray(),
    photoImages: await database.photoImages.toArray(),
    favorites: await database.favorites.toArray(),
    weightLogs: await database.weightLogs.toArray(),
    activityLogs: await database.activityLogs.toArray(),
    reviews: await database.reviews.toArray(),
    targetPlans: await database.targetPlans.toArray(),
    settings: await database.settings.toArray(),
  }));

  const meals = await Promise.all(
    raw.meals.map(async (m) => ({
      ...m,
      photos: await Promise.all(m.photos.map(async (p) => ({ ...p, thumbnail: await photoToDataUrl(p.thumbnail, p.mimeType) }))),
    })),
  );
  const photoImages = await Promise.all(raw.photoImages.map(async (i) => ({ ...i, image: await photoToDataUrl(i.image, i.mimeType) })));

  const data: BackupData = {
    meals,
    photoImages,
    favorites: raw.favorites as unknown as Record<string, unknown>[],
    weightLogs: raw.weightLogs as unknown as Record<string, unknown>[],
    activityLogs: raw.activityLogs as unknown as Record<string, unknown>[],
    reviews: raw.reviews as unknown as Record<string, unknown>[],
    targetPlans: raw.targetPlans as unknown as Record<string, unknown>[],
    settings: raw.settings as unknown as Record<string, unknown>[],
  };
  return buildBackupFile(data, SCHEMA_VERSION, now);
}

/** 共有メニューでの保存が完了したときに呼び、最後にバックアップした時刻を記録する */
export async function recordBackupDone(database: MealsDb, now: number): Promise<void> {
  await database.meta.put({ key: 'lastBackupAt', value: now });
}

/**
 * バックアップファイルから復元する。現在のデータはすべて置き換わる（APIキーは残す）。
 * 1つのトランザクションで行い、途中で失敗したら元の状態に戻る。
 * ファイルは checkBackupFile で確認済みのものを渡すこと。
 */
export async function restoreBackup(database: MealsDb, file: BackupFile): Promise<void> {
  // 古い版のファイルは、checkBackupFile の中で今の形に直してある（migrateBackupFile）
  const d = file.data;
  const meals = d.meals.map((m) => ({
    ...m,
    photos: (Array.isArray(m.photos) ? (m.photos as Record<string, unknown>[]) : []).flatMap((p) => {
      const bytes = dataUrlToBytes(p.thumbnail);
      return bytes ? [{ ...p, thumbnail: bytes.data, mimeType: bytes.mimeType }] : [];
    }),
  }));
  const photoImages = d.photoImages.flatMap((i) => {
    const bytes = dataUrlToBytes(i.image);
    return bytes ? [{ photoId: i.photoId, mealId: i.mealId, image: bytes.data, mimeType: bytes.mimeType }] : [];
  });

  await database.transaction('rw', [...database.backupTables, database.meta], async () => {
    await Promise.all(database.backupTables.map((t) => t.clear()));
    const put = (name: (typeof BACKUP_TABLES)[number], rows: unknown[]) =>
      // テーブルごとの型は確認済みのファイルの中身に合わせる
      (database.table(name) as unknown as { bulkPut: (r: unknown[]) => Promise<unknown> }).bulkPut(rows);
    await put('meals', meals);
    await put('photoImages', photoImages);
    await put('favorites', d.favorites);
    await put('weightLogs', d.weightLogs);
    await put('activityLogs', d.activityLogs);
    await put('reviews', d.reviews);
    await put('targetPlans', d.targetPlans);
    await put('settings', d.settings);
    await database.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION });
  });
}
