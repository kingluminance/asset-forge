import { expect, test, type Page } from '@playwright/test';

// 스크린샷 PNG를 페이지 안 2D 캔버스로 디코드해 마젠타/비마젠타 픽셀 비율을 센다.
// (WebGL 캔버스를 직접 읽으면 preserveDrawingBuffer 때문에 빈 화면일 수 있어 스크린샷을 경유한다)
async function magentaRatio(page: Page, png: Buffer) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let magenta = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      // 조명으로 어두워져도 통과: R·B가 높고 G가 그 절반 미만
      if (r > 80 && b > 80 && g < Math.min(r, b) / 2) magenta++;
    }
    return magenta / (data.length / 4);
  }, png.toString('base64'));
}

test('프리뷰가 문서 레이어를 텍스처로 입힌 3D 박스를 렌더한다', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));

  await page.goto('/');

  const preview = page.locator('[data-testid=preview]');
  await expect(preview).toBeVisible();

  // 레이어 이미지 로드가 비동기라 텍스처가 올라올 때까지 기다린다
  await expect(async () => {
    const ratio = await magentaRatio(page, await preview.screenshot());
    expect(ratio, '마젠타 레이어 텍스처가 박스 면에 보인다').toBeGreaterThanOrEqual(0.03);
    expect(ratio, '배경이 남는다 (박스가 화면을 꽉 채우지 않음)').toBeLessThanOrEqual(0.9);
  }).toPass({ timeout: 10_000 });

  expect(errors).toEqual([]);
});
