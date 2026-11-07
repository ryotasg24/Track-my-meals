/**
 * 画面の切り替えの定義（基本設計書 3.1、3.2）。
 * GitHub Pagesで再読み込みしても404にならないよう、ハッシュ方式（#/calendar）を使う。
 */
import { IconCalendar, IconChartLine, IconHome, IconSettings } from '@tabler/icons-react';
import { lazy, Suspense, useState } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigationType } from 'react-router';
import { CalendarPage } from './features/calendar/CalendarPage';
import { DayPage } from './features/calendar/DayPage';
import { FavoriteEditPage } from './features/favorites/FavoriteEditPage';
import { FavoritesPage } from './features/favorites/FavoritesPage';
import { HomePage } from './features/home/HomePage';
import { useSettings } from './features/hooks';
import { AddMealPage } from './features/meal/AddMealPage';
import { MealDetailPage } from './features/meal/MealDetailPage';
import { ResultPage } from './features/meal/ResultPage';
import { decideTransition, type PageTransition } from './features/navigation';
import { ReviewPage } from './features/review/ReviewPage';
import { ApiKeyGuidePage } from './features/settings/ApiKeyGuidePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ShortcutGuidePage } from './features/settings/ShortcutGuidePage';
import { TargetPage } from './features/target/TargetPage';
import { WeightPage } from './features/weight/WeightPage';
import { WelcomePage } from './features/welcome/WelcomePage';
import { UpdateBanner } from './ui/UpdateBanner';
import styles from './App.module.css';

// グラフの画面は Chart.js が大きいため、開いたときに読み込む（非機能・性能）
const StatsPage = lazy(() => import('./features/stats/StatsPage'));

// アイコンは Tabler Icons（MIT。デザイン仕様書 9章）
const NAV_ITEMS = [
  { to: '/', label: 'ホーム', Icon: IconHome },
  { to: '/calendar', label: 'カレンダー', Icon: IconCalendar },
  { to: '/stats', label: 'グラフ', Icon: IconChartLine },
  { to: '/settings', label: '設定', Icon: IconSettings },
];

/** タブとメニューを隠して、操作に集中させる画面（基本設計書 3.1） */
const FOCUS_PATHS = [/^\/meal\//, /^\/review\//, /^\/welcome$/];

export function App() {
  return (
    <HashRouter>
      <Layout />
    </HashRouter>
  );
}

function Layout() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const settings = useSettings();
  const isFocus = FOCUS_PATHS.some((re) => re.test(location.pathname));

  // 画面が変わったときに、前の画面のパスから遷移の種類を決める（デザイン仕様書 10.1）
  const [transition, setTransition] = useState<{ key: string; path: string; kind: PageTransition }>(() => ({
    key: location.key,
    path: location.pathname,
    kind: 'fade',
  }));
  if (transition.key !== location.key) {
    setTransition({
      key: location.key,
      path: location.pathname,
      kind: decideTransition(transition.path, location.pathname, navigationType),
    });
  }

  // 設定の読み込みが終わるまでは何も表示しない（初回案内へのちらつきを防ぐ）
  if (!settings) return null;
  if (!settings.onboardingDone && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <div className={isFocus ? styles.focusLayout : styles.layout}>
      {!isFocus && (
        <nav className={styles.nav} aria-label="メインメニュー">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? styles.navActive : styles.navItem)}
            >
              <span className={styles.navIcon}>
                <item.Icon size={22} stroke={2} aria-hidden="true" />
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
      <main className={isFocus ? styles.focusMain : styles.main}>
        <UpdateBanner />
        <div key={location.key} className={`${styles.page} ${styles[transition.kind] ?? ''}`}>
          <Suspense fallback={null}>
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/meal/new" element={<AddMealPage />} />
              <Route path="/meal/:id/result" element={<ResultPage />} />
              <Route path="/meal/:id" element={<MealDetailPage />} />
              <Route path="/review/:date" element={<ReviewPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/favorites/:id" element={<FavoriteEditPage />} />
              <Route path="/weight" element={<WeightPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/day/:date" element={<DayPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/target" element={<TargetPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/api-key" element={<ApiKeyGuidePage />} />
              <Route path="/settings/shortcut" element={<ShortcutGuidePage />} />
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
