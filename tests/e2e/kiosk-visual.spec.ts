import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const STATES = [
  'attract',
  'countdown',
  'review',
  'processing',
  'uploading-backoff',
  'final',
  'recovery-camera',
  'recovery-upload',
  'recovery-interrupted',
  'admin-frame',
  'admin-settings',
] as const;

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1280x720', width: 1280, height: 720 },
] as const;

for (const viewport of VIEWPORTS) {
  for (const state of STATES) {
    test(`${state} fits and remains accessible at ${viewport.label}`, async ({ page }) => {
      const externalRequests: string[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.origin !== 'http://127.0.0.1:4174') {
          externalRequests.push(request.url());
        }
      });

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/?visual=${state}`);
      await expect(page.locator('main, .admin-shell').first()).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((image) =>
            image.complete
              ? Promise.resolve()
              : new Promise<void>((resolveImage) => {
                  image.addEventListener('load', () => resolveImage(), { once: true });
                  image.addEventListener('error', () => resolveImage(), { once: true });
                }),
          ),
        );
      });
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-delay: 0s !important;
            animation-duration: 0s !important;
            caret-color: transparent !important;
            transition-delay: 0s !important;
            transition-duration: 0s !important;
          }
        `,
      });

      const layout = await page.evaluate(() => ({
        bodyHeight: document.body.scrollHeight,
        bodyWidth: document.body.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        documentWidth: document.documentElement.scrollWidth,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      }));
      expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.bodyHeight).toBeLessThanOrEqual(layout.viewportHeight);
      expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
      expect(externalRequests).toEqual([]);

      const accessibility = await new AxeBuilder({ page }).analyze();
      const seriousOrCritical = accessibility.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(seriousOrCritical).toEqual([]);

      await expect(page).toHaveScreenshot(`${state}-${viewport.label}.png`, {
        animations: 'disabled',
        fullPage: false,
      });
    });
  }
}

test('reduced motion removes cosmetic rotation and shutter flash', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1_366, height: 768 });
  await page.goto('/?visual=processing');
  await expect(page.getByTestId('processing-screen')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('.processing-card__motif svg').evaluate((element) => {
        const style = getComputedStyle(element);
        return style.animationName;
      }),
    )
    .toBe('none');

  await page.goto('/?visual=countdown');
  const flash = page.locator('.shutter-flash');
  await flash.evaluate((element) => element.classList.add('is-active'));
  await expect
    .poll(() =>
      flash.evaluate((element) => {
        const style = getComputedStyle(element);
        return { animationName: style.animationName, opacity: style.opacity };
      }),
    )
    .toEqual({ animationName: 'none', opacity: '0' });
});
