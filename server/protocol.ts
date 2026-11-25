export const WS_PATH = '/ws';                 // y-websocket: ws://host/ws/<room>
export const AI_GENERATE_PATH = '/api/generate';
export const PROMPT_MAX = 500;

export interface GenerateRequest { prompt: string }
export interface GenerateResponse { image: string }   // PNG data URL
export interface ErrorResponse { error: string }      // 400 입력 오류, 429 레이트 리밋, 502 업스트림 실패
