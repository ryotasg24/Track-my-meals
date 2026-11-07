/**
 * 品目の一覧。品目ごとに［よく食べるものに登録］できる（F-FAV-01）。
 */
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { addFavorite } from '../../db/repositories';
import { formatAmount } from '../../domain/format';
import { formatNutrient } from '../../domain/nutrition';
import type { MealItem } from '../../domain/types';
import styles from '../page.module.css';

interface Props {
  items: MealItem[];
  /** 品目を押したときの処理（編集など）。なければ押せない */
  onSelect?: (item: MealItem) => void;
}

export function ItemList({ items, onSelect }: Props) {
  const [registered, setRegistered] = useState<Set<string>>(new Set());

  const register = async (item: MealItem) => {
    await addFavorite(db, { name: item.name, amount: item.amount, unit: item.unit, nutrients: item.nutrients }, Date.now());
    setRegistered((s) => new Set(s).add(item.id));
  };

  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const n = item.nutrients;
        const body = (
          <>
            <span className={styles.itemName}>{item.name}</span> <span className={styles.itemMeta}>{formatAmount(item.amount, item.unit)}</span>
            <div className={styles.itemMeta}>
              {[
                `P ${formatNutrient('protein', n.protein, true)}`,
                `F ${formatNutrient('fat', n.fat, true)}`,
                `C ${formatNutrient('carbs', n.carbs, true)}`,
                `繊維 ${formatNutrient('fiber', n.fiber, true)}`,
                `塩 ${formatNutrient('salt', n.salt, true)}`,
              ].join(' / ')}
            </div>
          </>
        );
        const isDone = registered.has(item.id) || item.favoriteId !== null;
        return (
          <li key={item.id} className={styles.itemLine}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(item)}
                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', minHeight: 44 }}
              >
                {body}
              </button>
            ) : (
              <div>{body}</div>
            )}
            <span className={styles.kcal}>{formatNutrient('kcal', n.kcal)}kcal</span>
            <button
              type="button"
              disabled={isDone}
              onClick={() => void register(item)}
              aria-label={isDone ? `${item.name}はよく食べるものに登録済み` : `${item.name}をよく食べるものに登録`}
              title={isDone ? '登録済み' : 'よく食べるものに登録'}
              style={{ width: 44, height: 44, border: 'none', background: 'none', cursor: isDone ? 'default' : 'pointer', color: 'var(--color-nut-fat)' }}
            >
              {isDone ? <IconStarFilled size={22} /> : <IconStar size={22} stroke={2} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
