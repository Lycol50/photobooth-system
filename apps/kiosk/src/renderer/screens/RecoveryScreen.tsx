import {
  ArrowClockwiseIcon as ArrowClockwise,
  CheckCircleIcon as CheckCircle,
  CloudSlashIcon as CloudSlash,
  LockKeyIcon as LockKey,
  SpinnerGapIcon as SpinnerGap,
  VideoCameraSlashIcon as VideoCameraSlash,
} from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';

import { Button } from '../components/Button';
import { BrandMark } from '../components/BrandMark';
import { LOCAL_FIXTURES } from '../local-fixtures';
import type { RecoveryVariant } from '../types';

type RecoveryScreenProps = {
  busy?: boolean;
  canRetryUpload?: boolean;
  canFinishOffline?: boolean;
  message?: string | null;
  onOpenAdmin: () => void;
  onRestart: () => void;
  onRetryUpload: () => void;
  onFinishOffline?: () => void;
  variant: RecoveryVariant;
};

const COPY = {
  camera: {
    title: 'OPTICAL SUBSYSTEM DISCONNECTED',
    body: 'Verify physical camera connection, then authenticate operator bypass to restart session.',
    action: 'Restart session',
    icon: VideoCameraSlash,
  },
  upload: {
    title: 'CLOUD SYNC DISPATCH FAILED',
    body: 'Composite photo is safely persisted to local NVMe storage. Re-attempt secure sync.',
    action: 'Retry upload',
    icon: CloudSlash,
  },
  interrupted: {
    title: 'RECONCILING BOOTH STATE',
    body: 'Verifying atomic disk journal to safely restore session progress.',
    action: null,
    icon: SpinnerGap,
  },
} as const;

export function RecoveryScreen({
  busy = false,
  canRetryUpload = false,
  canFinishOffline = false,
  message,
  onOpenAdmin,
  onRestart,
  onRetryUpload,
  onFinishOffline,
  variant,
}: RecoveryScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const copy = COPY[variant];
  const Icon = copy.icon;

  useEffect(() => {
    headingRef.current?.focus();
  }, [variant]);

  return (
    <main className="screen screen--recovery" data-testid={`recovery-${variant}`}>
      <section className="recovery-art" aria-hidden="true">
        <img src={LOCAL_FIXTURES.recoveryBackground} alt="" draggable="false" />
        <div className="recovery-art__fade" />
      </section>
      <section className="recovery-content">
        <BrandMark compact muted />
        <article
          className="recovery-card"
          role={variant === 'interrupted' ? 'status' : 'alert'}
          aria-live={variant === 'interrupted' ? 'polite' : 'assertive'}
        >
          <div className={`recovery-card__icon recovery-card__icon--${variant}`} aria-hidden="true">
            <Icon weight="bold" />
          </div>
          <h1 ref={headingRef} tabIndex={-1} data-screen-heading>
            {copy.title}
          </h1>
          <p>{message ?? copy.body}</p>
          {variant === 'camera' ? (
            <Button icon={<LockKey aria-hidden="true" weight="bold" />} loading={busy} onClick={onRestart}>
              {copy.action}
            </Button>
          ) : null}
          {variant === 'upload' ? (
            <div className="recovery-actions">
              <Button
                disabled={!canRetryUpload}
                icon={<ArrowClockwise aria-hidden="true" weight="bold" />}
                loading={busy}
                onClick={onRetryUpload}
              >
                {copy.action}
              </Button>
              {onFinishOffline && (
                <Button
                  disabled={!canFinishOffline}
                  variant="secondary"
                  icon={<CheckCircle aria-hidden="true" weight="bold" />}
                  loading={busy}
                  onClick={onFinishOffline}
                >
                  Finish offline
                </Button>
              )}
            </div>
          ) : null}
        </article>
      </section>
      {variant !== 'interrupted' ? (
        <button className="operator-access" onClick={onOpenAdmin} aria-label="Admin" title="Admin">
          <LockKey aria-hidden="true" weight="bold" />
          <span>Admin</span>
        </button>
      ) : null}
    </main>
  );
}
