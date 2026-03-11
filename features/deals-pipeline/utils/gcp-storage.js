/**
 * GCP Storage Utility
 * Handles file uploads and downloads to Google Cloud Storage
 * Falls back to local storage if GCP is not configured
 */

const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Use core utils in LAD architecture
const logger = require('../../../core/utils/logger');

// Check if GCP is configured
const USE_GCP = process.env.GCP_BUCKET_NAME && process.env.GCP_PROJECT_ID;

let storage, bucket, BUCKET_NAME;

if (USE_GCP) {
  // Initialize GCP Storage client
  storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID
  });
  BUCKET_NAME = process.env.GCP_BUCKET_NAME;
  bucket = storage.bucket(BUCKET_NAME);
  logger.info('Using GCP Storage', { bucket: BUCKET_NAME });
} else {
  logger.warn('GCP Storage is not configured; attachment uploads require GCS', {
    hasBucketName: !!process.env.GCP_BUCKET_NAME,
    hasProjectId: !!process.env.GCP_PROJECT_ID
  });
}

const ensureGcpConfigured = () => {
  if (!USE_GCP) {
    const error = new Error('GCP Storage is not configured. Set GCP_BUCKET_NAME and GCP_PROJECT_ID to enable attachments upload.');
    error.code = 'GCP_STORAGE_NOT_CONFIGURED';
    throw error;
  }
};

/**
 * Upload a file to GCS
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} filename - Name of the file in GCS
 * @param {string} mimetype - MIME type of the file
 * @param {object} metadata - Additional metadata
 * @returns {Promise<string>} Public URL or signed URL of the uploaded file
 */
exports.uploadFile = async (fileBuffer, filename, mimetype, metadata = {}) => {
  try {
    ensureGcpConfigured();

    // Upload to GCP
    const blob = bucket.file(filename);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: mimetype,
        metadata: metadata
      }
    });

    return new Promise((resolve, reject) => {
      blobStream.on('error', (err) => {
        logger.error('GCS upload error', err, { filename });
        reject(err);
      });

      blobStream.on('finish', async () => {
        const gcsUri = `gs://${BUCKET_NAME}/${filename}`;
        logger.info('File uploaded to GCS', { filename, gcsUri });
        resolve(gcsUri);
      });

      blobStream.end(fileBuffer);
    });
  } catch (error) {
    logger.error('Error uploading file', error, { filename });
    throw error;
  }
};

/**
 * Generate a signed URL for reading a file
 * @param {string} filename - Name of the file in GCS
 * @param {number} expiresInMinutes - URL expiration time in minutes (default: 60)
 * @returns {Promise<string>} Signed URL
 */
exports.getSignedUrl = async (filename, expiresInMinutes = 60) => {
  try {
    ensureGcpConfigured();

    const file = bucket.file(filename);
    
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000
    });

    return url;
  } catch (error) {
    logger.error('Error generating signed URL', error, { filename });
    throw error;
  }
};

/**
 * Delete a file from GCS
 * @param {string} filename - Name of the file in GCS
 * @returns {Promise<void>}
 */
exports.deleteFile = async (filename) => {
  try {
    ensureGcpConfigured();

    await bucket.file(filename).delete();
    logger.info('File deleted from GCS', { filename });
  } catch (error) {
    logger.error('Error deleting file', error, { filename });
    throw error;
  }
};

/**
 * Extract filename from GCS URI
 * @param {string} fileUrl - GCS URI (gs://bucket/path)
 * @returns {string} Filename
 */
exports.extractFilename = (fileUrl) => {
  if (!fileUrl) return fileUrl;
  
  if (fileUrl.startsWith('gs://')) {
    // GCS URI: gs://bucket/path/to/file.ext
    const parts = fileUrl.split('/');
    return parts.slice(3).join('/'); // Remove gs://bucket/
  }
  
  return fileUrl;
};

/**
 * Check if file exists in GCS
 * @param {string} filename - Name of the file in GCS
 * @returns {Promise<boolean>}
 */
exports.fileExists = async (filename) => {
  try {
    ensureGcpConfigured();

    const [exists] = await bucket.file(filename).exists();
    return exists;
  } catch (error) {
    logger.error('Error checking file existence', error, { filename });
    return false;
  }
};
