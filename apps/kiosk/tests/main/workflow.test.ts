import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

import type {
  CameraAdapter,
  CameraStatus,
  CaptureRequest,
  CaptureResult,
} from '@grace-booth/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { assertOperatorBootstrapComplete } from '../../src/main/auth/bootstrap-guard.js';
import { SonyCameraAdapter } from '../../src/main/camera/sony-camera-adapter.js';
import type { QrService } from '../../src/main/cloud/qr-service.js';
import type { UploadQueue } from '../../src/main/cloud/upload-queue.js';
import type { StoredFrame } from '../../src/main/database/repositories.js';
import type { FrameService } from '../../src/main/frame/frame-service.js';
import type { ImageProcessor } from '../../src/main/image/image-worker-client.js';
import { BoothWorkflow } from '../../src/main/workflow/booth-workflow.js';
import { createTestStore, type TestStore } from './helpers.js';

let store: TestStore | null = null;
let workflow: BoothWorkflow | null = null;
afterEach(async () => {
  await workflow?.close();
  workflow = null;
  store?.close();
  store = null;
});

describe('booth workflow camera recovery', () => {
  it('keeps Attract when advisory startup warm-up fails', async () => {
    ({ store, workflow } = createWorkflow(new SequencedCamera(['throw'])));
    await workflow.initialize();
    expect(workflow.getSnapshot()).toMatchObject({ screen: 'attract', state: null });
  });

  it('routes the honest unsupported Sony adapter directly to calm recovery', async () => {
    ({ store, workflow } = createWorkflow(new SonyCameraAdapter()));
    const snapshot = await workflow.start();
    expect(snapshot).toMatchObject({
      screen: 'recovery',
      state: 'camera_error',
      errorCode: 'capture_failed',
    });
    expect(snapshot.countdownEndsAt).toBeNull();
  });

  it('reconnects before operator restart after an actual Start failure', async () => {
    const camera = new SequencedCamera(['throw', 'ready']);
    ({ store, workflow } = createWorkflow(camera));
    const failed = await workflow.start();
    expect(failed.state).toBe('camera_error');
    const restarted = await workflow.restartSession(failed.sessionId!);
    expect(restarted).toMatchObject({ screen: 'countdown', state: 'countdown', captureCount: 0 });
    expect(camera.connectCalls).toBe(2);
  });

  it('surfaces partial interrupted capture as actionable operator recovery', async () => {
    ({ store, workflow } = createWorkflow(new SequencedCamera(['ready', 'ready'])));
    const session = store.repository.createSession(randomUUID(), 1_000);
    store.database.raw
      .prepare(
        `UPDATE sessions SET state = 'interrupted', capture_count = 1,
          last_error_code = 'app_restarted' WHERE id = ?`,
      )
      .run(session.id);
    await workflow.initialize();
    const recovered = workflow.getSnapshot();
    expect(recovered).toMatchObject({ screen: 'recovery', state: 'camera_error', captureCount: 1 });
    const restarted = await workflow.restartSession(session.id);
    expect(restarted).toMatchObject({ screen: 'countdown', state: 'countdown', captureCount: 0 });
  });

  it('transitions session to upload_failed on auth-required event and supports finishOffline', async () => {
    const queue = new FakeUploadQueue();
    const camera = new SequencedCamera(['ready']);
    const testStore = createTestStore();
    store = testStore;
    queue.testStore = testStore;
    const sessionId = randomUUID();
    testStore.repository.createSession(sessionId, 1_000);
    testStore.database.raw
      .prepare("UPDATE sessions SET state = 'uploading', capture_count = 3 WHERE id = ?")
      .run(sessionId);

    const imageProcessor: ImageProcessor = {
      process: () => Promise.reject(new Error('not used')),
      validateSourceJpeg: () => Promise.reject(new Error('not used')),
      normalizeFramePng: () => Promise.reject(new Error('not used')),
      close: () => Promise.resolve(),
    };
    const frameService = {
      ensureDefaultFrame: () => Promise.resolve(undefined),
      ensureDefaultFrames: () => Promise.resolve({ option1: undefined, option2: undefined }),
      getFrameOptions: () => [null, null],
      toSummary: (f: StoredFrame) => ({
        id: f.id,
        name: f.name,
        width: 1200,
        height: 3600,
        byteSize: 1000,
        mediaUrl: `grace-booth-media://asset/${f.id}`,
        slots: [],
        revision: 0,
      }),
    } as unknown as FrameService;
    const qrService = {
      render: () => Promise.resolve({ imageDataUrl: 'data:image/png;base64,mockqr' }),
    } as unknown as QrService;

    workflow = new BoothWorkflow(
      testStore.repository,
      testStore.vault,
      camera,
      frameService,
      imageProcessor,
      queue as unknown as UploadQueue,
      qrService,
      { countdownMs: 60_000, now: () => 2_000 },
    );
    await workflow.initialize();

    queue.emit('auth-required', sessionId);
    const snapshot = workflow.getSnapshot();
    expect(snapshot.state).toBe('upload_failed');
    expect(snapshot.controls.canFinishOffline).toBe(true);

    const finished = await workflow.finishOffline();
    expect(finished.state).toBe('final');
  });

  it('accepts chosen collage option, records it on session, and recovers selected frame', async () => {
    const queue = new FakeUploadQueue();
    const camera = new SequencedCamera(['ready']);
    const testStore = createTestStore();
    store = testStore;
    queue.testStore = testStore;

    const frame1Id = randomUUID();
    const frame2Id = randomUUID();
    testStore.repository.setCollageFrameId(1, frame1Id);
    testStore.repository.setCollageFrameId(2, frame2Id);

    const mockFrame1 = {
      id: frame1Id,
      name: 'Option 1',
      encryptedPath: 'f1.png',
      width: 1200,
      height: 3600,
      byteSize: 100,
      sha256: 'a'.repeat(64),
      revision: 0,
      createdAt: 1,
      updatedAt: 1,
      slots: [],
    };
    const mockFrame2 = {
      id: frame2Id,
      name: 'Option 2',
      encryptedPath: 'f2.png',
      width: 1200,
      height: 3600,
      byteSize: 100,
      sha256: 'b'.repeat(64),
      revision: 0,
      createdAt: 1,
      updatedAt: 1,
      slots: [],
    };

    const frameService = {
      ensureDefaultFrame: () => Promise.resolve(mockFrame1),
      ensureDefaultFrames: () => Promise.resolve({ option1: mockFrame1, option2: mockFrame2 }),
      getFrameOptions: () => [mockFrame1, mockFrame2],
      toSummary: (f: StoredFrame) => ({
        id: f.id,
        name: f.name,
        width: 1200,
        height: 3600,
        byteSize: 1000,
        mediaUrl: `grace-booth-media://asset/${f.id}`,
        slots: [],
        revision: 0,
      }),
    } as unknown as FrameService;

    const sessionId = randomUUID();
    testStore.repository.createSession(sessionId, 1_000);
    testStore.database.raw
      .prepare("UPDATE sessions SET state = 'review', capture_count = 3 WHERE id = ?")
      .run(sessionId);

    const frame1Vault = testStore.vault.write('frames', Buffer.from('f1'));
    const frame2Vault = testStore.vault.write('frames', Buffer.from('f2'));

    testStore.database.raw
      .prepare(
        `INSERT INTO frames
          (id, name, encrypted_path, width, height, byte_size, sha256, revision, created_at, updated_at)
        VALUES (?, 'Option 1', ?, 1200, 3600, 100, ?, 0, 1, 1),
               (?, 'Option 2', ?, 1200, 3600, 100, ?, 0, 1, 1)`,
      )
      .run(
        frame1Id,
        frame1Vault.relativePath,
        'a'.repeat(64),
        frame2Id,
        frame2Vault.relativePath,
        'b'.repeat(64),
      );

    for (const fid of [frame1Id, frame2Id]) {
      for (let s = 1; s <= 3; s++) {
        testStore.database.raw
          .prepare(
            `INSERT INTO frame_slots (frame_id, slot_index, name, x, y, width, height, crop_mode)
            VALUES (?, ?, ?, 0.1, ?, 0.8, 0.2, 'crop-to-fill')`,
          )
          .run(fid, s, `Photo ${s}`, (s - 1) * 0.3);
      }
    }

    for (let i = 1; i <= 3; i++) {
      const written = testStore.vault.write('pending', Buffer.from(`photo-${i}`));
      testStore.database.raw
        .prepare(
          `INSERT INTO session_assets
            (id, session_id, kind, retake_round, shot_number, encrypted_path, content_type, width, height, byte_size, sha256, created_at)
          VALUES (?, ?, 'capture', 0, ?, ?, 'image/jpeg', 1000, 1000, 100, ?, 1)`,
        )
        .run(randomUUID(), sessionId, i, written.relativePath, `${i}`.repeat(64));
    }

    let processedFramePng: Buffer | null = null;
    const imageProcessor: ImageProcessor = {
      process: ({ framePng }) => {
        processedFramePng = Buffer.isBuffer(framePng) ? framePng : Buffer.from(framePng);
        return Promise.resolve({
          bytes: Buffer.from('collage-jpeg'),
          width: 1200,
          height: 3600,
          byteSize: 12,
          timing: {
            validationMs: 1,
            slotsMs: 1,
            compositeMs: 1,
            totalMs: 3,
          },
        });
      },
      validateSourceJpeg: () => Promise.resolve({ width: 1000, height: 1000 }),
      normalizeFramePng: () => Promise.reject(new Error('not used')),
      close: () => Promise.resolve(),
    };

    const qrService = {
      render: () => Promise.resolve({ imageDataUrl: 'data:image/png;base64,mockqr' }),
    } as unknown as QrService;

    workflow = new BoothWorkflow(
      testStore.repository,
      testStore.vault,
      camera,
      frameService,
      imageProcessor,
      queue as unknown as UploadQueue,
      qrService,
      { countdownMs: 60_000, now: () => 2_000 },
    );
    await workflow.initialize();

    // Accept photos with Option 2
    const snapshot = workflow.acceptPhotos(2);
    expect(snapshot.state).toBe('processing');

    const updatedSession = testStore.repository.getSession(sessionId);
    expect(updatedSession?.selectedOption).toBe(2);
    expect(updatedSession?.selectedFrameId).toBe(frame2Id);
    expect(processedFramePng).toBeDefined();
  });
});

