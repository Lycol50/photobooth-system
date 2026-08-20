import {
  ApertureIcon as Aperture,
  CameraIcon as Camera,
  CheckCircleIcon as CheckCircle,
  GearIcon as Gear,
  LockKeyIcon as LockKey,
} from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';

import { Button } from '../components/Button';
import { LOCAL_FIXTURES } from '../local-fixtures';

type AttractScreenProps = {
  busy?: boolean;
  canStart: boolean;
  onOpenAdmin: () => void;
  onOpenCameras?: () => void;
  onStart: () => void;
};

export function AttractScreen({
  busy = false,
  canStart,
  onOpenAdmin,
  onOpenCameras,
  onStart,
}: AttractScreenProps) {
  const startButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    startButtonRef.current?.focus();
  }, []);

  return (
    <main className="screen screen--attract" data-testid="attract-screen">
      <img
        className="attract-background"
        src={LOCAL_FIXTURES.attractBackground}
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <div className="attract-scrim" aria-hidden="true" />
      <div className="attract-top-controls">
        {onOpenCameras && (
          <button
            className="operator-access camera-access"
            onClick={onOpenCameras}
            aria-label="Camera Setup"
            title="Camera Setup"
          >
            <Gear aria-hidden="true" weight="bold" />
            <span className="operator-access__text">Camera</span>
          </button>
        )}
        <button className="operator-access" onClick={onOpenAdmin} aria-label="Admin" title="Admin">
          <LockKey aria-hidden="true" weight="bold" />
          <span className="operator-access__text">Admin</span>
        </button>
      </div>

      <section className="attract-card" aria-labelledby="attract-title">
        <div className="attract-card__brand-header">
          <div className="attract-card__motif" aria-hidden="true">
            <Aperture weight="bold" />
          </div>
        </div>

        <h1 id="attract-title">M.A.T. PHOTOBOOTH</h1>
        <p className="attract-card__subtitle">EVENT PHOTOBOOTH</p>
        <p className="attract-card__lead">Take four photos, get a collage, and download it with a QR code.</p>

        <p className="attract-status" role="status">
          <CheckCircle aria-hidden="true" weight="bold" />
          <span>4 photos · collage · QR download</span>
        </p>

        <Button
          className="button--attract-start"
          icon={<Camera aria-hidden="true" weight="bold" />}
          loading={busy}
          disabled={!canStart}
          onClick={onStart}
          ref={startButtonRef}
        >
          Start photo session
        </Button>
      </section>
    </main>
  );
}
