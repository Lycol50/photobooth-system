import { useEffect, useRef } from 'react';

import { QrPanel } from '../components/QrPanel';

type FinalQrScreenProps = {
  busy?: boolean;
  collageUrl: string;
  onDone: () => void;
  qrImageUrl: string;
};

export function FinalQrScreen({
  busy = false,
  collageUrl,
  onDone,
  qrImageUrl,
}: FinalQrScreenProps) {
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const heading = document.querySelector<HTMLElement>('[data-screen-heading]');
    heading?.focus();
  }, []);

  return (
    <main className="screen screen--final" data-testid="final-screen">
      <section className="final-result" aria-label="Your finished photo" ref={resultRef}>
        <div className="final-result__frame">
          <div className="final-result__crosshair final-result__crosshair--tl" aria-hidden="true">+</div>
          <div className="final-result__crosshair final-result__crosshair--tr" aria-hidden="true">+</div>
          <div className="final-result__crosshair final-result__crosshair--bl" aria-hidden="true">+</div>
          <div className="final-result__crosshair final-result__crosshair--br" aria-hidden="true">+</div>
          <div className="final-result__tag" aria-hidden="true">
            M.A.T. // OUTPUT-COMPOSITE // 300DPI
          </div>
          <img src={collageUrl} alt="Your finished four-photo collage" draggable="false" />
        </div>
      </section>
      <QrPanel busy={busy} onDone={onDone} qrImageUrl={qrImageUrl} />
    </main>
  );
}
