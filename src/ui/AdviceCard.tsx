/**
 * おすすめのカード（デザイン仕様書 6章）。
 * 整理したおすすめ（一言・食べ物の種類ごとのおすすめ度・献立の例・ポイント）を表示する。
 * 整理した形がない古い記録は文章のまま、AIが使えないときは数値による不足・超過の一覧を出す（F-ADV-05）。
 */
import {
  IconApple,
  IconBread,
  IconBulb,
  IconCircleCheck,
  IconCookie,
  IconEgg,
  IconFish,
  IconFlame,
  IconHandStop,
  IconMeat,
  IconMilk,
  IconSalad,
  IconSoup,
  IconSparkles,
  IconThumbUp,
  IconToolsKitchen2,
  type Icon,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import {
  ADVICE_CATEGORIES,
  ADVICE_LEVELS,
  groupByLevel,
  type AdviceCategory,
  type AdviceContent,
  type AdviceLevel,
} from '../domain/advice';
import { formatNutrient, gapSummary, NUTRIENT_LABELS, NUTRIENT_UNITS } from '../domain/nutrition';
import type { Nutrients } from '../domain/types';
import styles from './AdviceCard.module.css';
import { Card, Sub } from './Card';

const CATEGORY_ICONS: Record<AdviceCategory, Icon> = {
  vegetable: IconSalad,
  fish: IconFish,
  meat: IconMeat,
  soyEgg: IconEgg,
  staple: IconBread,
  dairy: IconMilk,
  fruit: IconApple,
  fried: IconFlame,
  salty: IconSoup,
  sweets: IconCookie,
};

const LEVEL_ICONS: Record<AdviceLevel, Icon> = {
  recommend: IconThumbUp,
  ok: IconCircleCheck,
  limit: IconHandStop,
};

interface Props {
  title?: string;
  /** 文章（整理した形がない古い記録で使う） */
  text: string | null;
  /** 整理したおすすめ。あればこちらを表示する */
  content?: AdviceContent | null;
  /** 文章がないときに出す、数値の一覧のもと */
  intake?: Nutrients;
  target?: Nutrients | null;
  /** 文章がない理由（例：AIが使えないため） */
  note?: string;
  loading?: boolean;
  actions?: ReactNode;
}

export function AdviceCard({ title = '次の食事のおすすめ', text, content, intake, target, note, loading, actions }: Props) {
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
      ) : content ? (
        <AdviceBody content={content} />
      ) : text ? (
        <p className={styles.text}>{text}</p>
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

/** 整理したおすすめの中身 */
function AdviceBody({ content }: { content: AdviceContent }) {
  const groups = groupByLevel(content.categories);
  return (
    <div>
      <p className={styles.summary}>{content.summary}</p>

      {groups.length > 0 && (
        <div className={styles.levels}>
          {groups.map(({ level, items }) => {
            const LevelIcon = LEVEL_ICONS[level];
            return (
              <section key={level} className={`${styles.level} ${styles[level]}`} aria-label={ADVICE_LEVELS[level]}>
                <div className={styles.levelLabel}>
                  <LevelIcon size={16} stroke={2.2} aria-hidden="true" />
                  {ADVICE_LEVELS[level]}
                </div>
                <ul className={styles.items}>
                  {items.map((i) => {
                    const CategoryIcon = CATEGORY_ICONS[i.category];
                    return (
                      <li key={i.category} className={styles.item}>
                        <CategoryIcon size={18} stroke={2} className={styles.itemIcon} aria-hidden="true" />
                        <span>
                          <span className={styles.itemName}>{ADVICE_CATEGORIES[i.category]}</span>
                          {i.reason && <span className={styles.reason}>{i.reason}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {content.menus.length > 0 && (
        <>
          <h3 className={styles.sectionTitle}>
            <IconToolsKitchen2 size={16} stroke={2} aria-hidden="true" />
            たとえばこんな食事
          </h3>
          <div className={styles.menus}>
            {content.menus.map((m, idx) => (
              <div key={idx} className={styles.menu}>
                <p className={styles.menuLabel}>{m.label}</p>
                <ul className={styles.list}>
                  {m.dishes.map((d, j) => (
                    <li key={j}>{d}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      {content.points.length > 0 && (
        <>
          <h3 className={styles.sectionTitle}>
            <IconBulb size={16} stroke={2} aria-hidden="true" />
            ポイント
          </h3>
          <ul className={styles.list}>
            {content.points.map((p, j) => (
              <li key={j}>{p}</li>
            ))}
          </ul>
        </>
      )}
    </div>
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
