import {
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  ArrowRightIcon as ArrowRight,
  CheckCircleIcon as CheckCircle,
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
      <header className="review-header">
        <div>
          <h1 id="review-title" data-screen-heading ref={headingRef} tabIndex={-1}>
            REVIEW CAPTURE MATRIX
          </h1>
          <p>Inspect all four frames. Proceed to render collage or retake sequence.</p>
        </div>
        <div className="capture-complete-badge">
          <CheckCircle aria-hidden="true" weight="bold" />
          <span>4 OF 4 FRAMES VERIFIED</span>
        </div>
      </header>
      <section className="review-grid" aria-labelledby="review-title">
        {Array.from({ length: 4 }, (_, index) => (
          <PhotoSlot index={index + 1} key={index} src={captureUrls[index]} />
        ))}
      </section>
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
          Use these photos · Print &amp; Dispatch Collage
        </Button>
      </div>
    </main>
  );
}
