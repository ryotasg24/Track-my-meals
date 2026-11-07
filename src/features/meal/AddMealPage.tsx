/**
 * 記録の追加（基本設計書 3.3 画面2、デザイン仕様書 7.3）。
 * 撮影・写真・文章はAIで読み取り、確認を挟まずに保存する（F-AI-02）。
 * よく食べるもの・手入力は品目を追加してから［保存］する。
 */
import { IconBowlChopsticks, IconCamera, IconMessage2, IconPencil, IconPhoto, IconStar, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { db } from '../../db/db';
import { addMeal, newId } from '../../db/repositories';
import { formatAmount, fromDateTimeInputValue, toDateTimeInputValue } from '../../domain/format';
import { MEAL_TYPE_LABELS, MEAL_TYPE_ORDER, mealTypeAt } from '../../domain/mealType';
import { addNutrients, formatNutrient, ZERO_NUTRIENTS } from '../../domain/nutrition';
import type { MealItem, MealType } from '../../domain/types';
import { Button } from '../../ui/Button';
import { Card, Sub } from '../../ui/Card';
import { Chip, ChipGroup } from '../../ui/Chip';
import { Field, Input, TextArea } from '../../ui/Field';
import { PageHeader } from '../../ui/PageHeader';
import { recordWithAi } from '../aiActions';
import { useApiKeyInfo, useNow, useSettings } from '../hooks';
import styles from '../page.module.css';
import { FavoritePicker } from './FavoritePicker';
import { ItemForm, type ItemValues } from './ItemForm';

type Method = 'favorite' | 'camera' | 'photo' | 'text' | 'manual';

const METHODS: { id: Method; label: string; Icon: typeof IconCamera }[] = [
  { id: 'camera', label: '撮影', Icon: IconCamera },
  { id: 'photo', label: '写真', Icon: IconPhoto },
  { id: 'text', label: '文章', Icon: IconMessage2 },
  { id: 'favorite', label: 'よく食べるもの', Icon: IconStar },
  { id: 'manual', label: '手入力', Icon: IconPencil },
];

type Phase = { kind: 'idle' } | { kind: 'analyzing'; startedAt: number } | { kind: 'message'; text: string; isNotFood: boolean };

export function AddMealPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useSettings();
  const key = useApiKeyInfo();
  const clock = useNow(30_000);
  const [now] = useState(() => Date.now());
  const [eatenAt, setEatenAt] = useState(now);
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [method, setMethod] = useState<Method>('favorite');
  const [items, setItems] = useState<MealItem[]>([]);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [elapsed, setElapsed] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedFromHome = useRef(false);

  const type: MealType = mealType ?? (settings ? mealTypeAt(eatenAt, settings.mealTypeStarts) : 'lunch');

  // 読み取り中は経過秒数を表示する（非機能・性能）
  useEffect(() => {
    if (phase.kind !== 'analyzing') return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - phase.startedAt) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [phase]);

  const analyze = async (file: Blob | null, inputText: string | null) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setElapsed(0);
    setPhase({ kind: 'analyzing', startedAt: Date.now() });
    try {
      const r = await recordWithAi({ file, text: inputText, eatenAt, mealType: type, preItems: items, signal: ctrl.signal });
      if (r.kind === 'done') {
        void navigate(`/meal/${r.mealId}/result`, { replace: true });
      } else if (r.kind === 'pending') {
        setItems([]);
        setPhase({ kind: 'message', text: r.message, isNotFood: false });
      } else if (r.keptMealId) {
        void navigate(`/meal/${r.keptMealId}/result`, { replace: true });
      } else {
        setPhase({ kind: 'message', text: `料理が見つかりませんでした：${r.reason}`, isNotFood: true });
      }
    } catch (error) {
      console.error(error);
      setPhase({ kind: 'message', text: '写真を読み込めませんでした。別の写真で試すか、文章や手入力で記録してください。', isNotFood: true });
    } finally {
      abortRef.current = null;
    }
  };

  // ホームの撮影ボタンから来た場合は、すぐに読み取りを始める
  const fileFromHome = (location.state as { file?: Blob } | null)?.file ?? null;
  useEffect(() => {
    if (!fileFromHome || !settings || startedFromHome.current) return;
    startedFromHome.current = true;
    void analyze(fileFromHome, null);
    // 最初の1回だけ動かす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileFromHome, settings]);

  if (!settings || !key) return null;

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void analyze(file, null);
  };

  const addItem = (v: ItemValues, source: MealItem['source'], favoriteId: string | null) => {
    setItems((list) => [...list, { id: newId(), ...v, source, favoriteId, model: null }]);
  };

  const save = async () => {
    const meal = await addMeal(
      db,
      { eatenAt, mealType: type, boundaryHour: settings.dayBoundaryHour, items, status: 'done' },
      Date.now(),
    );
    // 保存したら、おすすめを作って読み取り結果の画面に移る（毎回。2026-11-07 決定）
    void navigate(`/meal/${meal.id}/result`, { replace: true, state: { refreshAdvice: true } });
  };

  const total = items.reduce((s, i) => addNutrients(s, i.nutrients), ZERO_NUTRIENTS);
  const needsKey = !key.hasKey;

  if (phase.kind === 'analyzing') {
    return (
      <div className={styles.page}>
        <PageHeader title="記録の追加" nav="none" />
        <Card>
          <div className={styles.analyzing} role="status">
            <IconBowlChopsticks size={56} stroke={1.75} className={styles.bob} aria-hidden="true" />
            <div style={{ fontWeight: 800 }}>読み取っています… {elapsed}秒</div>
            <Sub>写真から料理と量を推定しています（30秒で中断します）</Sub>
            <Button variant="text" onClick={() => abortRef.current?.abort()}>
              中止
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader title="記録の追加" nav="close" to="/" />

      {phase.kind === 'message' && (
        <Card tone="tint">
          <p>{phase.text}</p>
          {phase.isNotFood ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => cameraRef.current?.click()}>
                撮り直す
              </Button>
              <Button variant="secondary" onClick={() => { setMethod('text'); setPhase({ kind: 'idle' }); }}>
                文章で入力
              </Button>
              <Button variant="secondary" onClick={() => { setMethod('manual'); setPhase({ kind: 'idle' }); }}>
                手入力
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => void navigate('/', { replace: true })}>
              ホームへ
            </Button>
          )}
        </Card>
      )}

      <Card>
        <ChipGroup label="区分">
          {MEAL_TYPE_ORDER.map((t) => (
            <Chip key={t} selected={type === t} onClick={() => setMealType(t)}>
              {MEAL_TYPE_LABELS[t]}
            </Chip>
          ))}
        </ChipGroup>
        <div style={{ marginTop: 12 }}>
          <Field label="食べた日時">
            <Input
              type="datetime-local"
              value={toDateTimeInputValue(eatenAt)}
              max={toDateTimeInputValue(clock)}
              onChange={(e) => {
                const v = fromDateTimeInputValue(e.target.value);
                // 未来の日時は選べない（基本設計書 3.3 画面2）
                if (v !== null) setEatenAt(Math.min(v, Date.now()));
              }}
            />
          </Field>
        </div>
      </Card>

      <ChipGroup label="記録の方法">
        {METHODS.map((m) => (
          <Chip
            key={m.id}
            variant="tint"
            selected={method === m.id}
            icon={<m.Icon size={18} stroke={2} aria-hidden="true" />}
            onClick={() => {
              setMethod(m.id);
              if (m.id === 'camera') cameraRef.current?.click();
              if (m.id === 'photo') photoRef.current?.click();
            }}
          >
            {m.label}
          </Chip>
        ))}
      </ChipGroup>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className={styles.hiddenInput} onChange={onPick} />
      <input ref={photoRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={onPick} />

      {(method === 'camera' || method === 'photo' || method === 'text') && needsKey && (
        <Card tone="tint">
          <p>AIで読み取るには、APIキーの設定が必要です。よく食べるもの・手入力なら記録できます。</p>
          <Button variant="secondary" onClick={() => void navigate('/settings/api-key')}>
            APIキーを設定する
          </Button>
        </Card>
      )}

      {(method === 'camera' || method === 'photo') && !needsKey && (
        <Card>
          <Button variant="primary" block onClick={() => (method === 'camera' ? cameraRef : photoRef).current?.click()}>
            {method === 'camera' ? <IconCamera size={24} stroke={2.2} /> : <IconPhoto size={24} stroke={2.2} />}
            {method === 'camera' ? '撮影する' : '写真を選ぶ'}
          </Button>
        </Card>
      )}

      {method === 'text' && !needsKey && (
        <Card>
          <Field label="食べたもの" hint="例：牛丼並盛と味噌汁">
            <TextArea value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Button variant="primary" block disabled={!text.trim()} onClick={() => void analyze(null, text.trim())}>
            読み取る
          </Button>
        </Card>
      )}

      {method === 'favorite' && (
        <Card title="よく食べるもの">
          <FavoritePicker onAdd={(v, id) => addItem(v, 'favorite', id)} />
        </Card>
      )}

      {method === 'manual' && (
        <Card title="手入力">
          <ItemForm key={items.length} submitLabel="品目に追加" onSubmit={(v) => addItem(v, 'manual', null)} />
        </Card>
      )}

      {items.length > 0 && (
        <Card title="追加した品目" aside={<span className={styles.kcal}>合計 {formatNutrient('kcal', total.kcal)}kcal</span>}>
          <ul className={styles.list}>
            {items.map((i) => (
              <li key={i.id} className={styles.itemLine}>
                <span>
                  <span className={styles.itemName}>{i.name}</span> <span className={styles.itemMeta}>{formatAmount(i.amount, i.unit)}</span>
                </span>
                <span className={styles.kcal}>{formatNutrient('kcal', i.nutrients.kcal)}kcal</span>
                <button
                  type="button"
                  aria-label={`${i.name}を外す`}
                  onClick={() => setItems((l) => l.filter((x) => x.id !== i.id))}
                  style={{ width: 44, height: 44, border: 'none', background: 'none', color: 'var(--color-text-sub)', cursor: 'pointer' }}
                >
                  <IconX size={20} />
                </button>
              </li>
            ))}
          </ul>
          <Sub>撮影・写真・文章で読み取ると、この品目と同じ食事にまとめて保存します。</Sub>
        </Card>
      )}

      <div className={styles.bottomBar}>
        <Button variant="primary" block disabled={items.length === 0} onClick={() => void save()}>
          保存
        </Button>
      </div>
    </div>
  );
}
