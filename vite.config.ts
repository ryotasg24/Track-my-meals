/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pagesでは、URLにリポジトリ名が入る（基本設計書 7.1）。
// リポジトリ名を変えるとアプリのURLが変わるため、この値も変えないこと。
const BASE_PATH = '/Track-my-meals/';

/** アプリの版。設定画面に、ビルドした日時（UTC）と合わせて表示する */
const APP_VERSION = '0.1.0';

/**
 * 読み込みと通信の許可先を決める設定（Content-Security-Policy。基本設計書 7.5）。
 * GitHub Pagesでは応答ヘッダーを設定できないため、<meta> で入れる。
 * 開発用サーバーはViteの動作に別の許可が要るため、ビルドした結果にだけ入れる。
 */
const CSP = [
  "default-src 'self'",
  "connect-src 'self' https://generativelanguage.googleapis.com",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'tmm-content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  base: BASE_PATH,
  define: {
    __APP_VERSION__: JSON.stringify(
      `${APP_VERSION}（${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC）`,
    ),
  },
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      // 利用者が［更新する］を押してから新しい版に切り替える（基本設計書 7.3）
      registerType: 'prompt',
      // アイコンは Tabler Icons のどんぶりと箸（MIT。デザイン仕様書 9章）から作った画像
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'third-party-licenses.txt'],
      manifest: {
        id: BASE_PATH,
        name: 'ごはんくん',
        short_name: 'ごはんくん',
        lang: 'ja',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        // 画面の背景色（デザイン仕様書 3.1 の --color-bg）に合わせる
        theme_color: '#FFF5EC',
        background_color: '#FFF5EC',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // 端末によって丸などに切り取られても、絵が欠けないように余白を大きく取ったもの
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // ビルドしたファイルをすべて事前にキャッシュし、オフラインで起動できるようにする（F-DATA-06）。
        // Gemini APIへの通信はキャッシュしない（別のドメインなので対象外になる）
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,txt}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 記録日の区切りを確かめるため、テストは日本時間で動かす
    env: { TZ: 'Asia/Tokyo' },
  },
});
