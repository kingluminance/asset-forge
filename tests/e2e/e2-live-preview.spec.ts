import { expect, test } from '@playwright/test';
import type { DocStore } from '../../src/core/types';
import { colorStats } from './pixels';

test('E2: 캔버스 수정이 100ms 안에 3D 프리뷰 텍스처에 반영된다', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));

  await page.goto('/');
  const editor = page.getByTestId('editor');
  const preview = page.getByTestId('preview');
  await expect(editor).toBeVisible({ timeout: 5000 });
  await expect(preview).toBeVisible();
  const orange = async (png: Buffer) => colorStats(page, png, 'orange');

  // 캔버스와 같은 문서의 초기 레이어(주황)가 프리뷰 텍스처에 올라올 때까지 기다린다
  await expect(async () => {
    expect((await orange(await preview.screenshot())).ratio, '캔버스의 주황 레이어가 프리뷰에 보인다').toBeGreaterThan(0.005);
  }).toPass({ timeout: 5000 });
  const beforePng = await preview.screenshot();
  const before = await orange(beforePng);

  // 캔버스 에디터에서 실제 마우스로 레이어를 (+100, +80) 드래그
  await editor.scrollIntoViewIfNeeded(); // 프리뷰 스크린샷이 페이지를 스크롤했을 수 있다
  const box = (await editor.boundingBox())!;
  await page.mouse.move(box.x + 256, box.y + 256);
  await page.mouse.down();
  await page.mouse.move(box.x + 356, box.y + 336, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(100);

  const movedPng = await preview.screenshot();
  const moved = await orange(movedPng);
  expect(movedPng.equals(beforePng), '드래그 후 100ms 안에 프리뷰 스크린샷이 달라진다').toBe(false);
  expect(moved.ratio, '드래그 후에도 주황 레이어가 프리뷰에 보인다').toBeGreaterThan(0.005);
  expect(
    Math.hypot(moved.cx - before.cx, moved.cy - before.cy),
    '주황 픽셀 무게중심이 이동한다 (텍스처 안에서 레이어가 움직임)',
  ).toBeGreaterThan(10);

  // 크기 변경도 100ms 안에 반영: 128² → 300² 이면 주황 면적이 크게 늘어난다
  await page.evaluate(() =>
    (window as unknown as { __store: DocStore }).__store.updateLayer('layer-1', { width: 300, height: 300 }),
  );
  await page.waitForTimeout(100);
  const resized = await orange(await preview.screenshot());
  expect(resized.ratio, '리사이즈 후 주황 픽셀 비율이 2배 이상 늘어난다').toBeGreaterThan(moved.ratio * 2);

  expect(errors).toEqual([]);
});
