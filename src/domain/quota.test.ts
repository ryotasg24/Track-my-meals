import { describe, expect, it } from 'vitest';
import { isModelAvailable, nextQuotaReset } from './quota';

describe('無料枠のリセット時刻（基本設計書 5.9）', () => {
  it('標準時の期間：日本時間11/7 10:00 → 日本時間11/7 17:00', () => {
    const now = new Date('2026-11-07T10:00:00+09:00').getTime();
    expect(nextQuotaReset(now)).toBe(new Date('2026-11-07T17:00:00+09:00').getTime());
  });

  it('夏時間の期間：日本時間7/1 10:00 → 日本時間7/1 16:00', () => {
    const now = new Date('2026-07-01T10:00:00+09:00').getTime();
    expect(nextQuotaReset(now)).toBe(new Date('2026-07-01T16:00:00+09:00').getTime());
  });

  it('リセット直後は翌日のリセット', () => {
    const now = new Date('2026-11-07T17:00:00+09:00').getTime();
    expect(nextQuotaReset(now)).toBe(new Date('2026-11-08T17:00:00+09:00').getTime());
  });

  it('夏時間が終わる日（太平洋時間 2026-11-01）をまたぐ', () => {
    // 太平洋時間10/31 12:00（夏時間）→ 11/1 0:00（まだ夏時間、UTC−7）
    const now = new Date('2026-10-31T12:00:00-07:00').getTime();
    expect(nextQuotaReset(now)).toBe(new Date('2026-11-01T00:00:00-07:00').getTime());
  });
});

describe('モデルを休ませる', () => {
  it('期限を過ぎたら使える', () => {
    expect(isModelAvailable({ a: 1000 }, 'a', 999)).toBe(false);
    expect(isModelAvailable({ a: 1000 }, 'a', 1000)).toBe(true);
    expect(isModelAvailable({}, 'a', 0)).toBe(true);
  });
});
