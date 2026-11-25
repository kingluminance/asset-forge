import { GeneratePanel } from '../ai/GeneratePanel';
import { CanvasEditor } from '../canvas/CanvasEditor';
import type { DocStore } from '../core/types';
import { Preview } from '../preview/Preview';
import { connect } from '../sync/connect';

declare global {
  interface Window {
    __store: DocStore;
  }
}

const SAMPLE_SRC =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#f5a623"/></svg>');

const store = connect(
  new URLSearchParams(location.search).get('room'),
  { width: 512, height: 512 },
  { id: 'layer-1', x: 256, y: 256, width: 128, height: 128, rotation: 0, src: SAMPLE_SRC },
);
window.__store = store;

export function App() {
  return (
    <>
      <h1>asset-forge</h1>
      <GeneratePanel store={store} />
      <CanvasEditor store={store} />
      <Preview store={store} />
    </>
  );
}
