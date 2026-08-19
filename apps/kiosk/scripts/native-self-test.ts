import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 32 * 1024;
const packaged = process.argv.includes('--packaged');
const require = createRequire(import.meta.url);
const electronModule: unknown = packaged
  ? resolve('release', 'win-unpacked', 'Grace Booth.exe')
  : require('electron');
if (typeof electronModule !== 'string') throw new Error('electron_path_unavailable');

const applicationArguments = packaged
  ? ['--native-self-test']
  : [resolve('out/main/index.js'), '--native-self-test'];
const childEnvironment = { ...process.env };
delete childEnvironment.ELECTRON_RUN_AS_NODE;
const child = spawn(electronModule, applicationArguments, {
  cwd: process.cwd(),
  env: childEnvironment,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stdout = '';
child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk: string | Buffer) => {
  stdout = appendBounded(stdout, chunk);
});
child.stderr.resume();

const exit = await new Promise<ExitOutcome>((resolveExit) => {
  const timeout = setTimeout(() => {
    child.kill('SIGKILL');
    resolveExit({ kind: 'timeout' });
  }, TIMEOUT_MS);
  child.once('error', (error) => {
    clearTimeout(timeout);
    resolveExit({ kind: 'exit', code: null, error });
  });
  child.once('exit', (code) => {
    clearTimeout(timeout);
    resolveExit({ kind: 'exit', code, error: null });
  });
});

try {
  if (exit.kind === 'timeout') throw new Error('native_self_test_timeout');
  if (exit.error || exit.code !== 0) throw new Error('native_self_test_process_failed');
  const result = parseResult(stdout);
  if (!result.ok || !result.sqlite || !result.sharp || !result.worker || !result.safeStorage) {
    throw new Error(result.code ?? 'native_self_test_failed');
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const code =
    error instanceof Error && /^[a-z0-9_]{1,80}$/i.test(error.message)
      ? error.message
      : 'native_self_test_failed';
  process.stderr.write(`${JSON.stringify({ ok: false, code })}\n`);
  process.exitCode = 1;
}

type ExitOutcome = { kind: 'exit'; code: number | null; error: Error | null } | { kind: 'timeout' };
type SelfTestResult = {
  ok: boolean;
  sqlite: boolean;
  sharp: boolean;
  worker: boolean;
  safeStorage: boolean;
  code?: string;
};

function appendBounded(current: string, chunk: string | Buffer): string {
  const next = current + String(chunk);
  return next.length <= MAX_OUTPUT_BYTES ? next : next.slice(-MAX_OUTPUT_BYTES);
}

function parseResult(output: string): SelfTestResult {
  for (const line of output.trim().split(/\r?\n/).reverse()) {
    try {
      const value: unknown = JSON.parse(line);
      if (isSelfTestResult(value)) return value;
    } catch {
      // Electron may emit unrelated diagnostic lines; only the sanitized JSON result is accepted.
    }
  }
  throw new Error('native_self_test_output_invalid');
}

function isSelfTestResult(value: unknown): value is SelfTestResult {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.ok === 'boolean' &&
    typeof record.sqlite === 'boolean' &&
    typeof record.sharp === 'boolean' &&
    typeof record.worker === 'boolean' &&
    typeof record.safeStorage === 'boolean' &&
    (record.code === undefined || typeof record.code === 'string')
  );
}
