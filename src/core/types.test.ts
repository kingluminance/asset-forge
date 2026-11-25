import { describe, expect, it } from 'vitest';
import type { AssetDoc, DocStore, Layer, LayerPatch } from './types';
import { AI_GENERATE_PATH, PROMPT_MAX, WS_PATH } from '../../server/protocol';
import type { ErrorResponse, GenerateRequest, GenerateResponse } from '../../server/protocol';

describe('타입 계약 (W-01)', () => {
  it('core 타입 계약이 컴파일된다', () => {
    const layer = { id: 'a', src: 'a.png', x: 10, y: 20, width: 100, height: 50, rotation: 0 } satisfies Layer;
    const doc = { width: 512, height: 512, layers: [layer] } satisfies AssetDoc;
    const patch = { x: 30, rotation: Math.PI / 2 } satisfies LayerPatch;
    const store = {
      getDoc: () => doc,
      subscribe: () => () => {},
      addLayer: (_layer: Layer) => {},
      updateLayer: (_id: string, _patch: LayerPatch) => {},
      removeLayer: (_id: string) => {},
    } satisfies DocStore;

    store.updateLayer(layer.id, patch);
    expect(store.getDoc().layers[0]).toEqual(layer);
  });

  it('서버 프로토콜 상수와 타입이 계약과 같다', () => {
    expect(WS_PATH).toBe('/ws');
    expect(AI_GENERATE_PATH).toBe('/api/generate');
    expect(PROMPT_MAX).toBe(500);

    const req = { prompt: 'sword' } satisfies GenerateRequest;
    const res = { image: 'data:image/png;base64,AAAA' } satisfies GenerateResponse;
    const err = { error: 'prompt too long' } satisfies ErrorResponse;
    expect([req.prompt, res.image, err.error].every((v) => typeof v === 'string')).toBe(true);
  });
});
