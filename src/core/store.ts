import type { AssetDoc, DocStore, Layer } from './types';

export function createStore(initial: AssetDoc): DocStore {
  let doc = initial;
  const listeners = new Set<() => void>();
  const setLayers = (layers: Layer[]) => {
    doc = { ...doc, layers };
    listeners.forEach((fn) => fn());
  };
  return {
    getDoc: () => doc,
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    addLayer: (layer) => setLayers([...doc.layers, layer]),
    updateLayer: (id, patch) => setLayers(doc.layers.map((l) => (l.id === id ? { ...l, ...patch } : l))),
    removeLayer: (id) => setLayers(doc.layers.filter((l) => l.id !== id)),
  };
}
