/**
 * ふりかえりを出す条件と、お知らせの判定（基本設計書 5.10、5.14）。
 */
import { diffDays, MS_PER_DAY, shiftDate } from './date';

/**
 * 起動時・前面に戻ったときに、前日のふりかえりを出すか（F-ADV-02）。
 * @param today 今日の記録日
 * @param lastCheckedDate 最後に判定した記録日（未判定ならnull）
 * @param hasMealsYesterday 前日に記録済みの食事があるか
 * @param hasReviewYesterday 前日のふりかえりがすでにあるか
 */
export function shouldShowReview(
  today: string,
  lastCheckedDate: string | null,
  hasMealsYesterday: boolean,
  hasReviewYesterday: boolean,
): boolean {
  return lastCheckedDate !== today && hasMealsYesterday && !hasReviewYesterday;
}

/** 前日の記録日 */
export function yesterdayOf(today: string): string {
  return shiftDate(today, -1);
}

/**
 * バックアップを促すか（F-DATA-05）。
 * @param lastBackupAt 最後にバックアップした時刻（未実施ならnull）
 * @param firstLaunchAt 初回起動の時刻
 */
export function shouldRemindBackup(
  now: number,
  lastBackupAt: number | null,
  firstLaunchAt: number | null,
  reminderDays: number,
  hasRecords: boolean,
): boolean {
  const base = lastBackupAt ?? firstLaunchAt;
  if (!hasRecords || base === null) return false;
  return now - base >= reminderDays * MS_PER_DAY;
}

/**
 * 体重の記録を促すか（F-WGT-02）。
 * @param lastWeightDate 最後の体重の記録日（なければnull。その場合は促す）
 */
export function shouldRemindWeight(today: string, lastWeightDate: string | null, reminderDays: number): boolean {
  if (lastWeightDate === null) return true;
  return diffDays(today, lastWeightDate) >= reminderDays;
}
