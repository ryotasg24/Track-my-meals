/**
 * ふりかえり・調整案（基本設計書 3.3 画面5、F-ADV-02、03）。
 * ?for=today：前日のふりかえりから「今日の調整案」、?for=tomorrow：今日をしめるから「明日の調整案」。
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { formatLongDate } from '../../domain/format';
import { AdviceCard } from '../../ui/AdviceCard';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { CalorieRing } from '../../ui/nutrition/CalorieRing';
import { NutrientTiles } from '../../ui/nutrition/NutrientTiles';
import { PageHeader } from '../../ui/PageHeader';
import { createReview } from '../aiActions';
import { useDay, useReview } from '../hooks';
import styles from '../page.module.css';

export function ReviewPage() {
  const { date } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const forDay = params.get('for') === 'tomorrow' ? 'tomorrow' : 'today';
  const day = useDay(date);
  const review = useReview(date);
  const [state, setState] = useState<{ loading: boolean; note: string | null }>({ loading: false, note: null });
  const requested = useRef(false);

  const generate = async () => {
    if (!date) return;
    setState({ loading: true, note: null });
    const note = await createReview(date, forDay);
    setState({ loading: false, note });
  };

  // まだ調整案がなければ作る。すでにある場合は、作り直すかを利用者が選ぶ（基本設計書 5.10）
  useEffect(() => {
    if (review === undefined || review !== null || requested.current || !date) return;
    requested.current = true;
    setState({ loading: true, note: null });
    void createReview(date, forDay).then((note) => setState({ loading: false, note }));
  }, [review, date, forDay]);

  if (!date || !day || review === undefined) return null;
  const target = day.target.ok ? day.target.result.target : null;
  const title = forDay === 'today' ? '今日の調整案' : '明日の調整案';

  return (
    <div className={styles.page}>
      <PageHeader title={`${formatLongDate(date)}のふりかえり`} nav="close" to="/" />
      <Card title="目標との差">
        <CalorieRing intake={day.intake.kcal} target={target?.kcal ?? null} size={84} />
        <NutrientTiles intake={day.intake} target={target} />
      </Card>
      <AdviceCard
        title={title}
        text={review?.text ?? null}
        loading={state.loading}
        intake={day.intake}
        target={target}
        note={state.note ? `${state.note} 目標との差だけを表示しています。` : 'AIが使えないため、数値だけを表示しています。'}
        actions={
          review && !state.loading ? (
            <Button
              variant="secondary"
              onClick={() => {
                if (window.confirm('調整案を作り直しますか？')) void generate();
              }}
            >
              作り直す
            </Button>
          ) : null
        }
      />
      <Button variant="primary" block onClick={() => void navigate('/', { replace: true })}>
        閉じる
      </Button>
    </div>
  );
}
