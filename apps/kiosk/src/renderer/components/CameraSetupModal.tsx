import type { CameraAdapterKind, CameraDevice, CameraStatus } from '@grace-booth/shared';
import {
  CameraIcon as Camera,
  CheckCircleIcon as CheckCircle,
  VideoCameraIcon as VideoCamera,
  XIcon as X,
  WarningCircleIcon as WarningCircle,
  ArrowsClockwiseIcon as ArrowsClockwise,
} from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from './Button';
import { enumerateVideoDevices, useCameraStream } from '../hooks/useCameraStream';

type CameraSetupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCameraSaved?: (adapter: CameraAdapterKind, deviceId: string | null) => void;
};

export function CameraSetupModal({ isOpen, onClose, onCameraSaved }: CameraSetupModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const descriptionId = useId();
  const [selectedAdapter, setSelectedAdapter] = useState<CameraAdapterKind>('webcam');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<CameraDevice[]>([]);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const previewEnabled = isOpen && (selectedAdapter === 'webcam' || selectedAdapter === 'internal_webcam');
  const { videoRef, ready: streamReady, denied: streamDenied } = useCameraStream(
    previewEnabled,
    selectedDeviceId,
  );

  const loadCameras = async () => {
    if (typeof window === 'undefined' || !window.graceBooth) return;
    setLoading(true);
    setError(null);
    try {
      const [configResult, devices] = await Promise.all([
        window.graceBooth.booth.getCameras(),
        enumerateVideoDevices(),
      ]);
      setVideoDevices(devices);
      if (configResult.ok) {
        setSelectedAdapter(configResult.data.adapter);
        setSelectedDeviceId(configResult.data.deviceId);
        setCameraStatus(configResult.data.status);
      }
    } catch {
      setError('Could not query connected camera devices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadCameras();
    setSuccessMessage(null);
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
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
  }, [isOpen, saving, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!window.graceBooth) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await window.graceBooth.booth.setCamera({
        adapter: selectedAdapter,
        deviceId: selectedDeviceId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setCameraStatus(result.data.status);
      setSuccessMessage('Camera configuration saved successfully.');
      onCameraSaved?.(selectedAdapter, selectedDeviceId);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch {
      setError('Failed to apply camera settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="camera-setup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-setup-title"
        aria-describedby={descriptionId}
        ref={dialogRef}
      >
        <button
          aria-label="Close"
          className="icon-button passcode-dialog__close"
          disabled={saving}
          onClick={onClose}
        >
          <X aria-hidden="true" weight="bold" />
        </button>

        <div className="camera-setup-dialog__header">
          <div className="camera-setup-dialog__icon">
            <Camera aria-hidden="true" weight="bold" size={32} />
          </div>
          <div>
            <h2 id="camera-setup-title">Camera Configuration</h2>
            <p id={descriptionId} className="camera-setup-dialog__subtitle">
              Select active optical capture source and verify live telemetry feed.
            </p>
          </div>
        </div>

        <div className="camera-setup-dialog__content">
          <div className="camera-adapter-selector">
            <label className="field-label">Camera Source</label>
            <div className="camera-source-grid">
              <button
                type="button"
                className={`camera-source-card ${selectedAdapter === 'webcam' || selectedAdapter === 'internal_webcam' ? 'camera-source-card--active' : ''}`}
                onClick={() => setSelectedAdapter('webcam')}
              >
                <VideoCamera size={24} weight="bold" />
                <span className="camera-source-card__title">Laptop / USB Webcam</span>
                <span className="camera-source-card__desc">Internal camera or standard UVC device</span>
              </button>

              <button
                type="button"
                className={`camera-source-card ${selectedAdapter === 'sony' ? 'camera-source-card--active' : ''}`}
                onClick={() => setSelectedAdapter('sony')}
              >
                <Camera size={24} weight="bold" />
                <span className="camera-source-card__title">Sony A7 Tethered</span>
                <span className="camera-source-card__desc">High-precision Sony Alpha mirrorless</span>
              </button>

              <button
                type="button"
                className={`camera-source-card ${selectedAdapter === 'mock' ? 'camera-source-card--active' : ''}`}
                onClick={() => setSelectedAdapter('mock')}
              >
                <ArrowsClockwise size={24} weight="bold" />
                <span className="camera-source-card__title">Mock Hardware</span>
                <span className="camera-source-card__desc">Simulated capture for testing</span>
              </button>
            </div>
          </div>

          {(selectedAdapter === 'webcam' || selectedAdapter === 'internal_webcam') && (
            <div className="camera-webcam-section">
              <div className="camera-device-select-row">
                <label htmlFor="camera-device-select" className="field-label">
                  Active Device Node
                </label>
                <div className="select-with-refresh">
                  <select
                    id="camera-device-select"
                    className="select-input"
                    value={selectedDeviceId ?? ''}
                    onChange={(e) => setSelectedDeviceId(e.target.value || null)}
                  >
                    <option value="">Default System Webcam</option>
                    {videoDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera (${device.deviceId.slice(0, 8)})`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-button"
                    title="Refresh camera devices"
                    aria-label="Refresh camera devices"
                    onClick={() => void loadCameras()}
                    disabled={loading}
                  >
                    <ArrowsClockwise className={loading ? 'spin' : ''} size={18} weight="bold" />
                  </button>
                </div>
              </div>

              <div className="camera-preview-container">
                <div className="camera-preview-box">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="camera-preview-video"
                  />
                  <div className="camera-preview-box__crosshair camera-preview-box__crosshair--tl" aria-hidden="true">+</div>
                  <div className="camera-preview-box__crosshair camera-preview-box__crosshair--tr" aria-hidden="true">+</div>
                  <div className="camera-preview-box__crosshair camera-preview-box__crosshair--bl" aria-hidden="true">+</div>
                  <div className="camera-preview-box__crosshair camera-preview-box__crosshair--br" aria-hidden="true">+</div>
                  {!streamReady && !streamDenied && (
                    <div className="camera-preview-overlay">
                      <span>INITIALIZING LIVE OPTICAL FEED...</span>
                    </div>
                  )}
                  {streamDenied && (
                    <div className="camera-preview-overlay camera-preview-overlay--warning">
                      <WarningCircle size={24} weight="bold" />
                      <span>Camera permission denied or camera in use by another app.</span>
                    </div>
                  )}
                </div>
                <div className="camera-preview-caption">
                  <span>TELEMETRY: Verify optical alignment, framing, and exposure.</span>
                </div>
              </div>
            </div>
          )}

          {selectedAdapter === 'sony' && (
            <div className="camera-info-card">
              <div className="camera-info-card__badge">
                <WarningCircle size={20} weight="bold" />
                <span>SONY ALPHA USB TETHERING PROTOCOL</span>
              </div>
              <p>
                To connect a Sony A7 or compatible Sony Alpha camera:
              </p>
              <ul className="camera-info-card__list">
                <li>Turn on your Sony camera and connect via direct USB-C cable.</li>
                <li>Set USB Connection mode in camera settings to <strong>PC Remote</strong>.</li>
                <li>Ensure battery level is sufficient and sleep timer is set to disabled.</li>
              </ul>
              {cameraStatus && (
                <div className="camera-status-pill">
                  STATUS: <strong>{cameraStatus.state.toUpperCase()}</strong> ({cameraStatus.operatorMessage})
                </div>
              )}
            </div>
          )}

          {selectedAdapter === 'mock' && (
            <div className="camera-info-card">
              <div className="camera-info-card__badge">
                <ArrowsClockwise size={20} weight="bold" />
                <span>MOCK CAMERA EMULATOR</span>
              </div>
              <p>
                Simulates three guest shots using bundled test fixtures. Ideal for offline staging and UI verification without hardware.
              </p>
            </div>
          )}

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="form-success" role="status">
              <CheckCircle size={18} weight="bold" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        <div className="camera-setup-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSave}>
            Apply &amp; Save
          </Button>
        </div>
      </section>
    </div>
  );
}
