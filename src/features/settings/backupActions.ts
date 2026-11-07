/**
 * バックアップ・CSVの書き出しと、復元の操作（F-DATA-03、04、07）。ホームと設定から使う。
 */
import { format } from 'date-fns';
import { db, SCHEMA_VERSION } from '../../db/db';
import { exportBackup, recordBackupDone, restoreBackup } from '../../db/backup';
import { initializeDb } from '../../db/repositories';
import { backupFileName, checkBackupFile } from '../../domain/backupFormat';
import { buildMealsCsv } from '../../domain/csv';
import { formatDateTime, formatShortDate } from '../../domain/format';
import { shareOrDownloadFile } from '../../platform/share';

export async function runBackupExport(): Promise<string> {
  const now = Date.now();
  const file = await exportBackup(db, now);
  const content = JSON.stringify(file);
  const result = await shareOrDownloadFile(backupFileName(now), content, 'application/json');
  if (result === 'cancelled') return 'バックアップを取り消しました。';
  await recordBackupDone(db, now);
  const mb = (new Blob([content]).size / 1024 / 1024).toFixed(1);
  return result === 'shared' ? `バックアップを書き出しました（${mb}MB）。` : `バックアップファイルをダウンロードしました（${mb}MB）。`;
}

export async function runCsvExport(): Promise<string> {
  const content = buildMealsCsv(await db.meals.toArray());
  const result = await shareOrDownloadFile(`meals-${format(Date.now(), 'yyyyMMdd')}.csv`, content, 'text/csv');
  return result === 'cancelled' ? '書き出しを取り消しました。' : 'CSVを書き出しました。';
}

export async function runRestore(file: File): Promise<string> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return 'ファイルを読み込めませんでした。バックアップファイル（.json）を選んでください。';
  }
  const checked = checkBackupFile(json, SCHEMA_VERSION);
  if (!checked.ok) return checked.error;
  const { summary } = checked;
  const period = summary.firstDate && summary.lastDate ? `${formatShortDate(summary.firstDate)}〜${formatShortDate(summary.lastDate)}` : '記録なし';
  const message =
    '現在のデータはすべて置き換わります（APIキーはそのまま残ります）。よろしいですか？\n\n' +
    `書き出した日時：${formatDateTime(summary.exportedAt)}\n` +
    `食事の記録：${summary.mealCount}件（${period}）`;
  if (!window.confirm(message)) return '復元を取り消しました。';
  await restoreBackup(db, checked.file);
  await initializeDb(db, Date.now());
  return '復元しました。';
}
