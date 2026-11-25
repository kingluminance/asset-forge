import { expect, test } from '@playwright/test';
import type { DocStore } from '../../src/core/types';

const IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#00ff00"/></svg>');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };

test('E4: 프롬프트로 생성한 이미지가 캔버스 중앙에 레이어로 추가된다 (API는 목)', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));
  let requestBody: unknown;
  await page.route('**/api/generate', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.fulfill({ status: 204, headers: CORS });
    requestBody = request.postDataJSON();
    await route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ image: IMAGE }) });
  });
  const readDoc = () => page.evaluate(() => (window as unknown as { __store: DocStore }).__store.getDoc());

  await page.goto('/');
  const prompt = page.getByTestId('prompt');
  await expect(prompt).toBeVisible({ timeout: 5000 });
  await prompt.fill('pixel sword');
  await page.getByTestId('generate').click();

  await expect.poll(async () => (await readDoc()).layers.length, { timeout: 5000 }).toBe(2);
  const doc = await readDoc();
  const layer = doc.layers[1];
  expect(layer).toMatchObject({ src: IMAGE, width: 256, height: 256, x: doc.width / 2, y: doc.height / 2, rotation: 0 });
  expect(layer.id).not.toBe(doc.layers[0].id);
  expect(requestBody).toMatchObject({ prompt: 'pixel sword' });
  expect(errors).toEqual([]);
});
