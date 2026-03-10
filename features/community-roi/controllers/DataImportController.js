const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * DataImportController - Handles bulk data imports from Excel sheets
 * Supports: Interactions, Referrals, Combination Matrix, TYFCB Report
 */

class DataImportController {
  /**
   * Get available import sheet options
   */
  static async getImportOptions(req, res) {
    try {
      const options = [
        {
          id: 'interactions',
          label: 'One-to-One Matrix',
          description: 'Import meeting interactions between members',
          targetTable: 'community_roi_interactions',
          icon: '👥'
        },
        {
          id: 'referrals',
          label: 'Referral Matrix',
          description: 'Import referral relationships',
          targetTable: 'community_roi_referrals',
          icon: '🔗'
        },
        {
          id: 'combination',
          label: 'Combination Matrix',
          description: 'Import combined metrics (M/R/MR)',
          targetTable: 'community_roi_relationship_scores',
          icon: '📊'
        },
        {
          id: 'tyfcb',
          label: 'TYFCB Report',
          description: 'Import contribution scores and statistics',
          targetTable: 'community_roi_contribution_scores',
          icon: '🏆'
        }
      ];

      return res.json({
        success: true,
        message: 'Available import options',
        data: options
      });
    } catch (error) {
      console.error('Error getting import options:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get import options'
      });
    }
  }

  /**
   * Import data from Excel file (extract)
   * Expects: FormData with file and sheetType
   */
  static async importData(req, res) {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const sheetType = req.body.sheetType || 'all';
      const excelFilePath = req.file.path;

      // Validate sheet type
      const validSheetTypes = ['all', 'interactions', 'referrals', 'combination', 'tyfcb'];
      if (!validSheetTypes.includes(sheetType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid sheet type. Must be one of: ${validSheetTypes.join(', ')}`
        });
      }

      console.log(`Extracting ${sheetType} from ${excelFilePath}`);
      
      const extractScriptPath = path.join(__dirname, '../scripts/extract_all_sheets.py');
      const cmd = `python3 "${extractScriptPath}" "${excelFilePath}" "${sheetType}"`;
      
      try {
        execSync(cmd, { timeout: 30000 });
      } catch (error) {
        console.error('Extraction error:', error.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to extract data from Excel',
          details: error.message
        });
      }

      // Read import summary
      const summaryPath = '/tmp/import_summary.json';
      let summary = {};
      
      if (fs.existsSync(summaryPath)) {
        try {
          summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        } catch (e) {
          console.error('Error reading summary:', e);
        }
      }

      // Prepare SQL files for import
      const sqlFiles = [];
      const fileMap = {
        'interactions': '/tmp/import_interactions.sql',
        'referrals': '/tmp/import_referrals.sql',
        'combination': '/tmp/import_combination.sql',
        'tyfcb': '/tmp/import_tyfcb.sql'
      };

      // Check which files were generated
      for (const [type, filepath] of Object.entries(fileMap)) {
        if (fs.existsSync(filepath)) {
          sqlFiles.push({
            type,
            path: filepath,
            name: `import_${type}.sql`
          });
        }
      }

      return res.json({
        success: true,
        message: 'Data extraction completed successfully',
        data: {
          sheetType,
          generatedFiles: sqlFiles,
          recordCounts: summary.data_counts || {},
          nextStep: 'Execute SQL import or call /api/community-roi/data-import/execute'
        }
      });
    } catch (error) {
      console.error('Error in importData:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process import',
        details: error.message
      });
    }
  }

  /**
   * Execute SQL import (apply extracted data to database)
   */
  static async executeSqlImport(req, res) {
    try {
      const { sheetTypes = ['all'] } = req.body;

      const shellTypes = Array.isArray(sheetTypes) ? sheetTypes : [sheetTypes];
      const dbCredentials = {
        host: process.env.DB_HOST || '165.22.221.77',
        user: process.env.DB_USER || 'dbadmin',
        password: process.env.DB_PASSWORD || 'TechieMaya',
        database: process.env.DB_NAME || 'salesmaya_agent'
      };

      const fileMap = {
        'interactions': '/tmp/import_interactions.sql',
        'referrals': '/tmp/import_referrals.sql',
        'combination': '/tmp/import_combination.sql',
        'tyfcb': '/tmp/import_tyfcb.sql'
      };

      const results = {};
      const errors = [];

      for (const sheetType of shellTypes) {
        const sqlFile = fileMap[sheetType];
        
        if (!sqlFile) {
          errors.push(`Unknown sheet type: ${sheetType}`);
          continue;
        }

        if (!fs.existsSync(sqlFile)) {
          errors.push(`SQL file not found for ${sheetType}`);
          continue;
        }

        try {
          console.log(`Executing import for ${sheetType}...`);
          
          // Execute SQL file
          const psqlCmd = `PGPASSWORD='${dbCredentials.password}' psql -h ${dbCredentials.host} -U ${dbCredentials.user} -d ${dbCredentials.database} -f ${sqlFile}`;
          
          const output = execSync(psqlCmd, { 
            timeout: 60000,
            encoding: 'utf8'
          });

          results[sheetType] = {
            success: true,
            message: 'Import completed',
            output: output.split('\n').filter(l => l.trim()).slice(-3)
          };
        } catch (error) {
          errors.push(`${sheetType}: ${error.message.split('\n')[0]}`);
          results[sheetType] = {
            success: false,
            error: error.message
          };
        }
      }

      // Determine response status
      const allSuccess = Object.values(results).every(r => r.success);
      const statusCode = allSuccess ? 200 : 207;

      return res.status(statusCode).json({
        success: allSuccess,
        message: allSuccess ? 'All imports completed successfully' : 'Some imports failed',
        data: results,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('SQL execution error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to execute SQL imports',
        details: error.message
      });
    }
  }

  /**
   * Get import history / status
   */
  static async getImportStatus(req, res) {
    try {
      const status = {
        lastExtractionTime: null,
        generatedFiles: [],
        pendingImports: [],
        lastImportTime: null
      };

      // Check for generated SQL files
      const fileMap = {
        'interactions': '/tmp/import_interactions.sql',
        'referrals': '/tmp/import_referrals.sql',
        'combination': '/tmp/import_combination.sql',
        'tyfcb': '/tmp/import_tyfcb.sql'
      };

      for (const [type, filepath] of Object.entries(fileMap)) {
        if (fs.existsSync(filepath)) {
          const stats = fs.statSync(filepath);
          status.generatedFiles.push({
            type,
            path: filepath,
            size: stats.size,
            createdAt: stats.mtime
          });
          status.pendingImports.push(type);
        }
      }

      return res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Status check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get import status'
      });
    }
  }
}

module.exports = DataImportController;
