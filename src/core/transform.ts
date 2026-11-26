import type { AssetDoc, Layer, LayerId, LayerPatch } from './types';

export type Corner = 'nw' | 'ne' | 'sw' | 'se';
export const ROTATE_HANDLE_OFFSET = 24;

type Point = { x: number; y: number };

// 레이어 로컬 좌표(중심 원점) ↔ 캔버스 좌표. rotation은 시계 방향(y 아래로 증가)
function toCanvas(l: Layer, lx: number, ly: number): Point {
  const c = Math.cos(l.rotation), s = Math.sin(l.rotation);
  return { x: l.x + lx * c - ly * s, y: l.y + lx * s + ly * c };
}
function toLocal(l: Layer, x: number, y: number): Point {
  const c = Math.cos(l.rotation), s = Math.sin(l.rotation);
  const dx = x - l.x, dy = y - l.y;
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}
const signs = (corner: Corner) => ({ sx: corner[1] === 'e' ? 1 : -1, sy: corner[0] === 's' ? 1 : -1 });

export function hitTest(doc: AssetDoc, x: number, y: number): LayerId | null {
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const l = doc.layers[i];
    const p = toLocal(l, x, y);
    if (Math.abs(p.x) <= l.width / 2 && Math.abs(p.y) <= l.height / 2) return l.id;
  }
  return null;
}

export function resizeFromCorner(layer: Layer, corner: Corner, x: number, y: number): LayerPatch {
  const { sx, sy } = signs(corner);
  const p = toLocal(layer, x, y);
  // 고정 모서리는 로컬 (-sx·w/2, -sy·h/2)
  const fx = (-sx * layer.width) / 2, fy = (-sy * layer.height) / 2;
  const width = Math.max(1, sx * (p.x - fx));
  const height = Math.max(1, sy * (p.y - fy));
  return { ...toCanvas(layer, fx + (sx * width) / 2, fy + (sy * height) / 2), width, height };
}

export function rotationTo(layer: Layer, x: number, y: number): number {
  return Math.atan2(x - layer.x, layer.y - y);
}

export function handlePoints(layer: Layer): Record<Corner | 'rotate', Point> {
  const w = layer.width / 2, h = layer.height / 2;
  return {
    nw: toCanvas(layer, -w, -h),
    ne: toCanvas(layer, w, -h),
    sw: toCanvas(layer, -w, h),
    se: toCanvas(layer, w, h),
    rotate: toCanvas(layer, 0, -h - ROTATE_HANDLE_OFFSET),
  };
}

export function hitHandle(layer: Layer, x: number, y: number, radius: number): Corner | 'rotate' | null {
  let best: Corner | 'rotate' | null = null, bestDist = radius;
  for (const [name, p] of Object.entries(handlePoints(layer)) as [Corner | 'rotate', Point][]) {
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist <= bestDist) [best, bestDist] = [name, dist];
  }
  return best;
}

export function clampCenter(_doc: AssetDoc, _x: number, _y: number): Point {
  throw new Error('not implemented');
}
