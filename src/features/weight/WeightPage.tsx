/**
 * 体重（基本設計書 3.3 画面7、F-WGT-01）。同じ日付に入力したら、その日の1件を上書きする。
 */
import { IconScale, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { deleteWeight, upsertWeight } from '../../db/repositories';
import { formatShortDate } from '../../domain/format';
import { Button } from '../../ui/Button';
import { Card, Sub } from '../../ui/Card';
import { ErrorList, Field, FieldRow, Input } from '../../ui/Field';
import { PageHeader } from '../../ui/PageHeader';
import { useToday, useWeights } from '../hooks';
import styles from '../page.module.css';

export function WeightPage() {
  const today = useToday();
  const weights = useWeights();
  const [date, setDate] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  if (!today || !weights) return null;
  const d = date ?? today;

  const save = async () => {
    const v = Number(value);
    const errs: string[] = [];
    if (!Number.isFinite(v) || v < 20 || v > 300) errs.push('体重は20〜300kgで入力してください。');
    if (d > today) errs.push('未来の日付には記録できません。');
    setErrors(errs);
    if (errs.length > 0) return;
    await upsertWeight(db, d, Math.round(v * 10) / 10, Date.now());
    setValue('');
    setSaved(true);
  };

  return (
    <div className={styles.page}>
      <PageHeader title="体重" />
      <Card
        title={
          <>
            <IconScale size={20} aria-hidden="true" />
            記録する
          </>
        }
      >
        <FieldRow>
          <Field label="日付">
            <Input type="date" value={d} max={today} onChange={(e) => setDate(e.target.value || null)} />
          </Field>
          <Field label="体重（kg）">
            <Input type="number" inputMode="decimal" step="0.1" min="20" max="300" value={value} onChange={(e) => { setValue(e.target.value); setSaved(false); }} />
          </Field>
        </FieldRow>
        <ErrorList errors={errors} />
        <Button variant="primary" block onClick={() => void save()}>
          保存
        </Button>
        {saved && <Sub>保存しました。目標は、この日以降の記録日から新しい体重で計算します。</Sub>}
      </Card>
      <Card title="これまでの記録">
        {weights.length === 0 && <p className={styles.empty}>まだ記録がありません</p>}
        <ul className={styles.list}>
          {weights.map((w) => (
            <li key={w.id} className={styles.itemLine}>
              <span>{formatShortDate(w.date)}</span>
              <span className={styles.kcal}>{w.weightKg.toFixed(1)} kg</span>
              <button
                type="button"
                aria-label={`${formatShortDate(w.date)}の体重を削除`}
                onClick={() => {
                  if (window.confirm('この記録を削除しますか？')) void deleteWeight(db, w.id, Date.now());
                }}
                style={{ width: 44, height: 44, border: 'none', background: 'none', color: 'var(--color-text-sub)', cursor: 'pointer' }}
              >
                <IconTrash size={18} />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
