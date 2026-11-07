import { describe, expect, it } from 'vitest';
import { runWithFallback, type Attempt } from './fallback';
import { extractOutputText } from './gemini';
import { nextQuotaReset } from '../domain/quota';

const NOW = new Date('2026-11-07T10:00:00+09:00').getTime();

/** モデルごとに、順番に返す結果を決めた呼び出し */
function fakeCall(plan: Record<string, Attempt<string>[]>) {
  const calls: string[] = [];
  return {
    calls,
    call: async (model: string) => {
      calls.push(model);
      return plan[model]?.shift() ?? { ok: false as const, kind: 'server' as const, message: 'x' };
    },
  };
}

const ok = (v: string): Attempt<string> => ({ ok: true, value: v });
const fail = (kind: Exclude<Attempt<string>, { ok: true }>['kind']): Attempt<string> => ({ ok: false, kind, message: kind });
const base = { primary: 'lite', fallback: 'flash', cooldown: {}, now: () => NOW, wait: async () => {} };

describe('予備のモデルへの切り替え（基本設計書 6.4）', () => {
  it('普段のモデルで成功すれば、それを使う', async () => {
    const f = fakeCall({ lite: [ok('a')] });
    const r = await runWithFallback({ ...base, call: f.call });
    expect(r.result).toEqual({ ok: true, value: 'a', model: 'lite' });
    expect(f.calls).toEqual(['lite']);
  });

  it('混雑（503）なら予備で試し、普段のモデルを5分休ませる', async () => {
    const f = fakeCall({ lite: [fail('busy')], flash: [ok('b')] });
    const r = await runWithFallback({ ...base, call: f.call });
    expect(r.result).toEqual({ ok: true, value: 'b', model: 'flash' });
    expect(r.cooldown.lite).toBe(NOW + 5 * 60_000);
  });

  it('時間切れも混雑と同じ', async () => {
    const f = fakeCall({ lite: [fail('timeout')], flash: [ok('b')] });
    const r = await runWithFallback({ ...base, call: f.call });
    expect(r.result.ok).toBe(true);
    expect(r.cooldown.lite).toBe(NOW + 5 * 60_000);
  });

  it('回数の上限（429）なら予備で試し、普段のモデルを1分休ませる', async () => {
    const f = fakeCall({ lite: [fail('rateLimited')], flash: [ok('b')] });
    const r = await runWithFallback({ ...base, call: f.call });
    expect(r.result.ok).toBe(true);
    expect(r.cooldown.lite).toBe(NOW + 60_000);
  });

  it('両方とも429なら、次のリセット時刻まで休ませる', async () => {
    const f = fakeCall({ lite: [fail('rateLimited')], flash: [fail('rateLimited')] });
    const r = await runWithFallback({ ...base, call: f.call });
    expect(r.result).toMatchObject({ ok: false, kind: 'quota' });
    expect(r.cooldown.lite).toBe(nextQuotaReset(NOW));
    expect(r.cooldown.flash).toBe(nextQuotaReset(NOW));
  });

  it('休ませているモデルは使わない', async () => {
    const f = fakeCall({ flash: [ok('b')] });
    const r = await runWithFallback({ ...base, cooldown: { lite: NOW + 1 }, call: f.call });
    expect(f.calls).toEqual(['flash']);
    expect(r.result.ok).toBe(true);
  });

  it('すべて休ませていれば呼ばずに上限として返す', async () => {
    const f = fakeCall({});
    const r = await runWithFallback({ ...base, cooldown: { lite: NOW + 1, flash: NOW + 1 }, call: f.call });
    expect(f.calls).toEqual([]);
    expect(r.result).toMatchObject({ ok: false, kind: 'quota' });
  });

  it('一時的なエラー（500）は同じモデルでもう一度試す', async () => {
    const f = fakeCall({ lite: [fail('server'), ok('a')] });
    const r = await runWithFallback({ ...base, call: f.call });
    expect(f.calls).toEqual(['lite', 'lite']);
    expect(r.result.ok).toBe(true);
  });

  it('回答の形が違うときは1回だけやり直し、だめなら予備で試す', async () => {
    const f = fakeCall({ lite: [fail('checkFailed'), fail('checkFailed')], flash: [ok('b')] });
    const r = await runWithFallback({ ...base, call: f.call });
    expect(f.calls).toEqual(['lite', 'lite', 'flash']);
    expect(r.result.ok).toBe(true);
  });

  it('APIキーが使えない場合は予備を試さずに終わる', async () => {
    const f = fakeCall({ lite: [fail('auth')] });
    const r = await runWithFallback({ ...base, call: f.call });
    expect(f.calls).toEqual(['lite']);
    expect(r.result).toMatchObject({ ok: false, kind: 'auth' });
  });

  it('予備のモデルがない設定なら切り替えない', async () => {
    const f = fakeCall({ lite: [fail('busy')] });
    const r = await runWithFallback({ ...base, fallback: null, call: f.call });
    expect(f.calls).toEqual(['lite']);
    expect(r.result).toMatchObject({ ok: false, kind: 'busy' });
  });
});

describe('回答から文章を取り出す（基本設計書 6.1）', () => {
  it('steps の model_output の text を取り出し、thought は無視する', () => {
    const resp = {
      steps: [
        { type: 'thought', signature: 'xxx' },
        { type: 'model_output', content: [{ type: 'text', text: '{"a":1}' }] },
      ],
    };
    expect(extractOutputText(resp)).toBe('{"a":1}');
  });

  it('文章がなければnull', () => {
    expect(extractOutputText({ steps: [] })).toBeNull();
    expect(extractOutputText(null)).toBeNull();
  });
});
