import type { Server } from 'node:http';
// lib0·y-protocols는 y-websocket의 전이 의존성. W-07에서 직접 의존성으로 승격 예정
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { WebSocketServer, type WebSocket } from 'ws';
import { readSyncMessage, writeSyncStep1, writeUpdate } from 'y-protocols/sync';
import * as Y from 'yjs';
import { WS_PATH } from './protocol';

// y-websocket 프로토콜: 첫 varUint가 메시지 타입
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

const syncMessage = (write: (encoder: encoding.Encoder) => void) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  write(encoder);
  return encoder;
};

// 방별 메모리 문서 하나. 영속화 없음: 마지막 연결이 끊기면 버린다
export function attachWs(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map<string, { doc: Y.Doc; conns: Set<WebSocket> }>();

  server.on('upgrade', (req, socket, head) => {
    const prefix = WS_PATH + '/';
    const path = (req.url ?? '').split('?')[0];
    const name = path.slice(prefix.length);
    if (!path.startsWith(prefix) || !name) return socket.destroy();

    wss.handleUpgrade(req, socket, head, (ws) => {
      let room = rooms.get(name);
      if (!room) {
        const created = { doc: new Y.Doc(), conns: new Set<WebSocket>() };
        // 문서 변경을 보낸 연결(origin)을 뺀 나머지에 전달
        created.doc.on('update', (update: Uint8Array, origin: unknown) => {
          const message = encoding.toUint8Array(syncMessage((e) => writeUpdate(e, update)));
          created.conns.forEach((c) => c !== origin && c.send(message));
        });
        rooms.set(name, (room = created));
      }
      const { doc, conns } = room;
      conns.add(ws);
      ws.on('error', () => {}); // 리스너가 없으면 잘못된 프레임 하나에 프로세스가 죽는다
      ws.on('close', () => {
        conns.delete(ws);
        if (conns.size === 0) {
          doc.destroy();
          rooms.delete(name);
        }
      });
      ws.on('message', (data: Buffer) => {
        // 깨진 메시지는 그 연결만 닫는다 (같은 프로세스의 AI 프록시를 지킨다)
        try {
          const decoder = decoding.createDecoder(data);
          const type = decoding.readVarUint(decoder);
          if (type === MSG_SYNC) {
            const reply = syncMessage((e) => readSyncMessage(decoder, e, doc, ws));
            if (encoding.length(reply) > 1) ws.send(encoding.toUint8Array(reply));
          } else if (type === MSG_AWARENESS) {
            conns.forEach((c) => c !== ws && c.send(data));
          }
        } catch {
          ws.close();
        }
      });
      ws.send(encoding.toUint8Array(syncMessage((e) => writeSyncStep1(e, doc))));
    });
  });
}
