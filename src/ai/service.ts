/**
 * AI層の窓口（基本設計書 2.3）。画面からは analyzeMeal と writeAdvice だけを使う。
 * ほかのAI（Claude APIなど）に差し替えるときは、この層だけを変える。
 */
import type { AdviceContent } from '../domain/advice';
import { checkAdviceResult, checkAnalyzeResult, type AnalyzeResult } from '../domain/aiResult';
import type { ModelCooldown } from '../domain/quota';
import { runWithFallback, type Attempt, type FallbackResult } from './fallback';
import { callGemini, type GeminiResponse } from './gemini';
import {
  ADVICE_SCHEMA,
  ANALYZE_SCHEMA,
  buildAnalyzePrompt,
  buildNextMealPrompt,
  buildReviewPrompt,
  SYSTEM_INSTRUCTION,
  type DayContext,
  type DayReviewContext,
} from './prompts';

/** AIを使うために必要な設定 */
export interface AiConfig {
  apiKey: string;
  primaryModel: string;
  fallbackModel: string | null;
  cooldown: ModelCooldown;
  now: () => number;
  signal?: AbortSignal;
}

/** 失敗の種類を、チェックの結果も含めて Attempt にする */
function toAttempt<T>(res: GeminiResponse, check: (json: unknown) => { ok: true; value: T } | { ok: false; error: string }): Attempt<T> {
  if (!res.ok) return { ok: false, kind: res.kind, message: res.message };
  const checked = check(res.json);
  return checked.ok ? { ok: true, value: checked.value } : { ok: false, kind: 'checkFailed', message: checked.error };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * 写真または文章から品目と栄養価を推定し、次の食事のおすすめも作る（F-AI-01、F-ADV-01）。
 * @param image AIに送る大きさの写真（文章だけならnull）
 */
export async function analyzeMeal(
  config: AiConfig,
  input: { image: Blob | null; text: string | null },
  context: DayContext,
): Promise<FallbackResult<AnalyzeResult>> {
  const image = input.image ? { base64: await blobToBase64(input.image), mimeType: input.image.type || 'image/jpeg' } : null;
  const text = buildAnalyzePrompt(context, input.text);
  return runWithFallback({
    primary: config.primaryModel,
    fallback: config.fallbackModel,
    cooldown: config.cooldown,
    now: config.now,
    call: async (model) =>
      toAttempt(
        await callGemini({
          apiKey: config.apiKey,
          model,
          systemInstruction: SYSTEM_INSTRUCTION,
          text,
          image,
          schema: ANALYZE_SCHEMA,
          signal: config.signal,
        }),
        (json) => checkAnalyzeResult(json, (context.recordedItems?.length ?? 0) > 0),
      ),
  });
}

export type AdviceRequest =
  | { kind: 'nextMeal'; context: DayContext }
  | { kind: 'review'; context: DayReviewContext };

/** 提案を作る（F-ADV-01〜03） */
export async function writeAdvice(config: AiConfig, request: AdviceRequest): Promise<FallbackResult<AdviceContent>> {
  const text = request.kind === 'nextMeal' ? buildNextMealPrompt(request.context) : buildReviewPrompt(request.context);
  return runWithFallback({
    primary: config.primaryModel,
    fallback: config.fallbackModel,
    cooldown: config.cooldown,
    now: config.now,
    call: async (model) =>
      toAttempt(
        await callGemini({
          apiKey: config.apiKey,
          model,
          systemInstruction: SYSTEM_INSTRUCTION,
          text,
          schema: ADVICE_SCHEMA,
          signal: config.signal,
        }),
        checkAdviceResult,
      ),
  });
}

/**
 * APIキーが使えるかを確かめる（F-KEY-02）。短い文章だけを送る。
 * @returns 使えればnull、使えなければ失敗の種類
 */
export async function verifyApiKey(apiKey: string, model: string): Promise<GeminiResponse> {
  return callGemini({ apiKey, model, systemInstruction: '', text: '「OK」とだけ答えてください。', schema: null });
}
