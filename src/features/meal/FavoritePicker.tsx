/**
 * よく食べるものから選ぶ（F-REC-04、F-FAV-03、04）。使った回数の多い順、名前で検索できる。
 * 押すと量を確認する欄が開き、［追加］で品目に加える。量を変えると栄養価を同じ割合で計算し直す。
 */
import { IconPlus, IconSearch, IconStar } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatAmount } from '../../domain/format';
import { formatNutrient, rescaleForAmount } from '../../domain/nutrition';
import type { Favorite } from '../../domain/types';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Field';
import { useFavorites } from '../hooks';
import styles from '../page.module.css';
import type { ItemValues } from './ItemForm';

export function FavoritePicker({ onAdd }: { onAdd: (values: ItemValues, favoriteId: string) => void }) {
  const favorites = useFavorites();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

  if (!favorites) return null;
  const q = query.trim();
  const list = q ? favorites.filter((f) => f.name.includes(q)) : favorites;

  const open = (f: Favorite) => {
    setOpenId(openId === f.id ? null : f.id);
    setAmount(String(f.amount));
  };

  const add = (f: Favorite) => {
    const a = Number(amount);
    const newAmount = Number.isFinite(a) && a > 0 ? a : f.amount;
    onAdd({ name: f.name, amount: newAmount, unit: f.unit, nutrients: rescaleForAmount(f.nutrients, f.amount, newAmount) }, f.id);
    setOpenId(null);
  };

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="名前で検索" aria-label="よく食べるものを検索" style={{ paddingLeft: 36 }} />
        <IconSearch size={18} style={{ position: 'absolute', left: 12, top: 15, color: 'var(--color-text-sub)' }} aria-hidden="true" />
      </div>
      {favorites.length === 0 && (
        <p className={styles.empty}>
          まだ登録がありません。記録した品目から［よく食べるものに登録］できます。
          <br />
          <Link to="/favorites/new">新しく登録する</Link>
        </p>
      )}
      <ul className={styles.list}>
        {list.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => open(f)}
              aria-expanded={openId === f.id}
              className={styles.itemLine}
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}
            >
              <span>
                <IconStar size={16} stroke={2} color="var(--color-nut-fat)" aria-hidden="true" />{' '}
                <span className={styles.itemName}>{f.name}</span> <span className={styles.itemMeta}>{formatAmount(f.amount, f.unit)}</span>
              </span>
              <span className={styles.kcal}>{formatNutrient('kcal', f.nutrients.kcal)}kcal</span>
              <IconPlus size={20} stroke={2.4} color="var(--color-primary-strong)" aria-hidden="true" />
            </button>
            {openId === f.id && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  aria-label={`${f.name}の量（${f.unit}）`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span>{f.unit}</span>
                <Button variant="secondary" onClick={() => add(f)}>
                  追加
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
