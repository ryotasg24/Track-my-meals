/**
 * アプリ内のカメラ（基本設計書 5.12。2026-11-08 追加）。
 * iPhoneの標準カメラ（<input capture>）は、日本で売られている機種ではシャッター音を消せないため、
 * カメラの映像をアプリの画面に出し、1コマを切り取って写真にする（音は鳴らない）。
 */

/** アプリ内のカメラが使える端末か */
export function canUseInAppCamera(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * 背面のカメラの映像を開く。
 * AIに送る写真は長い辺1024pxに縮めるため、映像は1920px程度あれば十分。
 */
export async function openRearCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1920 },
    },
  });
}

/** 映像を止めて、カメラを解放する（使用中の表示を消す） */
export function closeCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * 映像の今の1コマをJPEGにする。縮小と付加情報の削除は、あとで preparePhoto が行う。
 * @returns 映像がまだ始まっていない場合はnull
 */
export async function grabFrame(video: HTMLVideoElement): Promise<Blob | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92));
}

/** カメラを開けなかった理由を、利用者向けの文言にする */
export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'カメラの使用が許可されていません。iPhoneの「設定」→「アプリ」→「Safari」→「カメラ」を「確認」か「許可」にしてください。';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'カメラが見つかりませんでした。';
  if (name === 'NotReadableError') return 'カメラをほかのアプリが使っています。ほかのアプリを閉じてから試してください。';
  return 'カメラを起動できませんでした。';
}