describe('first-run guest-operation guard', () => {
  it('rejects Start until the local operator bootstrap is complete', () => {
    expect(() => assertOperatorBootstrapComplete(false)).toThrow(/operator.*passcode/i);
    expect(() => assertOperatorBootstrapComplete(true)).not.toThrow();
  });
});

function createWorkflow(camera: CameraAdapter): { store: TestStore; workflow: BoothWorkflow } {
  const testStore = createTestStore();
  const queue = new FakeUploadQueue();
  const imageProcessor: ImageProcessor = {
    process: () => Promise.reject(new Error('not used')),
    validateSourceJpeg: () => Promise.reject(new Error('not used')),
    normalizeFramePng: () => Promise.reject(new Error('not used')),
    close: () => Promise.resolve(),
  };
  const frameService = {
    ensureDefaultFrame: () => Promise.resolve(undefined),
    ensureDefaultFrames: () => Promise.resolve({ option1: undefined, option2: undefined }),
    getFrameOptions: () => [null, null],
    toSummary: (f: StoredFrame) => ({
      id: f.id,
      name: f.name,
      width: 1200,
      height: 3600,
      byteSize: 1000,
      mediaUrl: 'grace-booth-media://asset/test',
      slots: [],
      revision: 0,
    }),
  } as unknown as FrameService;
  const qrService = {
    render: () => Promise.resolve({ imageDataUrl: 'data:image/png;base64,mockqr' }),
  } as unknown as QrService;
  return {
    store: testStore,
    workflow: new BoothWorkflow(
      testStore.repository,
      testStore.vault,
      camera,
      frameService,
      imageProcessor,
      queue as unknown as UploadQueue,
      qrService,
      { countdownMs: 60_000, now: () => 2_000 },
    ),
  };
}

