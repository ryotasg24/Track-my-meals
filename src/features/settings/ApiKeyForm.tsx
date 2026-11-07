/**
 * APIキーの入力・確認・削除（F-KEY-01〜06）。キーは端末内にだけ保存し、画面では末尾4文字以外を伏せ字にする。
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { db } from '../../db/db';
import { deleteApiKey, saveApiKey } from '../../db/repositories';
import { verifyApiKey } from '../../ai/service';
import { formatDateTime } from '../../domain/format';
import { Button } from '../../ui/Button';
import { Sub } from '../../ui/Card';
import { Field, Input } from '../../ui/Field';
import { useApiKeyInfo, useSettings } from '../hooks';

export function ApiKeyForm({ onSaved }: { onSaved?: () => void }) {
  const info = useApiKeyInfo();
  const settings = useSettings();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!info || !settings) return null;

  const check = async (key: string) => {
    setBusy(true);
    setMessage('確認しています…');
    const r = await verifyApiKey(key, settings.primaryModel);
    setBusy(false);
    if (r.ok) {
      await saveApiKey(db, key, Date.now());
      setValue('');
      setMessage('使えることを確認しました。');
      onSaved?.();
      return;
    }
    if (r.kind === 'auth' || r.kind === 'badRequest') {
      setMessage(`このキーは使えません（${r.message}）。キーを確かめてください。`);
    } else if (r.kind === 'offline' || r.kind === 'network') {
      // 通信できない場合は、確認できないまま保存しておく
      await saveApiKey(db, key, null);
      setValue('');
      setMessage('通信できないため確認できませんでした。キーは保存しました。');
      onSaved?.();
    } else {
      await saveApiKey(db, key, null);
      setValue('');
      setMessage(`キーは保存しました。確認のときにAIが応答しませんでした（${r.message}）。時間をおいて［確認］してください。`);
      onSaved?.();
    }
  };

  return (
    <div>
      {info.hasKey && (
        <p>
          設定済み：<span className="num">••••••••{info.last4}</span>
          {info.verifiedAt && <Sub>{formatDateTime(info.verifiedAt)} に確認済み</Sub>}
        </p>
      )}
      <Field label={info.hasKey ? '新しいキーに変える' : 'Gemini APIキー'}>
        <Input
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="AIza…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" disabled={busy || !value.trim()} onClick={() => void check(value.trim())}>
          保存して確認
        </Button>
        {info.hasKey && (
          <>
            <Button
              variant="text"
              disabled={busy}
              onClick={async () => {
                const key = (await db.secrets.get('gemini'))?.apiKey;
                if (key) await check(key);
              }}
            >
              確認
            </Button>
            <Button
              variant="text"
              onClick={async () => {
                if (!window.confirm('APIキーを削除しますか？AIを使う機能が使えなくなります。')) return;
                await deleteApiKey(db);
                setMessage('削除しました。');
              }}
            >
              削除
            </Button>
          </>
        )}
      </div>
      {message && <Sub>{message}</Sub>}
      <Sub>
        キーの入手方法と、AIに送る内容は <Link to="/settings/api-key">APIキーの設定手順</Link> をご覧ください。キーはこの端末の中にだけ保存し、バックアップにも含めません。
      </Sub>
    </div>
  );
}
