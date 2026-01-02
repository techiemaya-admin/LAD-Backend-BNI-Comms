/**
 * GCP Storage Utility
 * Handles file uploads and downloads to Google Cloud Storage
 * Falls back to local storage if GCP is not configured
 */

const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');

// Try core paths first, fallback to local shared
let logger;
try {
  logger = require('../../../../core/utils/logger');
} catch (e) {
  logger = require('../../../shared/utils/logger');
}

// Check if GCP is configured
const USE_GCP = process.env.GCP_BUCKET_NAME && process.env.GCP_PROJECT_ID;
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../../uploads/attachments');

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
  // Ensure local directory exists
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  logger.info('Using local file storage (GCP not configured)', { path: LOCAL_UPLOAD_DIR });
}

/**
 * Upload a file to GCS or local storage
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} filename - Name of the file in GCS
 * @param {string} mimetype - MIME type of the file
 * @param {object} metadata - Additional metadata
 * @returns {Promise<string>} Public URL or signed URL of the uploaded file
 */
exports.uploadFile = async (fileBuffer, filename, mimetype, metadata = {}) => {
  try {
    if (USE_GCP) {
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
    } else {
      // Upload to local storage
      const localPath = path.join(LOCAL_UPLOAD_DIR, filename);
      const dir = path.dirname(localPath);
      
      // Create directory if it doesn't exist
      fs.mkdirSync(dir, { recursive: true });
      
      // Write file
      fs.writeFileSync(localPath, fileBuffer);
      
      // Return local file URL
      const fileUrl = `/uploads/attachments/${filename}`;
      logger.info('File uploaded locally', { filename, path: localPath });
      return fileUrl;
    }
  } catch (error) {
    logger.error('Error uploading file', error, { filename });
    throw error;
  }
};

/**
 * Generate a signed URL for reading a file (or return local URL)
 * @param {string} filename - Name of the file in GCS
 * @param {number} expiresInMinutes - URL expiration time in minutes (default: 60)
 * @returns {Promise<string>} Signed URL or local URL
 */
exports.getSignedUrl = async (filename, expiresInMinutes = 60) => {
  try {
    if (USE_GCP) {
      const file = bucket.file(filename);
      
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000
      });

      return url;
    } else {
      // For local files, return the direct URL
      // Extract filename if it's a local path
      const localFilename = filename.startsWith('/uploads/') ? filename.split('/uploads/attachments/')[1] : filename;
      return `http://localhost:${process.env.PORT || 3004}/uploads/attachments/${localFilename}`;
    }
  } catch (error) {
    logger.error('Error generating signed URL', error, { filename });
    throw error;
  }
};

/**
 * Delete a file from GCS or local storage
 * @param {string} filename - Name of the file in GCS
 * @returns {Promise<void>}
 */
exports.deleteFile = async (filename) => {
  try {
    if (USE_GCP) {
      await bucket.file(filename).delete();
      logger.info('File deleted from GCS', { filename });
    } else {
      const localPath = path.join(LOCAL_UPLOAD_DIR, filename);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        logger.info('File deleted locally', { filename, path: localPath });
      }
    }
  } catch (error) {
    logger.error('Error deleting file', error, { filename });
    throw error;
  }
};

/**
 * Extract filename from GCS URI or local path
 * @param {string} fileUrl - GCS URI (gs://bucket/path) or local URL
 * @returns {string} Filename
 */
exports.extractFilename = (fileUrl) => {
  if (!fileUrl) return fileUrl;
  
  if (fileUrl.startsWith('gs://')) {
    // GCS URI: gs://bucket/path/to/file.ext
    const parts = fileUrl.split('/');
    return parts.slice(3).join('/'); // Remove gs://bucket/
  } else if (fileUrl.startsWith('/uploads/')) {
    // Local path: /uploads/attachments/path/to/file.ext
    return fileUrl.split('/uploads/attachments/')[1] || fileUrl;
  }
  
  return fileUrl;
};

/**
 * Check if file exists in GCS or local storage
 * @param {string} filename - Name of the file in GCS
 * @returns {Promise<boolean>}
 */
exports.fileExists = async (filename) => {
  try {
    if (USE_GCP) {
      const [exists] = await bucket.file(filename).exists();
      return exists;
    } else {
      const localPath = path.join(LOCAL_UPLOAD_DIR, filename);
      return fs.existsSync(localPath);
    }
  } catch (error) {
    logger.error('Error checking file existence', error, { filename });
    return false;
  }
};
