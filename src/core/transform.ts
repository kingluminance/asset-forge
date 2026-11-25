import type { AssetDoc, Layer, LayerId, LayerPatch } from './types';

export type Corner = 'nw' | 'ne' | 'sw' | 'se';
export const ROTATE_HANDLE_OFFSET = 24;

export function hitTest(_doc: AssetDoc, _x: number, _y: number): LayerId | null {
  throw new Error('not implemented');
}
export function resizeFromCorner(_layer: Layer, _corner: Corner, _x: number, _y: number): LayerPatch {
  throw new Error('not implemented');
}
export function rotationTo(_layer: Layer, _x: number, _y: number): number {
  throw new Error('not implemented');
}
export function handlePoints(_layer: Layer): Record<Corner | 'rotate', { x: number; y: number }> {
  throw new Error('not implemented');
}
