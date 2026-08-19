import {
  CheckIcon as Check,
  CloudArrowUpIcon as CloudArrowUp,
  FilmStripIcon as FilmStrip,
  LockKeyIcon as LockKey,
  QrCodeIcon as QrCode,
  SpinnerGapIcon as SpinnerGap,
} from '@phosphor-icons/react';

import type { SessionState } from '@grace-booth/shared';

type ProcessingScreenProps = {
  message?: string | null;
  state: SessionState | null;
  onOpenAdmin?: () => void;
};

type ProcessingCopy = {
  headline: string;
  status: string;
  activeStep: number;
};

function copyForState(
  state: SessionState | null,
  message: string | null | undefined,
): ProcessingCopy {
  if (state === 'uploading') {
    return {
      headline: 'DISPATCHING ARCHIVE // SYNCING',
      status: message ?? 'Uploading and cryptographically verifying output composite.',
      activeStep: 2,
    };
  }

  if (state === 'pending_upload') {
    return {
      headline: 'Your photo is safely saved',
      status: message ?? 'Composite persisted to local storage. Waiting for secure upload dispatch.',
      activeStep: 2,
    };
  }

  if (state === 'ready') {
    return {
      headline: 'GENERATING SECURE QR PLATE',
      status: 'Constructing tokenized distribution payload.',
      activeStep: 3,
    };
  }

  return {
    headline: 'Creating your collage',
    status: message ?? 'Compositing four frames into the M.A.T. Photobooth canvas.',
    activeStep: 1,
  };
}

const STEPS = [
  { label: 'RENDER // COMPOSITE', icon: FilmStrip },
  { label: 'SYNC // VERIFY', icon: CloudArrowUp },
  { label: 'QR-DISPATCH // TOKEN', icon: QrCode },
] as const;

export function ProcessingScreen({ message, onOpenAdmin, state }: ProcessingScreenProps) {
  const copy = copyForState(state, message);

  return (
    <main
      aria-busy="true"
      className="screen screen--processing"
      data-state={state ?? 'unknown'}
      data-testid="processing-screen"
    >
      {onOpenAdmin ? (
        <button className="operator-access" onClick={onOpenAdmin} aria-label="Admin" title="Admin">
          <LockKey aria-hidden="true" weight="bold" />
          <span>Admin</span>
        </button>
      ) : null}
      <section
        className="processing-card"
        aria-labelledby="processing-title"
        role="status"
        aria-live="polite"
      >
        <div className="processing-card__motif" aria-hidden="true">
          <SpinnerGap weight="bold" />
        </div>
        <h1 id="processing-title" data-screen-heading tabIndex={-1}>
          {copy.headline}
        </h1>
        <p>{copy.status}</p>
        <ol className="processing-steps" aria-label="Photo preparation progress">
          {STEPS.map(({ icon: Icon, label }, index) => {
            const stepNumber = index + 1;
            const complete = stepNumber < copy.activeStep;
            const active = stepNumber === copy.activeStep;
            return (
              <li
                className={`${complete ? 'is-complete' : ''}${active ? ' is-active' : ''}`}
                key={label}
                aria-current={active ? 'step' : undefined}
              >
                <span className="processing-steps__icon">
                  {complete ? (
                    <Check aria-hidden="true" weight="bold" />
                  ) : (
                    <Icon aria-hidden="true" weight="bold" />
                  )}
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
