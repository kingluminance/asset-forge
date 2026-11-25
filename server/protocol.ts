export const WS_PATH = '/ws';                 // y-websocket: ws://host/ws/<room>
export const AI_GENERATE_PATH = '/api/generate';
export const PROMPT_MAX = 500;

export interface GenerateRequest { prompt: string }
export interface GenerateResponse { image: string }   // 이미지 data URL (실제 공급자: PNG, 목: SVG)
export interface ErrorResponse { error: string }      // 400 입력 오류, 405 메서드, 413 본문 초과, 429 레이트 리밋, 502 업스트림 실패
