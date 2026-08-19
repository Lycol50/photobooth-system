import {
  CalendarBlankIcon as CalendarBlank,
  CheckCircleIcon as CheckCircle,
  QrCodeIcon as QrCode,
} from '@phosphor-icons/react';

import { Button } from './Button';

type QrPanelProps = {
  qrImageUrl: string;
  onDone: () => void;
  busy?: boolean;
};

export function QrPanel({ busy = false, onDone, qrImageUrl }: QrPanelProps) {
  return (
    <section className="qr-panel" aria-labelledby="qr-title">
      <div className="success-badge">
        <CheckCircle aria-hidden="true" weight="bold" />
        <span>PHOTO READY // DISPATCH COMPLETE</span>
      </div>
      <div className="qr-panel__copy">
        <h1 id="qr-title" data-screen-heading tabIndex={-1}>
          ALL SET!
        </h1>
        <p>Scan to download. Point your mobile camera at the data plate below to save your high-resolution collage.</p>
      </div>
      <div className="qr-panel__code">
        <div className="qr-panel__corner-mark qr-panel__corner-mark--tl" aria-hidden="true" />
        <div className="qr-panel__corner-mark qr-panel__corner-mark--tr" aria-hidden="true" />
        <div className="qr-panel__corner-mark qr-panel__corner-mark--bl" aria-hidden="true" />
        <div className="qr-panel__corner-mark qr-panel__corner-mark--br" aria-hidden="true" />
        <img src={qrImageUrl} alt="QR code for your private photo download" draggable="false" />
        <QrCode className="qr-panel__corner-icon" aria-hidden="true" weight="bold" />
      </div>
      <div className="qr-panel__notice">
        <CalendarBlank aria-hidden="true" weight="bold" />
        <span>RETENTION WINDOW: 30 DAYS ACTIVE</span>
      </div>
      <Button
        className="qr-panel__done"
        iconAfter={<CheckCircle aria-hidden="true" weight="bold" />}
        loading={busy}
        onClick={onDone}
        wide
      >
        Done
      </Button>
    </section>
  );
}
