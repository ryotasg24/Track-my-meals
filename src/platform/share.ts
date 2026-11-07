/**
 * ファイルの書き出し（要件定義書 F-DATA-03、07、基本設計書 4.5）。
 * iPhoneでは共有メニューから「ファイル」アプリ（iCloud Drive）に保存できるようにする。
 */

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * 共有メニューでファイルを渡す。共有メニューが使えない環境（PCなど）ではダウンロードする。
 */
export async function shareOrDownloadFile(fileName: string, content: string, mimeType: string): Promise<ShareResult> {
  const file = new File([content], fileName, { type: mimeType });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  } finally {
    // クリック直後に消すとダウンロードが始まらないブラウザがあるため、少し待つ
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return 'downloaded';
}
