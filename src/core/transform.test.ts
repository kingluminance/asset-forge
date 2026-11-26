import { describe, expect, it } from 'vitest';
import { ROTATE_HANDLE_OFFSET, clampCenter, handlePoints, hitHandle, hitTest, resizeFromCorner, rotationTo } from './transform';
import type { AssetDoc, Layer } from './types';

// 좌표계: 캔버스 px, y는 아래로 증가, x/y는 중심, rotation은 라디안 시계 방향
const mk = (id: string, x: number, y: number, rotation = 0): Layer => ({ id, src: '', x, y, width: 80, height: 40, rotation });
const flat = mk('flat', 100, 100); // x 60..140, y 80..120
const quarter = mk('quarter', 100, 100, Math.PI / 2); // 화면상 x 80..120, y 60..140

describe('hitTest', () => {
  // top은 flat의 오른쪽 절반과 겹치며 더 위에 있다. rot은 화면상 x 280..320, y 260..340
  const doc: AssetDoc = { width: 512, height: 512, layers: [flat, mk('top', 140, 100), mk('rot', 300, 300, Math.PI / 2)] };
  it.each([
    ['레이어 안', 70, 100, 'flat'],
    ['겹치면 배열 뒤(위) 레이어', 120, 100, 'top'],
    ['빈 곳', 100, 200, null],
    ['회전된 레이어의 회전 후 영역', 300, 335, 'rot'],
    ['회전 전에만 덮던 영역', 335, 300, null],
  ])('%s (%d, %d) → %s', (_name, x, y, expected) => {
    expect(hitTest(doc, x, y)).toBe(expected);
  });
});

describe('resizeFromCorner', () => {
  it.each([
    ['se', flat, 'se', 160, 140, { x: 110, y: 110, width: 100, height: 60 }],
    ['nw', flat, 'nw', 40, 70, { x: 90, y: 95, width: 100, height: 50 }],
    ['ne', flat, 'ne', 150, 70, { x: 105, y: 95, width: 90, height: 50 }],
    ['sw', flat, 'sw', 50, 130, { x: 95, y: 105, width: 90, height: 50 }],
    // 90° 회전: se는 (80,140), 고정되는 nw는 (120,60). 로컬 x축은 화면 아래, 로컬 y축은 화면 왼쪽
    ['회전된 레이어 se', quarter, 'se', 70, 160, { x: 95, y: 110, width: 100, height: 50 }],
  ] as const)('%s 모서리를 끌면 반대쪽 모서리가 고정된다', (_name, layer, corner, x, y, expected) => {
    const patch = resizeFromCorner(layer, corner, x, y);
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(patch[key]).toBeCloseTo(expected[key], 6);
  });

  it('반대쪽 모서리를 넘어가도 최소 크기 1을 지킨다', () => {
    expect(resizeFromCorner(flat, 'se', 0, 0)).toMatchObject({ width: 1, height: 1 });
  });
});

describe('rotationTo', () => {
  it.each([
    ['바로 위', flat, 100, 50, 0],
    ['바로 오른쪽', flat, 150, 100, Math.PI / 2],
    ['오른쪽 위 대각선', flat, 150, 50, Math.PI / 4],
    ['이미 회전된 레이어도 포인터 방향만 따른다', quarter, 100, 50, 0],
  ])('포인터가 중심의 %s', (_name, layer, x, y, expected) => {
    expect(rotationTo(layer, x, y)).toBeCloseTo(expected, 6);
  });
});

describe('handlePoints', () => {
  it.each([
    ['회전 0', flat, { nw: [60, 80], ne: [140, 80], sw: [60, 120], se: [140, 120], rotate: [100, 80 - ROTATE_HANDLE_OFFSET] }],
    ['90° 회전', quarter, { nw: [120, 60], ne: [120, 140], sw: [80, 60], se: [80, 140], rotate: [120 + ROTATE_HANDLE_OFFSET, 100] }],
  ] as const)('%s: 모서리와 회전 핸들의 캔버스 좌표', (_name, layer, expected) => {
    const points = handlePoints(layer);
    for (const key of ['nw', 'ne', 'sw', 'se', 'rotate'] as const) {
      expect(points[key].x).toBeCloseTo(expected[key][0], 6);
      expect(points[key].y).toBeCloseTo(expected[key][1], 6);
    }
  });
});

describe('hitHandle', () => {
  const tiny: Layer = { ...mk('tiny', 100, 100), width: 4, height: 4 }; // 모서리 98..102: 네 모서리 모두 서로 반경 8 안
  it.each([
    ['se 모서리 근처', flat, 143, 123, 'se'],
    ['회전 핸들 근처', flat, 102, 58, 'rotate'],
    ['모든 핸들의 반경 밖', flat, 100, 100, null],
    ['핸들이 겹친 작은 레이어의 se 쪽', tiny, 101, 101, 'se'],
    ['핸들이 겹친 작은 레이어의 ne 쪽', tiny, 101, 99, 'ne'],
  ])('%s', (_name, layer, x, y, expected) => {
    expect(hitHandle(layer, x, y, 8)).toBe(expected);
  });
});

describe('clampCenter', () => {
  const doc: AssetDoc = { width: 512, height: 256, layers: [] };
  it.each([
    ['문서 안쪽 점은 그대로', 100, 200, 100, 200],
    ['왼쪽 밖은 x=0으로', -10, 100, 0, 100],
    ['오른쪽 밖은 x=width로', 700, 100, 512, 100],
    ['위쪽 밖은 y=0으로', 100, -5, 100, 0],
    ['아래쪽 밖은 y=height로', 100, 300, 100, 256],
    ['모서리 밖은 두 축 모두', 800, 700, 512, 256],
  ])('%s: (%d, %d) → (%d, %d)', (_name, x, y, ex, ey) => {
    expect(clampCenter(doc, x, y)).toEqual({ x: ex, y: ey });
  });
});
