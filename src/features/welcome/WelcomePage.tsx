/**
 * 初回案内（基本設計書 3.3 画面14）。
 * 1 ホーム画面への追加 → 2 18歳以上の確認 → 3 プロフィールと目的・体重 → 4 APIキー → 5 データの扱い → 6 永続ストレージ
 */
import { IconBowlChopsticks } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { db } from '../../db/db';
import { DEFAULT_PLAN_VALUES, saveTargetPlan, updateSettings, upsertWeight } from '../../db/repositories';
import { toRecordDate } from '../../domain/date';
import { DEFAULT_GOAL_ADJUST, GOAL_LABELS } from '../../domain/target';
import type { Goal, Sex } from '../../domain/types';
import { isIosSafari, isStandalone } from '../../platform/device';
import { requestPersistentStorage } from '../../platform/storage';
import { Button } from '../../ui/Button';
import { Card, Sub } from '../../ui/Card';
import { Checkbox, ErrorList, Field, Input } from '../../ui/Field';
import { Chip, ChipGroup } from '../../ui/Chip';
import { ApiKeyForm } from '../settings/ApiKeyForm';
import { ProfileFields, validateProfile } from '../settings/SettingsPage';
import styles from '../page.module.css';

type Step = 'install' | 'age' | 'profile' | 'key' | 'data';

export function WelcomePage() {
  const navigate = useNavigate();
  // iPhone・iPadのSafariのタブで開いている場合は、ホーム画面への追加を案内する（保存場所が別になるため）
  const [step, setStep] = useState<Step>(() => (isIosSafari() && !isStandalone() ? 'install' : 'age'));
  const [isAdult, setIsAdult] = useState(false);
  const [sex, setSex] = useState<Sex | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<Goal>('lose');
  const [errors, setErrors] = useState<string[]>([]);

  const saveProfile = async () => {
    const errs = validateProfile(sex, birthDate, height);
    const w = Number(weight);
    if (!Number.isFinite(w) || w < 20 || w > 300) errs.push('体重は20〜300kgで入力してください。');
    setErrors(errs);
    if (errs.length) return;
    const now = Date.now();
    const settings = await db.settings.get('app');
    const today = toRecordDate(now, settings?.dayBoundaryHour ?? 4);
    await updateSettings(db, { sex: sex as Sex, birthDate, heightCm: Math.round(Number(height) * 10) / 10 }, now);
    await upsertWeight(db, today, Math.round(w * 10) / 10, now);
    await saveTargetPlan(db, today, { ...DEFAULT_PLAN_VALUES, goal, goalAdjustKcal: DEFAULT_GOAL_ADJUST[goal] }, now);
    setStep('key');
  };

  const finish = async () => {
    await requestPersistentStorage();
    await updateSettings(db, { onboardingDone: true }, Date.now());
    void navigate('/', { replace: true });
  };

  return (
    <div className={styles.page}>
      <div style={{ textAlign: 'center', padding: '16px 0 0' }}>
        <div
          style={{
            width: 80,
            height: 80,
            margin: '0 auto 8px',
            borderRadius: 22,
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconBowlChopsticks size={52} stroke={1.75} aria-hidden="true" />
        </div>
        <h1>ごはんくんへようこそ</h1>
        <Sub>食事を撮るだけで、カロリーと栄養を記録します。</Sub>
      </div>

      {step === 'install' && (
        <Card title="ホーム画面に追加してください">
          <ol style={{ paddingLeft: 20 }}>
            <li>Safariの下にある共有ボタン（四角から矢印が出ているアイコン）を押します。</li>
            <li>「ホーム画面に追加」を選びます。</li>
            <li>ホーム画面の「ごはんくん」から開き直してください。</li>
          </ol>
          <Sub>Safariのタブで開いた場合とホーム画面から開いた場合では、データの保存場所が別になります。必ずホーム画面から使ってください。</Sub>
        </Card>
      )}

      {step === 'age' && (
        <Card title="はじめに">
          <p>AIによる読み取りには、Googleの Gemini API を使います。Gemini API は18歳以上の方が使えます。</p>
          <Checkbox label="18歳以上です" checked={isAdult} onChange={setIsAdult} />
          <Button variant="primary" block disabled={!isAdult} onClick={() => setStep('profile')}>
            次へ
          </Button>
        </Card>
      )}

      {step === 'profile' && (
        <Card title="プロフィールと目的">
          <Sub>1日の目標カロリーと栄養素の計算に使います。この端末の中にだけ保存します。</Sub>
          <ProfileFields sex={sex} setSex={setSex} birthDate={birthDate} setBirthDate={setBirthDate} height={height} setHeight={setHeight} />
          <Field label="体重（kg）">
            <Input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <ChipGroup label="目的">
            {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
              <Chip key={g} variant="tint" selected={goal === g} onClick={() => setGoal(g)}>
                {GOAL_LABELS[g]}
              </Chip>
            ))}
          </ChipGroup>
          <ErrorList errors={errors} />
          <div style={{ marginTop: 12 }}>
            <Button variant="primary" block onClick={() => void saveProfile()}>
              次へ
            </Button>
          </div>
        </Card>
      )}

      {step === 'key' && (
        <Card title="AIの設定（APIキー）">
          <p>写真から料理を読み取るには、Gemini APIのキーが必要です。あとから設定画面でも設定できます。</p>
          <ApiKeyForm />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button variant="text" onClick={() => setStep('data')}>
              あとで
            </Button>
            <Button variant="primary" style={{ flex: 1 }} onClick={() => setStep('data')}>
              次へ
            </Button>
          </div>
        </Card>
      )}

      {step === 'data' && (
        <Card title="データについて">
          <ul style={{ paddingLeft: 20 }}>
            <li>記録はこの端末の中にだけ保存します。ホーム画面からアプリを削除すると、データも消えます。</li>
            <li>設定画面から定期的にバックアップを書き出してください（iCloud Driveに保存できます）。</li>
            <li>AIで読み取るときは、縮小した写真・文章・数値をGoogleに送ります。無料枠では、送った内容がGoogleのサービスの改善に使われる場合があります。</li>
            <li>カロリー・栄養価・提案は推定値・一般的な目安であり、医療的な助言ではありません。</li>
          </ul>
          <Button variant="primary" block onClick={() => void finish()}>
            はじめる
          </Button>
        </Card>
      )}
    </div>
  );
}
