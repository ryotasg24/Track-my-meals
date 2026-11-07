/**
 * 品目の入力欄（手入力・よく食べるもの・品目の編集で共通。基本設計書 3.3 画面2、4、6）。
 * 名前とカロリーは必須。ほかの栄養素は空欄なら0として扱う。
 */
import { useState } from 'react';
import { NUTRIENT_LABELS } from '../../domain/nutrition';
import type { NutrientKey, Nutrients } from '../../domain/types';
import { Button } from '../../ui/Button';
import { ErrorList, Field, FieldRow, Input } from '../../ui/Field';

export interface ItemValues {
  name: string;
  amount: number;
  unit: string;
  nutrients: Nutrients;
}

const UNITS = ['g', 'ml', '杯', '個', '枚', '本', '皿', '人前'];
const KEYS: NutrientKey[] = ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'salt'];
/** 1品目の上限（AIの回答のチェックと同じ。基本設計書 5.8） */
const LIMITS: Record<NutrientKey, number> = { kcal: 5000, protein: 500, fat: 500, carbs: 500, fiber: 100, salt: 50 };

const toText = (n: number) => (n === 0 ? '' : String(Math.round(n * 10) / 10));

interface Props {
  initial?: ItemValues;
  submitLabel: string;
  onSubmit: (values: ItemValues) => void | Promise<void>;
  onCancel?: () => void;
}

export function ItemForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '1');
  const [unit, setUnit] = useState(initial?.unit ?? '人前');
  const [values, setValues] = useState<Record<NutrientKey, string>>(() =>
    Object.fromEntries(KEYS.map((k) => [k, initial ? toText(initial.nutrients[k]) : ''])) as Record<NutrientKey, string>,
  );
  const [errors, setErrors] = useState<string[]>([]);

  const submit = async () => {
    const errs: string[] = [];
    const trimmed = name.trim();
    if (!trimmed) errs.push('名前を入力してください。');
    if (trimmed.length > 40) errs.push('名前は40文字までです。');
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) errs.push('量は0より大きい数で入力してください。');
    if (!unit.trim()) errs.push('単位を入力してください。');
    if (values.kcal.trim() === '') errs.push('カロリーを入力してください。');
    const nutrients = {} as Nutrients;
    for (const k of KEYS) {
      const v = values[k].trim() === '' ? 0 : Number(values[k]);
      if (!Number.isFinite(v) || v < 0 || v > LIMITS[k]) errs.push(`${NUTRIENT_LABELS[k]}は0〜${LIMITS[k]}で入力してください。`);
      nutrients[k] = v;
    }
    setErrors(errs);
    if (errs.length > 0) return;
    await onSubmit({ name: trimmed, amount: a, unit: unit.trim(), nutrients });
  };

  return (
    <div>
      <Field label="名前（必須）">
        <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="例：白ごはん" />
      </Field>
      <FieldRow>
        <Field label="量">
          <Input type="number" inputMode="decimal" min="0" step="0.1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="単位">
          <Input list="tmm-units" value={unit} maxLength={10} onChange={(e) => setUnit(e.target.value)} />
        </Field>
      </FieldRow>
      <datalist id="tmm-units">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <FieldRow>
        {KEYS.map((k) => (
          <Field key={k} label={`${NUTRIENT_LABELS[k]}（${k === 'kcal' ? 'kcal・必須' : 'g'}）`}>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={values[k]}
              onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
            />
          </Field>
        ))}
      </FieldRow>
      <ErrorList errors={errors} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => void submit()}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="text" onClick={onCancel}>
            キャンセル
          </Button>
        )}
      </div>
    </div>
  );
}
