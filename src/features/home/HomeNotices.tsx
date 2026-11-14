/**
 * ホームのお知らせ（基本設計書 3.3 画面1、5.14）。撮影ボタンが押し出されないよう、最大2件まで表示する。
 */
import { hasPendingInput } from '../../domain/mealPhotos';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { shouldRemindBackup, shouldRemindWeight } from '../../domain/reminders';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Card';
import { analyzePending } from '../aiActions';
import { runBackupExport } from '../settings/backupActions';
import { useAllMeals, useApiKeyInfo, useMeta, useNow, useSettings, useWeights } from '../hooks';

const MAX_NOTICES = 2;

export function HomeNotices({ today }: { today: string }) {
  const settings = useSettings();
  const meals = useAllMeals();
  const weights = useWeights();
  const meta = useMeta();
  const key = useApiKeyInfo();
  const now = useNow(60_000);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!settings || !meals || !weights || !meta || !key) return null;

  const pending = meals.filter((m) => m.deleted === 0 && hasPendingInput(m));
  const notices: { id: string; tone: 'warn' | 'info'; body: ReactNode }[] = [];

  if (pending.length > 0) {
    notices.push({
      id: 'pending',
      tone: 'info',
      body: (
        <Row text={`読み取り待ちの食事が${pending.length}件あります`}>
          <Button
            variant="secondary"
            disabled={busy || !key.hasKey}
            onClick={async () => {
              setBusy(true);
              let last: string | null = null;
              for (const m of pending) {
                const r = await analyzePending(m.id);
                if (r.kind === 'pending') {
                  last = r.message;
                  break;
                }
                if (r.kind === 'notFood') last = `料理が見つからなかった写真がありました：${r.reason}`;
              }
              setMessage(last);
              setBusy(false);
            }}
          >
            {busy ? '読み取り中…' : '今すぐ読み取る'}
          </Button>
        </Row>
      ),
    });
  }
  if (!key.hasKey) {
    notices.push({
      id: 'key',
      tone: 'warn',
      body: (
        <Row text="AIを使うにはAPIキーの設定が必要です">
          <Link to="/settings/api-key">設定する</Link>
        </Row>
      ),
    });
  }
  const lastWeight = weights[0]?.date ?? null;
  if (shouldRemindWeight(today, lastWeight, settings.weightReminderDays)) {
    notices.push({
      id: 'weight',
      tone: 'warn',
      body: (
        <Row text={lastWeight ? `最後の体重の記録から${settings.weightReminderDays}日以上たちました` : '体重を記録すると、目標を計算できます'}>
          <Link to="/weight">記録する</Link>
        </Row>
      ),
    });
  }
  if (shouldRemindBackup(now, meta.lastBackupAt, meta.firstLaunchAt, settings.backupReminderDays, meals.length > 0)) {
    notices.push({
      id: 'backup',
      tone: 'warn',
      body: (
        <Row text={`最後のバックアップから${settings.backupReminderDays}日以上たちました`}>
          <Button variant="secondary" onClick={async () => setMessage(await runBackupExport())}>
            今すぐバックアップ
          </Button>
        </Row>
      ),
    });
  }

  const shown = notices.slice(0, MAX_NOTICES);
  const rest = notices.length - shown.length;
  if (shown.length === 0 && !message) return null;

  return (
    <>
      {shown.map((n) => (
        <Notice key={n.id} tone={n.tone}>
          {n.body}
        </Notice>
      ))}
      {rest > 0 && <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-sub)' }}>ほか{rest}件のお知らせがあります</div>}
      {message && (
        <Notice tone="info">
          <Row text={message}>
            <Button variant="text" onClick={() => setMessage(null)}>
              閉じる
            </Button>
          </Row>
        </Notice>
      )}
    </>
  );
}

function Row({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
      <span>{text}</span>
      {children}
    </div>
  );
}
