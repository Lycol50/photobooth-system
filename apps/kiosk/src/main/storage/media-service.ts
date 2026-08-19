import type { LocalRepository } from '../database/repositories.js';
import { AppError } from '../errors.js';
import type { PhotoVault } from './photo-vault.js';

export class MediaService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly vault: PhotoVault,
  ) {}

  read(identifier: string): { bytes: Buffer; contentType: 'image/jpeg' | 'image/png' } {
    const asset = this.repository.getAsset(identifier);
    if (asset) return { bytes: this.vault.read(asset.encryptedPath), contentType: 'image/jpeg' };
    const frame = this.repository.getFrame(identifier);
    if (frame) return { bytes: this.vault.read(frame.encryptedPath), contentType: 'image/png' };
    throw new AppError('media_missing', 'The requested image is unavailable.');
  }
}
