/**
 * カード・お知らせ・並べ方（デザイン仕様書 6章）。
 */
import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  /** tint：淡いメインの色の背景（おすすめのカードなど） */
  tone?: 'plain' | 'tint';
}

export function Card({ title, aside, children, tone = 'plain' }: CardProps) {
  return (
    <section className={tone === 'tint' ? `${styles.card} ${styles.tint}` : styles.card}>
      {(title || aside) && (
        <div className={styles.header}>
          {title && <h2>{title}</h2>}
          {aside && <div className={styles.aside}>{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** お知らせ。warn：注意（体重・バックアップ・APIキー）、info：お知らせ（更新・読み取り待ち） */
export function Notice({ tone, children }: { tone: 'warn' | 'info'; children: ReactNode }) {
  return (
    <div role="status" className={`${styles.card} ${styles.notice} ${styles[tone] ?? ''}`}>
      {children}
    </div>
  );
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}

export function Sub({ children }: { children: ReactNode }) {
  return <p className={styles.sub}>{children}</p>;
}

export function Actions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
