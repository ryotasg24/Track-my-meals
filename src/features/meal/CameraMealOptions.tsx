/**
 * カメラの画面の、区分の選択と「既存の食事に追加する」の切り替え（F-REC-11、12、基本設計書 5.15）。
 * 区分は時刻から選んだものを初めから選んでおく。同じ記録日・同じ区分の食事があれば、初めから「追加する」にしておく。
 */
import { IconCheck } from '@tabler/icons-react';
import { formatTime } from '../../domain/format';
import { MEAL_TYPE_LABELS, MEAL_TYPE_ORDER } from '../../domain/mealType';
import type { Meal, MealType } from '../../domain/types';
import styles from './CameraOverlay.module.css';

interface Props {
  mealType: MealType;
  onMealTypeChange: (type: MealType) => void;
  /** 写真を追加できる、同じ区分の食事（なければnull） */
  mergeTarget: Pick<Meal, 'eatenAt' | 'photos'> | null;
  isMerging: boolean;
  onMergingChange: (value: boolean) => void;
}

export function CameraMealOptions({ mealType, onMealTypeChange, mergeTarget, isMerging, onMergingChange }: Props) {
  const label = MEAL_TYPE_LABELS[mealType];
  return (
    <>
      <div className={styles.types} role="group" aria-label="区分">
        {MEAL_TYPE_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.type} ${t === mealType ? styles.typeSelected : ''}`}
            aria-pressed={t === mealType}
            onClick={() => onMealTypeChange(t)}
          >
            {MEAL_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      {mergeTarget && (
        <button
          type="button"
          className={`${styles.merge} ${isMerging ? styles.mergeOn : ''}`}
          aria-pressed={isMerging}
          onClick={() => onMergingChange(!isMerging)}
        >
          <span className={styles.mergeBox} aria-hidden="true">
            {isMerging && <IconCheck size={14} stroke={3} />}
          </span>
          {`今日の${label}（${formatTime(mergeTarget.eatenAt)}・写真${mergeTarget.photos.length}枚）に追加する`}
        </button>
      )}
    </>
  );
}
