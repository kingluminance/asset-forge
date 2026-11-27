import { useState, type FormEvent } from 'react';
import { AI_GENERATE_PATH, PROMPT_MAX, type GenerateRequest, type GenerateResponse } from '../../server/protocol';
import type { DocStore, LayerId } from '../core/types';

const ENDPOINT = `${import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8787'}${AI_GENERATE_PATH}`;

export function GeneratePanel({ store, onCreated }: { store: DocStore; onCreated: (id: LayerId) => void }) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [slow, setSlow] = useState(false);

  const generate = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError('');
    // 무료 호스팅은 첫 요청에 서버가 깨어나느라 오래 걸린다
    const timer = setTimeout(() => setSlow(true), 5000);
    try {
      const body: GenerateRequest = { prompt };
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
      if (!res) return setError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      if (res.status === 429) return setError('요청이 너무 많습니다. 1분 뒤 다시 시도해 주세요.');
      const data = (await res.json().catch(() => ({}))) as Partial<GenerateResponse>;
      if (!res.ok || !data.image) return setError('이미지 생성에 실패했습니다. 다시 시도해 주세요.');
      const doc = store.getDoc();
      const id = crypto.randomUUID();
      store.addLayer({ id, src: data.image, x: doc.width / 2, y: doc.height / 2, width: 256, height: 256, rotation: 0 });
      onCreated(id);
    } catch {
      setError('이미지 생성에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      clearTimeout(timer);
      setSlow(false);
      setBusy(false);
    }
  };

  return (
    <div>
      <form onSubmit={generate}>
        <input data-testid="prompt" aria-label="생성 프롬프트" maxLength={PROMPT_MAX} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <button data-testid="generate" disabled={busy}>{busy ? '생성 중…' : '생성'}</button>
      </form>
      {slow && <p data-testid="generate-hint" role="status">서버를 깨우는 중… 처음에는 1분쯤 걸릴 수 있습니다.</p>}
      {error && <p data-testid="generate-error" role="alert">{error}</p>}
    </div>
  );
}
