export type LayerId = string;

export interface Layer {
  id: LayerId;
  src: string;        // 이미지 URL 또는 data URL
  x: number;          // 중심 x (캔버스 px)
  y: number;          // 중심 y
  width: number;
  height: number;
  rotation: number;   // 라디안, 시계 방향
}

export interface AssetDoc {
  width: number;      // 캔버스 크기 = 프리뷰 텍스처 크기
  height: number;
  layers: Layer[];    // 배열 순서 = z 순서 (뒤가 위)
}

export type LayerPatch = Partial<Omit<Layer, 'id'>>;

// canvas·preview가 아는 유일한 상태 창구. W-05에서 sync/가 Yjs로 구현해 app/에서 갈아 끼운다.
export interface DocStore {
  getDoc(): AssetDoc;                               // 불변 스냅샷
  subscribe(fn: () => void): () => void;            // useSyncExternalStore 호환
  addLayer(layer: Layer): void;
  updateLayer(id: LayerId, patch: LayerPatch): void;
  removeLayer(id: LayerId): void;
}
