import { describe, expect, it } from 'vitest';
import {
  ConfirmUploadResponseSchema,
  FrameLayoutSchema,
  IpcContracts,
  OptionalGoogleFormsUrlSchema,
  isAllowedGoogleFormsUrl,
} from '../src/index.js';

const slots = [1, 2, 3, 4].map((slotIndex) => ({
  slotIndex,
  name: `Photo ${slotIndex}`,
  x: slotIndex % 2 === 0 ? 0.52 : 0.02,
  y: slotIndex > 2 ? 0.52 : 0.02,
  width: 0.46,
  height: 0.46,
  cropMode: 'crop-to-fill' as const,
}));

describe('shared boundary schemas', () => {
  it('accepts exactly four normalized slots', () => {
    expect(FrameLayoutSchema.parse(slots)).toHaveLength(4);
    expect(() => FrameLayoutSchema.parse([...slots.slice(0, 3), slots[0]])).toThrow();
    expect(() => FrameLayoutSchema.parse([{ ...slots[0], x: 0.9 }, ...slots.slice(1)])).toThrow();
  });

  it('allows only expected HTTPS Google Forms hosts', () => {
    expect(isAllowedGoogleFormsUrl('https://forms.gle/abc123')).toBe(true);
    expect(isAllowedGoogleFormsUrl('https://docs.google.com/forms/d/e/example/viewform')).toBe(
      true,
    );
    expect(isAllowedGoogleFormsUrl('http://forms.gle/abc123')).toBe(false);
    expect(isAllowedGoogleFormsUrl('https://forms.gle.evil.example/abc123')).toBe(false);
    expect(OptionalGoogleFormsUrlSchema.parse('')).toBeNull();
  });

  it('rejects extra IPC payload fields and weak passcodes', () => {
    expect(() => IpcContracts['booth:start'].request.parse({ arbitrary: true })).toThrow();
    expect(() => IpcContracts['admin:login'].request.parse({ passcode: '7777' })).toThrow();
  });

  it('requires ready metadata with an HTTPS public page origin or local LAN HTTP', () => {
    const valid = {
      status: 'ready',
      readyAt: '2026-08-17T12:00:00.000Z',
      expiresAt: '2026-09-16T12:00:00.000Z',
      publicPageOrigin: 'https://photos.example.org',
      publicPath: '/photo',
    };
    expect(ConfirmUploadResponseSchema.parse(valid)).toEqual(valid);
    expect(
      ConfirmUploadResponseSchema.parse({ ...valid, publicPageOrigin: 'http://192.168.1.50:4310' })
        .publicPageOrigin,
    ).toBe('http://192.168.1.50:4310');
    expect(() =>
      ConfirmUploadResponseSchema.parse({ ...valid, publicPageOrigin: 'http://example.test' }),
    ).toThrow();
  });
});
