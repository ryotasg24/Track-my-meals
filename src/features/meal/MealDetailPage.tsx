/**
 * 食事の詳細・編集（基本設計書 3.3 画面4、F-REC-08）。
 * 品目の追加・削除・量の変更、区分と日時の変更、削除、保存したおすすめ、読み取り待ちの読み取り。
 */
import { IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db } from '../../db/db';
import { deleteMeal, newId, updateMeal } from '../../db/repositories';
import { formatDateTime, fromDateTimeInputValue, toDateTimeInputValue } from '../../domain/format';
import { MEAL_TYPE_LABELS, MEAL_TYPE_ORDER } from '../../domain/mealType';
import { rescaleForAmount } from '../../domain/nutrition';
import type { MealItem } from '../../domain/types';
import { AdviceCard } from '../../ui/AdviceCard';
import { Button } from '../../ui/Button';
import { Card, Sub } from '../../ui/Card';
import { Chip, ChipGroup } from '../../ui/Chip';
import { Field, Input } from '../../ui/Field';
import { PageHeader } from '../../ui/PageHeader';
import { Thumbnail } from '../../ui/Thumbnail';
import { analyzePending, refreshMealAdvice } from '../aiActions';
import { useDay, useMeal, useNow, useSettings } from '../hooks';
import styles from '../page.module.css';
import { FavoritePicker } from './FavoritePicker';
import { ItemForm, type ItemValues } from './ItemForm';
import { ItemList } from './ItemList';

/** 保存する時刻（操作したときに呼ぶ。画面を描く処理の中では呼ばない） */
const now = () => Date.now();

