/**
 * 目標（基本設計書 3.3 画面10、F-TGT-01〜05、F-SET-02）。
 * 設定を変えたら、変えた日の記録日から新しい設定を使う（過去の日の目標は変わらない）。
 */
import { IconTarget } from '@tabler/icons-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { DEFAULT_PLAN_VALUES, saveTargetPlan, type TargetPlanValues } from '../../db/repositories';
import { formatNutrient, NUTRIENT_LABELS, NUTRIENT_UNITS } from '../../domain/nutrition';
import { ACTIVITY_FACTORS, DEFAULT_GOAL_ADJUST, GOAL_LABELS, pickPlan } from '../../domain/target';
import { NUTRIENT_KEYS, type Goal, type NutrientKey } from '../../domain/types';
import { Button } from '../../ui/Button';
import { Card, Sub } from '../../ui/Card';
import { Chip, ChipGroup } from '../../ui/Chip';
import { ErrorList, Field, FieldRow, Input, Select } from '../../ui/Field';
import { PageHeader } from '../../ui/PageHeader';
import { useDay, usePlans, useToday } from '../hooks';
import styles from '../page.module.css';

export function TargetPage() {
  const today = useToday();
  const day = useDay(today);
  const plans = usePlans();
  if (!today || !day || !plans) return null;
  const current = pickPlan(plans, today);
  return <TargetForm key={current?.id ?? 'none'} today={today} day={day} initial={current ?? { ...DEFAULT_PLAN_VALUES }} />;
}

