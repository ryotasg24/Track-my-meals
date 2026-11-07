/**
 * 記録日と日付の計算（基本設計書 5.1）。
 * 日付はすべて端末の時間帯で決める。現在時刻は引数で受け取る（テストできるようにするため）。
 */
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

/** 記録日の区切りの初期値（午前4時。要件定義書 3.1） */
export const DEFAULT_DAY_BOUNDARY_HOUR = 4;

/**
 * 時刻から記録日を求める。区切りの時刻より前の時刻は、前日の記録日になる。
 * @param ms 時刻
 * @param boundaryHour 区切りの時刻（0〜6時）
 * @returns 記録日（YYYY-MM-DD）
 */
export function toRecordDate(ms: number, boundaryHour: number): string {
  // 「時刻 − 区切りの時間」を端末の時間帯の日付にする。
  // 夏時間のない日本では、時刻から時間を引くだけで正しく求まる
  return format(ms - boundaryHour * MS_PER_HOUR, 'yyyy-MM-dd');
}

/** 記録日の開始時刻（例：区切り4時なら、その日の4:00） */
export function recordDateStart(localDate: string, boundaryHour: number): number {
  const d = parseISO(localDate);
  d.setHours(boundaryHour, 0, 0, 0);
  return d.getTime();
}

/**
 * 日付文字列を、指定した日数だけずらす。
 * @param localDate YYYY-MM-DD
 * @param days ずらす日数（負の値で過去へ）
 */
export function shiftDate(localDate: string, days: number): string {
  return format(addDays(parseISO(localDate), days), 'yyyy-MM-dd');
}

/** 2つの日付の差（日数）。a − b */
export function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(a), parseISO(b));
}

/**
 * 生年月日から、指定した日の満年齢を求める。
 * @param birthDate YYYY-MM-DD
 * @param onDate YYYY-MM-DD
 */
export function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [y, m, d] = onDate.split('-').map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}
