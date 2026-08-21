import type { FrameLayout } from '@grace-booth/shared';

export const LOCAL_FIXTURES = {
  attractBackground: '/backgrounds/attract.jpg',
  finalBackground: '/backgrounds/ministry-fair-download.jpeg',
  processingBackground: '/backgrounds/processing.jpg',
  processingAnimation: '/animations/loading.json',
  countdownAudio: '/audio/countdown.wav',
  defaultFrame: '/frames/default-frame.png',
  mockPhotos: ['/mock/photo-1.jpg', '/mock/photo-2.jpg', '/mock/photo-3.jpg'],
  recoveryBackground: '/backgrounds/recovery.jpg',
  shutterAudio: '/audio/shutter.wav',
} as const;

export const DEFAULT_FRAME_LAYOUT = [
  {
    slotIndex: 1,
    name: 'Photo 1',
    x: 0.171667,
    y: 0.161667,
    width: 0.581667,
    height: 0.158056,
    cropMode: 'crop-to-fill',
  },
  {
    slotIndex: 2,
    name: 'Photo 2',
    x: 0.151667,
    y: 0.4225,
    width: 0.57,
    height: 0.151667,
    cropMode: 'crop-to-fill',
  },
  {
    slotIndex: 3,
    name: 'Photo 3',
    x: 0.258333,
    y: 0.713611,
    width: 0.5325,
    height: 0.144167,
    cropMode: 'crop-to-fill',
  },
] satisfies FrameLayout;

export const DEFAULT_FRAME_PREVIEW = {
  width: 1_200,
  height: 3_600,
  mediaUrl: LOCAL_FIXTURES.defaultFrame,
  slots: DEFAULT_FRAME_LAYOUT,
} as const;

export function mockPhotoFor(slotIndex: number): string {
  return (
    LOCAL_FIXTURES.mockPhotos[Math.max(0, Math.min(2, slotIndex - 1))] ??
    LOCAL_FIXTURES.mockPhotos[0]
  );
}
