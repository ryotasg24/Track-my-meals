/**
 * 読み取り結果（基本設計書 3.3 画面3、デザイン仕様書 7.4）。
 */
import { IconInfoCircle } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { mealTotal } from '../../domain/nutrition';
import { AdviceCard } from '../../ui/AdviceCard';
import { Button } from '../../ui/Button';
import { Card, Sub } from '../../ui/Card';
import { CalorieRing } from '../../ui/nutrition/CalorieRing';
import { NutrientTiles } from '../../ui/nutrition/NutrientTiles';
import { PageHeader } from '../../ui/PageHeader';
import { PhotoStrip } from '../../ui/PhotoStrip';
import { MEAL_TYPE_LABELS } from '../../domain/mealType';
import { refreshMealAdvice } from '../aiActions';
import { useDay, useMeal } from '../hooks';
import styles from '../page.module.css';
import { ItemList } from './ItemList';

export function ResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const meal = useMeal(id);
  const day = useDay(meal?.localDate);
  const [adviceState, setAdviceState] = useState<{ loading: boolean; note: string | null }>({ loading: false, note: null });
  const requested = useRef(false);

  // よく食べるもの・手入力で保存した直後は、おすすめを作る（F-ADV-01）
  const shouldRefresh = (location.state as { refreshAdvice?: boolean } | null)?.refreshAdvice === true;
  useEffect(() => {
    if (!shouldRefresh || !id || requested.current) return;
    requested.current = true;
    setAdviceState({ loading: true, note: null });
    void refreshMealAdvice(id).then((note) => setAdviceState({ loading: false, note }));
  }, [shouldRefresh, id]);

  if (meal === undefined || !day) return null;
  if (meal === null) {
    return (
      <div className={styles.page}>
        <PageHeader title="読み取り結果" nav="close" to="/" />
        <p className={styles.empty}>記録が見つかりません。</p>
      </div>
    );
  }

  const hasAiItems = meal.items.some((i) => i.source === 'photo' || i.source === 'text');
  const target = day.target.ok ? day.target.result.target : null;

  return (
    <div className={styles.page}>
      <PageHeader title="読み取り結果" nav="close" to="/" />
      <Card>
        <div style={{ marginBottom: 8 }}>
          {meal.photos.length > 0 && <PhotoStrip photos={meal.photos} label={`${MEAL_TYPE_LABELS[meal.mealType]}の写真`} />}
          {meal.inputText && <p style={{ margin: '8px 0 0' }}>「{meal.inputText}」</p>}
        </div>
        <ItemList items={meal.items} />
        {hasAiItems && (
          <Sub>
            <IconInfoCircle size={14} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> AIによる推定値です。写真だけでは量の推定がずれやすいため、違っていたら修正してください。
          </Sub>
        )}
      </Card>
      <Card title="この食事の合計">
        {/* 棒は、1日の目標に対するこの食事の割合 */}
        <NutrientTiles intake={mealTotal(meal)} target={target} mode="meal" />
        <Sub>
          カロリー {Math.round(mealTotal(meal).kcal).toLocaleString('ja-JP')}kcal
          {target && target.kcal > 0 && `（1日の目標の${Math.round((mealTotal(meal).kcal / target.kcal) * 100)}%）`}
          {target && '。数値の右と棒は、1日の目標に対するこの食事の分です'}
        </Sub>
      </Card>
      <Card title="今日の状況">
        <CalorieRing intake={day.intake.kcal} target={target?.kcal ?? null} size={84} />
        <NutrientTiles intake={day.intake} target={target} />
      </Card>
      <AdviceCard
        text={meal.advice?.text ?? null}
        content={meal.advice?.content}
        loading={adviceState.loading}
        intake={day.intake}
        target={target}
        note={adviceState.note ?? 'おすすめを作れなかったため、今日の残りの目安を表示しています。'}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" onClick={() => void navigate(`/meal/${meal.id}`, { replace: true })}>
          修正する
        </Button>
        <Button variant="primary" style={{ flex: 1 }} onClick={() => void navigate('/', { replace: true })}>
          閉じる
        </Button>
      </div>
    </div>
  );
}
