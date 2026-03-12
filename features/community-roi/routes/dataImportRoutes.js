const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const DataImportController = require('../controllers/DataImportController');
const { authenticateToken } = require('../../../core/middleware/auth');

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to /tmp directory
    cb(null, '/tmp');
  },
  filename: (req, file, cb) => {
    // Use original filename with timestamp to avoid conflicts
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const timestamp = Date.now();
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Only accept Excel files
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/octet-stream'
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx?|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only Excel files are accepted.`), false);
    }
  }
});

/**
 * GET /api/community-roi/data-import/options
 * Get available import sheet options
 */
router.get('/options', authenticateToken, DataImportController.getImportOptions);

/**
 * POST /api/community-roi/data-import/extract
 * Extract data from Excel file without importing
 * FormData: { file: File, sheetType?: 'all'|'interactions'|'referrals'|'combination'|'tyfcb' }
 */
router.post('/extract', authenticateToken, upload.single('file'), DataImportController.importData);

/**
 * POST /api/community-roi/data-import/execute
 * Execute SQL import for previously extracted data
 * Body: { sheetTypes?: string[] }
 */
router.post('/execute', authenticateToken, DataImportController.executeSqlImport);

/**
 * GET /api/community-roi/data-import/status
 * Get import status and pending files
 */
router.get('/status', authenticateToken, DataImportController.getImportStatus);

module.exports = router;
