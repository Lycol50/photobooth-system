import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from 'npm:@aws-sdk/client-s3@^3.750.0';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@^3.750.0';
import { r2AccountId, r2AccessKeyId, r2BucketName, r2SecretAccessKey } from './env.ts';
import { ApiError } from './errors.ts';

export function createR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${r2AccountId()}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId(),
      secretAccessKey: r2SecretAccessKey(),
    },
  });
}

export async function createR2PresignedPutUrl(
  client: S3Client,
  key: string,
  contentType: string,
  expiresInSeconds: number,
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: r2BucketName(),
      Key: key,
      ContentType: contentType,
    });
    return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  } catch (error) {
    console.error('Failed to create R2 presigned URL:', error);
    throw new ApiError(
      503,
      'unavailable',
      'Upload authorization is temporarily unavailable.',
      true,
    );
  }
}

export async function checkR2ObjectExists(
  client: S3Client,
  key: string,
): Promise<{ exists: boolean; byteSize: number | null }> {
  try {
    const command = new HeadObjectCommand({
      Bucket: r2BucketName(),
      Key: key,
    });
    const response = await client.send(command);
    return {
      exists: true,
      byteSize: response.ContentLength ?? null,
    };
  } catch (error: unknown) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      return { exists: false, byteSize: null };
    }
    throw new ApiError(
      503,
      'unavailable',
      'Storage verification is temporarily unavailable.',
      true,
    );
  }
}

export async function getR2ObjectBytes(
  client: S3Client,
  key: string,
): Promise<Uint8Array | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: r2BucketName(),
      Key: key,
    });
    const response = await client.send(command);
    if (!response.Body) return null;
    return await response.Body.transformToByteArray();
  } catch (error: unknown) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw new ApiError(
      503,
      'unavailable',
      'Photo delivery is temporarily unavailable.',
      true,
    );
  }
}

export async function deleteR2Objects(
  client: S3Client,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return;
  try {
    const command = new DeleteObjectsCommand({
      Bucket: r2BucketName(),
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
        Quiet: true,
      },
    });
    await client.send(command);
  } catch {
    throw new ApiError(
      503,
      'unavailable',
      'Storage cleanup is temporarily unavailable.',
      true,
    );
  }
}
