import {
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  ArrowRightIcon as ArrowRight,
  CheckCircleIcon as CheckCircle,
} from '@phosphor-icons/react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { Button } from '../components/Button';
import { Photostrip, type PhotostripFrame } from '../components/Photostrip';
import { ANNIVERSARY_FRAME_PREVIEW, DEFAULT_FRAME_PREVIEW } from '../local-fixtures';

type ReviewScreenProps = {
  busy?: boolean;
  canAccept: boolean;
  canRetake: boolean;
  captureUrls: string[];
  frame?: PhotostripFrame | null | undefined;
  frames?: [PhotostripFrame, PhotostripFrame] | undefined;
  onAccept: (selectedOption: 1 | 2) => void;
  onRetake: () => void;
};

export function ReviewScreen({
  busy = false,
  canAccept,
  canRetake,
  captureUrls,
  frame,
  frames,
  onAccept,
  onRetake,
}: ReviewScreenProps) {
  const [selectedOption, setSelectedOption] = useState<1 | 2>(1);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const handleRetake = () => {
    setSelectedOption(1);
    onRetake();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, option: 1 | 2) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setSelectedOption(option);
    }
  };

  const frame1 = frames?.[0] ?? frame ?? DEFAULT_FRAME_PREVIEW;
  const frame2 = frames?.[1] ?? ANNIVERSARY_FRAME_PREVIEW;

  return (
    <main className="screen screen--review" data-testid="review-screen">
      <div className="review-layout">
        <section className="review-options-stage" role="radiogroup" aria-label="Collage options">
          <div
            className={`review-option-card ${selectedOption === 1 ? 'is-selected' : ''}`}
            role="radio"
            aria-checked={selectedOption === 1}
            tabIndex={0}
            onClick={() => setSelectedOption(1)}
            onKeyDown={(e) => handleKeyDown(e, 1)}
            data-testid="collage-option-1"
            aria-label="Collage Option 1"
          >
            <div className="review-option-badge">
              <span className="review-option-title">Collage 1</span>
              {selectedOption === 1 && (
                <span className="selected-indicator" aria-hidden="true">
                  <CheckCircle weight="fill" /> Selected
                </span>
              )}
            </div>
            <div className="review-option-preview">
              <Photostrip
                captureUrls={captureUrls}
                frame={frame1}
                label="Preview in Collage Option 1"
                variant="preview"
              />
            </div>
          </div>

          <div
            className={`review-option-card ${selectedOption === 2 ? 'is-selected' : ''}`}
            role="radio"
            aria-checked={selectedOption === 2}
            tabIndex={0}
            onClick={() => setSelectedOption(2)}
            onKeyDown={(e) => handleKeyDown(e, 2)}
            data-testid="collage-option-2"
            aria-label="Collage Option 2"
          >
            <div className="review-option-badge">
              <span className="review-option-title">Collage 2</span>
              {selectedOption === 2 && (
                <span className="selected-indicator" aria-hidden="true">
                  <CheckCircle weight="fill" /> Selected
                </span>
              )}
            </div>
            <div className="review-option-preview">
              <Photostrip
                captureUrls={captureUrls}
                frame={frame2}
                label="Preview in Collage Option 2"
                variant="preview"
              />
            </div>
          </div>
        </section>

        <section className="review-decision-panel" aria-label="Review decisions">
          <div className="review-decision-card">
            <div className="capture-complete-badge">
              <CheckCircle aria-hidden="true" weight="bold" />
              <span>All 3 photos captured</span>
            </div>
            <h1 id="review-title" data-screen-heading ref={headingRef} tabIndex={-1}>
              Choose your collage
            </h1>
            <p className="review-copy">
              Check your three-photo strip. Retake if you want another try, or continue to finish
              your collage.
            </p>
            <div className="review-actions">
              <Button
                aria-label="Retake all photos"
                disabled={!canRetake || busy}
                icon={<ArrowCounterClockwise aria-hidden="true" weight="bold" />}
                onClick={handleRetake}
                variant="secondary"
              >
                <span className="button__two-line">
                  <span className="button__line">Retake all</span>
                  <span className="button__line">photos</span>
                </span>
              </Button>
              <Button
                aria-label="Use these photos"
                disabled={!canAccept}
                iconAfter={<ArrowRight aria-hidden="true" weight="bold" />}
                loading={busy}
                onClick={() => onAccept(selectedOption)}
              >
                <span className="button__two-line">
                  <span className="button__line">Use these</span>
                  <span className="button__line">photos</span>
                </span>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
