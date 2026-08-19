import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { RendererFrameBroker } from '../../src/main/camera/renderer-frame-broker.js';
import { WebcamCameraAdapter } from '../../src/main/camera/webcam-camera-adapter.js';
import { isAllowedKioskPermission } from '../../src/main/security/window.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
const TRUSTED_ORIGIN = 'app://grace-booth';

function captureRequest(captureId: string) {
  return {
    sessionId: randomUUID(),
    captureId,
    shotNumber: 1 as const,
    timeoutMs: 5_000,
  };
}

describe('renderer frame broker', () => {
  it('resolves only the capture id that main issued', async () => {
    const broker = new RendererFrameBroker();
    const requested: string[] = [];
    broker.attach((request) => requested.push(request.captureId));
    const captureId = randomUUID();
    const pending = broker.requestFrame(captureId, 1_000);

    expect(requested).toEqual([captureId]);
    expect(() => broker.submitFrame(randomUUID(), JPEG)).toThrow(/no photo was requested/i);
    broker.submitFrame(captureId, JPEG);
    await expect(pending).resolves.toEqual(JPEG);
    expect(() => broker.submitFrame(captureId, JPEG)).toThrow(/no photo was requested/i);
  });

  it('rejects renderer bytes that are not a JPEG', async () => {
    const broker = new RendererFrameBroker();
    broker.attach(() => undefined);
    const captureId = randomUUID();
    const pending = broker.requestFrame(captureId, 1_000);
    expect(() => broker.submitFrame(captureId, Buffer.from('not-an-image'))).toThrow(/valid JPEG/i);
    broker.submitFrame(captureId, JPEG);
    await expect(pending).resolves.toEqual(JPEG);
  });

  it('refuses a second concurrent request and times out an unanswered one', async () => {
    const broker = new RendererFrameBroker();
    broker.attach(() => undefined);
    const first = broker.requestFrame(randomUUID(), 20);
    await expect(broker.requestFrame(randomUUID(), 1_000)).rejects.toThrow(/busy/i);
    await expect(first).rejects.toThrow(/did not respond/i);
  });

  it('fails an in-flight request when the renderer detaches', async () => {
    const broker = new RendererFrameBroker();
    broker.attach(() => undefined);
    const pending = broker.requestFrame(randomUUID(), 5_000);
    broker.detach();
    await expect(pending).rejects.toThrow(/not ready/i);
    expect(broker.isAttached()).toBe(false);
  });
});

describe('webcam camera adapter', () => {
  it('reports disconnected until a renderer owns the stream', async () => {
    const broker = new RendererFrameBroker();
    const adapter = new WebcamCameraAdapter(broker);
    await expect(adapter.connect()).resolves.toMatchObject({
      adapter: 'webcam',
      state: 'disconnected',
    });
    broker.attach(() => undefined);
    const status = await adapter.getStatus();
    expect(status).toMatchObject({ adapter: 'webcam', state: 'ready', code: null });
    expect(status.capabilities).toEqual({ stillCapture: true, preview: true });
  });

  it('returns the renderer frame as capture bytes', async () => {
    const broker = new RendererFrameBroker();
    const adapter = new WebcamCameraAdapter(broker);
    broker.attach((request) => broker.submitFrame(request.captureId, JPEG));
    await adapter.connect();
    const captureId = randomUUID();
    const result = await adapter.capture(captureRequest(captureId));
    expect(result).toMatchObject({ kind: 'buffer', captureId, contentType: 'image/jpeg' });
  });

  it('refuses to capture while disconnected', async () => {
    const broker = new RendererFrameBroker();
    const adapter = new WebcamCameraAdapter(broker);
    await adapter.connect();
    await expect(adapter.capture(captureRequest(randomUUID()))).rejects.toThrow(/not connected/i);
  });
});

describe('kiosk permission policy', () => {
  it('grants only video media to the trusted renderer origin', () => {
    expect(
      isAllowedKioskPermission({
        permission: 'media',
        requestingOrigin: TRUSTED_ORIGIN,
        mediaTypes: ['video'],
        trustedOrigin: TRUSTED_ORIGIN,
      }),
    ).toBe(true);
    expect(
      isAllowedKioskPermission({
        permission: 'media',
        requestingOrigin: `${TRUSTED_ORIGIN}/`,
        mediaTypes: ['video'],
        trustedOrigin: TRUSTED_ORIGIN,
      }),
    ).toBe(true);
  });

  it('denies audio, other permissions, and other origins', () => {
    const denied = [
      { permission: 'media', mediaTypes: ['audio'], requestingOrigin: TRUSTED_ORIGIN },
      { permission: 'media', mediaTypes: ['video', 'audio'], requestingOrigin: TRUSTED_ORIGIN },
      { permission: 'media', mediaTypes: [], requestingOrigin: TRUSTED_ORIGIN },
      { permission: 'media', mediaTypes: undefined, requestingOrigin: TRUSTED_ORIGIN },
      { permission: 'geolocation', mediaTypes: ['video'], requestingOrigin: TRUSTED_ORIGIN },
      { permission: 'notifications', mediaTypes: ['video'], requestingOrigin: TRUSTED_ORIGIN },
      { permission: 'media', mediaTypes: ['video'], requestingOrigin: 'https://example.test' },
      { permission: 'media', mediaTypes: ['video'], requestingOrigin: undefined },
    ];
    for (const query of denied) {
      expect(isAllowedKioskPermission({ ...query, trustedOrigin: TRUSTED_ORIGIN })).toBe(false);
    }
  });
});
