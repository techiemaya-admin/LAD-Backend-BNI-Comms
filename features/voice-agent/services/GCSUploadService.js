const path = require('path');
const { Storage } = require('@google-cloud/storage');

let logger;
try {
  logger = require('../../../core/utils/logger');
} catch (e) {
  logger = console;
}

class GCSUploadService {
  constructor() {
    this.storage = new Storage();
  }

  getBucketName() {
    const bucket = process.env.GCS_BUCKET_NAME || process.env.GCP_BUCKET_NAME;
    if (!bucket) {
      throw new Error('GCS_BUCKET_NAME is not configured');
    }
    return bucket;
  }

  getUploadPrefix() {
    return (process.env.GCS_UPLOAD_PREFIX || 'voice-agent/uploads').replace(/^\/+|\/+$/g, '');
  }

  getUrlMode() {
    // 'public' or 'signed'
    return (process.env.GCS_URL_MODE || 'signed').toLowerCase();
  }

  getSignedUrlExpiresSeconds() {
    const seconds = parseInt(process.env.GCS_SIGNED_URL_EXPIRES_SECONDS || '3600', 10);
    if (Number.isNaN(seconds) || seconds <= 0) return 3600;
    return seconds;
  }

  _safeFilename(filename) {
    const base = path.basename(filename || 'file');
    return base.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  _contentTypeFromMulter(file) {
    return file?.mimetype || 'application/octet-stream';
  }

  async uploadBuffer({ buffer, destination, contentType }) {
    const bucketName = this.getBucketName();
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(destination);

    await file.save(buffer, {
      resumable: false,
      contentType: contentType || 'application/octet-stream',
      metadata: {
        cacheControl: 'no-cache'
      }
    });

    return file;
  }

  async getFileUrl(file) {
    const mode = this.getUrlMode();

    if (mode === 'gs') {
      return `gs://${file.bucket.name}/${file.name}`;
    }

    if (mode === 'public') {
      // Requires the object (or bucket) to be publicly readable.
      const publicUrl = `https://storage.googleapis.com/${file.bucket.name}/${encodeURIComponent(file.name).replace(/%2F/g, '/')}`;
      return publicUrl;
    }

    if (mode === 'signed') {
      const expiresSeconds = this.getSignedUrlExpiresSeconds();
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresSeconds * 1000
      });
      return url;
    }

    throw new Error(`Unsupported GCS_URL_MODE: ${mode}`);
  }

  async uploadMulterFile({ file, tenantId, userId, kind }) {
    if (!file) {
      throw new Error('File is required');
    }
    if (!file.buffer) {
      throw new Error('File buffer missing (ensure multer memoryStorage is used)');
    }

    const prefix = this.getUploadPrefix();
    const safeName = this._safeFilename(file.originalname);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');

    const destination = `${prefix}/${tenantId || 'unknown'}/${userId || 'unknown'}/${kind || 'file'}/${ts}-${safeName}`;

    logger.info('[GCSUploadService] Uploading file to GCS', {
      bucket: this.getBucketName(),
      destination,
      size: file.size,
      mimetype: file.mimetype
    });

    const gcsFile = await this.uploadBuffer({
      buffer: file.buffer,
      destination,
      contentType: this._contentTypeFromMulter(file)
    });

    const url = await this.getFileUrl(gcsFile);

    return {
      bucket: gcsFile.bucket.name,
      objectName: gcsFile.name,
      url
    };
  }
}

module.exports = GCSUploadService;
