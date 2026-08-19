import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderVercelConfiguration } from '../scripts/configure-vercel.mjs';

const appDirectory = process.cwd();
const htmlTemplate = readFileSync(resolve(appDirectory, 'index.html'), 'utf8');
const vercelTemplate = readFileSync(resolve(appDirectory, 'vercel.template.json'), 'utf8');

function responseCsp(rendered: string): string {
  const config = JSON.parse(rendered) as {
    headers?: { headers?: { key?: string; value?: string }[] }[];
  };
  const value = config.headers
    ?.flatMap((rule) => rule.headers ?? [])
    .find((header) => header.key === 'Content-Security-Policy')?.value;
  if (!value) throw new Error('Rendered Vercel configuration has no CSP');
  return value;
}

function htmlCsp(source: string): string {
  const match = /content="(default-src [^"]+)"/u.exec(source);
  if (!match?.[1]) throw new Error('HTML template has no CSP');
  return match[1];
}

describe('production security configuration', () => {
  it('keeps HTML and Vercel CSPs exact and placeholder-free after rendering', () => {
    const apiUrl = 'https://project-ref.supabase.co/functions/v1/photo';
    const apiOrigin = new URL(apiUrl).origin;
    const renderedVercel = renderVercelConfiguration(vercelTemplate, apiUrl);
    const renderedHtml = htmlTemplate
      .replaceAll('__PHOTO_API_ORIGIN__', apiOrigin)
      .replaceAll('__PUBLIC_PAGE_ORIGIN__', 'https://photos.example.org')
      .replaceAll('__UPGRADE_INSECURE_REQUESTS__', 'upgrade-insecure-requests');

    expect(responseCsp(renderedVercel)).toBe(htmlCsp(renderedHtml));
    expect(renderedVercel).not.toContain('__PHOTO_API_ORIGIN__');
    expect(renderedHtml).not.toMatch(/__[A-Z_]+__/u);
    expect(responseCsp(renderedVercel)).not.toMatch(/unsafe-inline|unsafe-eval/u);
    expect(responseCsp(renderedVercel)).toContain(`connect-src ${apiOrigin}`);
    expect(appDirectory).toMatch(/[\\/]apps[\\/]public$/u);
  });

  it('rejects unsafe or decorated API endpoints', () => {
    for (const url of [
      'http://project-ref.supabase.co/functions/v1/photo',
      'https://user:password@project-ref.supabase.co/functions/v1/photo',
      'https://project-ref.supabase.co/functions/v1/photo?token=bad',
      'https://project-ref.supabase.co/functions/v1/other',
    ]) {
      expect(() => renderVercelConfiguration(vercelTemplate, url)).toThrow();
    }
  });
});
