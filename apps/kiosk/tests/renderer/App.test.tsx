// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest';

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type {
  AdminHealth,
  AdminSettings,
  BoothSnapshot,
  GraceBoothBridge,
  RpcResult,
} from '@grace-booth/shared';

import { App } from '../../src/renderer/App';
import { DEFAULT_FRAME_LAYOUT, LOCAL_FIXTURES } from '../../src/renderer/local-fixtures';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const FRAME_ID = '22222222-2222-4222-8222-222222222222';

function ok<T>(data: T): RpcResult<T> {
  return { ok: true, data };
}

const FRAME = {
  id: FRAME_ID,
  name: 'M.A.T. 42nd Anniversary',
  width: 1200,
  height: 3600,
  byteSize: 44_090,
  mediaUrl: LOCAL_FIXTURES.matFrame,
  revision: 1,
  slots: DEFAULT_FRAME_LAYOUT,
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
  revision: 1,
};

const HEALTH: AdminHealth = {
  camera: { state: 'healthy', code: null, message: 'Camera ready.', checkedAt: 1 },
  cloud: { state: 'healthy', code: null, message: 'Cloud ready.', checkedAt: 1 },
  database: { state: 'healthy', code: null, message: 'Database ready.', checkedAt: 1 },
  encryption: { state: 'healthy', code: null, message: 'Encryption ready.', checkedAt: 1 },
};

const ATTRACT: BoothSnapshot = {
  screen: 'attract',
  state: null,
  sessionId: null,
  shotNumber: null,
  captureCount: 0,
  countdownEndsAt: null,
  cameraPreviewEnabled: false,
  media: { captureUrls: [], collageUrl: null, qrImageUrl: null },
  controls: {
    canStart: true,
    canRetakeAll: false,
    canAcceptPhotos: false,
    canRetryUpload: false,
    canFinishOffline: false,
    canFinish: false,
  },
  errorCode: null,
  message: null,
};

function sessionSnapshot(patch: Partial<BoothSnapshot> = {}): BoothSnapshot {
  return {
    screen: 'countdown',
    state: 'countdown',
    sessionId: SESSION_ID,
    shotNumber: 1,
    captureCount: 0,
    countdownEndsAt: Date.now() + 5_000,
    cameraPreviewEnabled: false,
    media: { captureUrls: [], collageUrl: null, qrImageUrl: null },
    controls: {
      canStart: false,
      canRetakeAll: false,
      canAcceptPhotos: false,
      canRetryUpload: false,
      canFinishOffline: false,
      canFinish: false,
    },
    errorCode: null,
    message: null,
    ...patch,
  };
}

type BridgeHarness = {
  bootstrapPasscodeMock: Mock<GraceBoothBridge['admin']['bootstrapPasscode']>;
  bridge: GraceBoothBridge;
  emit: (snapshot: BoothSnapshot) => void;
  getAuthStatusMock: Mock<GraceBoothBridge['admin']['getAuthStatus']>;
  restartSessionMock: Mock<GraceBoothBridge['admin']['restartSession']>;
  startMock: Mock<GraceBoothBridge['booth']['start']>;
};

