/**
 * 失敗したときの動き（基本設計書 6.4）：予備のモデルへの切り替え、やり直し、モデルを休ませる記録。
 * 通信の処理（call）を引数で受け取り、単体テストできるようにしている。
 */
import { COOLDOWN_MS, isModelAvailable, nextQuotaReset, type ModelCooldown } from '../domain/quota';
import type { GeminiErrorKind } from './gemini';

/** 1回の呼び出しの結果。チェック（5.8）まで終えたもの */
export type Attempt<T> = { ok: true; value: T } | { ok: false; kind: GeminiErrorKind | 'checkFailed'; message: string };

export interface FallbackResult<T> {
  result: { ok: true; value: T; model: string } | { ok: false; kind: FailureKind; message: string };
  /** 更新した、モデルを休ませる記録（呼び出し側で保存する） */
  cooldown: ModelCooldown;
}

/** 利用者に伝える失敗の種類 */
export type FailureKind = 'offline' | 'network' | 'quota' | 'busy' | 'auth' | 'badModel' | 'aborted' | 'invalid';

export interface FallbackOptions<T> {
  primary: string;
  fallback: string | null;
  cooldown: ModelCooldown;
  now: () => number;
  call: (model: string) => Promise<Attempt<T>>;
  /** 待つ処理（テストでは待たない） */
  wait?: (ms: number) => Promise<void>;
}

const defaultWait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 普段のモデルで呼び、使えなければ予備のモデルに切り替える。
 */
export async function runWithFallback<T>(opts: FallbackOptions<T>): Promise<FallbackResult<T>> {
  const cooldown: ModelCooldown = { ...opts.cooldown };
  const wait = opts.wait ?? defaultWait;
  const models = [opts.primary, ...(opts.fallback && opts.fallback !== opts.primary ? [opts.fallback] : [])];
  const available = models.filter((m) => isModelAvailable(cooldown, m, opts.now()));

  if (available.length === 0) {
    return { result: { ok: false, kind: 'quota', message: '今日のAIの上限に達しました' }, cooldown };
  }

  let lastKind: FailureKind = 'busy';
  let lastMessage = '';
  let rateLimitedCount = 0;

  for (const model of available) {
    let attempt = await opts.call(model);

    // 一時的なエラー（500・504）は2秒待って同じモデルでもう一度。回答の形が違う場合もすぐに1回だけやり直す
    if (!attempt.ok && attempt.kind === 'server') {
      await wait(2000);
      attempt = await opts.call(model);
    } else if (!attempt.ok && (attempt.kind === 'checkFailed' || attempt.kind === 'invalidResponse')) {
      attempt = await opts.call(model);
    }

    if (attempt.ok) return { result: { ok: true, value: attempt.value, model }, cooldown };

    switch (attempt.kind) {
      case 'rateLimited':
        rateLimitedCount += 1;
        cooldown[model] = opts.now() + COOLDOWN_MS.rateLimited;
        lastKind = 'quota';
        continue;
      case 'busy':
      case 'timeout':
        cooldown[model] = opts.now() + COOLDOWN_MS.busy;
        lastKind = 'busy';
        lastMessage = attempt.message;
        continue;
      case 'server':
        lastKind = 'busy';
        lastMessage = attempt.message;
        continue;
      case 'notFound':
        // 設定したモデル名が見つからない。予備のモデルで試す
        lastKind = 'badModel';
        lastMessage = attempt.message;
        continue;
      case 'checkFailed':
      case 'invalidResponse':
        lastKind = 'invalid';
        lastMessage = attempt.message;
        continue;
      case 'auth':
      case 'badRequest':
        return { result: { ok: false, kind: 'auth', message: attempt.message }, cooldown };
      case 'offline':
        return { result: { ok: false, kind: 'offline', message: attempt.message }, cooldown };
      case 'network':
        return { result: { ok: false, kind: 'network', message: attempt.message }, cooldown };
      case 'aborted':
        return { result: { ok: false, kind: 'aborted', message: attempt.message }, cooldown };
    }
  }

  // 試したモデルがすべて回数の上限なら、次のリセット時刻まで休ませる
  if (rateLimitedCount === available.length) {
    const until = nextQuotaReset(opts.now());
    for (const m of models) cooldown[m] = until;
    return { result: { ok: false, kind: 'quota', message: '今日のAIの上限に達しました' }, cooldown };
  }
  return { result: { ok: false, kind: lastKind, message: lastMessage }, cooldown };
}

/** 利用者に見せる文言（基本設計書 6.4） */
export function failureMessage(kind: FailureKind, resetAt?: number): string {
  switch (kind) {
    case 'offline':
    case 'network':
      return '通信できません。通信できる場所で、もう一度試してください。';
    case 'quota': {
      const hour = resetAt ? new Date(resetAt).getHours() : 17;
      return `今日のAIの上限に達しました（${hour}時ごろに戻ります）。よく食べるもの・手入力なら記録できます。`;
    }
    case 'busy':
      return 'AIが混雑しています。時間をおいて試してください。';
    case 'auth':
      return 'APIキーが使えません。設定を確認してください。';
    case 'badModel':
      return '設定したAIのモデルが見つかりません。設定のモデル名を確認してください。';
    case 'aborted':
      return '読み取りを中止しました。';
    case 'invalid':
      return 'うまく読み取れませんでした。もう一度試すか、文章や手入力で記録してください。';
  }
}
