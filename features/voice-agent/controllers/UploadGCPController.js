const multer = require('multer');
const GCSUploadService = require('../services/GCSUploadService');
const gcsLinkStore = require('../services/GCSLinkStore');

let logger;
try {
  logger = require('../../../core/utils/logger');
} catch (e) {
  logger = console;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 2,
    fileSize: parseInt(process.env.GCS_MAX_FILE_SIZE_BYTES || `${25 * 1024 * 1024}`, 10)
  }
});

class UploadGCPController {
  constructor() {
    this.gcsUploadService = new GCSUploadService();
  }

  multerMiddleware() {
    // Expected field names from frontend: 'excel_file' and 'json_file'
    return upload.fields([
      { name: 'excel_file', maxCount: 1 },
      { name: 'json_file', maxCount: 1 }
    ]);
  }

  _pickSingleFile(req, fieldName) {
    const list = req.files?.[fieldName];
    if (!list || !Array.isArray(list) || list.length === 0) return null;
    return list[0];
  }

  _validateExcelFile(file) {
    if (!file) return 'Excel file is required (field: excel_file)';

    const allowed = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]);

    // Some clients send octet-stream for .xlsx; allow extension fallback
    const ext = (file.originalname || '').toLowerCase();
    const hasValidExt = ext.endsWith('.xlsx') || ext.endsWith('.xls');
    if (!allowed.has(file.mimetype) && !hasValidExt) {
      return 'Invalid Excel file type. Expected .xlsx or .xls';
    }

    return null;
  }

  _validateJsonFile(file) {
    if (!file) return 'JSON file is required (field: json_file)';

    const allowed = new Set(['application/json', 'text/json']);
    const ext = (file.originalname || '').toLowerCase();
    const hasValidExt = ext.endsWith('.json');

    if (!allowed.has(file.mimetype) && !hasValidExt) {
      return 'Invalid JSON file type. Expected .json';
    }

    return null;
  }

  async uploadGcp(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.headers['x-tenant-id'] || req.query.tenant_id;
      const userId = req.user?.id || req.user?.userId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID required'
        });
      }

      const excelFile = this._pickSingleFile(req, 'excel_file');
      const jsonFile = this._pickSingleFile(req, 'json_file');

      const excelErr = this._validateExcelFile(excelFile);
      if (excelErr) {
        return res.status(400).json({ success: false, error: excelErr });
      }

      const jsonErr = this._validateJsonFile(jsonFile);
      if (jsonErr) {
        return res.status(400).json({ success: false, error: jsonErr });
      }

      const [excelUpload, jsonUpload] = await Promise.all([
        this.gcsUploadService.uploadMulterFile({
          file: excelFile,
          tenantId,
          userId,
          kind: 'excel'
        }),
        this.gcsUploadService.uploadMulterFile({
          file: jsonFile,
          tenantId,
          userId,
          kind: 'json'
        })
      ]);

      const attachment_link = excelUpload.url;
      const json_link = jsonUpload.url;

      const stored = gcsLinkStore.setLinks({ tenantId, userId, attachment_link, json_link });

      return res.status(200).json({
        success: true,
        attachment_link,
        json_link,
        expires_at: stored.expiresAt
      });

    } catch (error) {
      logger.error('[UploadGCPController] uploadGcp failed', {
        error: error.message,
        stack: error.stack
      });

      // Multer limit errors come as error with code
      if (error?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'File too large'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to upload files to GCS',
        message: error.message
      });
    }
  }
}

module.exports = UploadGCPController;
