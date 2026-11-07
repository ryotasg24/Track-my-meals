/**
 * 設定・プロフィール（基本設計書 3.3 画面11、F-SET-01〜05）。
 */
import { IconChevronRight, IconDownload, IconFileExport, IconKey, IconUpload } from '@tabler/icons-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { db } from '../../db/db';
import { changeDayBoundary, updateSettings } from '../../db/repositories';
import { formatDateTime } from '../../domain/format';
import { MEAL_TYPE_LABELS, MEAL_TYPE_ORDER } from '../../domain/mealType';
import type { MealTypeStarts, Settings, Sex } from '../../domain/types';
import { isStoragePersisted } from '../../platform/storage';
import { Button } from '../../ui/Button';
import { Card, Sub } from '../../ui/Card';
import { Checkbox, ErrorList, Field, FieldRow, Input, Select, TextArea } from '../../ui/Field';
import { useMeta, useSettings } from '../hooks';
import styles from '../page.module.css';
import { ApiKeyForm } from './ApiKeyForm';
import { runBackupExport, runCsvExport, runRestore } from './backupActions';

export function SettingsPage() {
  const settings = useSettings();
  const meta = useMeta();
  const [message, setMessage] = useState<string | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void isStoragePersisted().then(setIsPersisted);
  }, []);

  if (!settings || !meta) return null;
  const update = (patch: Partial<Settings>) => updateSettings(db, patch, Date.now());

  return (
    <div className={styles.page}>
      <h1>設定</h1>
      <div className={styles.columns}>
        <div className={styles.column}>
          <ProfileCard settings={settings} />
          <Card title="目標・記録">
            <LinkRow to="/target">目標の設定</LinkRow>
            <LinkRow to="/weight">体重</LinkRow>
            <LinkRow to="/favorites">よく食べるもの</LinkRow>
            <Field label="記録日の区切りの時刻（この時刻より前の食事は前日の記録）">
              <Select
                value={String(settings.dayBoundaryHour)}
                onChange={(e) => void changeDayBoundary(db, Number(e.target.value), Date.now())}
              >
                {[0, 1, 2, 3, 4, 5, 6].map((h) => (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                ))}
              </Select>
            </Field>
            <MealTypeStartsForm starts={settings.mealTypeStarts} onSave={(s) => void update({ mealTypeStarts: s })} />
          </Card>
          <Card
            title={
              <>
                <IconKey size={20} aria-hidden="true" />
                AI
              </>
            }
          >
            <ApiKeyForm />
            <FieldRow>
              <Field label="普段使うモデル">
                <Input defaultValue={settings.primaryModel} onBlur={(e) => e.target.value.trim() && void update({ primaryModel: e.target.value.trim() })} />
              </Field>
              <Field label="予備のモデル（空欄なら切り替えない）">
                <Input defaultValue={settings.fallbackModel ?? ''} onBlur={(e) => void update({ fallbackModel: e.target.value.trim() || null })} />
              </Field>
            </FieldRow>
            <Field label="提案の好み（苦手な食材、外食が多い など）">
              <TextArea defaultValue={settings.advicePreferences} maxLength={200} onBlur={(e) => void update({ advicePreferences: e.target.value })} />
            </Field>
          </Card>
        </div>
        <div className={styles.column}>
          <Card title="ヘルスケア連携">
            <Checkbox label="運動（アクティブエネルギー）を取り込む" checked={settings.healthEnabled} onChange={(v) => void update({ healthEnabled: v })} />
            <Field label="ショートカットの名前">
              <Input defaultValue={settings.shortcutName} onBlur={(e) => e.target.value.trim() && void update({ shortcutName: e.target.value.trim() })} />
            </Field>
            <LinkRow to="/settings/shortcut">ショートカットの導入手順</LinkRow>
          </Card>
          <Card title="データ">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button variant="secondary" onClick={async () => setMessage(await runBackupExport())}>
                <IconDownload size={20} aria-hidden="true" />
                バックアップを書き出す
              </Button>
              <Button variant="secondary" onClick={() => restoreRef.current?.click()}>
                <IconUpload size={20} aria-hidden="true" />
                バックアップから復元
              </Button>
              <Button variant="secondary" onClick={async () => setMessage(await runCsvExport())}>
                <IconFileExport size={20} aria-hidden="true" />
                CSVを書き出す
              </Button>
            </div>
            <input
              ref={restoreRef}
              type="file"
              accept="application/json,.json"
              className={styles.hiddenInput}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) setMessage(await runRestore(file));
              }}
            />
            {message && <p role="status">{message}</p>}
            <Sub>最後のバックアップ：{meta.lastBackupAt ? formatDateTime(meta.lastBackupAt) : 'まだありません'}</Sub>
            <FieldRow>
              <Field label="バックアップを促すまで（日）">
                <Input type="number" min={1} max={30} defaultValue={settings.backupReminderDays} onBlur={(e) => clampSave(e.target.value, 1, 30, (v) => update({ backupReminderDays: v }))} />
              </Field>
              <Field label="体重の記録を促すまで（日）">
                <Input type="number" min={1} max={30} defaultValue={settings.weightReminderDays} onBlur={(e) => clampSave(e.target.value, 1, 30, (v) => update({ weightReminderDays: v }))} />
              </Field>
            </FieldRow>
            <Sub>
              データの保護：{isPersisted === null ? '確認中' : isPersisted ? '保護されています' : '保護されていません（ホーム画面から開くと保護されやすくなります）'}
            </Sub>
            <Sub>データはこの端末の中にだけあります。ホーム画面からアプリを削除するとデータも消えるため、定期的にバックアップしてください。</Sub>
          </Card>
          <Card title="このアプリについて">
            <Sub>ごはんくん 版 {__APP_VERSION__}</Sub>
            <Sub>
              カロリー・栄養価・目標・提案は推定値・一般的な目安であり、医療的・栄養学的な助言ではありません。AIの推定は誤差を含みます。
            </Sub>
            <Sub>
              <a href={`${import.meta.env.BASE_URL}third-party-licenses.txt`} target="_blank" rel="noreferrer">
                ライセンス表示
              </a>
            </Sub>
          </Card>
        </div>
      </div>
    </div>
  );
}

