/**
 * 今日（または指定した日）の状況：カロリーの輪と栄養素のタイル（F-DAY-01、02）。
 */
import { hasPendingInput } from '../../domain/mealPhotos';
import { Link } from 'react-router';
import { Card, Sub } from '../../ui/Card';
import { CalorieRing } from '../../ui/nutrition/CalorieRing';
import { NutrientTiles } from '../../ui/nutrition/NutrientTiles';
import type { DayData } from '../hooks';

const MISSING_TEXT = {
  profile: 'プロフィール（性別・生年月日・身長）を入力すると、目標を計算します。',
  weight: '体重を記録すると、目標を計算します。',
  plan: '目標の設定を保存すると、目標を計算します。',
};

const MISSING_LINK = { profile: '/settings', weight: '/weight', plan: '/target' };

export function DaySummaryCard({ day }: { day: DayData }) {
  const target = day.target.ok ? day.target.result.target : null;
  const hasPending = day.meals.some((m) => hasPendingInput(m));
  return (
    <Card>
      <Link to="/target" style={{ color: 'inherit', textDecoration: 'none' }} aria-label="目標の画面へ">
        <CalorieRing intake={day.intake.kcal} target={target?.kcal ?? null} />
      </Link>
      <NutrientTiles intake={day.intake} target={target} />
      {!day.target.ok && (
        <Sub>
          {MISSING_TEXT[day.target.missing]} <Link to={MISSING_LINK[day.target.missing]}>入力する</Link>
        </Sub>
      )}
      {hasPending && <Sub>読み取り待ちの食事は、合計に含まれていません。</Sub>}
    </Card>
  );
}
