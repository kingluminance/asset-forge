import { expect, test, type Page } from '@playwright/test';
import { handlePoints } from '../../src/core/transform';
import type { DocStore } from '../../src/core/types';

const readLayer = async (page: Page) =>
  (await page.evaluate(() => (window as unknown as { __store: DocStore }).__store.getDoc())).layers[0];

const open = async (page: Page) => {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));
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
  return { errors, drag };
};

test('핸들을 중심에서 벗어난 곳에서 잡아도 잡은 오프셋이 유지된다', async ({ page }) => {
  const { errors, drag } = await open(page);
  await page.getByTestId('editor').click({ position: { x: 256, y: 256 } }); // 선택

  // se 핸들 중심 +(5,5)를 잡고 (+30,+20): 크기는 포인터 이동량만큼만 변한다
  const se = handlePoints(await readLayer(page)).se;
  await drag({ x: se.x + 5, y: se.y + 5 }, { x: se.x + 35, y: se.y + 25 });
  let layer = await readLayer(page);
  expect.soft(Math.abs(layer.width - 158), `width ${layer.width} ≈ 158 ±1`).toBeLessThanOrEqual(1);
  expect.soft(Math.abs(layer.height - 148), `height ${layer.height} ≈ 148 ±1`).toBeLessThanOrEqual(1);
  // 회전 핸들 중심 +(5,0)을 잡고 1px: 각도가 튀지 않는다
  const before = layer.rotation;
  const rot = handlePoints(layer).rotate;
  await drag({ x: rot.x + 5, y: rot.y }, { x: rot.x + 6, y: rot.y });
  layer = await readLayer(page);
  expect.soft(Math.abs(layer.rotation - before), `rotation ${before} → ${layer.rotation}`).toBeLessThan(0.03);
  expect(errors).toEqual([]);
});

test('캔버스 밖에 놓은 레이어도 중심이 문서 안에 남아 다시 잡을 수 있다', async ({ page }) => {
  const { errors, drag } = await open(page);
  await drag({ x: 256, y: 256 }, { x: 800, y: 700 });
  const dropped = await readLayer(page);
  expect.soft(Math.abs(dropped.x - 512), `x ${dropped.x} ≈ 512 ±1`).toBeLessThanOrEqual(1);
  expect.soft(Math.abs(dropped.y - 512), `y ${dropped.y} ≈ 512 ±1`).toBeLessThanOrEqual(1);
  // 캔버스 안에 남은 부분을 중심 −(32,32)에서 다시 잡아 안쪽으로: 오프셋 유지 → (300,300) + (32,32)
  await drag({ x: 480, y: 480 }, { x: 300, y: 300 });
  const moved = await readLayer(page);
  expect.soft(Math.abs(moved.x - 332), `x ${moved.x} ≈ 332 ±1`).toBeLessThanOrEqual(1);
  expect.soft(Math.abs(moved.y - 332), `y ${moved.y} ≈ 332 ±1`).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
