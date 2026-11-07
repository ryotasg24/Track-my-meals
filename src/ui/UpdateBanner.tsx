/**
 * 新しい版を知らせる表示（非機能・更新、基本設計書 7.3）。
 */
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './Button';
import { Notice } from './Card';

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <Notice tone="info">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span>新しい版があります</span>
        <Button variant="secondary" onClick={() => void updateServiceWorker(true)}>
          更新する
        </Button>
      </div>
    </Notice>
  );
}
