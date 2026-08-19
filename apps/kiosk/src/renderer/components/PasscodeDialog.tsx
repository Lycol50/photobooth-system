import {
  EyeIcon as Eye,
  EyeSlashIcon as EyeSlash,
  LockKeyIcon as LockKey,
  XIcon as X,
} from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';

import { Button } from './Button';

type PasscodeDialogProps = {
  busy?: boolean;
  dismissible?: boolean;
  error?: string | null;
  mode: 'login' | 'bootstrap' | 'restart';
  onCancel: () => void;
  onSubmit: (passcode: string) => void;
};

const MIN_PASSCODE_LENGTH = 8;

export function PasscodeDialog({
  busy = false,
  dismissible = true,
  error,
  mode,
  onCancel,
  onSubmit,
}: PasscodeDialogProps) {
  const descriptionId = useId();
  const errorId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [passcode, setPasscode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isBootstrap = mode === 'bootstrap';

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible && !busy) {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, dismissible, onCancel]);

  const title = isBootstrap
    ? 'Create operator passcode'
    : mode === 'restart'
      ? 'Operator restart'
      : 'Operator access';

  const description = isBootstrap
    ? 'Create a shared passcode with at least 8 characters.'
    : mode === 'restart'
      ? 'Enter the operator passcode to restart this session safely.'
      : 'Enter the shared operator passcode.';

  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    setLocalError(null);

    if (passcode.length < MIN_PASSCODE_LENGTH) {
      setLocalError('Passcode must contain at least 8 characters.');
      return;
    }

    if (isBootstrap && passcode !== confirmation) {
      setLocalError('Passcodes do not match.');
      return;
    }

    onSubmit(passcode);
  };

  const displayedError = localError ?? error;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="passcode-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="passcode-title"
        aria-describedby={displayedError ? `${descriptionId} ${errorId}` : descriptionId}
        ref={dialogRef}
      >
        {dismissible ? (
          <button
            aria-label="Close"
            className="icon-button passcode-dialog__close"
            disabled={busy}
            onClick={() => {
              if (!busy) {
                onCancel();
              }
            }}
          >
            <X aria-hidden="true" weight="bold" />
          </button>
        ) : null}
        <div className="passcode-dialog__header">
          <div className="passcode-dialog__motif">
            <LockKey aria-hidden="true" weight="bold" />
          </div>
          <div>
            <h2 id="passcode-title">{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
        </div>
        <form onSubmit={submit} className="passcode-dialog__form">
          <label htmlFor="operator-passcode">Passcode</label>
          <div className="password-field">
            <input
              autoComplete={isBootstrap ? 'new-password' : 'current-password'}
              id="operator-passcode"
              maxLength={64}
              minLength={MIN_PASSCODE_LENGTH}
              onChange={(event) => setPasscode(event.target.value)}
              ref={inputRef}
              type={showPasscode ? 'text' : 'password'}
              value={passcode}
              aria-invalid={Boolean(displayedError)}
            />
            <button
              aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
              className="password-field__toggle"
              onClick={() => setShowPasscode((visible) => !visible)}
              type="button"
            >
              {showPasscode ? <EyeSlash aria-hidden="true" weight="bold" /> : <Eye aria-hidden="true" weight="bold" />}
            </button>
          </div>
          {isBootstrap ? (
            <>
              <label htmlFor="operator-passcode-confirmation">Confirm passcode</label>
              <input
                autoComplete="new-password"
                id="operator-passcode-confirmation"
                maxLength={64}
                minLength={MIN_PASSCODE_LENGTH}
                onChange={(event) => setConfirmation(event.target.value)}
                type={showPasscode ? 'text' : 'password'}
                value={confirmation}
              />
            </>
          ) : null}
          {displayedError ? (
            <p className="form-error" id={errorId} role="alert">
              {displayedError}
            </p>
          ) : null}
          <div className="passcode-dialog__actions">
            {dismissible ? (
              <Button disabled={busy} onClick={onCancel} variant="secondary">
                Cancel
              </Button>
            ) : null}
            <Button loading={busy} type="submit">
              {mode === 'restart' ? 'Restart session' : isBootstrap ? 'Save passcode' : 'Unlock'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
