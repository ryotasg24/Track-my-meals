import { describe, expect, it } from 'vitest';
import { decideTransition } from './navigation';

describe('画面遷移の種類（デザイン仕様書 10.1）', () => {
  it('最初の表示はフェード', () => {
    expect(decideTransition(null, '/', 'POP')).toBe('fade');
  });

  it('タブは並びの向きに動く（戻る操作でも）', () => {
    expect(decideTransition('/', '/stats', 'PUSH')).toBe('tabForward');
    expect(decideTransition('/settings', '/calendar', 'POP')).toBe('tabBack');
  });

  it('記録の追加・読み取り結果・ふりかえりは下から', () => {
    expect(decideTransition('/', '/meal/new', 'PUSH')).toBe('sheet');
    expect(decideTransition('/meal/new', '/meal/abc/result', 'PUSH')).toBe('sheet');
    expect(decideTransition('/', '/review/2026-11-07', 'PUSH')).toBe('sheet');
  });

  it('詳しい画面へは右から、戻るは左から、置き換えはフェード', () => {
    expect(decideTransition('/', '/meal/abc', 'PUSH')).toBe('push');
    expect(decideTransition('/meal/abc', '/', 'POP')).toBe('pop');
    expect(decideTransition('/meal/new', '/meal/abc/result', 'REPLACE')).toBe('fade');
  });
});
