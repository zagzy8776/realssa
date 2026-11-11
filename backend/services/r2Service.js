const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');

const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET || 'realssa-media';

let s3Client = null;

if (accessKeyId && secretAccessKey && endpoint) {
  try {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      forcePathStyle: true, // Necessary for compatibility with Cloudflare R2
    });
    console.log('✅ [Cloudflare R2] client initialized successfully.');
  } catch (err) {
    console.warn('❌ [Cloudflare R2] Failed to initialize client:', err.message);
  }
} else {
  console.warn('⚠️ [Cloudflare R2] Environment variables not fully set. Storage upload disabled.');
}

/**
 * Uploads a buffer directly to R2 bucket
 */
async function uploadBuffer(buffer, destinationKey, contentType = 'image/jpeg') {
  if (!s3Client) {
    throw new Error('R2 S3 Client is not initialized.');
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: destinationKey,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  
  // Public URL format: Endpoint contains the account-specific ID, e.g.
  // https://<account-id>.r2.cloudflarestorage.com/<bucket-name>/<destination-key>
  // We can transform this endpoint into a public custom domain if configured,
  // or fall back to the standard R2 storage endpoint layout.
  const cleanEndpoint = endpoint.replace('https://', '');
  return `https://${bucketName}.${cleanEndpoint}/${destinationKey}`;
}

/**
 * Downloads a media asset from a URL and caches it in Cloudflare R2
 * Returns the new R2 URL, or falls back to the original URL if failed.
 */
async function cacheImageToR2(imageUrl, destinationKey) {
  if (!s3Client || !imageUrl) return imageUrl;
  
  // If already an R2 URL, return it
  if (imageUrl.includes('r2.cloudflarestorage.com')) {
    return imageUrl;
  }

  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 8000 });
    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    const r2Url = await uploadBuffer(buffer, destinationKey, contentType);
    console.log(`📸 [R2 Cache] Cached image: ${destinationKey}`);
    return r2Url;
  } catch (err) {
    console.warn(`⚠️ [R2 Cache Fail] Failed to cache image from ${imageUrl}:`, err.message);
    return imageUrl; // Fall back to original TMDB / external image link
  }
}

module.exports = {
  uploadBuffer,
  cacheImageToR2,
  isAvailable: () => !!s3Client
};
