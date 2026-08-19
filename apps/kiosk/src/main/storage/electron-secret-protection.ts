import { safeStorage } from 'electron';

import type { PlatformSecretProtection } from './secret-store.js';

export const electronSecretProtection: PlatformSecretProtection = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encryptString: (value) => safeStorage.encryptString(value),
  decryptString: (value) => safeStorage.decryptString(value),
};