function createBridge(initial: BoothSnapshot = ATTRACT): BridgeHarness {
  let listener: ((snapshot: BoothSnapshot) => void) | null = null;
  const startMock = vi.fn<GraceBoothBridge['booth']['start']>().mockResolvedValue(
    ok(
      sessionSnapshot({
        screen: 'countdown',
        state: 'countdown',
        shotNumber: 1,
      }),
    ),
  );
  const restartSessionMock = vi
    .fn<GraceBoothBridge['admin']['restartSession']>()
    .mockResolvedValue(ok(ATTRACT));
  const getAuthStatusMock = vi
    .fn<GraceBoothBridge['admin']['getAuthStatus']>()
    .mockResolvedValue(ok({ configured: true, authenticated: false, expiresAt: null }));
  const bootstrapPasscodeMock = vi
    .fn<GraceBoothBridge['admin']['bootstrapPasscode']>()
    .mockResolvedValue(
      ok({ configured: true, authenticated: true, expiresAt: Date.now() + 60_000 }),
    );

  const bridge: GraceBoothBridge = {
    booth: {
      getSnapshot: vi.fn().mockResolvedValue(ok(initial)),
      start: startMock,
      retakeAll: vi.fn().mockResolvedValue(ok(initial)),
      acceptPhotos: vi.fn().mockResolvedValue(ok(initial)),
      retryUpload: vi.fn().mockResolvedValue(ok(initial)),
      finishOffline: vi.fn().mockResolvedValue(ok(initial)),
      done: vi.fn().mockResolvedValue(ok(initial)),
      getCameras: vi.fn().mockResolvedValue(
        ok({
          adapter: 'webcam' as const,
          deviceId: null,
          status: {
            adapter: 'webcam' as const,
            state: 'ready' as const,
            code: null,
            operatorMessage: 'Ready',
            capabilities: { stillCapture: true, preview: true },
            checkedAt: 1,
          },
        }),
      ),
      setCamera: vi.fn().mockResolvedValue(
        ok({
          adapter: 'webcam' as const,
          deviceId: null,
          status: {
            adapter: 'webcam' as const,
            state: 'ready' as const,
            code: null,
            operatorMessage: 'Ready',
            capabilities: { stillCapture: true, preview: true },
            checkedAt: 1,
          },
        }),
      ),
      submitCameraFrame: vi.fn().mockResolvedValue(ok({})),
      subscribe: vi.fn((nextListener: (snapshot: BoothSnapshot) => void) => {
        listener = nextListener;
        return () => {
          listener = null;
        };
      }),
      onCameraFrameRequest: vi.fn().mockReturnValue(() => undefined),
    },
    admin: {
      getAuthStatus: getAuthStatusMock,
      login: vi
        .fn()
        .mockResolvedValue(
          ok({ configured: true, authenticated: true, expiresAt: Date.now() + 60_000 }),
        ),
      logout: vi.fn().mockResolvedValue(ok({})),
      bootstrapPasscode: bootstrapPasscodeMock,
      changePasscode: vi.fn().mockResolvedValue(ok({})),
      getSettings: vi.fn().mockResolvedValue(ok(SETTINGS)),
      saveSettings: vi.fn().mockResolvedValue(ok(SETTINGS)),
      chooseFrame: vi.fn().mockResolvedValue(ok(null)),
      saveFrameLayout: vi.fn().mockResolvedValue(ok(FRAME)),
      chooseLanCertificate: vi.fn().mockResolvedValue(ok(null)),
      listUploadJobs: vi.fn().mockResolvedValue(ok({ items: [], nextCursor: null })),
      retryUpload: vi.fn(),
      getHealth: vi.fn().mockResolvedValue(ok(HEALTH)),
      restartSession: restartSessionMock,
      connectCloud: vi.fn().mockResolvedValue(ok({ message: 'Connected.' })),
    },
  };

  return {
    bootstrapPasscodeMock,
    bridge,
    emit: (snapshot: BoothSnapshot) => {
      if (!listener) {
        throw new Error('Booth listener has not been installed');
      }
      listener(snapshot);
    },
    getAuthStatusMock,
    restartSessionMock,
    startMock,
  };
}

