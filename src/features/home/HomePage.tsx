/**
 * ホーム（基本設計書 3.3 画面1、デザイン仕様書 7.1）。
 */
import { IconCamera, IconClipboardCheck, IconPlus } from '@tabler/icons-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { db } from '../../db/db';
import { setMeta } from '../../db/repositories';
import { formatLongDate } from '../../domain/format';
import { shouldShowReview, yesterdayOf } from '../../domain/reminders';
import { AdviceCard } from '../../ui/AdviceCard';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { MealRow } from '../../ui/MealRow';
import { canUseInAppCamera } from '../../platform/camera';
import { CameraOverlay } from '../meal/CameraOverlay';
import { DaySummaryCard } from './DaySummaryCard';
import { ActivityCard } from './ActivityCard';
import { HomeNotices } from './HomeNotices';
import { useDay, useSettings, useToday } from '../hooks';
import styles from '../page.module.css';

export function HomePage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const today = useToday();
  const day = useDay(today);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isCameraOpen, setCameraOpen] = useState(false);

  // 記録日が変わってから初めて開いたら、前日のふりかえりを出す（基本設計書 5.10）
  useEffect(() => {
    if (!today) return;
    let cancelled = false;
    void (async () => {
      const checked = (await db.meta.get('lastReviewCheckedDate'))?.value ?? null;
      if (checked === today) return;
      const yesterday = yesterdayOf(today);
      const [meals, reviews] = await Promise.all([
        db.meals.where('localDate').equals(yesterday).toArray(),
        db.reviews.where('localDate').equals(yesterday).toArray(),
      ]);
      const show = shouldShowReview(
        today,
        checked as string | null,
        meals.some((m) => m.deleted === 0 && m.status === 'done'),
        reviews.some((r) => r.deleted === 0),
      );
      await setMeta(db, 'lastReviewCheckedDate', today);
      if (show && !cancelled) void navigate(`/review/${yesterday}?for=today`);
    })();
    return () => {
      cancelled = true;
    };
  }, [today, navigate]);

  if (!settings || !today || !day) return null;

  const latestAdvice = [...day.meals]
    .filter((m) => m.advice)
    .sort((a, b) => (b.advice?.createdAt ?? 0) - (a.advice?.createdAt ?? 0))[0]?.advice;

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void navigate('/meal/new', { state: { file } });
  };

  return (
    <div className={styles.columns}>
      <div className={styles.column}>
        <HomeNotices today={today} />
        <div>
          <div className={styles.dateLine}>{formatLongDate(today)}</div>
          <h1 style={{ margin: 0 }}>今日の状況</h1>
        </div>
        <DaySummaryCard day={day} />
        {/* 撮影ボタン：押すとすぐにカメラが起動する（基本設計書 5.12）。PCでは画像ファイルを選ぶ */}
        <div className={styles.cameraRow}>
          <Button variant="camera" onClick={() => (canUseInAppCamera() ? setCameraOpen(true) : fileRef.current?.click())}>
            <IconCamera size={26} stroke={2.2} aria-hidden="true" />
            撮って記録
          </Button>
          <Link to="/meal/new" className={styles.roundButton} aria-label="ほかの方法で記録する">
            <IconPlus size={28} stroke={2.4} />
          </Link>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className={styles.hiddenInput} onChange={onPick} />
          {/* シャッター音が鳴らないアプリ内のカメラ。使えない端末は標準カメラを開く（基本設計書 5.12） */}
          {isCameraOpen && (
            <CameraOverlay
              onClose={() => setCameraOpen(false)}
              onCapture={(file) => {
                setCameraOpen(false);
                void navigate('/meal/new', { state: { file } });
              }}
            />
          )}
        </div>
        <AdviceCard
          text={latestAdvice?.text ?? null}
          content={latestAdvice?.content}
          intake={day.intake}
          target={day.target.ok ? day.target.result.target : null}
          note={day.meals.length === 0 ? '食事を記録すると、次の食事のおすすめが表示されます。' : '今日の残りの目安です。'}
        />
        {settings.healthEnabled && <ActivityCard today={today} />}
      </div>
      <div className={styles.column}>
        <Card title="今日の食事">
          {day.meals.length === 0 ? (
            <p className={styles.empty}>まだ記録がありません</p>
          ) : (
            day.meals.map((m) => <MealRow key={m.id} meal={m} />)
          )}
        </Card>
        <Button variant="secondary" block onClick={() => void navigate(`/review/${today}?for=tomorrow`)}>
          <IconClipboardCheck size={20} stroke={2} aria-hidden="true" />
          今日をしめる
        </Button>
      </div>
    </div>
  );
}
