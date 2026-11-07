/**
 * ショートカットを使ったアクティブエネルギーの取り込み（要件定義書 3.9、基本設計書 6.5）。
 * ショートカットへは区切り文字（|）のテキストで渡す（JSONは辞書に自動変換されて扱いにくいため。training-appで確認）。
 */
import { format } from 'date-fns';
import { MS_PER_MINUTE, recordDateStart, shiftDate } from './date';

export const ACTIVITY_PREFIX = 'tmm-active';

/** iPhoneの日本語表示と同じ形（ショートカットが日付として読み取れる形） */
function shortcutDateTime(ms: number): string {
  return format(ms, 'yyyy/MM/dd H:mm');
}

/**
 * 記録日の開始と終了（例：区切り4時、記録日11/7 → 2026/11/07 4:00 と 2026/11/08 3:59）。
 */
export function recordDateRangeText(localDate: string, boundaryHour: number): { start: string; end: string } {
  const start = recordDateStart(localDate, boundaryHour);
  const end = recordDateStart(shiftDate(localDate, 1), boundaryHour) - MS_PER_MINUTE;
  return { start: shortcutDateTime(start), end: shortcutDateTime(end) };
}

/**
 * ショートカットを起動するURL（基本設計書 6.5 の手順1）。
 */
export function buildActivityShortcutUrl(shortcutName: string, localDate: string, boundaryHour: number): string {
  const { start, end } = recordDateRangeText(localDate, boundaryHour);
  return (
    'shortcuts://run-shortcut?name=' +
    encodeURIComponent(shortcutName) +
    '&input=text&text=' +
    encodeURIComponent(`${start}|${end}`)
  );
}

export type ParseResult = { ok: true; activeKcal: number } | { ok: false; error: string };

/**
 * クリップボードのテキストを読む（基本設計書 6.5 の手順5）。
 * 形：tmm-active|2026/11/07 4:00|520
 * @param text クリップボードのテキスト
 * @param localDate 取り込もうとした記録日
 */
export function parseActivityText(text: string, localDate: string, boundaryHour: number): ParseResult {
  const parts = text.trim().split('|').map((s) => s.trim());
  if (parts.length !== 3 || parts[0] !== ACTIVITY_PREFIX) {
    return { ok: false, error: 'ショートカットから受け取った値ではありません。もう一度［運動を取り込む］から行ってください。' };
  }
  if (parts[1] !== recordDateRangeText(localDate, boundaryHour).start) {
    return { ok: false, error: '別の日の値です。もう一度［運動を取り込む］から行ってください。' };
  }
  // ショートカットが「520 kcal」「1,020」のような形にしても読めるようにする
  const value = Number((parts[2] ?? '').replace(/[^0-9.]/g, ''));
  if (!(parts[2] ?? '').match(/[0-9]/) || !Number.isFinite(value) || value < 0 || value > 5000) {
    return { ok: false, error: 'アクティブエネルギーの値がおかしいです（0〜5,000kcal）。' };
  }
  return { ok: true, activeKcal: Math.round(value) };
}