class FakeUploadQueue extends EventEmitter {
  testStore?: TestStore;

  start(): void {
    return undefined;
  }
  stop(): void {
    return undefined;
  }
  wake(): void {
    return undefined;
  }
  completeOffline(sessionId: string): Promise<void> {
    if (this.testStore) {
      this.testStore.database.raw
        .prepare("UPDATE sessions SET state = 'ready', public_secret_ref = 'sec-1' WHERE id = ?")
        .run(sessionId);
    }
    this.emit('ready', sessionId);
    return Promise.resolve();
  }
  readDeliverySecret(): {
    photoSessionId: string;
    publicToken: string;
    ready: {
      status: string;
      readyAt: string;
      expiresAt: string;
      publicPageOrigin: string;
      publicPath: string;
    };
  } {
    const readyAt = 1_000_000;
    const expiresAt = readyAt + 30 * 24 * 60 * 60 * 1_000;
    return {
      photoSessionId: randomUUID(),
      publicToken: Buffer.alloc(32, 0x41).toString('base64url'),
      ready: {
        status: 'ready',
        readyAt: new Date(readyAt).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        publicPageOrigin: 'https://test',
        publicPath: '/photo',
      },
    };
  }
}

class SequencedCamera implements CameraAdapter {
  connectCalls = 0;

  constructor(private readonly sequence: ('ready' | 'throw')[]) {}

  connect(): Promise<CameraStatus> {
    const result = this.sequence[this.connectCalls] ?? this.sequence.at(-1) ?? 'ready';
    this.connectCalls += 1;
    return result === 'throw'
      ? Promise.reject(new Error('camera unavailable'))
      : Promise.resolve(readyStatus());
  }

  getStatus(): Promise<CameraStatus> {
    return Promise.resolve(readyStatus());
  }

  capture(request: CaptureRequest): Promise<CaptureResult> {
    void request;
    return Promise.reject(new Error('not used'));
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

function readyStatus(): CameraStatus {
  return {
    adapter: 'mock',
    state: 'ready',
    code: null,
    operatorMessage: 'ready',
    capabilities: { stillCapture: true, preview: false },
    checkedAt: 2_000,
  };
}
