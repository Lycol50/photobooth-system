import { ApiError } from '../_shared/errors.ts';
import { isR2Configured, photoBucket, publicPageOrigin } from '../_shared/env.ts';
import {
  assertExactOrigin,
  jsonResponse,
  publicCorsHeaders,
  publicErrorResponse,
  readJson,
  requestId,
  withBaseHeaders,
} from '../_shared/http.ts';
import { createR2Client, getR2ObjectBytes } from '../_shared/r2.ts';
import { parseWithSchema, PublicPhotoTokenSchema } from '../_shared/schemas.ts';
import { type AdminClient, createAdminClient } from '../_shared/supabase.ts';
import { hashPublicToken } from '../_shared/token.ts';

type PhotoRoute = 'resolve' | 'image' | 'download';

type ResolvedPhoto = {
  id: string;
  storage_object_path: string;
  content_type: 'image/jpeg';
  byte_size: number;
  google_forms_url: string | null;
  expires_at: string;
};

export function routeFromRequest(request: Request): PhotoRoute {
  const pathname = new URL(request.url).pathname;
  const functionPath = pathname.startsWith('/functions/v1/')
    ? pathname.slice('/functions/v1'.length)
    : pathname;
  const match = /^\/photo\/(resolve|image|download)$/u.exec(functionPath);
  const route = match?.[1];
  if (route === 'resolve' || route === 'image' || route === 'download') return route;
  throw new ApiError(404, 'not_found', 'This photo is unavailable or has expired.');
}

function isResolvedPhoto(value: unknown): value is ResolvedPhoto {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<ResolvedPhoto>;
  return (
    typeof row.id === 'string' &&
    typeof row.storage_object_path === 'string' &&
    row.content_type === 'image/jpeg' &&
    typeof row.byte_size === 'number' &&
    (typeof row.google_forms_url === 'string' || row.google_forms_url === null) &&
    typeof row.expires_at === 'string'
  );
}

async function resolvePhoto(admin: AdminClient, tokenHash: string): Promise<ResolvedPhoto> {
  const { data, error } = await admin.rpc('resolve_photo_session', {
    p_public_token_hash_hex: tokenHash,
  });
  if (error) {
    throw new ApiError(503, 'unavailable', 'Photo delivery is temporarily unavailable.', true);
  }
  const row = Array.isArray(data) ? data[0] : null;
  if (!isResolvedPhoto(row)) {
    throw new ApiError(404, 'not_found', 'This photo is unavailable or has expired.');
  }
  return row;
}

function isStorageNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: number; statusCode?: number | string; message?: string };
  return (
    candidate.status === 404 ||
    candidate.statusCode === 404 ||
    candidate.statusCode === '404' ||
    candidate.message?.toLowerCase().includes('not found') === true
  );
}

function assertPreflight(request: Request): void {
  if (request.headers.get('access-control-request-method') !== 'POST') {
    throw new ApiError(400, 'invalid_request', 'The preflight request is invalid.');
  }
  const requested = request.headers
    .get('access-control-request-headers')
    ?.split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (requested?.some((header) => header !== 'content-type')) {
    throw new ApiError(400, 'invalid_request', 'The preflight request is invalid.');
  }
}

export async function handler(request: Request): Promise<Response> {
  const correlationId = requestId();
  let allowedOrigin: string;
  try {
    allowedOrigin = publicPageOrigin();
  } catch (error) {
    return publicErrorResponse(error, 'null', correlationId);
  }

  try {
    const route = routeFromRequest(request);
    assertExactOrigin(request, allowedOrigin);

    if (request.method === 'OPTIONS') {
      assertPreflight(request);
      return new Response(null, {
        status: 204,
        headers: withBaseHeaders(publicCorsHeaders(allowedOrigin), correlationId),
      });
    }
    if (request.method !== 'POST') {
      throw new ApiError(405, 'invalid_request', 'Only POST requests are accepted.');
    }

    const { token } = parseWithSchema(PublicPhotoTokenSchema, await readJson(request));
    const tokenHash = await hashPublicToken(token);
    const admin = createAdminClient();
    const photo = await resolvePhoto(admin, tokenHash);

    if (route === 'resolve') {
      return jsonResponse(
        {
          status: 'ready',
          expiresAt: photo.expires_at,
          googleFormsUrl: photo.google_forms_url,
        },
        200,
        publicCorsHeaders(allowedOrigin),
        correlationId,
      );
    }

    let bytes: Uint8Array;
    if (isR2Configured()) {
      const r2 = createR2Client();
      const r2Bytes = await getR2ObjectBytes(r2, photo.storage_object_path);
      if (!r2Bytes) {
        throw new ApiError(404, 'not_found', 'This photo is unavailable or has expired.');
      }
      bytes = r2Bytes;
    } else {
      const { data: image, error: imageError } = await admin.storage
        .from(photoBucket())
        .download(photo.storage_object_path);
      if (imageError || !image) {
        if (isStorageNotFound(imageError)) {
          throw new ApiError(404, 'not_found', 'This photo is unavailable or has expired.');
        }
        throw new ApiError(503, 'unavailable', 'Photo delivery is temporarily unavailable.', true);
      }
      bytes = new Uint8Array(await image.arrayBuffer());
    }

    if (bytes.byteLength !== Number(photo.byte_size)) {
      throw new ApiError(503, 'unavailable', 'Photo delivery is temporarily unavailable.', true);
    }

    const stillAuthorized = await resolvePhoto(admin, tokenHash);
    if (stillAuthorized.id !== photo.id || Date.parse(stillAuthorized.expires_at) <= Date.now()) {
      throw new ApiError(404, 'not_found', 'This photo is unavailable or has expired.');
    }

    const disposition = route === 'download'
      ? 'attachment; filename="grace-booth-photo.jpg"'
      : 'inline; filename="grace-booth-photo.jpg"';
    const headers = withBaseHeaders(
      {
        ...publicCorsHeaders(allowedOrigin),
        'Content-Type': 'image/jpeg',
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': disposition,
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
      correlationId,
    );
    return new Response(bytes as unknown as BodyInit, { status: 200, headers });
  } catch (error) {
    return publicErrorResponse(error, allowedOrigin, correlationId);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
