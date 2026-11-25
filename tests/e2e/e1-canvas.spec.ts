import { expect, test, type Page } from '@playwright/test';
import { handlePoints } from '../../src/core/transform';
import type { DocStore } from '../../src/core/types';

const readLayer = async (page: Page) =>
  (await page.evaluate(() => (window as unknown as { __store: DocStore }).__store.getDoc())).layers[0];

const near = (actual: number, expected: number, tolerance = 1) =>
  expect(Math.abs(actual - expected), `${actual} ≈ ${expected} ±${tolerance}`).toBeLessThanOrEqual(tolerance);

test('E1: 드래그·리사이즈·회전 후 core 모델 좌표가 기대값 ±1px', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible({ timeout: 5000 });
  const box = (await editor.boundingBox())!;
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await page.mouse.move(box.x + from.x, box.y + from.y);
    await page.mouse.down();
    await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 10 });
    await page.mouse.up();
  };

  // 드래그: 레이어 중심을 잡고 (+60, +40)
  await drag({ x: 256, y: 256 }, { x: 316, y: 296 });
  let layer = await readLayer(page);
  near(layer.x, 316);
  near(layer.y, 296);

  // 리사이즈: se 모서리를 (+30, +20). 반대쪽 모서리가 고정이므로 중심은 (+15, +10)
  const se = handlePoints(layer).se;
  await drag(se, { x: se.x + 30, y: se.y + 20 });
  layer = await readLayer(page);
  near(layer.width, 158);
  near(layer.height, 148);
  near(layer.x, 331);
  near(layer.y, 306);

  // 회전: 회전 핸들을 잡고 중심의 바로 오른쪽 지점으로
  await drag(handlePoints(layer).rotate, { x: layer.x + 120, y: layer.y });
  layer = await readLayer(page);
  near(layer.rotation, Math.PI / 2, 0.02);
});
