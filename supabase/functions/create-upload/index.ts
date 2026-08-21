import { SIGNED_UPLOAD_VALID_FOR_SECONDS } from '../_shared/constants.ts';
import { ApiError } from '../_shared/errors.ts';
import { isR2Configured, photoBucket, publicTokenDerivationKey } from '../_shared/env.ts';
import { assertPost, errorResponse, jsonResponse, readJson, requestId } from '../_shared/http.ts';
import { createR2Client, createR2PresignedPutUrl } from '../_shared/r2.ts';
import { CreateOrResumeUploadSchema, parseWithSchema } from '../_shared/schemas.ts';
import { type AdminClient, authenticateBooth, createAdminClient } from '../_shared/supabase.ts';
import { derivePublicToken, hashPublicToken } from '../_shared/token.ts';

type UploadAuthorization = {
  storagePath: string;
  signedUploadToken: string;
  uploadUrl?: string;
  validForSeconds: typeof SIGNED_UPLOAD_VALID_FOR_SECONDS;
};

async function authorizeUpload(
  admin: AdminClient,
  storagePath: string,
  contentType: string = 'image/jpeg',
  byteSize?: number,
): Promise<UploadAuthorization> {
  if (isR2Configured()) {
    const r2 = createR2Client();
    const uploadUrl = await createR2PresignedPutUrl(
      r2,
      storagePath,
      contentType,
      SIGNED_UPLOAD_VALID_FOR_SECONDS,
    );
    return {
      storagePath,
      signedUploadToken: 'r2_presigned',
      uploadUrl,
      validForSeconds: SIGNED_UPLOAD_VALID_FOR_SECONDS,
    };
  }

  const { data, error } = await admin.storage
    .from(photoBucket())
    .createSignedUploadUrl(storagePath, { upsert: false });

  if (error || !data?.token) {
    throw new ApiError(
      503,
      'unavailable',
      'Upload authorization is temporarily unavailable.',
      true,
    );
  }

  return {
    storagePath,
    signedUploadToken: data.token,
    validForSeconds: SIGNED_UPLOAD_VALID_FOR_SECONDS,
  };
}

function allocateStoragePath(sessionId: string, at = new Date()): string {
  const year = at.getUTCFullYear().toString().padStart(4, '0');
  const month = (at.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${year}/${month}/${sessionId}.jpg`;
}

async function enforceCreateRateLimit(admin: AdminClient, ownerUserId: string): Promise<void> {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await admin
    .from('photo_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', ownerUserId)
    .gte('created_at', oneMinuteAgo);

  if (error) {
    throw new ApiError(503, 'unavailable', 'Photo delivery is temporarily unavailable.', true);
  }
  if ((count ?? 0) >= 12) {
    throw new ApiError(429, 'rate_limited', 'Please wait before starting another upload.', true);
  }
}

async function isExistingClientSession(
  admin: AdminClient,
  ownerUserId: string,
  clientSessionId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('photo_sessions')
    .select('id')
    .eq('owner_user_id', ownerUserId)
    .eq('client_session_id', clientSessionId)
    .maybeSingle();
  if (error) {
    throw new ApiError(503, 'unavailable', 'Photo delivery is temporarily unavailable.', true);
  }
  return data !== null;
}

export async function handler(request: Request): Promise<Response> {
  const correlationId = requestId();
  try {
    assertPost(request);
    const admin = createAdminClient();
    const booth = await authenticateBooth(request, admin);
    const input = parseWithSchema(CreateOrResumeUploadSchema, await readJson(request));

    if (input.action === 'resume') {
      const { data: resumedRows, error } = await admin.rpc('resume_or_reopen_photo_session', {
        p_session_id: input.photoSessionId,
        p_owner_user_id: booth.id,
      });
      if (error?.code === 'P0002') {
        throw new ApiError(404, 'not_found', 'The upload session was not found.');
      }
      if (error?.code === 'P0001') {
        throw new ApiError(409, 'conflict', 'This upload session can no longer be resumed.');
      }
      const session = Array.isArray(resumedRows) ? resumedRows[0] : null;
      if (
        error ||
        !session ||
        typeof session.id !== 'string' ||
        typeof session.storage_object_path !== 'string' ||
        typeof session.reopened !== 'boolean'
      ) {
        throw new ApiError(503, 'unavailable', 'Photo delivery is temporarily unavailable.', true);
      }

      const upload = await authorizeUpload(admin, session.storage_object_path);
      return jsonResponse({ photoSessionId: session.id, upload }, 200, {}, correlationId);
    }

    if (!(await isExistingClientSession(admin, booth.id, input.clientSessionId))) {
      await enforceCreateRateLimit(admin, booth.id);
    }
    const clientSessionId = input.clientSessionId.toLowerCase();
    const photoSessionId = crypto.randomUUID();
    const publicToken = await derivePublicToken(
      publicTokenDerivationKey(),
      booth.id,
      clientSessionId,
    );
    const publicTokenHash = await hashPublicToken(publicToken);
    const storagePath = allocateStoragePath(photoSessionId);

    const { data: createdRows, error: insertError } = await admin.rpc(
      'create_or_get_photo_session',
      {
        p_candidate_id: photoSessionId,
        p_owner_user_id: booth.id,
        p_client_session_id: clientSessionId,
        p_public_token_hash_hex: publicTokenHash,
        p_storage_object_path: storagePath,
        p_content_type: input.contentType,
        p_byte_size: input.byteSize,
        p_content_sha256_hex: input.sha256,
        p_image_width: input.width,
        p_image_height: input.height,
        p_google_forms_url: input.googleFormsUrl,
      },
    );

    if (insertError?.code === 'P0001') {
      throw new ApiError(
        409,
        'conflict',
        'This local session already has a different or completed upload.',
      );
    }
    const created = Array.isArray(createdRows) ? createdRows[0] : null;
    if (
      insertError ||
      !created ||
      typeof created.id !== 'string' ||
      typeof created.storage_object_path !== 'string' ||
      typeof created.created !== 'boolean'
    ) {
      throw new ApiError(503, 'unavailable', 'Photo delivery is temporarily unavailable.', true);
    }

    const upload = await authorizeUpload(
      admin,
      created.storage_object_path,
      input.contentType,
      input.byteSize,
    );
    return jsonResponse(
      { photoSessionId: created.id, publicToken, upload },
      created.created ? 201 : 200,
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
