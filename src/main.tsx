import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { db } from './db/db';
import { initializeDb } from './db/repositories';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root が見つかりません。');

// 設定などの初期データを用意してから画面を表示する
initializeDb(db, Date.now())
  .catch((error: unknown) => {
    // 初期化に失敗しても画面は出し、原因を開発者ツールで確認できるようにする
    console.error('データベースの初期化に失敗しました', error);
  })
  .finally(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
