/**
 * 画面の見出し。戻る・閉じるのボタンを左に置く。
 */
import { IconChevronLeft, IconX } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import styles from './PageHeader.module.css';

interface Props {
  title: ReactNode;
  /** back：戻る（◀）、close：閉じる（×）、none：出さない */
  nav?: 'back' | 'close' | 'none';
  /** 戻る先（指定がなければ1つ前の画面） */
  to?: string;
  aside?: ReactNode;
}

export function PageHeader({ title, nav = 'back', to, aside }: Props) {
  const navigate = useNavigate();
  const go = () => {
    if (to) void navigate(to);
    else if (window.history.length > 1) void navigate(-1);
    else void navigate('/');
  };
  return (
    <header className={styles.header}>
      {nav !== 'none' && (
        <button type="button" className={styles.nav} onClick={go} aria-label={nav === 'back' ? '戻る' : '閉じる'}>
          {nav === 'back' ? <IconChevronLeft size={26} stroke={2.2} /> : <IconX size={24} stroke={2.2} />}
        </button>
      )}
      <h1>{title}</h1>
      {aside && <div className={styles.aside}>{aside}</div>}
    </header>
  );
}
