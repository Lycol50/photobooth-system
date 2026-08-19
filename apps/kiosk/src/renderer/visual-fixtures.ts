import type {
  AdminHealth,
  AdminSettings,
  BoothSnapshot,
  FrameSummary,
  UploadJobSummary,
} from '@grace-booth/shared';

import type { AdminView } from './types';

export type VisualSeedPayload = {
  adminView: AdminView | null;
  countdownSeconds?: number;
  health: AdminHealth | null;
  jobs: UploadJobSummary[];
  settings: AdminSettings | null;
  snapshot: BoothSnapshot;
};

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const FRAME_ID = '22222222-2222-4222-8222-222222222222';
const JOB_ID = '33333333-3333-4333-8333-333333333333';
const CAPTURE_URLS = [
  '/mock/photo-1.jpg',
  '/mock/photo-2.jpg',
  '/mock/photo-3.jpg',
  '/mock/photo-4.jpg',
];

const DEFAULT_FRAME: FrameSummary = {
  id: FRAME_ID,
  name: 'Grace Booth Classic.png',
  width: 2700,
  height: 1800,
  byteSize: 44_090,
  mediaUrl: '/frames/default-frame.png',
  revision: 3,
  slots: [
    {
      slotIndex: 1,
      name: 'Photo 1',
      x: 0.04,
      y: 0.14,
      width: 0.44,
      height: 0.32,
      cropMode: 'crop-to-fill',
    },
    {
      slotIndex: 2,
      name: 'Photo 2',
      x: 0.52,
      y: 0.14,
      width: 0.44,
      height: 0.32,
      cropMode: 'crop-to-fill',
    },
    {
      slotIndex: 3,
      name: 'Photo 3',
      x: 0.04,
      y: 0.5,
      width: 0.44,
      height: 0.32,
      cropMode: 'crop-to-fill',
    },
    {
      slotIndex: 4,
      name: 'Photo 4',
      x: 0.52,
      y: 0.5,
      width: 0.44,
      height: 0.32,
      cropMode: 'crop-to-fill',
    },
  ],
};

const SETTINGS: AdminSettings = {
  googleFormsUrl: 'https://forms.gle/example',
  localRetentionDays: 60,
  cloudRetentionDays: 30,
  lan: {
    enabled: false,
    bindHost: '127.0.0.1',
    port: 4310,
    tlsConfigured: false,
    certificateFingerprint: null,
  },
  activeFrame: DEFAULT_FRAME,
  cameraAdapter: 'mock',
  cameraDeviceId: null,
  supabaseUrl: null,
  supabasePublishableKey: null,
  revision: 5,
};

const HEALTH: AdminHealth = {
  camera: {
    state: 'healthy',
    code: null,
    message: 'Mock camera is ready.',
    checkedAt: 1_786_883_400_000,
  },
  cloud: {
    state: 'healthy',
    code: null,
    message: 'Secure upload service is available.',
    checkedAt: 1_786_883_400_000,
  },
  database: {
    state: 'healthy',
    code: null,
    message: 'Local storage is ready.',
    checkedAt: 1_786_883_400_000,
  },
  encryption: {
    state: 'healthy',
    code: null,
    message: 'Secure credential storage is ready.',
    checkedAt: 1_786_883_400_000,
  },
};

const JOBS: UploadJobSummary[] = [
  {
    id: JOB_ID,
    sessionId: SESSION_ID,
    state: 'failed',
    attemptCount: 4,
    automaticRetryIndex: 3,
    nextAttemptAt: null,
    lastErrorCode: 'connection_unavailable',
    lastErrorMessage: 'Secure upload could not be reached.',
    createdAt: 1_786_879_800_000,
    updatedAt: 1_786_883_400_000,
  },
];

