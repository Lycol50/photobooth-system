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
      if (state === 'processing' || state === 'uploading-backoff') {
        await page.emulateMedia({ reducedMotion: 'reduce' });
      }
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
      if ((await page.getByTestId('processing-animation').count()) > 0) {
        await expect(page.locator('.processing-animation__fallback')).toBeVisible();
      }
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

      if (state === 'final') {
        const qrMetrics = await page
          .getByRole('img', { name: 'QR code for your private photo download' })
          .evaluate((image: HTMLImageElement) => {
            const rect = image.getBoundingClientRect();
            return {
              height: rect.height,
              naturalHeight: image.naturalHeight,
              naturalWidth: image.naturalWidth,
              unobstructed:
                document.elementFromPoint(
                  rect.left + rect.width / 2,
                  rect.top + rect.height / 2,
                ) === image,
              width: rect.width,
            };
          });
        expect(qrMetrics.width).toBeGreaterThanOrEqual(180);
        expect(qrMetrics.height).toBe(qrMetrics.width);
        expect(qrMetrics.naturalWidth).toBeGreaterThanOrEqual(300);
        expect(qrMetrics.naturalHeight).toBe(qrMetrics.naturalWidth);
        expect(qrMetrics.unobstructed).toBe(true);
      }

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
  await expect(page.locator('.processing-animation__fallback')).toBeVisible();
  await expect(page.locator('.processing-animation svg')).toHaveCount(0);

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

test('processing loads the packaged Lottie animation without external requests', async ({
  page,
}) => {
  const externalRequests: string[] = [];
  const animationRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/animations/loading.json')) animationRequests.push(request.url());
    if (url.origin !== 'http://127.0.0.1:4174') externalRequests.push(request.url());
  });
  await page.setViewportSize({ width: 1_366, height: 768 });
  await page.goto('/?visual=processing');
  await expect(page.locator('.processing-animation svg')).toBeVisible();
  expect(animationRequests).toHaveLength(1);
  expect(externalRequests).toEqual([]);
});
