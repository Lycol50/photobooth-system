export const LOCAL_FIXTURES = {
  attractBackground: '/backgrounds/attract.jpg',
  processingBackground: '/backgrounds/processing.jpg',
  countdownAudio: '/audio/countdown.wav',
  defaultFrame: '/frames/default-frame.png',
  mockPhotos: ['/mock/photo-1.jpg', '/mock/photo-2.jpg', '/mock/photo-3.jpg'],
  recoveryBackground: '/backgrounds/recovery.jpg',
  shutterAudio: '/audio/shutter.wav',
} as const;

export function mockPhotoFor(slotIndex: number): string {
  return (
    LOCAL_FIXTURES.mockPhotos[Math.max(0, Math.min(2, slotIndex - 1))] ??
    LOCAL_FIXTURES.mockPhotos[0]
  );
}
