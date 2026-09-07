import { test, expect } from '@playwright/test';

test('redirige a login y muestra la portada', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('h1')).toContainText('Bienvenido');
});
