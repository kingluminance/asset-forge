import type { AssetDoc, DocStore } from '../core/types';
import { Preview } from '../preview/Preview';

const magenta =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ff00ff"/></svg>',
  );
const previewDoc: AssetDoc = {
  width: 512,
  height: 512,
  layers: [{ id: 'layer-1', x: 256, y: 256, width: 256, height: 256, rotation: 0, src: magenta }],
};
// W-04에서 캔버스와 같은 스토어로 교체
const previewStore: DocStore = {
  getDoc: () => previewDoc,
  subscribe: () => () => {},
  addLayer: () => {},
  updateLayer: () => {},
  removeLayer: () => {},
};

export function App() {
  return (
    <>
      <h1>asset-forge</h1>
      <Preview store={previewStore} />
    </>
  );
}
