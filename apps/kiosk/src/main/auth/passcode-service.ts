import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

import { PasscodeSchema } from '@grace-booth/shared';

import type { LocalRepository } from '../database/repositories.js';
import { AppError } from '../errors.js';

const DEFAULT_PARAMETERS = { n: 131_072, r: 8, p: 1, keyLength: 64 } as const;
const MAX_MEMORY = 256 * 1024 * 1024;

export class PasscodeService {
  private derivationTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: LocalRepository,
    private readonly derivePasscode: typeof derive = derive,
  ) {}

  isConfigured(): boolean {
    const settings = this.repository.getSettings();
    return settings.passcodeHash !== null && settings.passcodeSalt !== null;
  }

  async bootstrap(passcode: string): Promise<void> {
    return this.serialized(async () => {
      PasscodeSchema.parse(passcode);
      if (this.isConfigured()) {
        throw new AppError(
          'passcode_already_configured',
          'The admin passcode is already configured.',
        );
      }
      const salt = randomBytes(32);
      const hash = await this.derivePasscode(passcode, salt, DEFAULT_PARAMETERS);
      this.repository.setPasscode(hash, salt, DEFAULT_PARAMETERS, 'passcode_bootstrap');
    });
  }

  async verify(passcode: string): Promise<boolean> {
    return this.serialized(() => this.verifyUnlocked(passcode));
  }

  async change(currentPasscode: string, newPasscode: string): Promise<void> {
    return this.serialized(async () => {
      PasscodeSchema.parse(currentPasscode);
      PasscodeSchema.parse(newPasscode);
      if (!(await this.verifyUnlocked(currentPasscode))) {
        throw new AppError('invalid_passcode', 'The current passcode is incorrect.');
      }
      const salt = randomBytes(32);
      const hash = await this.derivePasscode(newPasscode, salt, DEFAULT_PARAMETERS);
      this.repository.setPasscode(hash, salt, DEFAULT_PARAMETERS, 'passcode_change');
    });
  }

  private async verifyUnlocked(passcode: string): Promise<boolean> {
    if (!PasscodeSchema.safeParse(passcode).success) return false;
    const settings = this.repository.getSettings();
    if (!settings.passcodeHash || !settings.passcodeSalt) {
      await this.derivePasscode(passcode, Buffer.alloc(32, 0x5a), DEFAULT_PARAMETERS);
      return false;
    }
    const derived = await this.derivePasscode(passcode, settings.passcodeSalt, {
      n: settings.scryptN,
      r: settings.scryptR,
      p: settings.scryptP,
      keyLength: settings.scryptKeyLength,
      version: settings.scryptVersion,
    });
    return (
      derived.length === settings.passcodeHash.length &&
      timingSafeEqual(derived, settings.passcodeHash)
    );
  }

  private async serialized<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.derivationTail;
    let release: () => void = () => undefined;
    this.derivationTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

async function derive(
  passcode: string,
  salt: Buffer,
  parameters: { n: number; r: number; p: number; keyLength: number; version?: number },
): Promise<Buffer> {
  validateParameters(parameters);
  return new Promise((resolve, reject) => {
    scryptCallback(
      passcode,
      salt,
      parameters.keyLength,
      { N: parameters.n, r: parameters.r, p: parameters.p, maxmem: MAX_MEMORY },
      (error, derived) => (error ? reject(error) : resolve(Buffer.from(derived))),
    );
  });
}

function validateParameters(parameters: {
  n: number;
  r: number;
  p: number;
  keyLength: number;
  version?: number;
}): void {
  if (
    (parameters.version ?? 1) !== 1 ||
    parameters.n !== DEFAULT_PARAMETERS.n ||
    parameters.r !== DEFAULT_PARAMETERS.r ||
    parameters.p !== DEFAULT_PARAMETERS.p ||
    parameters.keyLength !== DEFAULT_PARAMETERS.keyLength
  ) {
    throw new AppError('passcode_parameters_invalid', 'The stored passcode settings are invalid.');
  }
}
