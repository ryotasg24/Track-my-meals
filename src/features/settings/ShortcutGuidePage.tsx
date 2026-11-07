/**
 * ショートカットの導入手順（基本設計書 3.3 画面13、6.5、F-HLT-03）。
 * ショートカットがクリップボードにコピーした値を、アプリの［貼り付け］で取り込む。
 */
import { Card, Sub } from '../../ui/Card';
import { PageHeader } from '../../ui/PageHeader';
import { useSettings } from '../hooks';
import styles from '../page.module.css';

const STEPS: [string, string][] = [
  ['テキストを分割', '入力：ショートカットの入力。区切り文字：カスタム「|」'],
  ['リストから項目を取得 → 入力から日付を取得 → 変数を設定', '1番目の項目 → 変数「start」'],
  ['リストから項目を取得 → 入力から日付を取得 → 変数を設定', '2番目の項目 → 変数「end」'],
  ['ヘルスケアのサンプルを検索', '種類：アクティブエネルギー。開始日が「start」以降、かつ「end」以前'],
  ['統計を計算', '合計'],
  ['テキスト', 'tmm-active|（1の1番目の項目）|（5の結果）'],
  ['クリップボードにコピー', '6のテキスト'],
  ['通知を表示', '「コピーしました。アプリに戻って［貼り付け］を押してください」'],
];

export function ShortcutGuidePage() {
  const settings = useSettings();
  if (!settings) return null;
  return (
    <div className={styles.page}>
      <PageHeader title="ショートカットの導入手順" />
      <Card title="しくみ">
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          <li>ホームの［運動を取り込む］を押すと、ショートカットが起動します。</li>
          <li>ショートカットが、その日（{settings.dayBoundaryHour}:00〜翌{settings.dayBoundaryHour - 1 < 0 ? 23 : settings.dayBoundaryHour - 1}:59）のアクティブエネルギーの合計をコピーします。</li>
          <li>画面左上の「◀」でこのアプリに戻り、［貼り付け］を押します。</li>
        </ol>
        <Sub>ホーム画面から開いたアプリは、ショートカットから自動では呼び戻せないため、「◀」で戻ってください。</Sub>
      </Card>
      <Card title="ショートカットの作り方">
        <p>
          「ショートカット」アプリで新しいショートカットを作り、名前を「<strong>{settings.shortcutName}</strong>」にします（設定の名前と同じにしてください）。受け取る種類は「テキスト」にします。
        </p>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          {STEPS.map(([action, detail], i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              <strong>{action}</strong>
              <br />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-sub)' }}>{detail}</span>
            </li>
          ))}
        </ol>
        <Sub>
          間違えやすい点：区切り文字は半角の「|」。手順6の先頭は「tmm-active|」。うまく取り込めない場合は、ホームの［手で入力］からアクティブエネルギーを入力できます。
        </Sub>
      </Card>
    </div>
  );
}
