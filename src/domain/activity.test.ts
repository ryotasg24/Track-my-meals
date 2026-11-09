import { describe, expect, it } from 'vitest';
import { buildActivityShortcutUrl, parseActivityText, recordDateRangeText } from './activity';

describe('ショートカットとの受け渡し（基本設計書 6.5）', () => {
  it('記録日の範囲は4:00から翌3:59', () => {
    expect(recordDateRangeText('2026-11-07', 4)).toEqual({ start: '2026/11/07 4:00', end: '2026/11/08 3:59' });
  });

  it('ショートカットを起動するURL', () => {
    expect(buildActivityShortcutUrl('ごはんくんにアクティブエネルギーを渡す', '2026-11-07', 4)).toBe(
      'shortcuts://run-shortcut?name=' +
        encodeURIComponent('ごはんくんにアクティブエネルギーを渡す') +
        '&input=text&text=' +
        encodeURIComponent('2026/11/07 4:00|2026/11/08 3:59'),
    );
  });

  it('正しいテキストを読む（小数は四捨五入）', () => {
    expect(parseActivityText('tmm-active|2026/11/07 4:00|520.6', '2026-11-07', 4)).toEqual({ ok: true, activeKcal: 521 });
    expect(parseActivityText(' tmm-active|2026/11/07 4:00|1,020 kcal \n', '2026-11-07', 4)).toEqual({ ok: true, activeKcal: 1020 });
  });

  it('全角の「｜」、改行、日付の表示の違い、先頭の余計な文字は許す', () => {
    expect(parseActivityText('tmm-active｜2026/11/07 4:00｜520', '2026-11-07', 4)).toEqual({ ok: true, activeKcal: 520 });
    expect(parseActivityText('tmm-active|\n2026/11/07 4:00\n|520', '2026-11-07', 4)).toEqual({ ok: true, activeKcal: 520 });
    expect(parseActivityText('tmm-active|2026年11月7日 4:00|520', '2026-11-07', 4)).toEqual({ ok: true, activeKcal: 520 });
    expect(parseActivityText('tmm-active|2026/11/07 4:00:00|520', '2026-11-07', 4)).toEqual({ ok: true, activeKcal: 520 });
    expect(parseActivityText('コピー tmm-active|2026/11/07 4:00|520', '2026-11-07', 4)).toEqual({ ok: true, activeKcal: 520 });
  });

  it('エラーには受け取った値を添える', () => {
    const r = parseActivityText('2026/11/07 4:00|520', '2026-11-07', 4);
    expect(!r.ok && r.error).toContain('「2026/11/07 4:00|520」');
    const empty = parseActivityText('', '2026-11-07', 4);
    expect(!empty.ok && empty.error).toContain('クリップボードが空');
  });

  it('別の日・別の形・範囲外はエラー', () => {
    expect(parseActivityText('tmm-active|2026/11/06 4:00|520', '2026-11-07', 4).ok).toBe(false);
    expect(parseActivityText('520', '2026-11-07', 4).ok).toBe(false);
    expect(parseActivityText('tmm-active|2026/11/07 4:00|6000', '2026-11-07', 4).ok).toBe(false);
    expect(parseActivityText('tmm-active|2026/11/07 4:00|abc', '2026-11-07', 4).ok).toBe(false);
  });
});
