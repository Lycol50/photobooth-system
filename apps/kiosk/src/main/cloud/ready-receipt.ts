import {
  ConfirmUploadResponseSchema,
  PublicTokenSchema,
  type ConfirmUploadResponse,
} from '@grace-booth/shared';

import { AppError } from '../errors.js';

const readyReceiptBrand: unique symbol = Symbol('ReadyReceipt');

export type ReadyReceipt = {
  readonly [readyReceiptBrand]: true;
  readonly photoSessionId: string;
  readonly publicToken: string;
  readonly readyAt: string;
  readonly expiresAt: string;
  readonly publicPageOrigin: string;
  readonly publicPath: '/photo';
};

export function validateReadyReceipt(
  photoSessionId: string,
  publicToken: string,
  rawConfirmation: unknown,
): ReadyReceipt {
  const confirmation = ConfirmUploadResponseSchema.parse(rawConfirmation);
  const token = PublicTokenSchema.parse(publicToken);
  const readyAt = Date.parse(confirmation.readyAt);
  const expiresAt = Date.parse(confirmation.expiresAt);
  const requiredRetention = 30 * 24 * 60 * 60 * 1_000;
  if (
    !Number.isFinite(readyAt) ||
    !Number.isFinite(expiresAt) ||
    Math.abs(expiresAt - readyAt - requiredRetention) > 1_000
  ) {
    throw new AppError(
      'cloud_expiry_invalid',
      'The photo service returned an invalid expiry time.',
    );
  }
  return Object.freeze({
    [readyReceiptBrand]: true as const,
    photoSessionId,
    publicToken: token,
    ...confirmation,
  });
}

export function confirmationFromReadyReceipt(receipt: ReadyReceipt): ConfirmUploadResponse {
  return ConfirmUploadResponseSchema.parse({
    status: 'ready',
    readyAt: receipt.readyAt,
    expiresAt: receipt.expiresAt,
    publicPageOrigin: receipt.publicPageOrigin,
    publicPath: receipt.publicPath,
  });
}
