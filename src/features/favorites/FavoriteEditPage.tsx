/**
 * よく食べるものの追加・編集・削除（基本設計書 3.3 画面6'）。削除しても過去の記録は変わらない（F-FAV-02）。
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router';
import { db } from '../../db/db';
import { addFavorite, deleteFavorite, updateFavorite } from '../../db/repositories';
import { Button } from '../../ui/Button';
import { Card, Sub } from '../../ui/Card';
import { PageHeader } from '../../ui/PageHeader';
import { ItemForm } from '../meal/ItemForm';
import styles from '../page.module.css';

export function FavoriteEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const favorite = useLiveQuery(async () => (isNew || !id ? null : ((await db.favorites.get(id)) ?? null)), [id, isNew]);

  if (favorite === undefined) return null;
  if (!isNew && (favorite === null || favorite.deleted === 1)) {
    return (
      <div className={styles.page}>
        <PageHeader title="よく食べるもの" />
        <p className={styles.empty}>見つかりません。</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader title={isNew ? 'よく食べるものを登録' : 'よく食べるものを編集'} />
      <Card>
        <ItemForm
          initial={favorite ?? undefined}
          submitLabel="保存"
          onSubmit={async (v) => {
            if (favorite) await updateFavorite(db, favorite.id, v, Date.now());
            else await addFavorite(db, v, Date.now());
            void navigate(-1);
          }}
        />
      </Card>
      {favorite && (
        <>
          <Sub>削除しても、これまでの食事の記録は変わりません。</Sub>
          <Button
            variant="danger"
            onClick={async () => {
              if (!window.confirm(`「${favorite.name}」を削除しますか？`)) return;
              await deleteFavorite(db, favorite.id, Date.now());
              void navigate(-1);
            }}
          >
            削除
          </Button>
        </>
      )}
    </div>
  );
}
