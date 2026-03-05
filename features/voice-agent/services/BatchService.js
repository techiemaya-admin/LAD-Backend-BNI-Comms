const BatchRepository = require('../repositories/BatchRepository');
let logger;
try {
  logger = require('../../../core/utils/logger');
} catch (e) {
  logger = console;
}

class BatchService {
  constructor(pool) {
    this.batchRepository = new BatchRepository(pool);
  }

  /**
   * Get all batches for a tenant ordered by updated_at DESC with pagination
   */
  async getBatchesView(tenantId, schema, limit = 50, offset = 0) {
    try {
      const batches = await this.batchRepository.getBatchesByTenant(tenantId, schema, limit, offset);
      const total = await this.batchRepository.getBatchesCountByTenant(tenantId, schema);

      return {
        success: true,
        data: batches,
        total
      };
    } catch (error) {
      logger.error('[BatchService] getBatchesView failed', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get batch details with call logs for a specific batch_id with pagination
   */
  async getBatchById(batchId, tenantId, schema, limit = 50, offset = 0) {
    try {
      // Get total count of entries for this batch
      const total = await this.batchRepository.getCallLogIdsCountByBatchId(batchId, tenantId, schema);

      // Get call_log_ids from batch entries with pagination
      const callLogIds = await this.batchRepository.getCallLogIdsByBatchId(batchId, tenantId, schema, limit, offset);

      if (callLogIds.length === 0 && total === 0) {
        return {
          success: false,
          error: 'No entries found for this batch'
        };
      }

      // Get call logs for these call_log_ids
      const callLogs = await this.batchRepository.getCallLogsByIds(callLogIds, tenantId, schema);

      return {
        success: true,
        data: {
          batch_id: batchId,
          call_logs: callLogs,
          total
        }
      };

    } catch (error) {
      logger.error('[BatchService] getBatchById failed', {
        error: error.message,
        batchId,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get batch statistics for a tenant
   */
  async getBatchStats(tenantId, schema) {
    try {
      const stats = await this.batchRepository.getBatchStats(tenantId, schema);

      // Calculate total batches
      const total = stats.reduce((sum, item) => sum + parseInt(item.count, 10), 0);

      return {
        success: true,
        data: {
          batches_by_status: stats,
          total_batches: total
        }
      };
    } catch (error) {
      logger.error('[BatchService] getBatchStats failed', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }
}

module.exports = BatchService;
