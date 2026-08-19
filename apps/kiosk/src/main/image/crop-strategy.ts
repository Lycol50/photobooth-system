export type CropFocus = {
  x: number;
  y: number;
};

export type CropStrategy = {
  readonly name: string;
  locateFace(jpeg: Uint8Array): Promise<CropFocus | null>;
};

export class CenterCropStrategy implements CropStrategy {
  readonly name = 'center';

  locateFace(): Promise<CropFocus> {
    return Promise.resolve({ x: 0.5, y: 0.5 });
  }
}

export class MediaPipeCropStrategy implements CropStrategy {
  readonly name = 'mediapipe-unavailable';
  readonly operatorMessage =
    'Face-aware cropping is unavailable in the Electron main process; deterministic center crop is active.';

  locateFace(): Promise<null> {
    return Promise.resolve(null);
  }
}

export class FaceAwareWithCenterFallback implements CropStrategy {
  readonly name: string;

  constructor(
    private readonly faceStrategy: CropStrategy,
    private readonly fallback: CropStrategy = new CenterCropStrategy(),
  ) {
    this.name = `${faceStrategy.name}+${fallback.name}`;
  }

  async locateFace(jpeg: Uint8Array): Promise<CropFocus> {
    const face = await this.faceStrategy.locateFace(jpeg);
    if (face) return face;
    return (await this.fallback.locateFace(jpeg)) ?? { x: 0.5, y: 0.5 };
  }
}
