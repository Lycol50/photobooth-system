import type {
  CameraAdapter,
  CameraStatus,
  CaptureRequest,
  CaptureResult,
} from '@grace-booth/shared';

import { AppError } from '../errors.js';

const MESSAGE =
  'Sony camera support is pending exact model and firmware verification. Use Mock Camera for now.';

export class SonyCameraAdapter implements CameraAdapter {
  connect(): Promise<CameraStatus> {
    return this.getStatus();
  }

  getStatus(): Promise<CameraStatus> {
    return Promise.resolve({
      adapter: 'sony',
      state: 'unsupported',
      code: 'unsupported_pending_model_verification',
      operatorMessage: MESSAGE,
      capabilities: { stillCapture: false, preview: false },
      checkedAt: Date.now(),
    });
  }

  capture(request: CaptureRequest): Promise<CaptureResult> {
    void request;
    return Promise.reject(new AppError('unsupported_pending_model_verification', MESSAGE));
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }
}
