import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAiHandler, mockProvider, openaiProvider, pollinationsProvider, providerFromEnv, withFallback, type ImageProvider } from './ai-proxy';
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
    expect(cors(res)).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type');
  });

  it.each([['짧은 프롬프트', 'sword'], ['PROMPT_MAX 길이', 'a'.repeat(PROMPT_MAX)]])('POST %s → 200 GenerateResponse', async (_name, prompt) => {
    const provider = okProvider();
    const { post } = await serve(provider);
    const res = await post(JSON.stringify({ prompt }));
    expect(res.status).toBe(200);
    expect(cors(res)).toBe('*');
    expect(await res.json()).toEqual({ image: IMAGE });
    expect(provider).toHaveBeenCalledWith(prompt);
  });

  it.each<[string, string, number[]]>([
    ['JSON 아님', 'not json', [400]], ['prompt 누락', '{}', [400]], ['빈 문자열', '{"prompt":""}', [400]],
    ['공백뿐', '{"prompt":"   "}', [400]], ['문자열 아님', '{"prompt":123}', [400]],
    ['PROMPT_MAX 초과', JSON.stringify({ prompt: 'a'.repeat(PROMPT_MAX + 1) }), [400]],
    ['본문 상한 초과(유효한 prompt + 20KB 추가 필드)', JSON.stringify({ prompt: 'sword', pad: 'a'.repeat(20_000) }), [413]],
  ])('POST %s → ErrorResponse로 거절, 공급자 미호출', async (_name, body, statuses) => {
    const provider = okProvider();
    const { post } = await serve(provider);
    const res = await post(body);
    expect(statuses).toContain(res.status);
    expect(cors(res)).toBe('*');
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
    expect(cors(res)).toBe('*');
    expect(typeof (await res.json()).error).toBe('string');
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('공급자가 실패하면 502, 공급자 에러 메시지·키를 노출하지 않는다', async () => {
    const { post } = await serve(() => Promise.reject(new Error('upstream exploded: Bearer test-key')));
    const res = await post(JSON.stringify({ prompt: 'sword' }));
    expect(res.status).toBe(502);
    expect(cors(res)).toBe('*');
    const text = await res.text();
    expect(typeof JSON.parse(text).error).toBe('string');
    expect(text).not.toContain('exploded');
    expect(text).not.toContain('test-key');
  });

  it('POST·OPTIONS 외 메서드는 405', async () => {
    const { call } = await serve(okProvider());
    const res = await call({ method: 'GET' });
    expect(res.status).toBe(405);
    expect(cors(res)).toBe('*');
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

  it('mockProvider는 XML 1.0 금지 문자(U+FFFE·U+FFFF)를 SVG에 넣지 않고 나머지 글자는 남긴다', async () => {
    const svg = Buffer.from((await mockProvider('a\uffffb\ufffec')).replace('data:image/svg+xml;base64,', ''), 'base64').toString();
    expect(svg).not.toMatch(/[\ufffe\uffff]/);
    const label = /<text[^>]*>(.*)<\/text>/.exec(svg)?.[1];
    for (const ch of 'abc') expect(label).toContain(ch);
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

  it('openaiProvider는 fetch에 제한 시간용 AbortSignal을 넘긴다', async () => {
    const fetchSpy = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json({ data: [{ b64_json: 'QUJD' }] }));
    vi.stubGlobal('fetch', fetchSpy);
    await openaiProvider('test-key')('sword');
    expect(fetchSpy.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('openaiProvider는 응답이 ok가 아니면 reject한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'bad key' }, { status: 401 })));
    await expect(openaiProvider('test-key')('sword')).rejects.toThrow();
  });
});

describe('무료 공급자와 목 대체', () => {
  afterEach(() => vi.unstubAllGlobals());
  const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const JPEG_URL = `data:image/jpeg;base64,${Buffer.from(BYTES).toString('base64')}`;
  const jpeg = (bytes = BYTES) => new Response(bytes, { headers: { 'content-type': 'image/jpeg' } });
  const limited = () => Response.json({ status: 402, error: { code: 'FREE_LIMIT' } }, { status: 402 });
  const stubFetch = (respond: () => Response) => vi.stubGlobal('fetch', vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => respond()));
  it('pollinationsProvider는 인코딩한 프롬프트로 GET하고 이미지 바이트를 data URL로 바꾼다', async () => {
    stubFetch(jpeg);
    expect(await pollinationsProvider('red sword/axe?')).toBe(JPEG_URL);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain(`https://image.pollinations.ai/prompt/${encodeURIComponent('red sword/axe?')}?`);
    expect(new URL(String(url)).searchParams.get('width')).toBe('512');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each<[string, () => Response]>([
    ['HTTP 402', limited], ['이미지가 아닌 200', () => Response.json({ ok: true })],
    ['2MB 초과 본문', () => jpeg(new Uint8Array(2 * 1024 * 1024 + 1))],
  ])('pollinationsProvider는 %s 응답이면 reject한다', async (_name, respond) => {
    stubFetch(respond);
    await expect(pollinationsProvider('sword')).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1); // 응답을 보고 거절한 것인지 확인
  });

  it('withFallback은 primary가 성공하면 그 결과만 쓰고, reject하면 같은 prompt로 fallback을 불러 그 결과를 쓴다', async () => {
    const [unused, used] = [okProvider(), okProvider()];
    expect(await withFallback(async () => 'data:primary', unused)('sword')).toBe('data:primary');
    expect(unused).not.toHaveBeenCalled();
    expect(await withFallback(() => Promise.reject(new Error('down')), used)('sword')).toBe(IMAGE);
    expect(used).toHaveBeenCalledWith('sword');
  });

  it('providerFromEnv는 AI_PROVIDER=pollinations면 키 없이 무료 공급자를 쓰고 실패하면 목으로 대체한다', async () => {
    const provider = providerFromEnv({ AI_PROVIDER: 'pollinations' });
    expect(provider).not.toBe(mockProvider);
    stubFetch(limited);
    expect(await provider('sword')).toBe(await mockProvider('sword'));
    stubFetch(jpeg);
    expect(await provider('sword')).toBe(JPEG_URL);
  });
});
