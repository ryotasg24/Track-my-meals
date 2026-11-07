/**
 * 画面に表示する文字の形式。
 */
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';

/** 例：11月7日（金） */
export function formatLongDate(localDate: string): string {
  return format(parseISO(localDate), 'M月d日（E）', { locale: ja });
}

/** 例：11/7(金) */
export function formatShortDate(localDate: string): string {
  return format(parseISO(localDate), 'M/d(E)', { locale: ja });
}

/** 例：12:30 */
export function formatTime(ms: number): string {
  return format(ms, 'H:mm');
}

/** 例：11/7(金) 12:30 */
export function formatDateTime(ms: number): string {
  return format(ms, 'M/d(E) H:mm', { locale: ja });
}

/** <input type="datetime-local"> に入れる値（端末の時間帯） */
export function toDateTimeInputValue(ms: number): string {
  return format(ms, "yyyy-MM-dd'T'HH:mm");
}

/** <input type="datetime-local"> の値を時刻にする。不正な値ならnull */
export function fromDateTimeInputValue(value: string): number | null {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** 量の表示。例：150g、1杯、0.5人前 */
export function formatAmount(amount: number, unit: string): string {
  const a = Math.round(amount * 10) / 10;
  return `${a}${unit}`;
}
