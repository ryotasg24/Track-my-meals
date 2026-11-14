/**
 * 食事の写真（デザイン仕様書 8章）。写真がない食事は、淡いメインの色にどんぶりのアイコン。
 */
import { IconBowlChopsticks, IconHourglassHigh } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { photoBlob } from '../domain/mealPhotos';
import type { MealPhoto } from '../domain/types';
import styles from './Meal.module.css';

/** 表示を試し直す回数（読み込みに失敗したとき） */
const MAX_RETRY = 2;

/**
 * 写真を画面に表示するためのURL。写真が変わったときと画面を離れたときに解放する。
 * 保存したデータから毎回メモリ上にBlobを作り直す（iPhoneで、保存した直後のBlobが表示できないことがあるため）。
 * @param attempt 試し直した回数。変わるとURLを作り直す
 */
function usePhotoUrl(photo: Pick<MealPhoto, 'thumbnail' | 'mimeType'> | null | undefined, attempt: number): string | null {
  const url = useMemo(
    () => (photo ? URL.createObjectURL(photoBlob(photo.thumbnail, photo.mimeType)) : null),
    // attempt が変わったら作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photo, attempt],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

interface Props {
  photo: Pick<MealPhoto, 'thumbnail' | 'mimeType'> | null;
  alt: string;
  size?: number;
  isPending?: boolean;
  /** 写真の枚数（2枚以上のとき、右上に枚数を出す） */
  count?: number;
}

export function Thumbnail({ photo, alt, size = 48, isPending = false, count = 0 }: Props) {
  const [attempt, setAttempt] = useState(0);
  const url = usePhotoUrl(photo, attempt);
  return (
    <div className={styles.thumb} style={{ width: size, height: size }}>
      {url && attempt <= MAX_RETRY ? (
        <img
          src={url}
          alt={alt}
          // 読み込みに失敗したら、少し待ってURLを作り直す
          onError={() => window.setTimeout(() => setAttempt((n) => n + 1), 300)}
        />
      ) : (
        <IconBowlChopsticks size={size * 0.55} stroke={2} aria-label={alt} />
      )}
      {count > 1 && (
        <span className={styles.countBadge} aria-label={`写真${count}枚`}>
          {count}
        </span>
      )}
      {isPending && (
        <span className={styles.pendingBadge} title="読み取り待ち">
          <IconHourglassHigh size={12} stroke={2.5} aria-label="読み取り待ち" />
        </span>
      )}
    </div>
  );
}