class AudioStub {
  currentTime = 0;
  preload = '';
  load = vi.fn();
  play = vi.fn().mockResolvedValue(undefined);
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('Audio', AudioStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App guest flow', () => {
  it('starts the bridge-driven capture flow and primes local audio', async () => {
    const harness = createBridge();
    window.graceBooth = harness.bridge;
    const user = userEvent.setup();

    render(<App />);
    await screen.findByTestId('attract-screen');
    await user.click(screen.getByRole('button', { name: /start photo session/i }));

    expect(await screen.findByTestId('capture-screen')).toHaveAttribute('data-phase', 'countdown');
    expect(screen.getByText('Photo 1 of 3')).toBeVisible();
    expect(harness.startMock).toHaveBeenCalledOnce();
  });

  it('maps review to exactly the two approved guest decisions', async () => {
    const harness = createBridge();
    window.graceBooth = harness.bridge;
    render(<App />);
    await screen.findByTestId('attract-screen');

    act(() =>
      harness.emit(
        sessionSnapshot({
          screen: 'review',
          state: 'review',
          captureCount: 3,
          media: {
            captureUrls: ['/mock/photo-1.jpg', '/mock/photo-2.jpg', '/mock/photo-3.jpg'],
            collageUrl: null,
            frame: FRAME,
            qrImageUrl: null,
          },
          controls: {
            canStart: false,
            canRetakeAll: true,
            canAcceptPhotos: true,
            canRetryUpload: false,
            canFinishOffline: false,
            canFinish: false,
          },
        }),
      ),
    );

    expect(await screen.findByTestId('review-screen')).toBeVisible();
    expect(screen.getByTestId('collage-option-1')).toBeVisible();
    expect(screen.getByTestId('collage-option-2')).toBeVisible();
    expect(screen.getByRole('button', { name: /retake all photos/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /use these photos/i })).toBeVisible();
  });

  it('never renders a final QR until both verified media URLs and final state exist', async () => {
    const harness = createBridge();
    window.graceBooth = harness.bridge;
    render(<App />);
    await screen.findByTestId('attract-screen');

    act(() =>
      harness.emit(
        sessionSnapshot({
          screen: 'final',
          state: 'ready',
          media: {
            captureUrls: [],
            collageUrl: 'grace-booth-media://asset/collage',
            qrImageUrl: null,
          },
        }),
      ),
    );
    expect(await screen.findByTestId('recovery-interrupted')).toBeVisible();
    expect(screen.queryByAltText(/qr code/i)).not.toBeInTheDocument();

    act(() =>
      harness.emit(
        sessionSnapshot({
          screen: 'final',
          state: 'final',
          media: {
            captureUrls: [],
            collageUrl: 'grace-booth-media://asset/collage',
            qrImageUrl: 'grace-booth-media://asset/qr',
          },
          controls: {
            canStart: false,
            canRetakeAll: false,
            canAcceptPhotos: false,
            canRetryUpload: false,
            canFinishOffline: false,
            canFinish: true,
          },
        }),
      ),
    );
    expect(await screen.findByTestId('final-screen')).toBeVisible();
    expect(screen.getByAltText(/qr code for your private/i)).toHaveAttribute(
      'src',
      'grace-booth-media://asset/qr',
    );
  });

  it('requires an operator login before restarting a camera-error session', async () => {
    const cameraFailure = sessionSnapshot({
      screen: 'recovery',
      state: 'camera_error',
      errorCode: 'camera_unavailable',
    });
    const harness = createBridge(cameraFailure);
    window.graceBooth = harness.bridge;
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /restart session/i }));
    expect(await screen.findByRole('dialog', { name: /operator restart/i })).toBeVisible();
    await user.type(screen.getByLabelText('Passcode'), 'secure88');
    await user.click(screen.getByRole('button', { name: /restart session/i }));

    await waitFor(() => expect(harness.restartSessionMock).toHaveBeenCalledWith(SESSION_ID));
    expect(await screen.findByTestId('attract-screen')).toBeVisible();
  });

  it('requires the first operator passcode before guest operation', async () => {
    const harness = createBridge();
    harness.getAuthStatusMock.mockResolvedValue(
      ok({ configured: false, authenticated: false, expiresAt: null }),
    );
    window.graceBooth = harness.bridge;
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('dialog', { name: /create operator passcode/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /cancel|close/i })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: /create operator passcode/i })).toBeVisible();
    await user.type(screen.getByLabelText('Passcode'), 'secure88');
    await user.type(screen.getByLabelText('Confirm passcode'), 'secure88');
    await user.click(screen.getByRole('button', { name: /save passcode/i }));

    expect(await screen.findByTestId('attract-screen')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(harness.bootstrapPasscodeMock).toHaveBeenCalledWith('secure88');
  });
});
