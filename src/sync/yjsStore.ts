import * as Y from 'yjs';
import type { AssetDoc, DocStore, Layer } from '../core/types';

// 구조: layers = LayerId → Y.Map(레이어 필드 + 내부용 z). z는 스냅샷에 노출하지 않는다.
export function createYjsStore(ydoc: Y.Doc, size: { width: number; height: number }): DocStore {
  const layers = ydoc.getMap<Y.Map<unknown>>('layers');
  const snapshot = (): AssetDoc => ({
    ...size,
    layers: [...layers.values()]
      .map((m) => m.toJSON() as Layer & { z: number })
      .sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : 1))
      .map((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'z')) as unknown as Layer),
  });
  // getDoc은 캐시만 돌려준다 (useSyncExternalStore가 같은 참조를 기대)
  let doc = snapshot();
  const listeners = new Set<() => void>();
  layers.observeDeep(() => {
    doc = snapshot();
    listeners.forEach((fn) => fn());
  });
  return {
    getDoc: () => doc,
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    addLayer: (layer) =>
      ydoc.transact(() => {
        const z = Math.max(-1, ...[...layers.values()].map((m) => m.get('z') as number)) + 1;
        layers.set(layer.id, new Y.Map(Object.entries({ ...layer, z })));
      }),
    updateLayer: (id, patch) =>
      ydoc.transact(() => {
        const m = layers.get(id);
        if (m) Object.entries(patch).forEach(([k, v]) => m.set(k, v));
      }),
    removeLayer: (id) => void layers.delete(id),
  };
}
