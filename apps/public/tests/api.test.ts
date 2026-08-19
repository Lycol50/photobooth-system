import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPhotoDownload, fetchPhotoImage, resolvePhoto } from '../src/api';

const token = 'A'.repeat(43);

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

describe('photo API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('resolves by POSTing the token only in the body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ready',
          expiresAt: '2026-09-16T10:00:00.000Z',
          googleFormsUrl: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(resolvePhoto(token)).resolves.toMatchObject({ status: 'ready' });
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(url ? requestUrl(url) : '').toBe('https://api.example.test/functions/v1/photo/resolve');
    expect(url ? requestUrl(url) : '').not.toContain(token);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    expect(init?.body).toBe(JSON.stringify({ token }));
  });

  it('uses separate controlled image and download POST routes', async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
      type: 'image/jpeg',
    });
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(jpeg, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(jpeg.size) },
        }),
      ),
    );

    await fetchPhotoImage(token);
    await fetchPhotoDownload(token);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => requestUrl(url))).toEqual([
      'https://api.example.test/functions/v1/photo/image',
      'https://api.example.test/functions/v1/photo/download',
    ]);
    expect(
      vi.mocked(fetch).mock.calls.every(([, init]) => init?.body === JSON.stringify({ token })),
    ).toBe(true);
  });
});
