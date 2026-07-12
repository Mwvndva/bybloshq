import { test, expect, type Page } from '@playwright/test';
import { ROLES } from './roles';

// Collect uncaught page errors so any refactor that breaks a route is caught.
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('homepage loads with correct title', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/byblos/i);
});

const PUBLIC_ROUTES = [
  '/', '/buyer/login', '/buyer/register', '/seller/login', '/seller/register',
  '/creator/login', '/creator/register', '/mzigo/login',
];
for (const path of PUBLIC_ROUTES) {
  test(`public route renders: ${path}`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const bodyLen = (await page.locator('body').innerText().catch(() => '')).length;
    expect(errors, `JS error on ${path}: ${errors[0] || ''}`).toHaveLength(0);
    expect(bodyLen, `blank screen on ${path}`).toBeGreaterThan(20);
  });
}

for (const w of [375, 768, 1280]) {
  test(`homepage: no horizontal overflow @ ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(o.sw, `overflow @ ${w}px`).toBeLessThanOrEqual(o.iw + 2);
  });
}

// Authenticated dashboards. Each role is skipped unless its creds are provided
// via env, so the suite is safe to run anywhere.
for (const role of ROLES) {
  test(`${role.name} dashboard renders (authenticated)`, async ({ page }) => {
    test.skip(!role.email || !role.pass, `no creds for ${role.name}`);
    const errors = trackErrors(page);
    await page.goto(role.loginPath, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.locator('input[type="email"], input[name="email"]').first().fill(role.email!);
    await page.locator('input[type="password"]').first().fill(role.pass!);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => role.apiLogin.test(r.url()), { timeout: 25000 }).catch(() => null),
      page.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Log")').first().click(),
    ]);
    await page.waitForTimeout(5000);
    expect(resp?.status(), `${role.name} login status`).toBe(200);
    expect(page.url(), `${role.name} did not reach dashboard`).toContain(role.dashPath);
    const html = await page.content();
    expect(errors, `JS error on ${role.name} dashboard: ${errors[0] || ''}`).toHaveLength(0);
    expect(html.length, `${role.name} dashboard blank`).toBeGreaterThan(4000);
    const body = await page.locator('body').innerText();
    for (const m of role.markers) {
      expect(body, `${role.name} missing marker "${m}"`).toContain(m);
    }
  });
}
