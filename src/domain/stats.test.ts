import { describe, expect, it } from 'vitest';
import { buildBuckets, periodLabel, periodRange, shiftPeriod, summarizePeriod, type DaySummary } from './stats';

const n = (kcal: number) => ({ kcal, protein: kcal / 20, fat: 0, carbs: 0, fiber: 0, salt: 0 });
const day = (localDate: string, kcal: number | null, targetKcal = 2000, weightKg: number | null = null): DaySummary => ({
  localDate,
  hasMeals: kcal !== null,
  intake: n(kcal ?? 0),
  target: n(targetKcal),
  weightKg,
});

describe('期間（基本設計書 5.11）', () => {
  it('週は月曜始まり', () => {
    expect(periodRange('week', '2026-11-07')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(periodRange('week', '2026-11-09')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
  });

  it('月と年', () => {
    expect(periodRange('month', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodRange('year', '2026-11-07')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('前後の期間と見出し', () => {
    expect(shiftPeriod('week', '2026-11-07', -1)).toBe('2026-10-31');
    expect(shiftPeriod('month', '2026-01-31', 1)).toBe('2026-02-28');
    expect(periodLabel('month', '2026-11-07')).toBe('2026年11月');
  });
});

describe('グラフの点', () => {
  it('週は7点。記録のない日は点を置かない（0として数えない）', () => {
    const buckets = buildBuckets('week', '2026-11-07', [day('2026-11-02', 1800), day('2026-11-04', null)]);
    expect(buckets).toHaveLength(7);
    expect(buckets[0]?.intake?.kcal).toBe(1800);
    expect(buckets[2]?.intake).toBeNull();
    expect(buckets[1]?.intake).toBeNull();
  });

  it('年は月ごとの、記録のある日だけの平均', () => {
    const buckets = buildBuckets('year', '2026-11-07', [
      day('2026-11-01', 1800, 2000, 70),
      day('2026-11-02', 2200, 2000, 69),
      day('2026-11-03', null, 2000),
    ]);
    expect(buckets).toHaveLength(12);
    expect(buckets[10]?.intake?.kcal).toBe(2000);
    expect(buckets[10]?.weightKg).toBe(69.5);
    expect(buckets[0]?.intake).toBeNull();
  });
});

describe('期間のまとめ（F-GRA-04）', () => {
  it('平均と、範囲内だった日数', () => {
    const s = summarizePeriod('week', '2026-11-07', [
      day('2026-11-02', 1800),
      day('2026-11-03', 2300),
      day('2026-11-04', null),
      day('2026-10-30', 1000),
    ]);
    expect(s.recordedDays).toBe(2);
    expect(s.average?.kcal).toBe(2050);
    expect(s.withinDays).toBe(1);
  });
});
