import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAiHandler, mockProvider, openaiProvider, providerFromEnv, type ImageProvider } from './ai-proxy';
import { AI_GENERATE_PATH, PROMPT_MAX } from './protocol';

const IMAGE = 'data:image/png;base64,AAAA';
const servers: Server[] = [];
// 실제 HTTP 서버(포트 0)에 핸들러를 물리고 fetch로 부른다. 핸들러가 false면 index.ts처럼 404
async function serve(provider: ImageProvider, limitPerMinute = 100) {
  const handler = createAiHandler({ provider, limitPerMinute });
  const server = createServer((req, res) => void (handler(req, res) || res.writeHead(404).end()));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (init: RequestInit, path = AI_GENERATE_PATH) => fetch(base + path, init);
  const post = (body: string) => call({ method: 'POST', headers: { 'content-type': 'application/json' }, body });
  return { call, post };
}
const okProvider = () => vi.fn<ImageProvider>(async () => IMAGE);
const cors = (res: Response) => res.headers.get('access-control-allow-origin');

describe('createAiHandler', () => {
  afterEach(() => servers.splice(0).forEach((s) => s.close(() => {}).closeAllConnections()));

  it('다른 경로는 건드리지 않고 false를 돌려준다', async () => {
    const provider = okProvider();
    const { call } = await serve(provider);
    const res = await call({ method: 'POST', body: JSON.stringify({ prompt: 'sword' }) }, '/other');
    expect(res.status).toBe(404);
    expect(cors(res)).toBeNull();
    expect(provider).not.toHaveBeenCalled();
  });

  it('OPTIONS 프리플라이트에 204와 CORS 헤더로 답한다', async () => {
    const { call } = await serve(okProvider());
    const res = await call({ method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(cors(res)).toBeTruthy();
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type');
  });

  it.each([['짧은 프롬프트', 'sword'], ['PROMPT_MAX 길이', 'a'.repeat(PROMPT_MAX)]])('POST %s → 200 GenerateResponse', async (_name, prompt) => {
    const provider = okProvider();
    const { post } = await serve(provider);
    const res = await post(JSON.stringify({ prompt }));
    expect(res.status).toBe(200);
    expect(cors(res)).toBeTruthy();
    expect(await res.json()).toEqual({ image: IMAGE });
    expect(provider).toHaveBeenCalledWith(prompt);
  });

  it.each<[string, string, number[]]>([
    ['JSON 아님', 'not json', [400]], ['prompt 누락', '{}', [400]], ['빈 문자열', '{"prompt":""}', [400]],
    ['공백뿐', '{"prompt":"   "}', [400]], ['문자열 아님', '{"prompt":123}', [400]],
    ['PROMPT_MAX 초과', JSON.stringify({ prompt: 'a'.repeat(PROMPT_MAX + 1) }), [400]],
    ['과도하게 큰 본문(20KB)', JSON.stringify({ prompt: 'a'.repeat(20_000) }), [400, 413]],
  ])('POST %s → ErrorResponse로 거절, 공급자 미호출', async (_name, body, statuses) => {
    const provider = okProvider();
    const { post } = await serve(provider);
    const res = await post(body);
    expect(statuses).toContain(res.status);
    expect(cors(res)).toBeTruthy();
    expect(typeof (await res.json()).error).toBe('string');
    expect(provider).not.toHaveBeenCalled();
  });

  it('같은 IP가 분당 한도를 넘으면 429, 공급자를 부르지 않는다', async () => {
    const provider = okProvider();
    const { post } = await serve(provider, 2);
    const body = JSON.stringify({ prompt: 'sword' });
    expect((await post(body)).status).toBe(200);
    expect((await post(body)).status).toBe(200);
    const res = await post(body);
    expect(res.status).toBe(429);
    expect(cors(res)).toBeTruthy();
    expect(typeof (await res.json()).error).toBe('string');
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('공급자가 실패하면 502, 공급자 에러 메시지·키를 노출하지 않는다', async () => {
    const { post } = await serve(() => Promise.reject(new Error('upstream exploded: Bearer test-key')));
    const res = await post(JSON.stringify({ prompt: 'sword' }));
    expect(res.status).toBe(502);
    expect(cors(res)).toBeTruthy();
    const text = await res.text();
    expect(typeof JSON.parse(text).error).toBe('string');
    expect(text).not.toContain('exploded');
    expect(text).not.toContain('test-key');
  });

  it('POST·OPTIONS 외 메서드는 405', async () => {
    const { call } = await serve(okProvider());
    const res = await call({ method: 'GET' });
    expect(res.status).toBe(405);
    expect(cors(res)).toBeTruthy();
  });
});

describe('공급자', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mockProvider는 네트워크 없이 프롬프트별로 결정적인 이미지 data URL을 만든다', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy); // 네트워크를 쓰면 여기서 걸린다
    const a = await mockProvider('sword');
    expect(a).toMatch(/^data:image\//);
    expect(await mockProvider('sword')).toBe(a);
    expect(await mockProvider('shield')).not.toBe(a);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('providerFromEnv는 AI_PROVIDER=openai와 키가 둘 다 있을 때만 실제 공급자를 쓴다', () => {
    expect(providerFromEnv({})).toBe(mockProvider);
    expect(providerFromEnv({ AI_PROVIDER: 'openai' })).toBe(mockProvider);
    expect(providerFromEnv({ AI_API_KEY: 'test-key' })).toBe(mockProvider);
    expect(providerFromEnv({ AI_PROVIDER: 'openai', AI_API_KEY: 'test-key' })).not.toBe(mockProvider);
  });

  it('openaiProvider는 Bearer 키로 이미지 API를 부르고 b64를 PNG data URL로 바꾼다', async () => {
    const fetchSpy = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json({ data: [{ b64_json: 'QUJD' }] }));
    vi.stubGlobal('fetch', fetchSpy);
    expect(await openaiProvider('test-key')('sword')).toBe('data:image/png;base64,QUJD');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://api.openai.com/v1/images/generations');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-key');
  });

  it('openaiProvider는 응답이 ok가 아니면 reject한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'bad key' }, { status: 401 })));
    await expect(openaiProvider('test-key')('sword')).rejects.toThrow();
  });
});
