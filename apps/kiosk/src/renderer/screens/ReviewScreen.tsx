import {
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  ArrowRightIcon as ArrowRight,
  CheckCircleIcon as CheckCircle,
} from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';

import { Button } from '../components/Button';
import { Photostrip, type PhotostripFrame } from '../components/Photostrip';
import { DEFAULT_FRAME_PREVIEW } from '../local-fixtures';

type ReviewScreenProps = {
  busy?: boolean;
  canAccept: boolean;
  canRetake: boolean;
  captureUrls: string[];
  frame?: PhotostripFrame | null | undefined;
  onAccept: () => void;
  onRetake: () => void;
};

export function ReviewScreen({
  busy = false,
  canAccept,
  canRetake,
  captureUrls,
  frame,
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
        <section className="review-stage" aria-label="Finished photobooth strip preview">
          <Photostrip
            captureUrls={captureUrls}
            frame={frame ?? DEFAULT_FRAME_PREVIEW}
            label="Three captured photos in the selected Ministry Fair frame"
            variant="preview"
          />
        </section>

        <section className="review-panel" aria-labelledby="review-title">
          <div className="review-panel__header">
            <div className="capture-complete-badge">
              <CheckCircle aria-hidden="true" weight="bold" />
              <span>All 3 photos captured</span>
            </div>
            <h1 id="review-title" data-screen-heading ref={headingRef} tabIndex={-1}>
              Review your photos
            </h1>
            <p>
              Check your three-photo strip. Retake if you want another try, or continue to finish
              your collage.
            </p>
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
