import { describe, expect, it } from 'vitest';
import { ageOn, diffDays, recordDateStart, shiftDate, toRecordDate } from './date';

/** 日本時間の日時から時刻を作る */
const at = (s: string) => new Date(s).getTime();

describe('記録日（基本設計書 5.1）', () => {
  it('午前4時より前の食事は前日の記録になる', () => {
    expect(toRecordDate(at('2026-11-08T01:30:00'), 4)).toBe('2026-11-07');
    expect(toRecordDate(at('2026-11-08T03:59:59'), 4)).toBe('2026-11-07');
  });

  it('午前4時ちょうどからはその日の記録になる', () => {
    expect(toRecordDate(at('2026-11-08T04:00:00'), 4)).toBe('2026-11-08');
  });

  it('月と年をまたぐ', () => {
    expect(toRecordDate(at('2026-12-01T02:00:00'), 4)).toBe('2026-11-30');
    expect(toRecordDate(at('2027-01-01T00:30:00'), 4)).toBe('2026-12-31');
  });

  it('区切りが0時なら暦どおり', () => {
    expect(toRecordDate(at('2026-11-08T00:00:00'), 0)).toBe('2026-11-08');
    expect(toRecordDate(at('2026-11-07T23:59:59'), 0)).toBe('2026-11-07');
  });

  it('記録日の開始時刻は区切りの時刻', () => {
    expect(recordDateStart('2026-11-07', 4)).toBe(at('2026-11-07T04:00:00'));
  });
});

describe('日付の計算', () => {
  it('日付をずらす', () => {
    expect(shiftDate('2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('日数の差', () => {
    expect(diffDays('2026-11-07', '2026-10-31')).toBe(7);
  });

  it('満年齢は誕生日の当日に1つ増える', () => {
    expect(ageOn('1991-11-07', '2026-11-06')).toBe(34);
    expect(ageOn('1991-11-07', '2026-11-07')).toBe(35);
  });
});
