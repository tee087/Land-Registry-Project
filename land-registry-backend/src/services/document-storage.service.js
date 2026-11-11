import { promises as fs } from 'node:fs';
import path from 'node:path';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import env from '../config/environment.js';

const driver = process.env.DOCUMENT_STORAGE_DRIVER || (env.isProduction ? 's3' : 'local');
const bucket = process.env.S3_BUCKET || '';
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');

if (!['local', 's3'].includes(driver)) throw new Error('DOCUMENT_STORAGE_DRIVER must be "local" or "s3"');
if (env.isProduction && driver !== 's3') {
  throw new Error('Production requires DOCUMENT_STORAGE_DRIVER=s3; local disk is ephemeral on serverless hosts');
}
if (driver === 's3' && !bucket) throw new Error('S3_BUCKET is required when DOCUMENT_STORAGE_DRIVER=s3');

const s3 = driver === 's3'
  ? new S3Client({
    region: process.env.AWS_REGION || 'auto',
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  })
  : null;

function localPath(key) {
  const resolved = path.resolve(uploadDir, key);
  if (!resolved.startsWith(`${uploadDir}${path.sep}`)) throw new Error('Invalid document storage key');
  return resolved;
}

export async function putDocument(key, buffer, contentType) {
  if (driver === 's3') {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
    return;
  }
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(localPath(key), buffer, { flag: 'wx' });
}

export async function createDocumentUploadUrl(key, contentType, checksumSha256) {
  if (driver !== 's3') return null;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ChecksumSHA256: checksumSha256,
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 300 });
  return {
    url,
    headers: { 'Content-Type': contentType, 'x-amz-checksum-sha256': checksumSha256 },
  };
}

export async function createDocumentDownloadUrl(key, contentType, originalName) {
  if (driver !== 's3') return null;
  const filename = encodeURIComponent(String(originalName).replace(/[\r\n\u0000-\u001f]/g, '_'));
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: contentType,
    ResponseContentDisposition: `attachment; filename*=UTF-8''${filename}`,
  });
  return getSignedUrl(s3, command, { expiresIn: 60 });
}

export async function verifyUploadedDocument(key) {
  if (driver !== 's3') return null;
  try {
    return await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key, ChecksumMode: 'ENABLED' }));
  } catch (error) {
    if (error.name === 'NotFound' || error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

export async function getDocument(key) {
  if (driver === 's3') {
    try {
      const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) return null;
      throw error;
    }
  }
  try {
    return await fs.readFile(localPath(key));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
