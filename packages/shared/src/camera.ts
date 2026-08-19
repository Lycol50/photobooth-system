import { z } from 'zod';
import { OpaqueIdSchema, UtcMillisSchema } from './domain.js';

export const CameraAdapterKindSchema = z.enum(['mock', 'sony', 'webcam', 'internal_webcam']);
export type CameraAdapterKind = z.infer<typeof CameraAdapterKindSchema>;
export const CameraConnectionStateSchema = z.enum([
  'disconnected',
  'connecting',
  'ready',
  'busy',
  'error',
  'unsupported',
]);

export const CameraDeviceSchema = z
  .object({
    deviceId: z.string(),
    label: z.string(),
    groupId: z.string().optional(),
  })
  .strict();
export type CameraDevice = z.infer<typeof CameraDeviceSchema>;

export const CameraStatusSchema = z
  .object({
    adapter: CameraAdapterKindSchema,
    state: CameraConnectionStateSchema,
    code: z.string().max(100).nullable(),
    operatorMessage: z.string().max(300),
    capabilities: z
      .object({
        stillCapture: z.boolean(),
        preview: z.boolean(),
      })
      .strict(),
    checkedAt: UtcMillisSchema,
  })
  .strict();
export type CameraStatus = z.infer<typeof CameraStatusSchema>;

export const CameraConfigSchema = z
  .object({
    adapter: CameraAdapterKindSchema,
    deviceId: z.string().nullable(),
    status: CameraStatusSchema,
  })
  .strict();
export type CameraConfig = z.infer<typeof CameraConfigSchema>;

export const CaptureRequestSchema = z
  .object({
    sessionId: OpaqueIdSchema,
    captureId: OpaqueIdSchema,
    shotNumber: z.number().int().min(1).max(4),
    timeoutMs: z.number().int().min(1_000).max(120_000),
  })
  .strict();
export type CaptureRequest = z.infer<typeof CaptureRequestSchema>;

export type CaptureResult =
  | {
      kind: 'buffer';
      captureId: string;
      bytes: Uint8Array;
      contentType: 'image/jpeg';
      capturedAt: number;
    }
  | {
      kind: 'file';
      captureId: string;
      path: string;
      contentType: 'image/jpeg';
      capturedAt: number;
    };

export type CameraAdapter = {
  connect(): Promise<CameraStatus>;
  getStatus(): Promise<CameraStatus>;
  capture(request: CaptureRequest): Promise<CaptureResult>;
  disconnect(): Promise<void>;
};
