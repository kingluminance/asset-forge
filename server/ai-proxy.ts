import type { IncomingMessage, ServerResponse } from 'node:http';
import { AI_GENERATE_PATH, PROMPT_MAX, type ErrorResponse, type GenerateRequest, type GenerateResponse } from './protocol';

export type ImageProvider = (prompt: string) => Promise<string>; // data URL
type Handler = (req: IncomingMessage, res: ServerResponse) => boolean;

const XML_ESCAPES: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' };
// 네트워크 없이 프롬프트로 결정되는 SVG. 제어 문자는 XML에 넣을 수 없어 공백으로 바꾼다
export const mockProvider: ImageProvider = async (prompt) => {
  let hash = 0;
  for (const ch of prompt) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  const label = prompt.slice(0, 24).replace(/[\u0000-\u001f￾￿]/g, ' ').replace(/[<>&"']/g, (c) => XML_ESCAPES[c]);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="hsl(${hash % 360} 60% 45%)"/>` +
    `<text x="128" y="136" text-anchor="middle" font-size="20" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`; // base64: 짝 없는 서러게이트에도 안전
};

export const openaiProvider = (apiKey: string): ImageProvider => async (prompt) => {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024' }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`openai responded ${res.status}`);
  const b64 = ((await res.json()) as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
  if (!b64) throw new Error('openai response has no image');
  return `data:image/png;base64,${b64}`;
};

// ponytail: 키 없는 무료 API는 IP당 45초에 1장. 넘으면 402 → 목으로 대체. 품질·한도가 필요하면 키가 있는 공급자로 교체
export const pollinationsProvider: ImageProvider = async (prompt) => {
  if (/^\.+$/.test(prompt)) throw new Error('pollinations prompt cannot be only dots'); // URL 파서가 점 세그먼트를 정규화해 /prompt/ 경로를 벗어난다
  const res = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`pollinations responded ${res.status}`);
  const type = (res.headers.get('content-type') ?? '').split(/[,;]/)[0].trim().toLowerCase();
  if (!type.startsWith('image/')) throw new Error('pollinations response is not an image');
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 2 * 1024 * 1024) throw new Error('pollinations image exceeds 2MB');
  return `data:${type};base64,${bytes.toString('base64')}`;
};

export const withFallback = (primary: ImageProvider, fallback: ImageProvider): ImageProvider => async (prompt) => {
  try {
    return await primary(prompt);
  } catch (err) {
    console.error('[ai] primary provider failed, using fallback:', err instanceof Error ? err.message : 'unknown error'); // 프롬프트는 남기지 않는다
    return fallback(prompt);
  }
};

export const providerFromEnv = (env: Record<string, string | undefined>): ImageProvider => {
  if (env.AI_PROVIDER === 'pollinations') return withFallback(pollinationsProvider, mockProvider);
  return env.AI_PROVIDER === 'openai' && env.AI_API_KEY ? openaiProvider(env.AI_API_KEY) : mockProvider;
};

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const MAX_BODY_BYTES = 8 * 1024; // PROMPT_MAX자 JSON이 넉넉히 들어가는 크기

const send = (res: ServerResponse, status: number, body: GenerateResponse | ErrorResponse, headers: Record<string, string> = {}) =>
  void res.writeHead(status, { ...CORS, 'content-type': 'application/json', ...headers }).end(JSON.stringify(body));

// 한도를 넘으면 null. 소켓은 끊지 않고 남은 본문은 버린다(응답을 보낼 수 있게)
const readBody = (req: IncomingMessage) =>
  new Promise<string | null>((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_BODY_BYTES) return void chunks.push(chunk);
      req.removeAllListeners('data');
      resolve(null);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', () => resolve(null));
  });

async function generate(req: IncomingMessage, res: ServerResponse, provider: ImageProvider) {
  const body = await readBody(req);
  if (body === null) return send(res, 413, { error: 'request body too large' }, { connection: 'close' });
  let prompt: unknown;
  try {
    prompt = (JSON.parse(body) as GenerateRequest | null)?.prompt;
  } catch { /* JSON이 아니면 아래 검증에서 400 */ }
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > PROMPT_MAX) {
    return send(res, 400, { error: `prompt must be a non-empty string of at most ${PROMPT_MAX} characters` });
  }
  try {
    send(res, 200, { image: await provider(prompt) });
  } catch (err) {
    console.error('[ai] provider failed:', err); // 상세는 서버 로그에만. 응답에는 싣지 않는다
    send(res, 502, { error: 'image generation failed' });
  }
}

export const createAiHandler = ({ provider, limitPerMinute }: { provider: ImageProvider; limitPerMinute: number }): Handler => {
  // ponytail: remoteAddress 기준이라 프록시 뒤에서는 전체 공용 한도가 된다. 필요하면 신뢰 가능한 X-Forwarded-For 처리로 교체
  // ponytail: 고정 1분 창(창이 바뀌면 Map을 통째로 비운다). 경계에서 최대 2배 버스트. 문제가 되면 슬라이딩 윈도로
  const counts = new Map<string, number>();
  let windowStart = 0;
  return (req, res) => {
    if (req.url?.split('?')[0] !== AI_GENERATE_PATH) return false;
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS).end();
    } else if (req.method !== 'POST') {
      send(res, 405, { error: 'method not allowed' });
    } else {
      const now = Date.now();
      if (now - windowStart >= 60_000) {
        counts.clear();
        windowStart = now;
      }
      const ip = req.socket.remoteAddress ?? '';
      const count = (counts.get(ip) ?? 0) + 1;
      counts.set(ip, count);
      if (count > limitPerMinute) send(res, 429, { error: 'rate limit exceeded, try again in a minute' });
      else void generate(req, res, provider);
    }
    return true;
  };
};

try {
  process.loadEnvFile('server/.env');
} catch { /* 없으면 목 공급자로 동작 */ }
export const handleAi = createAiHandler({
  provider: providerFromEnv(process.env),
  limitPerMinute: Number(process.env.RATE_LIMIT_PER_MIN) || 10,
});