function clampSave(value: string, min: number, max: number, save: (v: number) => unknown) {
  const v = Math.round(Number(value));
  if (Number.isFinite(v) && v >= min && v <= max) void save(v);
}

function LinkRow({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={styles.itemLine} style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--color-border)', marginBottom: 8 }}>
      <span>{children}</span>
      <IconChevronRight size={20} color="var(--color-text-sub)" aria-hidden="true" />
    </Link>
  );
}

/** プロフィール（F-SET-01）。性別・生年月日・身長は目標の計算に使う。ニックネームはAIに送らない */
function ProfileCard({ settings }: { settings: Settings }) {
  const [nickname, setNickname] = useState(settings.nickname);
  const [sex, setSex] = useState<Sex | ''>(settings.sex ?? '');
  const [birthDate, setBirthDate] = useState(settings.birthDate ?? '');
  const [height, setHeight] = useState(settings.heightCm ? String(settings.heightCm) : '');
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const errs = validateProfile(sex, birthDate, height);
    setErrors(errs);
    if (errs.length) return;
    await updateSettings(db, { nickname: nickname.trim(), sex: sex as Sex, birthDate, heightCm: Math.round(Number(height) * 10) / 10 }, Date.now());
    setSaved(true);
  };

  return (
    <Card title="プロフィール">
      <ProfileFields {...{ nickname, setNickname, sex, setSex, birthDate, setBirthDate, height, setHeight }} />
      <ErrorList errors={errors} />
      <Button variant="secondary" onClick={() => void save()}>
        保存
      </Button>
      {saved && <Sub>保存しました。</Sub>}
    </Card>
  );
}

export function validateProfile(sex: string, birthDate: string, height: string): string[] {
  const errs: string[] = [];
  if (sex !== 'male' && sex !== 'female') errs.push('性別を選んでください（目標の計算に使います）。');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) errs.push('生年月日を入力してください。');
  const h = Number(height);
  if (!Number.isFinite(h) || h < 100 || h > 250) errs.push('身長は100〜250cmで入力してください。');
  return errs;
}

export function ProfileFields(p: {
  nickname?: string;
  setNickname?: (v: string) => void;
  sex: Sex | '';
  setSex: (v: Sex | '') => void;
  birthDate: string;
  setBirthDate: (v: string) => void;
  height: string;
  setHeight: (v: string) => void;
}) {
  return (
    <>
      {p.setNickname && (
        <Field label="ニックネーム（任意。AIには送りません）">
          <Input value={p.nickname} maxLength={20} onChange={(e) => p.setNickname?.(e.target.value)} />
        </Field>
      )}
      <FieldRow>
        <Field label="性別">
          <Select value={p.sex} onChange={(e) => p.setSex(e.target.value as Sex | '')}>
            <option value="">選んでください</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
          </Select>
        </Field>
        <Field label="生年月日">
          <Input type="date" value={p.birthDate} onChange={(e) => p.setBirthDate(e.target.value)} />
        </Field>
        <Field label="身長（cm）">
          <Input type="number" inputMode="decimal" step="0.1" value={p.height} onChange={(e) => p.setHeight(e.target.value)} />
        </Field>
      </FieldRow>
    </>
  );
}

/** 食事の区分の区切り時刻（F-SET-03） */
function MealTypeStartsForm({ starts, onSave }: { starts: MealTypeStarts; onSave: (s: MealTypeStarts) => void }) {
  const [value, setValue] = useState(starts);
  return (
    <>
      <FieldRow>
        {MEAL_TYPE_ORDER.map((t) => (
          <Field key={t} label={`${MEAL_TYPE_LABELS[t]}の開始`}>
            <Input type="time" value={value[t]} onChange={(e) => setValue((v) => ({ ...v, [t]: e.target.value }))} onBlur={() => onSave(value)} />
          </Field>
        ))}
      </FieldRow>
    </>
  );
}
