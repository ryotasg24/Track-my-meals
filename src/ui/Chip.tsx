/**
 * チップ：丸い形の切り替えボタン（デザイン仕様書 6章）。
 */
import type { ReactNode } from 'react';
import styles from './Chip.module.css';

interface ChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  /** fill：選択中はコーラルの塗り（区分）、tint：選択中は淡い塗り（記録の方法） */
  variant?: 'fill' | 'tint';
  icon?: ReactNode;
}

export function Chip({ selected, onClick, children, variant = 'fill', icon }: ChipProps) {
  const cls = [styles.chip, selected ? (variant === 'fill' ? styles.fill : styles.tint) : undefined].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} aria-pressed={selected} onClick={onClick}>
      {selected && variant === 'fill' ? <span aria-hidden="true">✓</span> : icon}
      {children}
    </button>
  );
}

export function ChipGroup({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.group}>
      {label && <div className={styles.label}>{label}</div>}
      <div className={styles.chips}>{children}</div>
    </div>
  );
}
