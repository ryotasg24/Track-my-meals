/**
 * ショートカットの起動とクリップボード（要件定義書 3.9、基本設計書 6.5）。
 */

/**
 * ショートカットを起動する。ホーム画面から開いたアプリは、ショートカットから呼び戻せないため、
 * 利用者に左上の「◀」で戻ってもらう。
 * @param url domain/activity.ts の buildActivityShortcutUrl で作ったURL
 */
export function openShortcut(url: string): void {
  window.location.href = url;
}

/**
 * クリップボードの文字を読む。iPhoneでは「ペースト」の確認が出る。
 * ボタンを押したときの処理の中で呼ぶこと（利用者の操作がないと読めないため）。
 * @returns 読めなければnull
 */
export async function readClipboardText(): Promise<string | null> {
  if (!navigator.clipboard?.readText) return null;
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}
