/**
 * AIのおすすめの形（基本設計書 6.3、F-ADV-01〜03）。
 * 文章だけだと読みにくいため、「一言」「食べ物の種類ごとのおすすめ度」「献立の例」「ポイント」に分けて受け取る。
 * AIの回答の形の指定では細かい条件が無視されるため、保存する前に必ず checkAdviceContent を通す（基本設計書 5.8）。
 */

/** 食べ物の種類。AIにはこのIDの中から選ばせる */
export const ADVICE_CATEGORIES = {
  vegetable: '野菜・サラダ',
  fish: '魚',
  meat: '肉',
  soyEgg: '大豆・卵',
  staple: 'ご飯・麺・パン',
  dairy: '乳製品',
  fruit: '果物',
  fried: '揚げ物・脂っこいもの',
  salty: '汁物・塩辛いもの',
  sweets: 'お菓子・甘いもの',
} as const;

export type AdviceCategory = keyof typeof ADVICE_CATEGORIES;

/** おすすめ度。recommend：積極的に、ok：食べても大丈夫、limit：控えめに */
export const ADVICE_LEVELS = {
  recommend: 'おすすめ',
  ok: '食べてOK',
  limit: '控えめに',
} as const;

export type AdviceLevel = keyof typeof ADVICE_LEVELS;

export interface AdviceCategoryItem {
  category: AdviceCategory;
  level: AdviceLevel;
  /** 理由（短い一言） */
  reason: string;
}

export interface AdviceMenu {
  /** 案の名前（例：案1、朝食） */
  label: string;
  /** 料理の名前（箇条書きで表示する） */
  dishes: string[];
}

/** 整理したおすすめ */
export interface AdviceContent {
  /** 一言のまとめ */
  summary: string;
  categories: AdviceCategoryItem[];
  menus: AdviceMenu[];
  /** 補足のポイント（不足・控える栄養素、良かった点・課題など） */
  points: string[];
}

const MAX_SUMMARY = 80;
const MAX_REASON = 30;
const MAX_CATEGORIES = 8;
const MAX_MENUS = 4;
const MAX_LABEL = 20;
const MAX_DISHES = 6;
const MAX_DISH = 40;
const MAX_POINTS = 4;
const MAX_POINT = 80;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function textList(v: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((s) => text(s, maxLength)).filter(Boolean).slice(0, maxItems);
}

/**
 * AIのおすすめの回答をチェックし、表示できる形にそろえる。
 * 知らない種類・おすすめ度の行と、空の項目は捨てる。同じ種類が重なったら最初の1つだけを残す。
 * @param json AIの回答の advice の部分
 * @returns 一言がない、または種類と献立の例の両方がない場合はnull
 */
export function checkAdviceContent(json: unknown): AdviceContent | null {
  if (!isObject(json)) return null;
  const summary = text(json.summary, MAX_SUMMARY);
  if (!summary) return null;

  const categories: AdviceCategoryItem[] = [];
  if (Array.isArray(json.categories)) {
    for (const raw of json.categories) {
      if (!isObject(raw)) continue;
      const { category, level } = raw;
      if (typeof category !== 'string' || !(category in ADVICE_CATEGORIES)) continue;
      if (typeof level !== 'string' || !(level in ADVICE_LEVELS)) continue;
      if (categories.some((c) => c.category === category)) continue;
      categories.push({ category: category as AdviceCategory, level: level as AdviceLevel, reason: text(raw.reason, MAX_REASON) });
      if (categories.length >= MAX_CATEGORIES) break;
    }
  }

  const menus: AdviceMenu[] = [];
  if (Array.isArray(json.menus)) {
    for (const raw of json.menus) {
      if (!isObject(raw)) continue;
      const dishes = textList(raw.dishes, MAX_DISHES, MAX_DISH);
      if (dishes.length === 0) continue;
      menus.push({ label: text(raw.label, MAX_LABEL) || `案${menus.length + 1}`, dishes });
      if (menus.length >= MAX_MENUS) break;
    }
  }

  if (categories.length === 0 && menus.length === 0) return null;
  return { summary, categories, menus, points: textList(json.points, MAX_POINTS, MAX_POINT) };
}

/** おすすめ度の順に並べた種類（表示用） */
export function groupByLevel(categories: AdviceCategoryItem[]): { level: AdviceLevel; items: AdviceCategoryItem[] }[] {
  return (Object.keys(ADVICE_LEVELS) as AdviceLevel[])
    .map((level) => ({ level, items: categories.filter((c) => c.level === level) }))
    .filter((g) => g.items.length > 0);
}

/**
 * おすすめを文章にする。整理した形を表示できない場所（古い版のアプリ・書き出し）のために text にも保存する。
 */
export function adviceToText(c: AdviceContent): string {
  const lines = [c.summary];
  for (const { level, items } of groupByLevel(c.categories)) {
    lines.push(`【${ADVICE_LEVELS[level]}】${items.map((i) => ADVICE_CATEGORIES[i.category] + (i.reason ? `（${i.reason}）` : '')).join('、')}`);
  }
  for (const m of c.menus) lines.push(`${m.label}：${m.dishes.join('、')}`);
  for (const p of c.points) lines.push(`・${p}`);
  return lines.join('\n');
}

/** AIへの指示文に入れる、種類とおすすめ度の説明 */
export function adviceVocabulary(): string {
  const cats = Object.entries(ADVICE_CATEGORIES)
    .map(([id, label]) => `${id}（${label}）`)
    .join('、');
  const levels = Object.entries(ADVICE_LEVELS)
    .map(([id, label]) => `${id}（${label}）`)
    .join('、');
  return `categories の category は次から選んでください：${cats}。level は次から選んでください：${levels}。`;
}
