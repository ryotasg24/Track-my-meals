/**
 * 画面遷移のアニメーションの種類を決める（デザイン仕様書 10.1）。
 * 画面やルーターに依存しない普通の関数にして、単体テストできるようにしている。
 */

/** タブ・メニューの画面（左から順） */
export const TAB_PATHS = ['/', '/calendar', '/stats', '/settings'] as const;

/** 下から現れる画面（記録の追加・読み取り結果・ふりかえり） */
const SHEET_PATHS = [/^\/meal\/new$/, /^\/meal\/[^/]+\/result$/, /^\/review\//];

/**
 * 遷移の種類。
 * - push：右から入る（詳しい画面へ進む）
 * - pop：左から入る（戻る）
 * - tabForward / tabBack：タブの移動
 * - sheet：下から入る（手前の層）
 * - fade：その場で切り替わる（置き換え・最初の表示）
 */
export type PageTransition = 'push' | 'pop' | 'tabForward' | 'tabBack' | 'sheet' | 'fade';

/** ルーターの移動の種類（React Router の useNavigationType と同じ値） */
export type NavigationKind = 'PUSH' | 'POP' | 'REPLACE';

export function decideTransition(prevPath: string | null, nextPath: string, kind: NavigationKind): PageTransition {
  if (prevPath === null || prevPath === nextPath) return 'fade';

  const prevTab = TAB_PATHS.indexOf(prevPath as (typeof TAB_PATHS)[number]);
  const nextTab = TAB_PATHS.indexOf(nextPath as (typeof TAB_PATHS)[number]);
  // タブどうしの移動は、戻る操作でもタブの並びの向きに合わせる
  if (prevTab >= 0 && nextTab >= 0) return nextTab > prevTab ? 'tabForward' : 'tabBack';

  if (kind === 'POP') return 'pop';
  if (kind === 'REPLACE') return 'fade';
  if (SHEET_PATHS.some((re) => re.test(nextPath))) return 'sheet';
  return 'push';
}
