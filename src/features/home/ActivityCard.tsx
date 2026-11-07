/**
 * 運動の上乗せ（要件定義書 3.9、基本設計書 6.5）。
 * ショートカットでアクティブエネルギーをクリップボードにコピーし、［貼り付け］で取り込む。手入力もできる。
 */
import { IconRun } from '@tabler/icons-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { upsertActivity } from '../../db/repositories';
import { buildActivityShortcutUrl, parseActivityText } from '../../domain/activity';
import { Button } from '../../ui/Button';
import { Card, Sub } from '../../ui/Card';
import { Input } from '../../ui/Field';
import { openShortcut, readClipboardText } from '../../platform/shortcut';
import { useActivities, useDay, useSettings } from '../hooks';

export function ActivityCard({ today }: { today: string }) {
  const settings = useSettings();
  const activities = useActivities();
  const day = useDay(today);
  const [message, setMessage] = useState<string | null>(null);
  const [isManual, setIsManual] = useState(false);
  const [manualValue, setManualValue] = useState('');

  if (!settings || !activities || !day) return null;
  const activity = activities.find((a) => a.localDate === today);
  const extra = day.target.ok ? day.target.result.exerciseKcal : 0;

  const paste = async () => {
    const text = await readClipboardText();
    if (text === null) {
      setMessage('クリップボードを読めませんでした。手で入力してください。');
      setIsManual(true);
      return;
    }
    const r = parseActivityText(text, today, settings.dayBoundaryHour);
    if (!r.ok) {
      setMessage(r.error);
      return;
    }
    await upsertActivity(db, today, r.activeKcal, 'shortcut', Date.now());
    setMessage(`アクティブエネルギー ${r.activeKcal}kcal を取り込みました。`);
  };

  const saveManual = async () => {
    const v = Number(manualValue);
    if (!Number.isFinite(v) || v < 0 || v > 5000) {
      setMessage('0〜5,000kcalで入力してください。');
      return;
    }
    await upsertActivity(db, today, Math.round(v), 'manual', Date.now());
    setIsManual(false);
    setManualValue('');
    setMessage('保存しました。');
  };

  return (
    <Card
      title={
        <>
          <IconRun size={20} stroke={2} aria-hidden="true" />
          運動の上乗せ
        </>
      }
      aside={<span className="num" style={{ fontWeight: 800, color: 'var(--color-primary-strong)', fontSize: '1rem' }}>＋{extra}kcal</span>}
    >
      <Sub>
        {activity
          ? `アクティブエネルギー ${activity.activeKcal}kcal（普段より多い分を目標に足しています）`
          : 'ヘルスケアのアクティブエネルギーを取り込むと、運動した分を目標に足します。'}
      </Sub>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => openShortcut(buildActivityShortcutUrl(settings.shortcutName, today, settings.dayBoundaryHour))}>
          運動を取り込む
        </Button>
        <Button variant="secondary" onClick={() => void paste()}>
          貼り付け
        </Button>
        <Button variant="text" onClick={() => setIsManual((v) => !v)}>
          手で入力
        </Button>
      </div>
      {isManual && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="kcal"
            aria-label="アクティブエネルギー（kcal）"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
          />
          <Button variant="secondary" onClick={() => void saveManual()}>
            保存
          </Button>
        </div>
      )}
      {message && <Sub>{message}</Sub>}
    </Card>
  );
}