function TargetForm({ today, day, initial }: { today: string; day: NonNullable<ReturnType<typeof useDay>>; initial: TargetPlanValues }) {
  const [goal, setGoal] = useState<Goal>(initial.goal);
  const [activity, setActivity] = useState(String(initial.activityFactor));
  const [adjust, setAdjust] = useState(String(initial.goalAdjustKcal));
  const [protein, setProtein] = useState(String(initial.proteinPerKg));
  const [fatPct, setFatPct] = useState(String(Math.round(initial.fatRatio * 100)));
  const [typical, setTypical] = useState(String(initial.typicalActiveKcal));
  const [overrides, setOverrides] = useState<Record<NutrientKey, string>>(
    () => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, initial.overrides[k] === null ? '' : String(initial.overrides[k])])) as Record<NutrientKey, string>,
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const t = day.target;

  const save = async () => {
    const errs: string[] = [];
    const num = (s: string, min: number, max: number, label: string) => {
      const v = Number(s);
      if (s.trim() === '' || !Number.isFinite(v) || v < min || v > max) errs.push(`${label}は${min}〜${max}で入力してください。`);
      return v;
    };
    const values: TargetPlanValues = {
      goal,
      activityFactor: Number(activity),
      goalAdjustKcal: num(adjust, -1000, 1000, '目的による増減'),
      proteinPerKg: num(protein, 0.8, 2.5, 'たんぱく質の係数'),
      fatRatio: num(fatPct, 15, 40, '脂質の割合') / 100,
      typicalActiveKcal: num(typical, 0, 1500, '普段のアクティブエネルギー'),
      overrides: Object.fromEntries(
        NUTRIENT_KEYS.map((k) => {
          const s = overrides[k].trim();
          if (s === '') return [k, null];
          const v = Number(s);
          if (!Number.isFinite(v) || v <= 0) errs.push(`${NUTRIENT_LABELS[k]}の目標は0より大きい数で入力してください。`);
          return [k, v];
        }),
      ) as TargetPlanValues['overrides'],
    };
    setErrors(errs);
    if (errs.length > 0) return;
    await saveTargetPlan(db, today, values, Date.now());
    setSaved(true);
  };

  return (
    <div className={styles.page}>
      <PageHeader title="目標" />
      <Card
        title={
          <>
            <IconTarget size={20} aria-hidden="true" />
            今日の目標
          </>
        }
      >
        {t.ok ? (
          <>
            <ul className={styles.list}>
              {NUTRIENT_KEYS.map((k) => (
                <li key={k} className={styles.itemLine}>
                  <span>{NUTRIENT_LABELS[k]}</span>
                  <span className={styles.kcal}>
                    {formatNutrient(k, t.result.target[k])}
                    {NUTRIENT_UNITS[k]}
                    {k === 'fiber' || k === 'protein' ? '以上' : k === 'salt' ? '未満' : ''}
                  </span>
                </li>
              ))}
            </ul>
            <h2 style={{ marginTop: 12 }}>計算の内訳</h2>
            <Sub>
              基礎代謝 {t.result.bmr.toLocaleString('ja-JP')}kcal（体重{t.weightKg}kg）× 活動係数 {t.plan.activityFactor} ＋ 目的による増減{' '}
              {t.plan.goalAdjustKcal > 0 ? '+' : ''}
              {t.plan.goalAdjustKcal}kcal ＝ {Math.round(t.result.baseKcal).toLocaleString('ja-JP')}kcal
              {t.result.isFloorApplied && '（基礎代謝を下回るため、基礎代謝の値にしています）'}
            </Sub>
            <Sub>
              運動の上乗せ ＋{t.result.exerciseKcal}kcal
              {t.activeKcal !== null ? `（アクティブエネルギー${t.activeKcal}kcal − 普段${t.plan.typicalActiveKcal}kcal）` : '（取り込みなし）'}
            </Sub>
            {t.result.isCarbsClamped && <Sub>炭水化物が0未満になるため0にしています。設定を見直してください。</Sub>}
          </>
        ) : (
          <p>
            {t.missing === 'profile' ? '設定でプロフィールを入力してください。' : t.missing === 'weight' ? '体重を記録してください。' : '下の設定を保存すると、目標を計算します。'}
          </p>
        )}
        <Sub>一般的な目安であり、医療的な助言ではありません。</Sub>
      </Card>

      <Card title="目標の設定">
        <ChipGroup label="目的">
          {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
            <Chip
              key={g}
              variant="tint"
              selected={goal === g}
              onClick={() => {
                setGoal(g);
                setAdjust(String(DEFAULT_GOAL_ADJUST[g]));
              }}
            >
              {GOAL_LABELS[g]}
            </Chip>
          ))}
        </ChipGroup>
        <div style={{ marginTop: 12 }}>
          <Field label="活動係数（運動を除いた、日常生活の活動量）">
            <Select value={activity} onChange={(e) => setActivity(e.target.value)}>
              {ACTIVITY_FACTORS.map((a) => (
                <option key={a.value} value={String(a.value)}>
                  {a.value.toFixed(2)}：{a.label}
                </option>
              ))}
            </Select>
          </Field>
          <FieldRow>
            <Field label="目的による増減（kcal）">
              <Input type="number" inputMode="numeric" value={adjust} onChange={(e) => setAdjust(e.target.value)} />
            </Field>
            <Field label="たんぱく質（g／体重1kg）">
              <Input type="number" inputMode="decimal" step="0.1" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="脂質の割合（%）">
              <Input type="number" inputMode="numeric" value={fatPct} onChange={(e) => setFatPct(e.target.value)} />
            </Field>
            <Field label="普段のアクティブエネルギー（kcal）">
              <Input type="number" inputMode="numeric" value={typical} onChange={(e) => setTypical(e.target.value)} />
            </Field>
          </FieldRow>
        </div>
        <h2>自分で決めた値を使う（空欄なら計算した値）</h2>
        <FieldRow>
          {NUTRIENT_KEYS.map((k) => (
            <Field key={k} label={`${NUTRIENT_LABELS[k]}（${NUTRIENT_UNITS[k]}）`}>
              <Input type="number" inputMode="decimal" step="0.1" value={overrides[k]} onChange={(e) => setOverrides((o) => ({ ...o, [k]: e.target.value }))} />
            </Field>
          ))}
        </FieldRow>
        <ErrorList errors={errors} />
        <Button variant="primary" block onClick={() => void save()}>
          保存
        </Button>
        {saved && <Sub>保存しました。今日の記録日から新しい設定を使います（過去の日の目標は変わりません）。</Sub>}
      </Card>
    </div>
  );
}