export function MealDetailPage() {
  const clock = useNow(30_000);
  const { id } = useParams();
  const navigate = useNavigate();
  const settings = useSettings();
  const meal = useMeal(id);
  const day = useDay(meal?.localDate);
  const [editing, setEditing] = useState<MealItem | null>(null);
  const [adding, setAdding] = useState<'none' | 'favorite' | 'manual'>('none');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);

  if (meal === undefined || !settings || !day) return null;
  if (meal === null || meal.deleted === 1) {
    return (
      <div className={styles.page}>
        <PageHeader title="食事の詳細" />
        <p className={styles.empty}>記録が見つかりません。</p>
      </div>
    );
  }

  const saveItems = (items: MealItem[]) => updateMeal(db, meal.id, { items }, settings.dayBoundaryHour, now());

  /** 品目を編集する。量だけを変えた場合は、栄養価を同じ割合で計算し直す（5.7） */
  const saveEdit = async (v: ItemValues) => {
    if (!editing) return;
    const sameNutrients = (Object.keys(v.nutrients) as (keyof typeof v.nutrients)[]).every(
      (k) => Math.abs(v.nutrients[k] - Math.round(editing.nutrients[k] * 10) / 10) < 0.05,
    );
    const amountChanged = v.amount !== editing.amount && v.unit === editing.unit;
    const nutrients = amountChanged && sameNutrients ? rescaleForAmount(editing.nutrients, editing.amount, v.amount) : v.nutrients;
    await saveItems(meal.items.map((i) => (i.id === editing.id ? { ...i, ...v, nutrients } : i)));
    setMessage(v.unit !== editing.unit ? '単位を変えたため、栄養価も見直してください。' : null);
    setEditing(null);
  };

  const addItem = async (v: ItemValues, source: MealItem['source'], favoriteId: string | null) => {
    await saveItems([...meal.items, { id: newId(), ...v, source, favoriteId, model: null }]);
    setAdding('none');
  };

  const remove = async () => {
    if (!window.confirm('この食事の記録を削除しますか？')) return;
    await deleteMeal(db, meal.id, now());
    void navigate(-1);
  };

  const target = day.target.ok ? day.target.result.target : null;

  return (
    <div className={styles.page}>
      <PageHeader title={`${MEAL_TYPE_LABELS[meal.mealType]}の詳細`} />
      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="button" onClick={() => setIsPhotoOpen((v) => !v)} aria-label="写真を大きく表示" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
            <Thumbnail blob={meal.thumbnail} alt="食事の写真" size={isPhotoOpen ? 280 : 88} isPending={meal.status === 'pending'} />
          </button>
          {!isPhotoOpen && (
            <div>
              <div>{formatDateTime(meal.eatenAt)}</div>
              {meal.inputText && <Sub>「{meal.inputText}」</Sub>}
            </div>
          )}
        </div>
      </Card>

      {meal.status === 'pending' && (
        <Card tone="tint">
          <p>この食事は読み取り待ちです。</p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await analyzePending(meal.id);
              setBusy(false);
              if (r.kind === 'pending') setMessage(r.message);
              else if (r.kind === 'notFood') {
                setMessage(`料理が見つかりませんでした：${r.reason}`);
                if (!r.keptMealId) void navigate('/', { replace: true });
              } else void navigate(`/meal/${meal.id}/result`, { replace: true });
            }}
          >
            {busy ? '読み取り中…' : '今すぐ読み取る'}
          </Button>
        </Card>
      )}

      <Card>
        <ChipGroup label="区分">
          {MEAL_TYPE_ORDER.map((t) => (
            <Chip key={t} selected={meal.mealType === t} onClick={() => void updateMeal(db, meal.id, { mealType: t }, settings.dayBoundaryHour, now())}>
              {MEAL_TYPE_LABELS[t]}
            </Chip>
          ))}
        </ChipGroup>
        <div style={{ marginTop: 12 }}>
          <Field label="食べた日時">
            <Input
              type="datetime-local"
              value={toDateTimeInputValue(meal.eatenAt)}
              max={toDateTimeInputValue(clock)}
              onChange={(e) => {
                const v = fromDateTimeInputValue(e.target.value);
                if (v !== null) void updateMeal(db, meal.id, { eatenAt: Math.min(v, now()) }, settings.dayBoundaryHour, now());
              }}
            />
          </Field>
        </div>
      </Card>

      <Card title="品目" aside="押すと編集">
        {editing ? (
          <ItemForm initial={editing} submitLabel="保存" onSubmit={saveEdit} onCancel={() => setEditing(null)} />
        ) : (
          <>
            <ItemList items={meal.items} onSelect={setEditing} />
            {meal.items.length === 0 && <p className={styles.empty}>品目がありません</p>}
          </>
        )}
        {editing && (
          <Button
            variant="danger"
            onClick={async () => {
              await saveItems(meal.items.filter((i) => i.id !== editing.id));
              setEditing(null);
            }}
          >
            この品目を外す
          </Button>
        )}
        {message && <Sub>{message}</Sub>}
        {!editing && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setAdding(adding === 'favorite' ? 'none' : 'favorite')}>
              よく食べるものから追加
            </Button>
            <Button variant="secondary" onClick={() => setAdding(adding === 'manual' ? 'none' : 'manual')}>
              手入力で追加
            </Button>
          </div>
        )}
        {adding === 'favorite' && (
          <div style={{ marginTop: 12 }}>
            <FavoritePicker onAdd={(v, favId) => void addItem(v, 'favorite', favId)} />
          </div>
        )}
        {adding === 'manual' && (
          <div style={{ marginTop: 12 }}>
            <ItemForm submitLabel="追加" onSubmit={(v) => addItem(v, 'manual', null)} onCancel={() => setAdding('none')} />
          </div>
        )}
      </Card>

      {meal.status === 'done' && (
        <AdviceCard
          text={meal.advice?.text ?? null}
          content={meal.advice?.content}
          loading={busy}
          intake={day.intake}
          target={target}
          note="おすすめはまだありません。"
          actions={
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const note = await refreshMealAdvice(meal.id);
                setBusy(false);
                if (note) setMessage(note);
              }}
            >
              おすすめを作り直す
            </Button>
          }
        />
      )}

      <Button variant="danger" onClick={() => void remove()}>
        <IconTrash size={18} aria-hidden="true" />
        この食事を削除
      </Button>
    </div>
  );
}
