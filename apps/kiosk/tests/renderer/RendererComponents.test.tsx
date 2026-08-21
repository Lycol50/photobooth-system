// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AdminHealth, AdminSettings, FrameLayout } from '@grace-booth/shared';

import { AdminSettings as AdminSettingsScreen } from '../../src/renderer/admin/AdminSettings';
import { FrameEditor } from '../../src/renderer/admin/FrameEditor';
import { CaptureScreen } from '../../src/renderer/screens/CaptureScreen';
import { ProcessingScreen } from '../../src/renderer/screens/ProcessingScreen';
import { RecoveryScreen } from '../../src/renderer/screens/RecoveryScreen';
import { ReviewScreen } from '../../src/renderer/screens/ReviewScreen';
import { recoveryVariantFor, safeGuestMessage } from '../../src/renderer/types';

const FRAME = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'CCF Alabang Ministry Fair Strip',
  width: 1200,
  height: 3600,
  byteSize: 44_090,
  mediaUrl: '/frames/default-frame.png',
  revision: 1,
  slots: [
    {
      slotIndex: 1,
      name: 'Photo 1',
      x: 0.171667,
      y: 0.161667,
      width: 0.581667,
      height: 0.158056,
      cropMode: 'crop-to-fill',
    },
    {
      slotIndex: 2,
      name: 'Photo 2',
      x: 0.151667,
      y: 0.4225,
      width: 0.57,
      height: 0.151667,
      cropMode: 'crop-to-fill',
    },
    {
      slotIndex: 3,
      name: 'Photo 3',
      x: 0.258333,
      y: 0.713611,
      width: 0.5325,
      height: 0.144167,
      cropMode: 'crop-to-fill',
    },
  ],
} satisfies AdminSettings['activeFrame'];

const SETTINGS: AdminSettings = {
  googleFormsUrl: null,
  localRetentionDays: 60,
  cloudRetentionDays: 30,
  lan: {
    enabled: false,
    bindHost: '127.0.0.1',
    port: 4310,
    tlsConfigured: false,
    certificateFingerprint: null,
  },
  activeFrame: FRAME,
  cameraAdapter: 'webcam',
  cameraDeviceId: null,
  supabaseUrl: null,
  supabasePublishableKey: null,
  revision: 4,
};

const HEALTH: AdminHealth = {
  camera: { state: 'healthy', code: null, message: 'Camera ready.', checkedAt: 1 },
  cloud: { state: 'degraded', code: 'offline', message: 'Retrying.', checkedAt: 1 },
  database: { state: 'healthy', code: null, message: 'Database ready.', checkedAt: 1 },
  encryption: { state: 'healthy', code: null, message: 'Encryption ready.', checkedAt: 1 },
};

afterEach(cleanup);

