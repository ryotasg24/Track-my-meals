/**
 * カロリーの輪（デザイン仕様書 6章）。食べた分はコーラル、残りは薄い色。超過したら危険の色。
 */
import { formatNutrient, nutrientStatus, remaining } from '../../domain/nutrition';
import styles from './Nutrition.module.css';

interface Props {
  intake: number;
  target: number | null;
  size?: number;
}

export function CalorieRing({ intake, target, size = 104 }: Props) {
  const stroke = size >= 100 ? 13 : 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const isOver = target !== null && nutrientStatus('kcal', intake, target) === 'over';
  const ratio = target ? Math.min(1, intake / target) : 0;
  const rest = target !== null ? remaining('kcal', intake, target) : null;

  const label =
    target === null
      ? `カロリー：${formatNutrient('kcal', intake)}キロカロリー`
      : `カロリー：${formatNutrient('kcal', intake)}キロカロリー、目標${formatNutrient('kcal', target)}、` +
        (isOver ? `${-(rest ?? 0)}超過` : `あと${rest}`);

  return (
    <div className={styles.ringWrap} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-primary-track)" strokeWidth={stroke} />
        <circle
          className={styles.ringValue}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={isOver ? 'var(--color-danger)' : 'var(--color-primary)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circ * (isOver ? 1 : ratio)} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className={styles.ringText}>
        <div className={styles.ringLabel}>摂取 / 目標</div>
        <div className={`num ${styles.ringBig}`}>{formatNutrient('kcal', intake)}</div>
        <div className={styles.ringSub}>/ {target !== null ? formatNutrient('kcal', target) : '―'} kcal</div>
        {rest !== null && (
          <span className={isOver ? `${styles.pill} ${styles.pillOver}` : styles.pill}>
            {isOver ? `${(-rest).toLocaleString('ja-JP')} kcal 超過` : `あと ${rest.toLocaleString('ja-JP')} kcal`}
          </span>
        )}
      </div>
    </div>
  );
}
