import { useState } from 'react';
import { AI_GENERATE_PATH, PROMPT_MAX, type ErrorResponse, type GenerateRequest, type GenerateResponse } from '../../server/protocol';
import type { DocStore } from '../core/types';

const ENDPOINT = `${import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8787'}${AI_GENERATE_PATH}`;

export function GeneratePanel({ store }: { store: DocStore }) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setError('');
    try {
      const body: GenerateRequest = { prompt };
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as Partial<GenerateResponse & ErrorResponse>;
      if (!res.ok || !data.image) throw new Error(data.error ?? `생성 실패 (HTTP ${res.status})`);
      const doc = store.getDoc();
      store.addLayer({ id: crypto.randomUUID(), src: data.image, x: doc.width / 2, y: doc.height / 2, width: 256, height: 256, rotation: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <input data-testid="prompt" aria-label="생성 프롬프트" maxLength={PROMPT_MAX} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <button data-testid="generate" disabled={busy} onClick={generate}>생성</button>
      {error && <p data-testid="generate-error" role="alert">{error}</p>}
    </div>
  );
}
