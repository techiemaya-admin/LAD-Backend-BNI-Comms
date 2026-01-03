/**
 * Settings Controller - Deals Pipeline Feature
 * 
 * Handles pipeline-specific user preferences and settings
 * Includes view modes, filters, sorting, column visibility, etc.
 */

const logger = require('../../../core/utils/logger');

/**
 * GET /api/deal-pipeline/settings
 * Get pipeline preferences for the current user
 */
exports.getSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    
    logger.info('[Pipeline Settings] Getting settings', { userId, tenantId });
    
    // TODO: Implement database storage for pipeline preferences
    // For now, return default settings in the format expected by frontend
    const defaultSettings = {
      viewMode: 'kanban',
      visibleColumns: {
        name: true,
        email: true,
        phone: true,
        status: true,
        priority: true,
        source: true,
        assignedTo: true,
        createdAt: true,
        updatedAt: false
      },
      filters: {
        statuses: [],
        priorities: [],
        sources: [],
        assignees: [],
        dateRange: { start: null, end: null }
      },
      sortConfig: {
        field: 'created_at',
        direction: 'desc'
      },
      uiSettings: {
        zoom: 1.0,
        autoRefresh: false,
        refreshInterval: 30,
        compactView: false,
        showCardCount: true,
        showStageValue: true,
        enableDragAndDrop: true
      }
    };
    
    res.json({
      success: true,
      settings: defaultSettings
    });
  } catch (error) {
    logger.error('[Pipeline Settings] Error getting settings', { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?.id 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pipeline settings'
    });
  }
};

/**
 * PUT /api/deal-pipeline/settings
 * Update pipeline preferences for the current user
 */
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    const settings = req.body;
    
    logger.info('[Pipeline Settings] Updating settings', { 
      userId, 
      tenantId, 
      settingsKeys: Object.keys(settings) 
    });
    
    // TODO: Implement database storage for pipeline preferences
    // For now, just return the settings back to indicate success
    
    res.json({
      success: true,
      settings,
      message: 'Pipeline settings updated successfully'
    });
  } catch (error) {
    logger.error('[Pipeline Settings] Error updating settings', { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?.id 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update pipeline settings'
    });
  }
};