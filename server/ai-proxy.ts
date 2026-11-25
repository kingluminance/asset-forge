import type { IncomingMessage, ServerResponse } from 'node:http';

export type ImageProvider = (prompt: string) => Promise<string>; // data URL
const todo = (): never => {
  throw new Error('not implemented');
};
export const mockProvider: ImageProvider = async (_prompt) => todo();
export const openaiProvider = (_apiKey: string): ImageProvider => todo();
export const providerFromEnv = (_env: Record<string, string | undefined>): ImageProvider => todo();
export const createAiHandler = (_opts: { provider: ImageProvider; limitPerMinute: number }): typeof handleAi => todo();

// W-06에서 구현
export function handleAi(_req: IncomingMessage, _res: ServerResponse): boolean {
  return false;
}
