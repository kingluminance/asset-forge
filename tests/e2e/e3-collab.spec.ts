import { expect, test, type Page } from '@playwright/test';
import type { DocStore, LayerPatch } from '../../src/core/types';

type Win = { __store: DocStore };
const layers = (page: Page) => page.evaluate(() => (window as unknown as Win).__store.getDoc().layers);
const patch = (page: Page, p: LayerPatch) =>
  page.evaluate((p) => (window as unknown as Win).__store.updateLayer('layer-1', p), p);
const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected), `${actual} ≈ ${expected} ±1`).toBeLessThanOrEqual(1);

test('E3: 두 탭 동시 편집 — 탭 A 이동이 탭 B에 반영되고 충돌 없이 수렴한다', async ({ browser, baseURL }) => {
  const room = `e3-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const errors: Error[] = [];
  const open = async () => {
    const page = await (await browser.newContext({ baseURL })).newPage();
    page.on('pageerror', (e) => errors.push(e));
    await page.goto(`/?room=${room}`);
    await expect(page.getByTestId('editor')).toBeVisible({ timeout: 5000 });
    return page;
  };
  const a = await open();
  const b = await open();
  for (const page of [a, b]) {
    await expect.poll(async () => (await layers(page)).length, '초기 레이어가 하나 보인다').toBe(1);
  }
  // 탭 A: 실제 마우스로 레이어 중심을 잡고 (+60, +40) 드래그
  const box = (await a.getByTestId('editor').boundingBox())!;
  await a.mouse.move(box.x + 256, box.y + 256);
  await a.mouse.down();
  await a.mouse.move(box.x + 316, box.y + 296, { steps: 10 });
  await a.mouse.up();
  const moved = (await layers(a))[0];
  near(moved.x, 316);
  near(moved.y, 296);
  // 탭 B에 A의 이동이 반영된다
  await expect(async () => {
    const [layer] = await layers(b);
    near(layer.x, moved.x);
    near(layer.y, moved.y);
  }, '탭 A의 이동이 탭 B에 반영된다').toPass({ timeout: 5000 });
  // 같은 레이어의 서로 다른 필드를 양쪽이 거의 동시에 수정 → 둘 다 남는다
  await Promise.all([patch(b, { rotation: 1 }), patch(a, { width: 200 })]);
  await expect(async () => {
    for (const page of [a, b]) {
      const all = await layers(page);
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ rotation: 1, width: 200 });
    }
  }, '양쪽 모두 rotation=1, width=200으로 수렴한다').toPass({ timeout: 5000 });
  expect(errors).toEqual([]);
});
