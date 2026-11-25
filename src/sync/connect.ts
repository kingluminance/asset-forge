import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { WS_PATH } from '../../server/protocol';
import type { DocStore, Layer } from '../core/types';
import { createYjsStore } from './yjsStore';

// 방이 있으면 서버와 동기화한 뒤 문서가 비어 있을 때만 seed를 넣는다. 방이 없으면 로컬 문서에 바로 넣는다.
export function connect(room: string | null, size: { width: number; height: number }, seed: Layer): DocStore {
  const ydoc = new Y.Doc();
  const store = createYjsStore(ydoc, size);
  if (!room) {
    store.addLayer(seed);
    return store;
  }
  const url = (import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8787').replace(/^http/, 'ws') + WS_PATH;
  new WebsocketProvider(url, room, ydoc).once('sync', () => {
    if (store.getDoc().layers.length === 0) store.addLayer(seed);
  });
  return store;
}
