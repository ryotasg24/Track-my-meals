import { describe, expect, it } from 'vitest';
import { BACKUP_TABLES, backupFileName, buildBackupFile, checkBackupFile, type BackupData } from './backupFormat';

const emptyData = () => Object.fromEntries(BACKUP_TABLES.map((t) => [t, []])) as unknown as BackupData;

describe('バックアップファイル（基本設計書 4.5）', () => {
  it('ファイル名', () => {
    expect(backupFileName(new Date('2026-11-07T21:30:00').getTime())).toBe('meals-backup-20261107-2130.json');
  });

  it('正しいファイルは件数と期間を返す。削除済みは数えない', () => {
    const data = emptyData();
    data.meals = [
      { localDate: '2026-11-07', deleted: 0 },
      { localDate: '2026-11-01', deleted: 0 },
      { localDate: '2026-10-01', deleted: 1 },
    ];
    const r = checkBackupFile(JSON.parse(JSON.stringify(buildBackupFile(data, 1, 5))), 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.summary).toEqual({ mealCount: 2, firstDate: '2026-11-01', lastDate: '2026-11-07', exportedAt: 5 });
  });

  it('別のアプリ・新しい版・壊れたファイルは読まない', () => {
    expect(checkBackupFile({ app: 'dat-training' }, 1).ok).toBe(false);
    expect(checkBackupFile(buildBackupFile(emptyData(), 2, 0), 1).ok).toBe(false);
    expect(checkBackupFile({ ...buildBackupFile(emptyData(), 1, 0), data: { meals: [] } }, 1).ok).toBe(false);
  });

  it('APIキーのテーブルは含めない（F-KEY-05）', () => {
    expect(BACKUP_TABLES as readonly string[]).not.toContain('secrets');
  });
});
