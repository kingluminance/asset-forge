import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { Layer } from '../core/types';
import { createYjsStore } from './yjsStore';

const size = { width: 100, height: 100 };
const layer = (id: string): Layer => ({ id, src: '', x: 10, y: 20, width: 30, height: 40, rotation: 0 });
const peer = (ydoc = new Y.Doc()) => ({ ydoc, store: createYjsStore(ydoc, size) });
const make = () => {
  const { store } = peer();
  store.addLayer(layer('a'));
  return store;
};
// 서버 없이 두 문서의 update를 주고받는다
const send = (from: Y.Doc, to: Y.Doc) => Y.applyUpdate(to, Y.encodeStateAsUpdate(from));
const exchange = (a: Y.Doc, b: Y.Doc) => {
  send(a, b);
  send(b, a);
};

describe('createYjsStore: DocStore 계약', () => {
  it('add/update/remove가 문서에 반영된다', () => {
    const store = make();
    store.addLayer(layer('b'));
    expect(store.getDoc().layers.map((l) => l.id)).toEqual(['a', 'b']);
    store.updateLayer('a', { x: 55, rotation: 1 });
    expect(store.getDoc().layers[0]).toEqual({ ...layer('a'), x: 55, rotation: 1 });
    store.removeLayer('a');
    expect(store.getDoc()).toEqual({ ...size, layers: [layer('b')] });
  });
  it('변경마다 구독자를 부르고 unsubscribe 후에는 부르지 않는다', () => {
    const store = make();
    const fn = vi.fn();
    const unsubscribe = store.subscribe(fn);
    store.addLayer(layer('b'));
    store.updateLayer('b', { x: 1 });
    store.removeLayer('b');
    expect(fn).toHaveBeenCalledTimes(3);
    unsubscribe();
    store.updateLayer('a', { x: 1 });
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it('getDoc은 변경이 없으면 같은 참조, 변경 후엔 새 참조이고 이전 스냅샷은 그대로다', () => {
    const store = make();
    const before = store.getDoc();
    expect(store.getDoc()).toBe(before);
    store.updateLayer('a', { x: 99 });
    expect(store.getDoc()).not.toBe(before);
    expect(store.getDoc().layers[0].x).toBe(99);
    expect(before.layers[0].x).toBe(10);
  });
});

describe('createYjsStore: 두 문서 동기화', () => {
  it('원격 update가 적용되면 구독자를 부르고 getDoc이 새 스냅샷이 된다', () => {
    const [a, b] = [peer(), peer()];
    const fn = vi.fn();
    b.store.subscribe(fn);
    const before = b.store.getDoc();
    a.store.addLayer(layer('a'));
    send(a.ydoc, b.ydoc);
    expect(fn).toHaveBeenCalled();
    expect(b.store.getDoc()).not.toBe(before);
    expect(b.store.getDoc().layers).toEqual([layer('a')]);
  });
  it('같은 레이어의 서로 다른 필드를 동시에 고치면 둘 다 남고 양쪽이 같아진다', () => {
    const [a, b] = [peer(), peer()];
    a.store.addLayer(layer('a'));
    send(a.ydoc, b.ydoc);
    a.store.updateLayer('a', { x: 55 });
    b.store.updateLayer('a', { rotation: 1 });
    exchange(a.ydoc, b.ydoc);
    expect(a.store.getDoc().layers).toEqual([{ ...layer('a'), x: 55, rotation: 1 }]);
    expect(b.store.getDoc()).toEqual(a.store.getDoc());
  });
  it('같은 id의 레이어를 양쪽이 각각 추가해도 교환 후 레이어는 하나다', () => {
    const [a, b] = [peer(), peer()];
    a.store.addLayer(layer('a'));
    b.store.addLayer(layer('a'));
    exchange(a.ydoc, b.ydoc);
    expect(a.store.getDoc().layers).toEqual([layer('a')]);
    expect(b.store.getDoc()).toEqual(a.store.getDoc());
  });
  it('늦게 합류한 빈 문서가 update를 받으면 편집된 값과 순서까지 같아진다', () => {
    const [a, b] = [peer(), peer()];
    a.store.addLayer(layer('a'));
    a.store.addLayer(layer('b'));
    a.store.updateLayer('a', { x: 77 });
    send(a.ydoc, b.ydoc);
    expect(b.store.getDoc()).toEqual({ ...size, layers: [{ ...layer('a'), x: 77 }, layer('b')] });
    expect(b.store.getDoc()).toEqual(a.store.getDoc());
  });
});
