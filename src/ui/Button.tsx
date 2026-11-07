/**
 * ボタン（デザイン仕様書 6章）。押せる部品は必ず button / a 要素で作る。
 */
import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';

/**
 * primary：主要ボタン（コーラルの塗り、文字20px太字）
 * camera：撮影ボタン（大きな丸い形、下に厚みの影）
 * secondary：副ボタン（淡いメインの色の塗り）
 * danger：危険な操作
 * text：文字だけ
 */
export type ButtonVariant = 'primary' | 'camera' | 'secondary' | 'danger' | 'text';

export function buttonClassName(variant: ButtonVariant, block = false, extra?: string): string {
  return [styles.button, styles[variant], block ? styles.block : undefined, extra].filter(Boolean).join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
}

export function Button({ variant = 'primary', block = false, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClassName(variant, block, className)} {...rest} />;
}

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  block?: boolean;
}

/** ボタンの見た目のリンク（画面の移動に使う） */
export function LinkButton({ variant = 'secondary', block = false, className, ...rest }: LinkButtonProps) {
  return <Link className={buttonClassName(variant, block, className)} {...rest} />;
}
