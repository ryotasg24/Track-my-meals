/**
 * APIキーの設定手順（基本設計書 3.3 画面12、F-KEY-03、F-SET-05）。
 * AIに送る内容と、無料枠でのデータの扱いも説明する（要件定義書 7.1）。
 */
import { Card, Sub } from '../../ui/Card';
import { PageHeader } from '../../ui/PageHeader';
import styles from '../page.module.css';
import { ApiKeyForm } from './ApiKeyForm';

export function ApiKeyGuidePage() {
  return (
    <div className={styles.page}>
      <PageHeader title="APIキーの設定手順" />
      <Card title="キーを作る">
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          <li>
            <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">
              Google AI Studio
            </a>
            にGoogleアカウントでログインします（18歳以上の方が使えます）。
          </li>
          <li>「API キー」の画面で、キーを作ります。</li>
          <li>キーの利用制限で「Gemini API だけに使える」制限を付けます（Googleが勧めている設定です）。</li>
          <li>キーをコピーし、下の欄に貼り付けて［保存して確認］を押します。</li>
        </ol>
      </Card>
      <Card title="APIキー">
        <ApiKeyForm />
      </Card>
      <Card title="AIに送る内容とデータの扱い">
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>送るもの：縮小して撮影場所などの情報を消した写真、入力した文章、目標と摂取量などの数値、提案の好み。</li>
          <li>送らないもの：ニックネーム、生年月日、APIキー以外の個人の情報。</li>
          <li>
            Gemini APIの無料枠では、送った写真や文章と回答が、Googleのサービスの改善に使われ、人が内容を読む場合があります（アカウントやキーとの紐付けは外されます）。気になる写真は送らないでください。
          </li>
          <li>無料枠には1分あたり・1日あたりの回数の上限があります。上限は Google AI Studio の「レート制限」の画面で確かめられます。1日の上限は日本時間の17時（夏時間の期間は16時）ごろに戻ります。</li>
        </ul>
        <Sub>記録したデータはこの端末の中にだけ保存し、AI以外には送りません。</Sub>
      </Card>
    </div>
  );
}
