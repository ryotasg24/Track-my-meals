/**
 * 食事の写真の並び（F-REC-12、デザイン仕様書 6章）。横に並べ、押すと大きく表示する。
 * 食事の詳細では、写真の追加と削除もできる。
 */
import { IconCamera, IconPhoto, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { MAX_PHOTOS } from '../domain/mealPhotos';
import type { MealPhoto } from '../domain/types';
import styles from './Meal.module.css';
import { Thumbnail } from './Thumbnail';

interface Props {
  photos: MealPhoto[];
  /** 写真の説明（読み上げ用）。例：夕食の写真 */
  label: string;
  /** 写真を撮って追加する（食事の詳細） */
  onTake?: () => void;
  /** 保存した写真を選んで追加する（食事の詳細） */
  onPick?: () => void;
  /** 写真を削除する（食事の詳細） */
  onRemove?: (photoId: string) => void;
  disabled?: boolean;
}

export function PhotoStrip({ photos, label, onTake, onPick, onRemove, disabled = false }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = photos.find((p) => p.id === openId) ?? null;
  const canAdd = photos.length < MAX_PHOTOS && (onTake || onPick);

  return (
    <div>
      {open && (
        <div className={styles.photoLarge}>
          <button type="button" className={styles.photoButton} onClick={() => setOpenId(null)} aria-label="写真を小さく表示">
            <Thumbnail photo={open} alt={label} size={280} isPending={open.isPending} />
          </button>
          {onRemove && (
            <button
              type="button"
              className={styles.photoRemove}
              disabled={disabled}
              onClick={() => {
                if (!window.confirm('この写真を削除しますか？（品目はそのまま残ります）')) return;
                onRemove(open.id);
                setOpenId(null);
              }}
            >
              <IconTrash size={18} stroke={2} aria-hidden="true" />
              この写真を削除
            </button>
          )}
        </div>
      )}
      <ul className={styles.photoStrip} aria-label={label}>
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              className={`${styles.photoButton} ${p.id === openId ? styles.photoSelected : ''}`}
              onClick={() => setOpenId((id) => (id === p.id ? null : p.id))}
              aria-label={`${label}（${i + 1}枚目）を大きく表示`}
              aria-pressed={p.id === openId}
            >
              <Thumbnail photo={p} alt={`${label}（${i + 1}枚目）`} size={72} isPending={p.isPending} />
            </button>
          </li>
        ))}
        {photos.length === 0 && (
          <li>
            <Thumbnail photo={null} alt={`${label}はありません`} size={72} />
          </li>
        )}
        {canAdd && onTake && (
          <li>
            <button type="button" className={styles.photoAdd} onClick={onTake} disabled={disabled} aria-label="写真を撮って追加">
              <IconCamera size={24} stroke={2} aria-hidden="true" />
              <span>撮る</span>
            </button>
          </li>
        )}
        {canAdd && onPick && (
          <li>
            <button type="button" className={styles.photoAdd} onClick={onPick} disabled={disabled} aria-label="保存した写真から追加">
              <IconPhoto size={24} stroke={2} aria-hidden="true" />
              <span>選ぶ</span>
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
