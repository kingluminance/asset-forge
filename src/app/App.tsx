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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {/* 경계선은 감싸는 쪽에: canvas 요소에 border를 주면 포인터 좌표가 어긋난다 */}
        <div style={{ alignSelf: 'flex-start', outline: '1px solid #999' }}>
          <CanvasEditor store={store} />
        </div>
        <Preview store={store} />
      </div>
    </>
  );
}
