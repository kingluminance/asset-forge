import { expect, test } from '@playwright/test';
import type { DocStore } from '../../src/core/types';
import { colorStats } from './pixels';

const MAGENTA =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ff00ff"/></svg>');

test('프리뷰가 문서 레이어를 텍스처로 입힌 3D 박스를 렌더한다', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));

  await page.goto('/');

  const preview = page.locator('[data-testid=preview]');
  await expect(preview).toBeVisible();

  // 프리뷰는 캔버스와 같은 문서를 본다: 처음엔 마젠타가 없고, 레이어를 마젠타 256×256으로 바꾸면 텍스처가 따라온다
  const initial = await colorStats(page, await preview.screenshot(), 'magenta');
  expect(initial.ratio, '문서를 바꾸기 전에는 프리뷰에 마젠타가 없다').toBe(0);
  await page.evaluate(
    (src) => (window as unknown as { __store: DocStore }).__store.updateLayer('layer-1', { src, width: 256, height: 256 }),
    MAGENTA,
  );

  // 레이어 이미지 로드가 비동기라 텍스처가 올라올 때까지 기다린다
  await expect(async () => {
    const { ratio } = await colorStats(page, await preview.screenshot(), 'magenta');
    expect(ratio, '마젠타 레이어 텍스처가 박스 면에 보인다').toBeGreaterThanOrEqual(0.03);
    expect(ratio, '배경이 남는다 (박스가 화면을 꽉 채우지 않음)').toBeLessThanOrEqual(0.9);
  }).toPass({ timeout: 10_000 });

  expect(errors).toEqual([]);
});
