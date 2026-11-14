import { describe, expect, it } from 'vitest';
import { BACKUP_TABLES, backupFileName, buildBackupFile, checkBackupFile, type BackupData } from './backupFormat';
import { legacyPhotoId } from './mealPhotos';

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
    const r = checkBackupFile(JSON.parse(JSON.stringify(buildBackupFile(data, 2, 5))), 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.summary).toEqual({ mealCount: 2, firstDate: '2026-11-01', lastDate: '2026-11-07', exportedAt: 5 });
  });

  it('別のアプリ・新しい版・壊れたファイルは読まない', () => {
    expect(checkBackupFile({ app: 'dat-training' }, 1).ok).toBe(false);
    expect(checkBackupFile(buildBackupFile(emptyData(), 3, 0), 2).ok).toBe(false);
    expect(checkBackupFile({ ...buildBackupFile(emptyData(), 2, 0), data: { meals: [] } }, 2).ok).toBe(false);
  });

  it('版1のファイルは、写真を新しい形に直して読む（基本設計書 4.4）', () => {
    const tables = BACKUP_TABLES.map((t) => (t === 'photoImages' ? 'mealImages' : t));
    const data = Object.fromEntries(tables.map((t) => [t, []])) as Record<string, Record<string, unknown>[]>;
    data.meals = [
      { id: 'm1', localDate: '2026-11-07', deleted: 0, status: 'pending', createdAt: 3, thumbnail: 'data:image/jpeg;base64,AA==' },
      { id: 'm2', localDate: '2026-11-07', deleted: 0, status: 'done', thumbnail: null },
    ];
    data.mealImages = [{ mealId: 'm1', image: 'data:image/jpeg;base64,AQ==' }];
    const r = checkBackupFile({ app: 'tmm-meals', format: 1, schemaVersion: 1, exportedAt: 0, data }, 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.schemaVersion).toBe(2);
    expect(r.file.data.meals[0]?.photos).toEqual([
      { id: legacyPhotoId('m1'), thumbnail: 'data:image/jpeg;base64,AA==', mimeType: 'image/jpeg', isPending: true, createdAt: 3 },
    ]);
    expect(r.file.data.meals[1]?.photos).toEqual([]);
    expect(r.file.data.photoImages).toEqual([
      { photoId: legacyPhotoId('m1'), mealId: 'm1', image: 'data:image/jpeg;base64,AQ==', mimeType: 'image/jpeg' },
    ]);
    expect('mealImages' in r.file.data).toBe(false);
  });

  it('APIキーのテーブルは含めない（F-KEY-05）', () => {
    expect(BACKUP_TABLES as readonly string[]).not.toContain('secrets');
  });
});
