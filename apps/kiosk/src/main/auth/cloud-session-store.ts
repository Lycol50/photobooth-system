import { BoothAuthSessionSchema, type BoothAuthSession } from '@grace-booth/shared';

import type { SecretStore } from '../storage/secret-store.js';

const SESSION_NAME = 'booth-auth-session';

export class CloudSessionStore {
  constructor(private readonly secrets: SecretStore) {}

  load(): BoothAuthSession | null {
    const value = this.secrets.getNamedJson(SESSION_NAME);
    return value === null ? null : BoothAuthSessionSchema.parse(value);
  }

  save(session: BoothAuthSession): void {
    this.secrets.writeNamedJson(SESSION_NAME, BoothAuthSessionSchema.parse(session));
  }

  clear(): void {
    this.secrets.delete(`secrets/${SESSION_NAME}.sealed`);
  }
}
