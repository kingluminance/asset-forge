import { once } from 'node:events';
import { createServer } from 'node:http';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { readSyncMessage, writeSyncStep1, writeUpdate } from 'y-protocols/sync';
import * as Y from 'yjs';
import { WS_PATH } from './protocol';
import { attachWs } from './ws';

const server = createServer();
attachWs(server);
const sockets: WebSocket[] = [];
// 받은 메시지를 큐에 쌓고 next()로 하나씩 꺼낸다. ms 안에 오지 않으면 undefined
function connect(path: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${(server.address() as { port: number }).port}${path}`).on('error', () => {});
  const queue: Uint8Array[] = [];
  ws.on('message', (data: Buffer) => queue.push(new Uint8Array(data)));
  const next = async (ms = 1000) => {
    if (!queue.length) await Promise.race([once(ws, 'message'), new Promise((resolve) => setTimeout(resolve, ms))]);
    return queue.shift();
  };
  sockets.push(ws);
  return { ws, next };
}
type Client = ReturnType<typeof connect>;
// 방에 접속해 서버의 첫 step1을 받아 넘긴 클라이언트
const join = (room: string, client = connect(`${WS_PATH}/${room}`)) => client.next().then(() => client);
const sync = (write: (e: encoding.Encoder) => void) => encoding.encode((e) => (encoding.writeVarUint(e, 0), write(e)));
// [메시지 타입, sync 타입, 메시지를 빈 Y.Doc에 적용한 뒤의 값]
const read = (message: Uint8Array = new Uint8Array()) => {
  const [d, doc] = [decoding.createDecoder(message), new Y.Doc()];
  return [decoding.readVarUint(d), readSyncMessage(d, encoding.createEncoder(), doc, null), doc.getMap('m').get('k')];
};
const source = new Y.Doc();
source.getMap('m').set('k', 'v');
// step1 → 서버의 응답(step2면 방의 현재 상태). 같은 연결의 앞선 메시지가 처리된 뒤에 온다
const pull = (c: Client) => (c.ws.send(sync((e) => writeSyncStep1(e, new Y.Doc()))), c.next().then(read));
const sendUpdate = (c: Client) => (c.ws.send(sync((e) => writeUpdate(e, Y.encodeStateAsUpdate(source)))), pull(c));
beforeAll(() => new Promise<void>((resolve) => void server.listen(0, '127.0.0.1', resolve)));
afterEach(() => sockets.splice(0).forEach((s) => s.terminate()));
afterAll(() => void server.close());
it('접속하면 sync step1을 보낸다', async () => expect(read(await connect(`${WS_PATH}/r1`).next())).toEqual([0, 0, undefined]));
it('A의 update를 같은 방 B만 받는다: 발신자 A와 다른 방 D는 받지 않는다', async () => {
  const [a, b, d] = [await join('r2'), await join('r2'), await join('r2-other')];
  await sendUpdate(a);
  expect(read(await b.next())).toEqual([0, 2, 'v']);
  expect([await a.next(100), await d.next(100)]).toEqual([undefined, undefined]);
});
it('늦게 합류한 C가 step1을 보내면 step2로 현재 상태를 받는다', async () => {
  await sendUpdate(await join('r3'));
  expect(await pull(await join('r3'))).toEqual([0, 1, 'v']);
});
it('깨진 프레임은 그 연결만 닫고, 모르는 메시지 타입은 무시한다', async () => {
  const [a, b] = [await join('r5'), await join('r5')];
  a.ws.send(new Uint8Array(0));
  await once(a.ws, 'close');
  b.ws.send(Uint8Array.of(99));
  expect(await pull(b)).toEqual([0, 1, undefined]); // 99 뒤에도 응답 = 같은 방 연결 유지
  expect(await pull(await join('r5'))).toEqual([0, 1, undefined]); // 서버는 계속 새 연결을 받는다
});
it('WS_PATH 밖 경로의 upgrade는 거부된다', () => expect(once(connect('/other/room').ws, 'open')).rejects.toThrow());
it('마지막 연결이 끊긴 뒤 다시 들어오면 문서가 비어 있다', async () => {
  const a = await join('r7');
  expect(await sendUpdate(a)).toEqual([0, 1, 'v']);
  a.ws.close();
  await once(a.ws, 'close');
  expect(await pull(await join('r7'))).toEqual([0, 1, undefined]);
});
