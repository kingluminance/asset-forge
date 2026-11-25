import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store';
import type { Layer } from './types';

const layer = (id: string): Layer => ({ id, src: '', x: 10, y: 20, width: 30, height: 40, rotation: 0 });
const make = () => createStore({ width: 100, height: 100, layers: [layer('a')] });

describe('createStore', () => {
  it('add/update/remove가 문서에 반영된다', () => {
    const store = make();
    store.addLayer(layer('b'));
    expect(store.getDoc().layers.map((l) => l.id)).toEqual(['a', 'b']);
    store.updateLayer('a', { x: 55, rotation: 1 });
    expect(store.getDoc().layers[0]).toEqual({ ...layer('a'), x: 55, rotation: 1 });
    store.removeLayer('a');
    expect(store.getDoc()).toEqual({ width: 100, height: 100, layers: [layer('b')] });
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
