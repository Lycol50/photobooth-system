import { CLEANUP_BATCH_SIZE, CLEANUP_MAX_BATCHES } from '../_shared/constants.ts';
import { constantTimeEqual } from '../_shared/encoding.ts';
import { ApiError } from '../_shared/errors.ts';
import { cleanupSecret, photoBucket } from '../_shared/env.ts';
import { assertPost, errorResponse, jsonResponse, readJson, requestId } from '../_shared/http.ts';
import { type AdminClient, createAdminClient } from '../_shared/supabase.ts';

type CleanupClaim = {
  id: string;
  storage_object_path: string;
  previous_status: 'pending' | 'expired' | 'deleting';
};

function isCleanupClaim(value: unknown): value is CleanupClaim {
  if (!value || typeof value !== 'object') return false;
  const claim = value as Partial<CleanupClaim>;
  return (
    typeof claim.id === 'string' &&
    typeof claim.storage_object_path === 'string' &&
    (claim.previous_status === 'pending' ||
      claim.previous_status === 'expired' ||
      claim.previous_status === 'deleting')
  );
}

function assertCleanupSecret(request: Request): void {
  const received = request.headers.get('x-cleanup-secret') ?? '';
  if (!constantTimeEqual(received, cleanupSecret())) {
    throw new ApiError(401, 'unauthorized', 'A valid cleanup credential is required.');
  }
}

function assertEmptyObject(value: unknown): void {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length > 0
  ) {
    throw new ApiError(400, 'invalid_request', 'The request body is invalid.');
  }
}

export type CleanupSummary = {
  claimed: number;
  deleted: number;
  failed: number;
  hasMore: boolean;
};

export async function runCleanup(
  admin: AdminClient,
  leaseId = crypto.randomUUID(),
  bucket = photoBucket(),
): Promise<CleanupSummary> {
  let claimedCount = 0;
  let deletedCount = 0;
  let failedCount = 0;
  let lastBatchWasFull = false;

  for (let batch = 0; batch < CLEANUP_MAX_BATCHES; batch += 1) {
    const { data, error } = await admin.rpc('claim_photo_cleanup', {
      p_limit: CLEANUP_BATCH_SIZE,
      p_lease_id: leaseId,
    });
    if (error || !Array.isArray(data)) {
      throw new ApiError(503, 'unavailable', 'Cleanup is temporarily unavailable.', true);
    }

    const claims = data.filter(isCleanupClaim);
    if (claims.length !== data.length) {
      throw new ApiError(500, 'internal_error', 'Cleanup returned an invalid result.', true);
    }

    claimedCount += claims.length;
    lastBatchWasFull = claims.length === CLEANUP_BATCH_SIZE;
    if (claims.length === 0) break;

    for (const claim of claims) {
      const { error: removeError } = await admin.storage
        .from(bucket)
        .remove([claim.storage_object_path]);

      if (removeError) {
        failedCount += 1;
        continue;
      }

      const { data: completed, error: completeError } = await admin.rpc(
        'complete_photo_cleanup',
        {
          p_session_id: claim.id,
          p_lease_id: leaseId,
        },
      );
      if (completeError || completed !== true) {
        failedCount += 1;
      } else {
        deletedCount += 1;
      }
    }

    if (!lastBatchWasFull) break;
  }

  return {
    claimed: claimedCount,
    deleted: deletedCount,
    failed: failedCount,
    hasMore: lastBatchWasFull,
  };
}

export async function handler(request: Request): Promise<Response> {
  const correlationId = requestId();
  try {
    assertPost(request);
    assertCleanupSecret(request);
    assertEmptyObject(await readJson(request, 256));

    const admin = createAdminClient();
    const summary = await runCleanup(admin);

    return jsonResponse(
      summary,
      200,
      {},
      correlationId,
    );
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
