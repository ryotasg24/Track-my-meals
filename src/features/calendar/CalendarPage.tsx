/**
 * カレンダー（基本設計書 3.3 画面8、F-HIS-01、デザイン仕様書 3.4）。
 * 印は色に加えて形を変える：範囲内＝塗った丸、不足＝白抜きの丸、超過＝三角。
 */
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { useState } from 'react';
import { Link } from 'react-router';
import { shiftPeriod } from '../../domain/stats';
import { dayMark, type DayMark } from '../../domain/nutrition';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useNow, useToday } from '../hooks';
import { useDaySummaries } from '../summaries';
import styles from './Calendar.module.css';

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];
const MARK_LABEL: Record<DayMark, string> = { within: '範囲内', under: '不足', over: '超過' };

export function CalendarPage() {
  const today = useToday();
  const clock = useNow(60_000);
  const [anchor, setAnchor] = useState<string | null>(null);
  const month = anchor ?? today ?? format(clock, 'yyyy-MM-dd');
  const first = startOfMonth(parseISO(month));
  const gridStart = startOfWeek(first, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });
  const summaries = useDaySummaries(format(gridStart, 'yyyy-MM-dd'), format(gridEnd, 'yyyy-MM-dd'));
  if (!today || !summaries) return null;

  const byDate = new Map(summaries.map((s) => [s.localDate, s]));
  const cells: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) cells.push(d);

  return (
    <div className={styles.page}>
      <h1>カレンダー</h1>
      <Card>
        <div className={styles.header}>
          <button type="button" className={styles.navButton} onClick={() => setAnchor(shiftPeriod('month', month, -1))} aria-label="前の月">
            <IconChevronLeft size={24} />
          </button>
          <h2 style={{ margin: 0 }}>{format(first, 'yyyy年M月')}</h2>
          <button type="button" className={styles.navButton} onClick={() => setAnchor(shiftPeriod('month', month, 1))} aria-label="次の月">
            <IconChevronRight size={24} />
          </button>
          <Button variant="text" onClick={() => setAnchor(null)}>
            今日
          </Button>
        </div>
        <div className={styles.grid} role="grid" aria-label={format(first, 'yyyy年M月')}>
          {WEEKDAYS.map((w) => (
            <div key={w} className={styles.weekday} role="columnheader">
              {w}
            </div>
          ))}
          {cells.map((d) => {
            const key = format(d, 'yyyy-MM-dd');
            const s = byDate.get(key);
            const mark = s?.hasMeals && s.target ? dayMark(s.intake.kcal, s.target.kcal) : null;
            const isOther = d.getMonth() !== first.getMonth();
            const isToday = key === today;
            const label = `${format(d, 'M月d日')}${s?.hasMeals ? `、${Math.round(s.intake.kcal)}キロカロリー` : '、記録なし'}${mark ? `、${MARK_LABEL[mark]}` : ''}`;
            return (
              <Link
                key={key}
                to={`/day/${key}`}
                className={[styles.cell, isOther ? styles.other : '', isToday ? styles.today : ''].join(' ')}
                aria-label={label}
              >
                <span className={styles.dayNum}>{d.getDate()}</span>
                {mark ? <span className={`${styles.mark} ${styles[mark]}`} aria-hidden="true" /> : s?.hasMeals ? <span className={`${styles.mark} ${styles.recorded}`} aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </div>
        <div className={styles.legend}>
          <span>
            <span className={`${styles.mark} ${styles.within}`} aria-hidden="true" />
            範囲内（目標の±10%）
          </span>
          <span>
            <span className={`${styles.mark} ${styles.under}`} aria-hidden="true" />
            不足
          </span>
          <span>
            <span className={`${styles.mark} ${styles.over}`} aria-hidden="true" />
            超過
          </span>
        </div>
      </Card>
    </div>
  );
}
