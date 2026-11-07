/**
 * 無料枠の回数のリセット時刻と、モデルを休ませる期限（基本設計書 5.9、6.4）。
 */

const PACIFIC = 'America/Los_Angeles';

/** 指定した時間帯での、ある時刻の年月日時分秒 */
function partsIn(ms: number, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const get = (type: string) => Number(fmt.formatToParts(ms).find((p) => p.type === type)?.value);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

/** その時刻での、時間帯のずれ（ミリ秒）。太平洋時間なら −7時間 または −8時間 */
function offsetMs(ms: number, timeZone: string): number {
  const p = partsIn(ms, timeZone);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * 次に1日の回数がリセットされる時刻（太平洋時間の次の0時）。
 * @param now 現在時刻
 */
export function nextQuotaReset(now: number): number {
  const p = partsIn(now, PACIFIC);
  // 太平洋時間の翌日0時を、いったんUTCとして作り、時間帯のずれで直す
  const guess = Date.UTC(p.y, p.mo - 1, p.d + 1, 0, 0, 0);
  // 夏時間の切り替わりの日でも正しくなるよう、求めた時刻でのずれを使う
  return guess - offsetMs(guess - offsetMs(guess, PACIFIC), PACIFIC);
}

/** モデルを休ませる記録（モデル名 → 使わない期限の時刻） */
export type ModelCooldown = Record<string, number>;

/** 休ませる時間（基本設計書 6.4） */
export const COOLDOWN_MS = {
  /** 回数の上限（429）：1分の上限の可能性があるため1分だけ */
  rateLimited: 60_000,
  /** 混雑（503）・時間切れ：混雑が続くことがあったため5分 */
  busy: 5 * 60_000,
};

/** モデルが今使えるか（休ませる期限を過ぎているか） */
export function isModelAvailable(cooldown: ModelCooldown, model: string, now: number): boolean {
  const until = cooldown[model];
  return until === undefined || until <= now;
}
