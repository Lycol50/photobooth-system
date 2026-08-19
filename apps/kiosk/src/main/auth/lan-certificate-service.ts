import { createHash } from 'node:crypto';
import { createSecureContext } from 'node:tls';

import type { LocalRepository } from '../database/repositories.js';
import { AppError } from '../errors.js';
import type { SecretStore } from '../storage/secret-store.js';

const MAX_PFX_BYTES = 2 * 1024 * 1024;

type StoredLanCertificate = {
  version: 1;
  pfxBase64: string;
  passphrase: string;
};

export class LanCertificateService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly secrets: SecretStore,
  ) {}

  importPfx(bytes: Uint8Array, passphrase: string): { fingerprint: string; secretRef: string } {
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PFX_BYTES) {
      throw new AppError(
        'certificate_size',
        'Choose a valid PFX certificate within the size limit.',
      );
    }
    try {
      createSecureContext({ pfx: Buffer.from(bytes), passphrase });
    } catch (error) {
      throw new AppError(
        'certificate_invalid',
        'The PFX certificate or passphrase is invalid.',
        false,
        {
          cause: error,
        },
      );
    }
    const fingerprint = createHash('sha256').update(bytes).digest('hex').toUpperCase();
    const secretRef = this.secrets.putJson('lan-tls', {
      version: 1,
      pfxBase64: Buffer.from(bytes).toString('base64'),
      passphrase,
    } satisfies StoredLanCertificate);
    const previous = this.repository.getSettings().lanTlsSecretRef;
    try {
      this.repository.setLanCertificate(secretRef, fingerprint);
      if (previous) this.secrets.delete(previous);
    } catch (error) {
      this.secrets.delete(secretRef);
      throw error;
    }
    return { fingerprint, secretRef };
  }

  load(): { pfx: Buffer; passphrase: string } | null {
    const reference = this.repository.getSettings().lanTlsSecretRef;
    if (!reference) return null;
    const raw = this.secrets.getJson(reference);
    if (!raw || typeof raw !== 'object') {
      throw new AppError('certificate_invalid', 'The LAN certificate record is invalid.');
    }
    const record = raw as Record<string, unknown>;
    if (
      record.version !== 1 ||
      typeof record.pfxBase64 !== 'string' ||
      typeof record.passphrase !== 'string' ||
      !record.pfxBase64 ||
      !record.passphrase
    ) {
      throw new AppError('certificate_invalid', 'The LAN certificate record is invalid.');
    }
    const stored: StoredLanCertificate = {
      version: 1,
      pfxBase64: record.pfxBase64,
      passphrase: record.passphrase,
    };
    const pfx = Buffer.from(stored.pfxBase64, 'base64');
    createSecureContext({ pfx, passphrase: stored.passphrase });
    return { pfx, passphrase: stored.passphrase };
  }
}
