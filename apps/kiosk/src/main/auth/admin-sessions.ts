import { createHash, randomBytes } from 'node:crypto';

import { AppError } from '../errors.js';

const DEFAULT_TTL_MS = 15 * 60 * 1_000;
const ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1_000;
const MAX_FAILURES = 5;
const LOCKOUT_MS = 5 * 60 * 1_000;

type AuthenticatedSession = {
  idleExpiresAt: number;
  absoluteExpiresAt: number;
  csrfToken: string | null;
};

type FailureState = {
  count: number;
  lockedUntil: number;
};

export class AdminSessionService {
  private readonly rendererSessions = new Map<number, AuthenticatedSession>();
  private readonly webSessions = new Map<string, AuthenticatedSession>();
  private readonly failures = new Map<string, FailureState>();

  constructor(private readonly ttlMs = DEFAULT_TTL_MS) {}

  authenticateRenderer(webContentsId: number, now = Date.now()): number {
    const idleExpiresAt = now + this.ttlMs;
    const absoluteExpiresAt = now + ABSOLUTE_TTL_MS;
    this.rendererSessions.set(webContentsId, { idleExpiresAt, absoluteExpiresAt, csrfToken: null });
    return Math.min(idleExpiresAt, absoluteExpiresAt);
  }

  rendererStatus(webContentsId: number, now = Date.now()): number | null {
    const session = this.rendererSessions.get(webContentsId);
    if (!session || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) {
      this.rendererSessions.delete(webContentsId);
      return null;
    }
    session.idleExpiresAt = Math.min(now + this.ttlMs, session.absoluteExpiresAt);
    return session.idleExpiresAt;
  }

  requireRenderer(webContentsId: number, now = Date.now()): void {
    if (this.rendererStatus(webContentsId, now) === null) {
      throw new AppError('unauthorized', 'Admin authentication is required.');
    }
  }

  logoutRenderer(webContentsId: number): void {
    this.rendererSessions.delete(webContentsId);
  }

  createWebSession(now = Date.now()): {
    cookieValue: string;
    csrfToken: string;
    expiresAt: number;
  } {
    const cookieValue = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    const idleExpiresAt = now + this.ttlMs;
    const absoluteExpiresAt = now + ABSOLUTE_TTL_MS;
    this.webSessions.set(hash(cookieValue), { idleExpiresAt, absoluteExpiresAt, csrfToken });
    return { cookieValue, csrfToken, expiresAt: Math.min(idleExpiresAt, absoluteExpiresAt) };
  }

  requireWebSession(
    cookieValue: string | undefined,
    csrfToken: string | undefined,
    now = Date.now(),
  ): void {
    if (!cookieValue) throw new AppError('unauthorized', 'Admin authentication is required.');
    const key = hash(cookieValue);
    const session = this.webSessions.get(key);
    if (!session || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) {
      this.webSessions.delete(key);
      throw new AppError('unauthorized', 'Admin authentication is required.');
    }
    if (!csrfToken || csrfToken !== session.csrfToken) {
      throw new AppError('csrf_invalid', 'The request could not be verified.');
    }
    session.idleExpiresAt = Math.min(now + this.ttlMs, session.absoluteExpiresAt);
  }

  logoutWeb(cookieValue: string | undefined): void {
    if (cookieValue) this.webSessions.delete(hash(cookieValue));
  }

  assertLoginAllowed(key: string, now = Date.now()): void {
    const failure = this.failures.get(key);
    if (failure && failure.lockedUntil > now) {
      throw new AppError(
        'rate_limited',
        'Too many attempts. Wait a few minutes and try again.',
        true,
      );
    }
    if (failure && failure.lockedUntil !== 0 && failure.lockedUntil <= now)
      this.failures.delete(key);
  }

  recordLoginResult(key: string, success: boolean, now = Date.now()): void {
    if (success) {
      this.failures.delete(key);
      return;
    }
    const current = this.failures.get(key) ?? { count: 0, lockedUntil: 0 };
    current.count += 1;
    if (current.count >= MAX_FAILURES) current.lockedUntil = now + LOCKOUT_MS;
    this.failures.set(key, current);
  }

  clear(): void {
    this.rendererSessions.clear();
    this.webSessions.clear();
    this.failures.clear();
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}
