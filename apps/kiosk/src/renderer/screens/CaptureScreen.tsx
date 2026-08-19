import {
  CameraIcon as Camera,
  CheckCircleIcon as CheckCircle,
} from '@phosphor-icons/react';

import { ProgressStepper } from '../components/ProgressStepper';
import { mockPhotoFor } from '../local-fixtures';

type CaptureScreenProps = {
  phase: 'countdown' | 'capturing';
  secondsRemaining: number;
  shotNumber: number;
  liveVideoRef?: (element: HTMLVideoElement | null) => void;
  liveStreamReady?: boolean;
};

const POSE_COPY = [
  'Big smiles & eyes on lens!',
  'Try a playful pose!',
  'Peace signs and hugs!',
  'Grand celebratory finale!',
] as const;

export function CaptureScreen({
  phase,
  secondsRemaining,
  shotNumber,
  liveVideoRef,
  liveStreamReady = false,
}: CaptureScreenProps) {
  const safeShot = Math.max(1, Math.min(4, shotNumber));
  const poseSuggestion = POSE_COPY[safeShot - 1];
  const countdownHint = secondsRemaining <= 3 ? 'HOLD POSE & SMILE' : 'PREPARE FRAME';

  return (
    <main className="screen screen--capture" data-phase={phase} data-testid="capture-screen">
      <header className="capture-header">
        <ProgressStepper activeStep={safeShot} />
        <div className="camera-ready-badge" role="status">
          <CheckCircle aria-hidden="true" weight="bold" />
          <span>{liveVideoRef && !liveStreamReady ? 'CALIBRATING OPTICS' : 'OPTICAL FEED ACTIVE'}</span>
        </div>
      </header>
      <section className="viewfinder" aria-labelledby="capture-title">
        {/* Technical Corner Crosshairs */}
        <div className="viewfinder__crosshair viewfinder__crosshair--tl" aria-hidden="true">+</div>
        <div className="viewfinder__crosshair viewfinder__crosshair--tr" aria-hidden="true">+</div>
        <div className="viewfinder__crosshair viewfinder__crosshair--bl" aria-hidden="true">+</div>
        <div className="viewfinder__crosshair viewfinder__crosshair--br" aria-hidden="true">+</div>
        <div className="viewfinder__telemetry-tag" aria-hidden="true">
          REC // CH-01 // 60FPS
        </div>

        {liveVideoRef ? (
          <video
            className="viewfinder__live"
            ref={liveVideoRef}
            autoPlay
            muted
            playsInline
            aria-label="Live camera preview"
            data-testid="viewfinder-live"
            hidden={!liveStreamReady}
          />
        ) : null}
        {liveStreamReady ? null : (
          <div
            className="viewfinder__fixture"
            style={{ backgroundImage: `url(${mockPhotoFor(safeShot)})` }}
            role="img"
            aria-label="Local pose guide showing a family facing the camera"
          />
        )}
        <div className="viewfinder__scrim" aria-hidden="true" />
        <div className="viewfinder__pose-copy">
          <Camera aria-hidden="true" weight="bold" />
          <span className="telemetry-prefix">FRAME 0{safeShot}</span>
          <span className="sr-only">{poseSuggestion}</span>
        </div>
        {phase === 'countdown' ? (
          <div className="countdown-card">
            <span
              className="countdown-card__number"
              data-testid="countdown-value"
              role="timer"
              aria-label={`${secondsRemaining} seconds until photo ${safeShot}`}
            >
              {secondsRemaining}
            </span>
            <h1
              className="sr-only"
              id="capture-title"
              data-screen-heading
              tabIndex={-1}
            >
              {countdownHint}
            </h1>
          </div>
        ) : (
          <div
            className="countdown-card countdown-card--capturing"
            role="status"
            aria-live="polite"
          >
            <h1 id="capture-title" data-screen-heading tabIndex={-1} className="sr-only">
              CAPTURING FRAME
            </h1>
          </div>
        )}
        <div
          className={`shutter-flash${phase === 'capturing' ? ' is-active' : ''}`}
          aria-hidden="true"
        />
      </section>
    </main>
  );
}
