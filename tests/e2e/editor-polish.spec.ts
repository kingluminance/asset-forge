import { expect, test, type Page } from '@playwright/test';
import { handlePoints } from '../../src/core/transform';
import type { DocStore } from '../../src/core/types';

const IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#00ff00"/></svg>');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
type Point = { x: number; y: number };

const readLayers = async (page: Page) =>
  (await page.evaluate(() => (window as unknown as { __store: DocStore }).__store.getDoc())).layers;

const open = async (page: Page) => {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.goto('/');
  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible({ timeout: 5000 });
  const box = (await editor.boundingBox())!;
  const drag = async (from: Point, to: Point) => {
    await page.mouse.move(box.x + from.x, box.y + from.y);
    await page.mouse.down();
    await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 10 });
    await page.mouse.up();
  };
  return { errors, drag, editor };
};
const near = (actual: number, expected: number, label: string) =>
  expect.soft(Math.abs(actual - expected), `${label} ${actual} ≈ ${expected} ±1`).toBeLessThanOrEqual(1);

test('생성 직후 새 레이어가 선택되어 있어 바로 핸들로 리사이즈된다', async ({ page }) => {
  await page.route('**/api/generate', (route) =>
    route.request().method() !== 'POST'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ image: IMAGE }) }),
  );
  const { errors, drag } = await open(page);
  const original = (await readLayers(page))[0];
  await page.getByTestId('prompt').fill('pixel sword');
  await page.getByTestId('generate').click();
  await expect.poll(async () => (await readLayers(page)).length, { timeout: 5000 }).toBe(2);

  // 다른 클릭 없이 새 레이어의 se 핸들을 (+20,+20): 선택돼 있으면 리사이즈, 아니면 몸통이라 이동
  const se = handlePoints((await readLayers(page))[1]).se;
  await drag(se, { x: se.x + 20, y: se.y + 20 });
  const [first, created] = await readLayers(page);
  near(created.width, 276, 'width');
  near(created.height, 276, 'height');
  const nw = handlePoints(created).nw; // 반대 모서리 고정
  near(nw.x, 128, 'nw.x');
  near(nw.y, 128, 'nw.y');
  expect.soft(first).toEqual(original);
  expect(errors).toEqual([]);
});

test('선택한 레이어를 삭제 버튼과 Delete 키로 지운다 (입력창의 Backspace는 지우지 않는다)', async ({ page }) => {
  const { errors, editor } = await open(page);
  const del = page.getByTestId('delete');
  await expect(del).toBeDisabled({ timeout: 5000 });
  await editor.click({ position: { x: 256, y: 256 } }); // 선택
  await expect(del).toBeEnabled();
  await del.click();
  expect((await readLayers(page)).length).toBe(0);
  await expect(del).toBeDisabled();

  await page.goto('/');
  await editor.click({ position: { x: 256, y: 256 } });
  const prompt = page.getByTestId('prompt');
  await prompt.pressSequentially('ab');
  await prompt.press('Backspace');
  expect((await readLayers(page)).length).toBe(1);
  await editor.click({ position: { x: 256, y: 256 } }); // 캔버스로 포커스
  await page.keyboard.press('Delete');
  expect((await readLayers(page)).length).toBe(0);

  await page.goto('/');
  const url = page.url();
  await editor.click({ position: { x: 256, y: 256 } }); // 선택 + 캔버스 포커스
  await page.keyboard.press('Backspace');
  expect((await readLayers(page)).length).toBe(0);
  expect(page.url(), 'Backspace가 뒤로 가기를 일으키지 않는다').toBe(url);
  expect(errors).toEqual([]);
});

test('리사이즈로 레이어 중심이 문서 밖으로 나가지 않아 다시 잡을 수 있다', async ({ page }) => {
  const { errors, drag } = await open(page);
  await drag({ x: 256, y: 256 }, { x: 800, y: 700 }); // 중심이 (512,512)에 붙는다 (선택 유지)
  await drag(handlePoints((await readLayers(page))[0]).nw, { x: 570, y: 570 });
  const resized = (await readLayers(page))[0];
  for (const [axis, v] of [['x', resized.x], ['y', resized.y]] as const) {
    expect.soft(v, `중심 ${axis} ${v} ≥ 0`).toBeGreaterThanOrEqual(0);
    expect.soft(v, `중심 ${axis} ${v} ≤ 512`).toBeLessThanOrEqual(512);
  }
  // 캔버스 안에 보이는 몸통(중심 −(20,20))을 잡아 안쪽으로: 오프셋 유지 → (300,300) + (20,20)
  await drag({ x: resized.x - 20, y: resized.y - 20 }, { x: 300, y: 300 });
  const moved = (await readLayers(page))[0];
  near(moved.x, 320, 'x');
  near(moved.y, 320, 'y');
  expect(errors).toEqual([]);
});
