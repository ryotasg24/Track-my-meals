/**
 * 日ごとの状況（基本設計書 3.3 画面8'、F-DAY-04、F-HIS-02）。
 */
import { useParams } from 'react-router';
import { formatLongDate } from '../../domain/format';
import { AdviceCard } from '../../ui/AdviceCard';
import { LinkButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { MealRow } from '../../ui/MealRow';
import { PageHeader } from '../../ui/PageHeader';
import { DaySummaryCard } from '../home/DaySummaryCard';
import { useDay, useReview } from '../hooks';
import styles from '../page.module.css';

export function DayPage() {
  const { date } = useParams();
  const day = useDay(date);
  const review = useReview(date);
  if (!date || !day || review === undefined) return null;

  return (
    <div className={styles.page}>
      <PageHeader title={formatLongDate(date)} to="/calendar" />
      <div className={styles.columns}>
        <div className={styles.column}>
          <DaySummaryCard day={day} />
          {review && <AdviceCard title="翌日への調整案" text={review.text} />}
        </div>
        <div className={styles.column}>
          <Card title="食事">
            {day.meals.length === 0 ? <p className={styles.empty}>記録がありません</p> : day.meals.map((m) => <MealRow key={m.id} meal={m} />)}
          </Card>
          <LinkButton to={`/review/${date}?for=tomorrow`} variant="secondary">
            この日をふりかえる
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
