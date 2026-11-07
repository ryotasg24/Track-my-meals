/**
 * よく食べるもの（基本設計書 3.3 画面6、F-FAV-01〜04）。
 */
import { IconPlus, IconStar } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatAmount } from '../../domain/format';
import { formatNutrient } from '../../domain/nutrition';
import { LinkButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Field';
import { PageHeader } from '../../ui/PageHeader';
import { useFavorites } from '../hooks';
import styles from '../page.module.css';

export function FavoritesPage() {
  const favorites = useFavorites();
  const [query, setQuery] = useState('');
  if (!favorites) return null;
  const list = query.trim() ? favorites.filter((f) => f.name.includes(query.trim())) : favorites;

  return (
    <div className={styles.page}>
      <PageHeader title="よく食べるもの" to="/settings" />
      <LinkButton to="/favorites/new" variant="secondary">
        <IconPlus size={20} aria-hidden="true" />
        新しく登録
      </LinkButton>
      <Card>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="名前で検索" aria-label="よく食べるものを検索" />
        {list.length === 0 && <p className={styles.empty}>登録がありません</p>}
        <ul className={styles.list}>
          {list.map((f) => (
            <li key={f.id}>
              <Link to={`/favorites/${f.id}`} className={styles.itemLine} style={{ color: 'inherit', textDecoration: 'none' }}>
                <span>
                  <IconStar size={16} color="var(--color-nut-fat)" aria-hidden="true" /> <span className={styles.itemName}>{f.name}</span>{' '}
                  <span className={styles.itemMeta}>
                    {formatAmount(f.amount, f.unit)}・{f.useCount}回
                  </span>
                </span>
                <span className={styles.kcal}>{formatNutrient('kcal', f.nutrients.kcal)}kcal</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
