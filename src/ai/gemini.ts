/**
 * Gemini API（Interactions API）の呼び出し（基本設計書 6.1〜6.4）。
 *
 * 公式の部品（@google/genai）は使わず、ブラウザ標準の fetch で直接呼び出す。理由：
 * - 部品の自動のやり直しが、アプリ側のモデルの切り替え（6.4）と重なる
 * - 部品の初期設定では、やり取りがGoogleのサーバーに保存される（store）
 * - 試験用ページで、この呼び出し方がPCとiPhoneで動くことを確認済み（2026-11-07）
 *
 * ヘッダー Api-Revision は、ブラウザからの送信が許可されていないため付けない（6.1）。
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/** 1回の呼び出しを待つ時間（基本設計書 6.4） */
export const TIMEOUT_MS = 30_000;

export interface GeminiRequest {
  apiKey: string;
  model: string;
  systemInstruction: string;
  text: string;
  image?: { base64: string; mimeType: string } | null;
  /** 回答の形（JSONスキーマ） */
  schema: object | null;
  /** 利用者が［中止］を押したときに止める */
  signal?: AbortSignal;
}

/** 失敗の種類（基本設計書 6.4 の表） */
export type GeminiErrorKind =
  | 'offline'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'rateLimited'
  | 'busy'
  | 'server'
  | 'auth'
  | 'badRequest'
  | 'notFound'
  | 'invalidResponse';

export type GeminiResponse = { ok: true; json: unknown; text: string } | { ok: false; kind: GeminiErrorKind; message: string };

/**
 * 回答の中から、AIの文章を取り出す（6.1：steps の中の model_output の text）。
 * 形が変わっても読めるよう、output_text や、ほかの場所の text も探す。
 */
export function extractOutputText(resp: unknown): string | null {
  if (typeof resp !== 'object' || resp === null) return null;
  const r = resp as Record<string, unknown>;
  if (typeof r.output_text === 'string') return r.output_text;
  if (Array.isArray(r.steps)) {
    const texts: string[] = [];
    for (const step of r.steps) {
      if (typeof step !== 'object' || step === null) continue;
      const s = step as Record<string, unknown>;
      if (s.type !== 'model_output' || !Array.isArray(s.content)) continue;
      for (const c of s.content) {
        if (typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text') {
          const t = (c as Record<string, unknown>).text;
          if (typeof t === 'string') texts.push(t);
        }
      }
    }
    if (texts.length > 0) return texts.join('');
  }
  return null;
}

/** HTTPの状態コードから、失敗の種類を決める */
export function classifyStatus(status: number): GeminiErrorKind {
  if (status === 429) return 'rateLimited';
  if (status === 503) return 'busy';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'notFound';
  if (status === 400) return 'badRequest';
  return 'server';
}

/** 1回だけ呼び出す（やり直しや切り替えはしない） */
export async function callGemini(req: GeminiRequest): Promise<GeminiResponse> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, kind: 'offline', message: '通信できません' };
  }

  const input: unknown = req.image
    ? [
        { type: 'text', text: req.text },
        { type: 'image', data: req.image.base64, mime_type: req.image.mimeType },
      ]
    : req.text;
  const body: Record<string, unknown> = {
    model: req.model,
    input,
    system_instruction: req.systemInstruction,
    // やり取りをGoogleのサーバーに保存しない（あとから取り出す必要がないため）
    store: false,
  };
  if (req.schema) body.response_format = { type: 'text', mime_type: 'application/json', schema: req.schema };

  const ctrl = new AbortController();
  let isTimedOut = false;
  const timer = setTimeout(() => {
    isTimedOut = true;
    ctrl.abort();
  }, TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  req.signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': req.apiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const e = JSON.parse(raw) as { error?: { message?: string } };
        if (e.error?.message) message = e.error.message;
      } catch {
        // 本文がJSONでない場合は、状態コードだけを伝える
      }
      return { ok: false, kind: classifyStatus(res.status), message };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, kind: 'invalidResponse', message: '回答を読めませんでした' };
    }
    const text = extractOutputText(parsed);
    if (text === null) return { ok: false, kind: 'invalidResponse', message: '回答に文章がありません' };
    if (!req.schema) return { ok: true, json: null, text };
    try {
      return { ok: true, json: JSON.parse(text), text };
    } catch {
      return { ok: false, kind: 'invalidResponse', message: '回答がJSONではありません' };
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return isTimedOut
        ? { ok: false, kind: 'timeout', message: '時間切れ' }
        : { ok: false, kind: 'aborted', message: '中止しました' };
    }
    return { ok: false, kind: 'network', message: '通信できませんでした' };
  } finally {
    clearTimeout(timer);
    req.signal?.removeEventListener('abort', onAbort);
  }
}
