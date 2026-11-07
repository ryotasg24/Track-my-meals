/**
 * バックアップの書き出しと復元（要件定義書 F-DATA-03、04、基本設計書 4.5）。
 * 写真（Blob）はデータURLの文字列にして書き出し、復元するときにBlobに戻す。
 */
import { BACKUP_TABLES, buildBackupFile, type BackupData, type BackupFile } from '../domain/backupFormat';
import { SCHEMA_VERSION, type MealsDb } from './db';

/** Blobを、データURL（data:image/jpeg;base64,...）にする */
async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // 大きな配列を一度に文字にすると失敗するため、少しずつ変換する
  for (let i = 0; i < buffer.length; i += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  }
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
}

/** データURLをBlobに戻す。形が違えばnull */
export function dataUrlToBlob(dataUrl: unknown): Blob | null {
  if (typeof dataUrl !== 'string') return null;
  const m = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  const binary = atob(m[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

/** 全テーブルを読み、バックアップファイルを作る。削除済みのデータも含める */
export async function exportBackup(database: MealsDb, now: number): Promise<BackupFile> {
  const raw = await database.transaction('r', database.backupTables, async () => ({
    meals: await database.meals.toArray(),
    mealImages: await database.mealImages.toArray(),
    favorites: await database.favorites.toArray(),
    weightLogs: await database.weightLogs.toArray(),
    activityLogs: await database.activityLogs.toArray(),
    reviews: await database.reviews.toArray(),
    targetPlans: await database.targetPlans.toArray(),
    settings: await database.settings.toArray(),
  }));

  const meals = await Promise.all(
    raw.meals.map(async (m) => ({ ...m, thumbnail: m.thumbnail ? await blobToDataUrl(m.thumbnail) : null })),
  );
  const mealImages = await Promise.all(raw.mealImages.map(async (i) => ({ ...i, image: await blobToDataUrl(i.image) })));

  const data: BackupData = {
    meals,
    mealImages,
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
  // 版1しかないため、今は移行の処理はない。版を上げたら、ここで古いファイルを新しい形に直す（4.4）
  const d = file.data;
  const meals = d.meals.map((m) => ({ ...m, thumbnail: dataUrlToBlob(m.thumbnail) }));
  const mealImages = d.mealImages
    .map((i) => ({ mealId: i.mealId as string, image: dataUrlToBlob(i.image) }))
    .filter((i): i is { mealId: string; image: Blob } => i.image !== null);

  await database.transaction('rw', [...database.backupTables, database.meta], async () => {
    await Promise.all(database.backupTables.map((t) => t.clear()));
    const put = (name: (typeof BACKUP_TABLES)[number], rows: unknown[]) =>
      // テーブルごとの型は確認済みのファイルの中身に合わせる
      (database.table(name) as unknown as { bulkPut: (r: unknown[]) => Promise<unknown> }).bulkPut(rows);
    await put('meals', meals);
    await put('mealImages', mealImages);
    await put('favorites', d.favorites);
    await put('weightLogs', d.weightLogs);
    await put('activityLogs', d.activityLogs);
    await put('reviews', d.reviews);
    await put('targetPlans', d.targetPlans);
    await put('settings', d.settings);
    await database.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION });
  });
}
