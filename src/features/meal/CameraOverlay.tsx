/**
 * アプリ内のカメラの画面（基本設計書 5.12、デザイン仕様書 6章。2026-11-08 追加）。
 * 画面いっぱいに映像を出し、シャッターで1コマを切り取る。シャッター音は鳴らない。
 * カメラを使えないときは、iPhoneの標準カメラ（シャッター音あり）に切り替えられる。
 */
import { IconCamera, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { cameraErrorMessage, closeCamera, grabFrame, openRearCamera } from '../../platform/camera';
import styles from './CameraOverlay.module.css';

interface Props {
  /** 撮った写真（または標準カメラ・ファイルで選んだ写真） */
  onCapture: (photo: Blob) => void;
  onClose: () => void;
}

export function CameraOverlay({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ kind: 'starting' | 'ready' } | { kind: 'error'; message: string }>({ kind: 'starting' });
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    openRearCamera()
      .then(async (s) => {
        if (cancelled) {
          closeCamera(s);
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        await video.play();
        if (!cancelled) setState({ kind: 'ready' });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ kind: 'error', message: cameraErrorMessage(error) });
      });
    return () => {
      cancelled = true;
      closeCamera(stream);
    };
  }, []);

  // 開いている間は、後ろの画面がスクロールしないようにする
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const shoot = async () => {
    const video = videoRef.current;
    if (!video || state.kind !== 'ready') return;
    const photo = await grabFrame(video);
    if (!photo) return;
    // 音の代わりに、画面を一瞬白くして撮れたことを伝える
    setFlash(true);
    onCapture(photo);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onCapture(file);
  };

  // 画面の切り替えの動き（transform）の中に置くと画面いっぱいにならないため、body の直下に出す
  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="カメラ">
      <video ref={videoRef} className={styles.video} playsInline muted autoPlay aria-hidden="true" />
      {flash && <div className={styles.flash} aria-hidden="true" />}

      <div className={styles.top}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="閉じる">
          <IconX size={26} stroke={2.2} />
        </button>
      </div>

      {state.kind === 'starting' && <p className={styles.message}>カメラを起動しています…</p>}
      {state.kind === 'error' && (
        <div className={styles.message}>
          <p>{state.message}</p>
        </div>
      )}

      <div className={styles.bottom}>
        <button
          type="button"
          className={styles.fallback}
          onClick={() => fallbackRef.current?.click()}
          aria-label="iPhoneの標準カメラで撮る（シャッター音あり）"
        >
          標準カメラ
        </button>
        <button
          type="button"
          className={styles.shutter}
          onClick={() => void shoot()}
          disabled={state.kind !== 'ready'}
          aria-label="撮影する"
        >
          <IconCamera size={30} stroke={2} aria-hidden="true" />
        </button>
        <span className={styles.spacer} />
      </div>
      <input ref={fallbackRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
    </div>,
    document.body,
  );
}
