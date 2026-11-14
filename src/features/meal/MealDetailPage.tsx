/**
 * 食事の詳細・編集（基本設計書 3.3 画面4、F-REC-08）。
 * 品目の追加・削除・量の変更、区分と日時の変更、削除、保存したおすすめ、読み取り待ちの読み取り。
 */
import { IconTrash } from '@tabler/icons-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db } from '../../db/db';
import { deleteMeal, newId, removePhoto, updateMeal } from '../../db/repositories';
import { hasPendingInput } from '../../domain/mealPhotos';
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
import { PhotoStrip } from '../../ui/PhotoStrip';
import { canUseInAppCamera } from '../../platform/camera';
import { addPhotoAndAnalyze, analyzePending, refreshMealAdvice, type RecordOutcome } from '../aiActions';
import { useDay, useMeal, useNow, useSettings } from '../hooks';
import styles from '../page.module.css';
import { CameraOverlay } from './CameraOverlay';
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
  /** 写真の追加・読み取りの結果（写真の下に出す） */
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [isCameraOpen, setCameraOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

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

  /** 読み取りの結果を伝える。読み取れたら読み取り結果の画面へ */
  const showOutcome = (r: RecordOutcome) => {
    if (r.kind === 'pending') setPhotoMessage(r.message);
    else if (r.kind === 'notFood') {
      setPhotoMessage(`料理が見つかりませんでした：${r.reason}`);
      if (!r.keptMealId) void navigate('/', { replace: true });
    } else void navigate(`/meal/${meal.id}/result`, { replace: true });
  };

  /** 写真を追加して読み取る（F-REC-12） */
  const addPhoto = async (file: Blob) => {
    setBusy(true);
    setPhotoMessage(null);
    try {
      showOutcome(await addPhotoAndAnalyze(meal.id, file));
    } catch (error) {
      console.error(error);
      setPhotoMessage('写真を読み込めませんでした。別の写真で試してください。');
    } finally {
      setBusy(false);
    }
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void addPhoto(file);
  };

  return (
    <div className={styles.page}>
      <PageHeader title={`${MEAL_TYPE_LABELS[meal.mealType]}の詳細`} />
      <Card>
        <div style={{ marginBottom: 8 }}>
          <div>{formatDateTime(meal.eatenAt)}</div>
          {meal.inputText && <Sub>「{meal.inputText}」</Sub>}
        </div>
        <PhotoStrip
          photos={meal.photos}
          label={`${MEAL_TYPE_LABELS[meal.mealType]}の写真`}
          disabled={busy}
          onTake={() => (canUseInAppCamera() ? setCameraOpen(true) : cameraRef.current?.click())}
          onPick={() => photoRef.current?.click()}
          onRemove={(photoId) => void removePhoto(db, meal.id, photoId, now())}
        />
        {busy && <Sub>読み取っています…</Sub>}
        {photoMessage && <Sub>{photoMessage}</Sub>}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className={styles.hiddenInput} onChange={onPick} />
        <input ref={photoRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={onPick} />
        {isCameraOpen && (
          <CameraOverlay
            onClose={() => setCameraOpen(false)}
            onCapture={(photo) => {
              setCameraOpen(false);
              void addPhoto(photo);
            }}
          />
        )}
      </Card>

      {hasPendingInput(meal) && (
        <Card tone="tint">
          <p>この食事は読み取り待ちです。</p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await analyzePending(meal.id);
              setBusy(false);
              showOutcome(r);
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