const BASE_SNAPSHOT: BoothSnapshot = {
  screen: 'attract',
  state: 'attract',
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

type SnapshotUpdate = Omit<Partial<BoothSnapshot>, 'controls' | 'media'> & {
  controls?: Partial<BoothSnapshot['controls']>;
  media?: Partial<BoothSnapshot['media']>;
};

function withSession(update: SnapshotUpdate): BoothSnapshot {
  const { controls, media, ...rest } = update;
  return {
    ...BASE_SNAPSHOT,
    sessionId: SESSION_ID,
    ...rest,
    media: { ...BASE_SNAPSHOT.media, ...media },
    controls: { ...BASE_SNAPSHOT.controls, ...controls },
  };
}

async function buildReadyQr(): Promise<string> {
  const { toDataURL } = await import('qrcode');
  return toDataURL('https://example.invalid/photo#0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg', {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 360,
  });
}

export async function readVisualFixture(search: string): Promise<VisualSeedPayload | null> {
  if (!import.meta.env.DEV) {
    return null;
  }

  const seed = new URLSearchParams(search).get('visual');
  if (!seed) {
    return null;
  }

  let snapshot = BASE_SNAPSHOT;
  let adminView: AdminView | null = null;
  let countdownSeconds: number | undefined;

  switch (seed) {
    case 'attract':
      break;
    case 'countdown':
      countdownSeconds = 5;
      snapshot = withSession({
        screen: 'countdown',
        state: 'countdown',
        shotNumber: 3,
        captureCount: 2,
        media: { captureUrls: CAPTURE_URLS.slice(0, 2), collageUrl: null, qrImageUrl: null },
      });
      break;
    case 'review':
      snapshot = withSession({
        screen: 'review',
        state: 'review',
        shotNumber: null,
        captureCount: 4,
        media: { captureUrls: CAPTURE_URLS, collageUrl: null, qrImageUrl: null },
        controls: { canRetakeAll: true, canAcceptPhotos: true },
      });
      break;
    case 'processing':
      snapshot = withSession({
        screen: 'processing',
        state: 'processing',
        shotNumber: null,
        captureCount: 4,
        media: { captureUrls: CAPTURE_URLS, collageUrl: null, qrImageUrl: null },
        message: 'Adding your four photos to the Grace Booth frame.',
      });
      break;
    case 'uploading-backoff':
      snapshot = withSession({
        screen: 'processing',
        state: 'pending_upload',
        shotNumber: null,
        captureCount: 4,
        media: { captureUrls: CAPTURE_URLS, collageUrl: null, qrImageUrl: null },
        message: 'Your collage is saved. The next secure upload attempt will begin shortly.',
      });
      break;
    case 'final':
      snapshot = withSession({
        screen: 'final',
        state: 'final',
        shotNumber: null,
        captureCount: 4,
        media: {
          captureUrls: CAPTURE_URLS,
          collageUrl: '/mock/photo-4.jpg',
          qrImageUrl: await buildReadyQr(),
        },
        controls: { canFinish: true },
      });
      break;
    case 'recovery-camera':
      snapshot = withSession({
        screen: 'recovery',
        state: 'camera_error',
        errorCode: 'camera_unavailable',
        message: 'The camera needs an operator check before this session can continue.',
      });
      break;
    case 'recovery-upload':
      snapshot = withSession({
        screen: 'recovery',
        state: 'upload_failed',
        captureCount: 4,
        errorCode: 'upload_failed',
        message: 'Your photo is safe on this booth. Try the secure upload again.',
        media: { captureUrls: CAPTURE_URLS, collageUrl: '/mock/photo-4.jpg', qrImageUrl: null },
        controls: { canRetryUpload: true },
      });
      break;
    case 'recovery-interrupted':
      snapshot = withSession({
        screen: 'recovery',
        state: 'interrupted',
        errorCode: 'interrupted',
      });
      break;
    case 'admin-frame':
      adminView = 'frame';
      break;
    case 'admin-settings':
      adminView = 'settings';
      break;
    default:
      return null;
  }

  const payload = {
    adminView,
    health: adminView ? HEALTH : null,
    jobs: adminView ? JOBS : [],
    settings: adminView ? SETTINGS : null,
    snapshot,
  };
  return countdownSeconds === undefined ? payload : { ...payload, countdownSeconds };
}
