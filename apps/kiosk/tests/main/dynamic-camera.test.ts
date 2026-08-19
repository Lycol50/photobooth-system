import { describe, expect, it, vi } from 'vitest';

import { DynamicCameraAdapter } from '../../src/main/camera/dynamic-camera-adapter.js';
import { RendererFrameBroker } from '../../src/main/camera/renderer-frame-broker.js';

describe('DynamicCameraAdapter', () => {
  it('initializes with mock adapter and reports mock status after connect', async () => {
    const broker = new RendererFrameBroker();
    const dynamic = new DynamicCameraAdapter({
      frameBroker: broker,
      mockOptions: { fixtureDirectory: 'fixtures' },
      initialAdapter: 'mock',
      initialDeviceId: null,
    });

    expect(dynamic.getActiveAdapterKind()).toBe('mock');
    expect(dynamic.getDeviceId()).toBeNull();
    const initialStatus = await dynamic.getStatus();
    expect(initialStatus.adapter).toBe('mock');
    expect(initialStatus.state).toBe('disconnected');

    const connectedStatus = await dynamic.connect();
    expect(connectedStatus.adapter).toBe('mock');
    expect(connectedStatus.state).toBe('ready');
  });

  it('switches between adapters and notifies listener', async () => {
    const broker = new RendererFrameBroker();
    const onAdapterChanged = vi.fn();

    const dynamic = new DynamicCameraAdapter({
      frameBroker: broker,
      mockOptions: { fixtureDirectory: 'fixtures' },
      initialAdapter: 'mock',
      initialDeviceId: null,
      onAdapterChanged,
    });

    const newStatus = await dynamic.switchAdapter('webcam', 'device-usb-1');
    expect(dynamic.getActiveAdapterKind()).toBe('webcam');
    expect(dynamic.getDeviceId()).toBe('device-usb-1');
    expect(newStatus.adapter).toBe('webcam');
    expect(onAdapterChanged).toHaveBeenCalledWith('webcam', 'device-usb-1');

    const sonyStatus = await dynamic.switchAdapter('sony');
    expect(dynamic.getActiveAdapterKind()).toBe('sony');
    expect(dynamic.getDeviceId()).toBeNull();
    expect(sonyStatus.adapter).toBe('sony');
    expect(onAdapterChanged).toHaveBeenCalledWith('sony', null);
  });

  it('delegates connect and disconnect to active adapter', async () => {
    const broker = new RendererFrameBroker();
    const dynamic = new DynamicCameraAdapter({
      frameBroker: broker,
      mockOptions: { fixtureDirectory: 'fixtures' },
      initialAdapter: 'mock',
      initialDeviceId: null,
    });

    await expect(dynamic.connect()).resolves.toBeDefined();
    await expect(dynamic.disconnect()).resolves.toBeUndefined();
  });
});
