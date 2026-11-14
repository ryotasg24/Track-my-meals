/**
 * 栄養素のタイル（デザイン仕様書 6章）。2列に並べ、食塩相当量だけ2列分の幅にする。
 * 状態は色だけでなく「超過」「達成」の札でも示す（10.2）。
 */
import { IconCheck } from '@tabler/icons-react';
import { formatNutrient, NUTRIENT_LABELS, nutrientStatus } from '../../domain/nutrition';
import type { NutrientKey, Nutrients } from '../../domain/types';
import { NutrientIcon, nutrientColors } from './NutrientIcon';
import styles from './Nutrition.module.css';

const KEYS: NutrientKey[] = ['protein', 'fat', 'carbs', 'fiber', 'salt'];

interface Props {
  intake: Nutrients;
  target: Nutrients | null;
  /**
   * day：1日の摂取量と目標（初期値）。meal：1つの食事の量を、1日の目標に対する割合の棒で示す。
   * meal では、1食だけで「超過」「達成」とは言えないため、札を出さない
   */
  mode?: 'day' | 'meal';
}

export function NutrientTiles({ intake, target, mode = 'day' }: Props) {
  return (
    <div className={styles.tiles}>
      {KEYS.map((key) => {
        const { fg, bg } = nutrientColors(key);
        const t = target?.[key] ?? null;
        const status = t !== null && mode === 'day' ? nutrientStatus(key, intake[key], t) : 'normal';
        const ratio = t ? Math.min(1, intake[key] / t) : 0;
        const goal = key === 'salt' ? '未満' : key === 'fiber' || key === 'protein' ? '以上' : '';
        const spoken =
          `${NUTRIENT_LABELS[key]}：${formatNutrient(key, intake[key])}グラム` +
          (t !== null
            ? mode === 'meal'
              ? `、1日の目標${formatNutrient(key, t)}グラムの${Math.round((intake[key] / t) * 100)}パーセント`
              : `、目標${formatNutrient(key, t)}グラム${goal}`
            : '') +
          (status === 'over' ? '、超過' : status === 'achieved' ? '、達成' : '');
        return (
          <div
            key={key}
            className={key === 'salt' ? `${styles.tile} ${styles.tileWide}` : styles.tile}
            style={{ background: bg, color: fg }}
            role="group"
            aria-label={spoken}
          >
            <div className={styles.tileHead} aria-hidden="true">
              <NutrientIcon nutrient={key} />
              <span>{NUTRIENT_LABELS[key]}</span>
              {status === 'over' && (
                <span className={styles.badge} style={{ background: fg, color: bg }}>
                  超過
                </span>
              )}
              {status === 'achieved' && (
                <span className={styles.badgeAchieved}>
                  <IconCheck size={14} stroke={3} />
                  達成
                </span>
              )}
            </div>
            <div className={`num ${styles.tileValue}`} aria-hidden="true">
              {formatNutrient(key, intake[key])}
              <span className={styles.tileTarget}> / {t !== null ? formatNutrient(key, t) : '―'}g</span>
            </div>
            <div className={styles.bar} aria-hidden="true">
              <div className={styles.barValue} style={{ width: `${ratio * 100}%`, background: fg }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
