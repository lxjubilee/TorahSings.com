// Cloudflare R2 (S3-compatible) write helper for admin cover uploads.
//
// PORTED FROM JUBILUJAH (2026-07-20) with ONE deliberate change: the
// `@aws-sdk/client-s3` import is LAZY (dynamic import inside the client/put
// helpers) instead of a top-level static import. Reason: torahsings-api can then
// boot even before the SDK is `npm install`ed on the box — only an actual cover
// upload needs it. `r2Configured()` lets routes fail closed (503) until the R2_*
// env keys are set; `r2Put` additionally throws if the SDK is not installed.
import { config } from '../config.js';

let client = null;

export function r2Configured() {
  const r = config.r2;
  return !!(r.endpoint && r.accessKeyId && r.secretAccessKey && r.bucket);
}

async function getClient() {
  if (!client) {
    const { S3Client } = await import('@aws-sdk/client-s3');
    client = new S3Client({
      region: 'auto',
      endpoint: config.r2.endpoint,
      credentials: { accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey },
    });
  }
  return client;
}

// PUT an object to R2. Covers are immutable-per-version (the ?v= query busts the
// cache), so we keep the long immutable cache-control the CDN already serves.
export async function r2Put(key, body, contentType) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const c = await getClient();
  await c.send(new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: key,
    Body: body,
    ContentType: contentType || 'image/png',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}
