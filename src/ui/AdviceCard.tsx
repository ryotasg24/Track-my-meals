/**
 * おすすめのカード（デザイン仕様書 6章）。AIが使えないときは、数値による不足・超過の一覧を出す（F-ADV-05）。
 */
import { IconSparkles } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { formatNutrient, gapSummary, NUTRIENT_LABELS, NUTRIENT_UNITS } from '../domain/nutrition';
import type { Nutrients } from '../domain/types';
import { Card, Sub } from './Card';

interface Props {
  title?: string;
  text: string | null;
  /** 文章がないときに出す、数値の一覧のもと */
  intake?: Nutrients;
  target?: Nutrients | null;
  /** 文章がない理由（例：AIが使えないため） */
  note?: string;
  loading?: boolean;
  actions?: ReactNode;
}

export function AdviceCard({ title = '次の食事のおすすめ', text, intake, target, note, loading, actions }: Props) {
  return (
    <Card
      tone="tint"
      title={
        <>
          <IconSparkles size={20} stroke={2} color="var(--color-primary-strong)" aria-hidden="true" />
          <span style={{ color: 'var(--color-primary-strong)' }}>{title}</span>
        </>
      }
    >
      {loading ? (
        <p>おすすめを考えています…</p>
      ) : text ? (
        <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>{text}</p>
      ) : (
        <>
          {note && <Sub>{note}</Sub>}
          {intake && target && <GapList intake={intake} target={target} />}
        </>
      )}
      {actions}
      <Sub>一般的な目安であり、医療的な助言ではありません。</Sub>
    </Card>
  );
}

/** 数値による不足・超過の一覧 */
export function GapList({ intake, target }: { intake: Nutrients; target: Nutrients }) {
  return (
    <ul style={{ margin: '0 0 8px', paddingLeft: 20, fontSize: '0.875rem' }}>
      {gapSummary(intake, target).map(({ key, status, remaining }) => (
        <li key={key}>
          {NUTRIENT_LABELS[key]}：
          {status === 'over'
            ? `${formatNutrient(key, Math.abs(remaining))}${NUTRIENT_UNITS[key]} 超過`
            : status === 'achieved'
              ? '達成'
              : key === 'salt'
                ? `あと${formatNutrient(key, remaining)}${NUTRIENT_UNITS[key]}まで`
                : `あと${formatNutrient(key, remaining)}${NUTRIENT_UNITS[key]}`}
        </li>
      ))}
    </ul>
  );
}
