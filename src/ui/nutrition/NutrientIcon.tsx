/**
 * 栄養素のアイコンと色（デザイン仕様書 3.2、9章）。アイコンは Tabler Icons（MIT）。
 */
import { IconDroplet, IconFlame, IconLeaf, IconMeat, IconSalt, IconWheat } from '@tabler/icons-react';
import type { NutrientKey } from '../../domain/types';

const ICONS = {
  kcal: IconFlame,
  protein: IconMeat,
  fat: IconDroplet,
  carbs: IconWheat,
  fiber: IconLeaf,
  salt: IconSalt,
} as const;

/** 栄養素の文字・棒の色と、タイルの背景の色（CSS変数） */
export function nutrientColors(key: NutrientKey): { fg: string; bg: string } {
  return { fg: `var(--color-nut-${key})`, bg: `var(--color-nut-${key}-bg)` };
}

export function NutrientIcon({ nutrient, size = 16 }: { nutrient: NutrientKey; size?: number }) {
  const Icon = ICONS[nutrient];
  return <Icon size={size} stroke={2} aria-hidden="true" />;
}
