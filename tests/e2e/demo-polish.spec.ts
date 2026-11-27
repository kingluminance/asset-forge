import { expect, test, type Page, type Route } from '@playwright/test';
import type { DocStore } from '../../src/core/types';

const IMAGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#00ff00"/></svg>');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (route: Route, status: number, body: object) =>
  route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(body) });
// POST만 handler로 넘긴다 (CORS preflight는 항상 통과)
const mockGenerate = (page: Page, onPost: (route: Route) => unknown) =>
  page.route('**/api/generate', (route) => (route.request().method() === 'POST' ? onPost(route) : route.fulfill({ status: 204, headers: CORS })));
const watchErrors = (page: Page) => {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));
  return errors;
};
const layerCount = (page: Page) => page.evaluate(() => (window as unknown as { __store: DocStore }).__store.getDoc().layers.length);

test('A: Enter로 생성을 시작하고, 요청 중에는 "생성 중…", 5초 넘으면 서버 깨우는 중 안내가 보인다', async ({ page }) => {
  const errors = watchErrors(page);
  let posts = 0;
  let respond = () => {};
  const held = new Promise<void>((resolve) => (respond = resolve));
  await mockGenerate(page, async (route) => {
    posts += 1;
    await held.then(() => json(route, 200, { image: IMAGE }));
  });
  await page.clock.install();
  await page.goto('/');
  const prompt = page.getByTestId('prompt');
  const button = page.getByTestId('generate');
  const hint = page.getByTestId('generate-hint');
  await expect(prompt).toBeVisible({ timeout: 5000 });
  // 시계를 멈춘다: 이후 시간은 fastForward로만 흐르므로 실제 소요 시간이 5초 타이머에 영향을 주지 않는다
  await page.clock.pauseAt(Date.now() + 60_000);

  await prompt.press('Enter'); // 빈 프롬프트: 요청 없음
  await prompt.fill('pixel sword');
  await prompt.press('Enter');
  await expect(button).toHaveText('생성 중…');
  await expect(button).toBeDisabled();
  await page.clock.fastForward(4000);
  await expect(hint, '5초 전에는 안내가 없다').toBeHidden();
  await page.clock.fastForward(1500);
  await expect(hint).toContainText('서버를 깨우는 중');
  respond();
  await expect.poll(() => layerCount(page), { timeout: 5000 }).toBe(2);
  await expect(button).toHaveText('생성');
  await expect(button).toBeEnabled();
  await expect(hint).toBeHidden();
  expect(posts, '빈 프롬프트 Enter는 요청을 보내지 않는다').toBe(1);
  expect(errors).toEqual([]);
});

test('B: 생성 실패는 원인별 한국어 문구로 보이고 영어 원문은 보이지 않는다', async ({ page }) => {
  const errors = watchErrors(page);
  const cases: [string, (route: Route) => unknown][] = [
    ['서버에 연결하지 못했습니다', (route) => route.abort()],
    ['요청이 너무 많습니다', (route) => json(route, 429, { error: 'rate limit exceeded, try again in a minute' })],
    ['이미지 생성에 실패했습니다', (route) => json(route, 502, { error: 'upstream image provider failed' })],
  ];
  let onPost = cases[0][1];
  await mockGenerate(page, (route) => onPost(route));
  await page.goto('/');
  const button = page.getByTestId('generate');
  await page.getByTestId('prompt').fill('pixel sword');

  for (const [message, respond] of cases) {
    onPost = respond;
    await button.click();
    await expect.soft(page.getByTestId('generate-error')).toContainText(message, { timeout: 5000 });
    await expect.soft(page.locator('body'), '영어 원문 미표시').not.toContainText(/Failed to fetch|rate limit exceeded|upstream/, { timeout: 1000 });
    await expect(button).toBeEnabled();
    await expect(button).toHaveText('생성');
  }
  expect(await layerCount(page)).toBe(1);
  expect(errors).toEqual([]);
});

test('C: 방이 없으면 협업 방 만들기 링크, 방 안에서는 방 이름과 링크 복사가 보인다', async ({ page, context }) => {
  const errors = watchErrors(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const newRoom = page.getByTestId('new-room');
  await expect(newRoom).toHaveText('협업 방 만들기', { timeout: 5000 });
  const note = page.getByTestId('new-room-note');
  await expect(note, '로컬 편집이 새 방으로 옮겨지지 않음을 알린다').toContainText('옮겨지지 않습니다');
  const copy = page.getByTestId('copy-link');
  await expect(page.getByTestId('room-name')).toBeHidden();
  await expect(copy).toBeHidden();
  const firstHref = await newRoom.getAttribute('href');
  await page.reload();
  expect(await newRoom.getAttribute('href'), '새로 열면 방 이름이 달라진다').not.toBe(firstHref);
  await newRoom.click();
  await expect(page).toHaveURL(/\/\?room=[^&=]+$/);

  await page.goto('/?room=abc');
  await expect(page.getByTestId('room-name')).toHaveText('abc');
  await expect(newRoom).toBeHidden();
  await expect(note).toBeHidden();
  await expect(copy).toHaveText('링크 복사');
  await copy.click();
  await expect(copy).toHaveText('복사됨');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  expect(errors).toEqual([]);
});
