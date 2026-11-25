import { describe, expect, it } from 'vitest';
import { AI_GENERATE_PATH, PROMPT_MAX, WS_PATH } from './protocol';
import type { ErrorResponse, GenerateRequest, GenerateResponse } from './protocol';

describe('타입 계약 (W-01)', () => {
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
