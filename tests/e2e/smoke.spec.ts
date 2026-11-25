import { expect, test } from '@playwright/test';

test('앱이 에러 없이 로드된다', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));

  await page.goto('/');

  await expect(page).toHaveTitle('asset-forge');
  await expect(page.locator('#root')).not.toBeEmpty();
  expect(errors).toEqual([]);
});
