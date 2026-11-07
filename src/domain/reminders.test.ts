import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from './date';
import { shouldRemindBackup, shouldRemindWeight, shouldShowReview, yesterdayOf } from './reminders';

describe('ふりかえりを出す条件（基本設計書 5.10）', () => {
  it('記録日が変わって初めて開き、前日に食事があり、まだふりかえりがないときだけ出す', () => {
    expect(shouldShowReview('2026-11-08', '2026-11-07', true, false)).toBe(true);
    expect(shouldShowReview('2026-11-08', '2026-11-08', true, false)).toBe(false);
    expect(shouldShowReview('2026-11-08', null, false, false)).toBe(false);
    expect(shouldShowReview('2026-11-08', '2026-11-07', true, true)).toBe(false);
  });

  it('前日', () => {
    expect(yesterdayOf('2026-12-01')).toBe('2026-11-30');
  });
});

describe('お知らせ（基本設計書 5.14）', () => {
  it('バックアップは7日たったら促す', () => {
    const now = 10 * MS_PER_DAY;
    expect(shouldRemindBackup(now, now - 7 * MS_PER_DAY, 0, 7, true)).toBe(true);
    expect(shouldRemindBackup(now, now - 7 * MS_PER_DAY + 1, 0, 7, true)).toBe(false);
    expect(shouldRemindBackup(now, null, now - 8 * MS_PER_DAY, 7, true)).toBe(true);
    expect(shouldRemindBackup(now, null, 0, 7, false)).toBe(false);
  });

  it('体重は7日たったら促す。記録がなければ促す', () => {
    expect(shouldRemindWeight('2026-11-08', '2026-11-01', 7)).toBe(true);
    expect(shouldRemindWeight('2026-11-07', '2026-11-01', 7)).toBe(false);
    expect(shouldRemindWeight('2026-11-07', null, 7)).toBe(true);
  });
});
