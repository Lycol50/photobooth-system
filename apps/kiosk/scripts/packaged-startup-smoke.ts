import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

import { chromium, type Browser } from 'playwright';

const executablePath = resolve('release/win-unpacked/Grace Booth.exe');
const screenshotPath = resolve('../../test-results/packaged-attract.png');
const userDataDirectory = await mkdtemp(join(tmpdir(), 'grace-booth-packaged-smoke-'));
let browser: Browser | null = null;
let application: ChildProcess | null = null;

try {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined &&
        entry[0] !== 'ELECTRON_RUN_AS_NODE' &&
        !entry[0].startsWith('GRACE_BOOTH_E2E'),
    ),
  );
  application = spawn(
    executablePath,
    [`--user-data-dir=${userDataDirectory}`, '--remote-debugging-port=0'],
    { env: environment, stdio: 'ignore', windowsHide: false },
  );

  const debuggingPort = await waitForDebuggingPort(userDataDirectory, 60_000);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${debuggingPort}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error('packaged_browser_context_missing');
  const page = context.pages()[0] ?? (await context.waitForEvent('page', { timeout: 60_000 }));
  await page.waitForLoadState('domcontentloaded');
  await page.getByTestId('renderer-loading').waitFor({ state: 'detached', timeout: 30_000 });

  const bootstrapDialog = page.getByRole('dialog');
  if (await bootstrapDialog.isVisible()) {
    await page.locator('#operator-passcode').fill('grace-packaged-smoke-2026');
    await page.locator('#operator-passcode-confirmation').fill('grace-packaged-smoke-2026');
    await page.getByRole('button', { name: 'Save passcode' }).click();
  }

  await page.getByTestId('attract-screen').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await mkdir(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: false });
  process.stdout.write(
    `${JSON.stringify({ ok: true, screen: 'attract', screenshotPath, executablePath })}\n`,
  );
  await page.close();
  await waitForExit(application, 15_000);
} finally {
  await browser?.close().catch(() => undefined);
  if (application?.exitCode === null) application.kill();
  const temporaryRoot = resolve(tmpdir());
  const cleanupTarget = resolve(userDataDirectory);
  if (
    dirname(cleanupTarget) === temporaryRoot &&
    !relative(temporaryRoot, cleanupTarget).startsWith('..') &&
    cleanupTarget.includes('grace-booth-packaged-smoke-')
  ) {
    await rm(cleanupTarget, { force: true, recursive: true, maxRetries: 40, retryDelay: 250 });
  }
}

async function waitForDebuggingPort(profileDirectory: string, timeoutMs: number): Promise<number> {
  const activePortFile = join(profileDirectory, 'DevToolsActivePort');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const [port] = (await readFile(activePortFile, 'utf8')).split(/\r?\n/u);
      const parsed = Number(port);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    } catch {
      // The packaged Chromium process creates this file shortly after startup.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error('packaged_debugging_port_timeout');
}

async function waitForExit(applicationProcess: ChildProcess, timeoutMs: number): Promise<void> {
  if (applicationProcess.exitCode !== null) return;
  await Promise.race([
    new Promise<void>((resolveExit) => applicationProcess.once('exit', () => resolveExit())),
    new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, timeoutMs)),
  ]);
}
