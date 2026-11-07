/**
 * 食事の写真（デザイン仕様書 8章）。写真がない食事は、淡いメインの色にどんぶりのアイコン。
 */
import { IconBowlChopsticks, IconHourglassHigh } from '@tabler/icons-react';
import { useEffect, useMemo } from 'react';
import styles from './Meal.module.css';

/** Blobを画面に表示するためのURL。写真が変わったときと画面を離れたときに解放する */
function useObjectUrl(blob: Blob | null | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

interface Props {
  blob: Blob | null;
  alt: string;
  size?: number;
  isPending?: boolean;
}

export function Thumbnail({ blob, alt, size = 48, isPending = false }: Props) {
  const url = useObjectUrl(blob);
  return (
    <div className={styles.thumb} style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt={alt} />
      ) : (
        <IconBowlChopsticks size={size * 0.55} stroke={2} aria-label={alt} />
      )}
      {isPending && (
        <span className={styles.pendingBadge} title="読み取り待ち">
          <IconHourglassHigh size={12} stroke={2.5} aria-label="読み取り待ち" />
        </span>
      )}
    </div>
  );
}
