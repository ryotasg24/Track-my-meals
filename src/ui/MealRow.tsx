/**
 * 食事の行（デザイン仕様書 6章）：写真、区分と時刻の札、品目名、カロリー。
 */
import { Link } from 'react-router';
import { formatTime } from '../domain/format';
import { hasPendingInput } from '../domain/mealPhotos';
import { MEAL_TYPE_LABELS } from '../domain/mealType';
import { formatNutrient, mealTotal } from '../domain/nutrition';
import type { Meal } from '../domain/types';
import { Thumbnail } from './Thumbnail';
import styles from './Meal.module.css';

/** 品目名の要約。例：味噌煮込みうどん ほか2品 */
export function itemsSummary(meal: Meal): string {
  if (meal.status === 'pending') return meal.inputText ? `読み取り待ち：${meal.inputText}` : '読み取り待ちの写真';
  const first = meal.items[0]?.name;
  if (!first) return '品目なし';
  return meal.items.length > 1 ? `${first} ほか${meal.items.length - 1}品` : first;
}

export function MealRow({ meal }: { meal: Meal }) {
  const summary = itemsSummary(meal);
  return (
    <Link to={`/meal/${meal.id}`} className={styles.row}>
      <Thumbnail
        photo={meal.photos[0] ?? null}
        alt={`${MEAL_TYPE_LABELS[meal.mealType]}の写真：${summary}`}
        isPending={hasPendingInput(meal)}
        count={meal.photos.length}
      />
      <div className={styles.rowMain}>
        <span className={styles.typePill}>
          {MEAL_TYPE_LABELS[meal.mealType]} {formatTime(meal.eatenAt)}
        </span>
        <div className={styles.rowName}>{summary}</div>
      </div>
      {meal.status === 'done' && (
        <div className={`num ${styles.rowKcal}`}>
          {formatNutrient('kcal', mealTotal(meal).kcal)}
          <span> kcal</span>
        </div>
      )}
    </Link>
  );
}
