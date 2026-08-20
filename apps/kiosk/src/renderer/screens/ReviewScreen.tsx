import {
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  ArrowRightIcon as ArrowRight,
  CheckCircleIcon as CheckCircle,
  FilmStripIcon as FilmStrip,
} from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';

import { Button } from '../components/Button';
import { PhotoSlot } from '../components/PhotoSlot';

type ReviewScreenProps = {
  busy?: boolean;
  canAccept: boolean;
  canRetake: boolean;
  captureUrls: string[];
  onAccept: () => void;
  onRetake: () => void;
};

export function ReviewScreen({
  busy = false,
  canAccept,
  canRetake,
  captureUrls,
  onAccept,
  onRetake,
}: ReviewScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="screen screen--review" data-testid="review-screen">
      <div className="review-layout">
        {/* Left / Center Stage: Authentic Physical Photobooth Strip */}
        <section className="review-stage" aria-label="Finished photobooth strip preview">
          <div className="photostrip-preview">
            <div
              className="photostrip-preview__sprocket-bar photostrip-preview__sprocket-bar--top"
              aria-hidden="true"
            >
              <span className="photostrip-preview__sprocket" />
              <span className="photostrip-preview__sprocket" />
              <span className="photostrip-preview__sprocket" />
              <span className="photostrip-preview__sprocket" />
            </div>

            <div className="photostrip-preview__header">
              <div className="photostrip-preview__brand">
                <FilmStrip weight="bold" aria-hidden="true" />
                <span>M.A.T. PHOTOBOOTH</span>
              </div>
            </div>

            <div
              className="photostrip-preview__frames"
              role="region"
              aria-label="Captured photo frames"
            >
              {Array.from({ length: 4 }, (_, index) => (
                <PhotoSlot index={index + 1} key={index} src={captureUrls[index]} />
              ))}
            </div>

            <div className="photostrip-preview__footer">
              <div className="photostrip-preview__footer-brand">
                <span>M.A.T. PHOTOBOOTH</span>
              </div>
            </div>

            <div
              className="photostrip-preview__sprocket-bar photostrip-preview__sprocket-bar--bottom"
              aria-hidden="true"
            >
              <span className="photostrip-preview__sprocket" />
              <span className="photostrip-preview__sprocket" />
              <span className="photostrip-preview__sprocket" />
              <span className="photostrip-preview__sprocket" />
            </div>
          </div>
        </section>

        <section className="review-panel" aria-labelledby="review-title">
          <div className="review-panel__header">
            <div className="capture-complete-badge">
              <CheckCircle aria-hidden="true" weight="bold" />
              <span>All 4 photos captured</span>
            </div>
            <h1 id="review-title" data-screen-heading ref={headingRef} tabIndex={-1}>
              Review your photos
            </h1>
            <p>Check your four-photo strip. Retake if you want another try, or continue to finish your collage.</p>
          </div>

          <div className="review-actions">
            <Button
              disabled={!canRetake || busy}
              icon={<ArrowCounterClockwise aria-hidden="true" weight="bold" />}
              onClick={onRetake}
              variant="secondary"
              wide
            >
              Retake all photos
            </Button>
            <Button
              disabled={!canAccept}
              iconAfter={<ArrowRight aria-hidden="true" weight="bold" />}
              loading={busy}
              onClick={onAccept}
              wide
            >
              Use these photos
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