describe('guest screen components', () => {
  it('renders the locked countdown progress and current pose', () => {
    render(<CaptureScreen phase="countdown" secondsRemaining={5} shotNumber={3} />);
    expect(screen.getByText('Photo 3 of 3')).toBeVisible();
    expect(screen.getByTestId('countdown-value')).toHaveTextContent('5');
    expect(screen.getByText(/Ministry Fair · Grand celebratory finale!/i)).toBeVisible();
  });

  it('renders only whole-set review actions', () => {
    const captureUrls = ['/capture/one.jpg', '/capture/two.jpg', '/capture/three.jpg'];
    render(
      <ReviewScreen
        canAccept
        canRetake
        captureUrls={captureUrls}
        frame={FRAME}
        onAccept={() => undefined}
        onRetake={() => undefined}
      />,
    );
    expect(screen.getAllByRole('figure')).toHaveLength(3);
    expect(screen.getByRole('group', { name: /selected Ministry Fair frame/i })).toHaveStyle({
      aspectRatio: '1200 / 3600',
    });
    expect(screen.getByAltText('Captured photo 1')).toHaveAttribute('src', captureUrls[0]);
    expect(screen.getByAltText('Captured photo 2')).toHaveAttribute('src', captureUrls[1]);
    expect(screen.getByAltText('Captured photo 3')).toHaveAttribute('src', captureUrls[2]);
    expect(screen.getByAltText('Captured photo 1').closest('figure')).toHaveStyle({
      left: '17.1667%',
      top: '16.1667%',
    });
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByText(/retake photo 1/i)).not.toBeInTheDocument();
  });

  it('distinguishes collage processing from upload backoff without claiming readiness', () => {
    const { rerender } = render(<ProcessingScreen state="processing" />);
    expect(screen.getByText('Creating your collage')).toBeVisible();
    expect(screen.getByText('Combining your three photos into one finished image.')).toBeVisible();
    expect(screen.getByTestId('processing-animation')).toBeVisible();
    expect(screen.queryByText('Photo ready')).not.toBeInTheDocument();

    rerender(<ProcessingScreen state="pending_upload" />);
    expect(screen.getByText('Your photo is safely saved')).toBeVisible();
    expect(screen.getByTestId('processing-screen')).toHaveAttribute('data-state', 'pending_upload');
  });

  it('exposes no recovery action while interrupted reconciliation runs', () => {
    render(
      <RecoveryScreen
        onOpenAdmin={() => undefined}
        onRestart={() => undefined}
        onRetryUpload={() => undefined}
        variant="interrupted"
      />,
    );
    expect(screen.getByTestId('recovery-interrupted')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('FrameEditor', () => {
  it('saves edited slot geometry as normalized coordinates', async () => {
    const onSave = vi.fn<(slots: FrameLayout) => void>();
    const user = userEvent.setup();
    render(<FrameEditor frame={FRAME} onChooseFrame={() => undefined} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('x percent'), { target: { value: '12.5' } });
    await user.click(screen.getByRole('button', { name: /save configuration/i }));
    expect(onSave).toHaveBeenCalledOnce();
    const savedSlots = onSave.mock.calls[0]?.[0];
    expect(savedSlots).toBeDefined();
    expect(savedSlots?.[0]?.x).toBeCloseTo(0.125);
  });

  it('resets the selected slot to persisted geometry', async () => {
    const user = userEvent.setup();
    render(<FrameEditor frame={FRAME} onChooseFrame={() => undefined} onSave={() => undefined} />);
    fireEvent.change(screen.getByLabelText('width percent'), { target: { value: '30' } });
    expect(screen.getByLabelText('width percent')).toHaveValue(30);
    await user.click(screen.getByRole('button', { name: /reset slot/i }));
    expect(screen.getByLabelText('width percent')).toHaveValue(58.2);
  });

  it('applies 1-click layout presets across all slots', async () => {
    const onSave = vi.fn<(slots: FrameLayout) => void>();
    const user = userEvent.setup();
    render(<FrameEditor frame={FRAME} onChooseFrame={() => undefined} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /3-Stack/i }));
    expect(screen.getByLabelText('x percent')).toHaveValue(10);
    expect(screen.getByLabelText('width percent')).toHaveValue(80);

    await user.click(screen.getByRole('button', { name: /3-Strip/i }));
    expect(screen.getByLabelText('x percent')).toHaveValue(17.2);
    expect(screen.getByLabelText('width percent')).toHaveValue(58.2);

    await user.click(screen.getByRole('button', { name: /Save configuration/i }));
    expect(onSave).toHaveBeenCalledOnce();
    const savedSlots = onSave.mock.calls[0]?.[0];
    expect(savedSlots).toHaveLength(3);
    expect(savedSlots?.[0]?.width).toBeCloseTo(0.581667);
  });
});

describe('AdminSettings', () => {
  const props = {
    health: HEALTH,
    jobs: [],
    onChangePasscode: vi.fn(),
    onChooseLanCertificate: vi.fn(),
    onConnectCloud: vi.fn(),
    onRefresh: vi.fn(),
    onRetryJob: vi.fn(),
    onSaveSettings: vi.fn(),
    settings: SETTINGS,
  };

  it('validates Google Forms allow-list before crossing the bridge', async () => {
    const user = userEvent.setup();
    render(<AdminSettingsScreen {...props} />);
    await user.type(screen.getByLabelText('Google Forms URL'), 'https://example.com/form');
    await user.click(screen.getByRole('button', { name: /save settings/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('valid HTTPS Google Forms URL');
    expect(props.onSaveSettings).not.toHaveBeenCalled();
  });

  it('keeps retention read-only and passcode inputs aligned to 8 to 64 characters', () => {
    render(<AdminSettingsScreen {...props} />);
    expect(screen.getByText('30')).toBeVisible();
    expect(screen.getByText('60')).toBeVisible();
    expect(screen.queryByRole('spinbutton', { name: /retention/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current passcode')).toHaveAttribute('maxLength', '64');
    expect(screen.getByLabelText('New passcode')).toHaveAttribute('maxLength', '64');
    expect(screen.getByLabelText('Confirm passcode')).toHaveAttribute('maxLength', '64');
  });
});

describe('guest-safe state helpers', () => {
  it('maps recovery variants deterministically', () => {
    expect(recoveryVariantFor('camera_error', null)).toBe('camera');
    expect(recoveryVariantFor('upload_failed', null)).toBe('upload');
    expect(recoveryVariantFor('interrupted', 'interrupted')).toBe('interrupted');
  });

  it('filters paths and credential-like technical messages from guest copy', () => {
    expect(safeGuestMessage('C:\\Users\\operator\\secret.jpg', 'Safe fallback')).toBe(
      'Safe fallback',
    );
    expect(safeGuestMessage('Bearer private-value', 'Safe fallback')).toBe('Safe fallback');
    expect(safeGuestMessage('Your photo is safe on this booth.', 'Safe fallback')).toBe(
      'Your photo is safe on this booth.',
    );
  });
});
