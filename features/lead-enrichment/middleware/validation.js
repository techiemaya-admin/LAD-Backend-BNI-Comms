/**
 * Validation Middleware for Lead Enrichment Feature
 */

/**
 * Validate enrichment request
 */
function validateEnrichmentRequest(req, res, next) {
  const { leads, topic } = req.body;

  if (!leads || !Array.isArray(leads)) {
    return res.status(400).json({
      success: false,
      error: 'Leads must be an array'
    });
  }

  if (leads.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Leads array cannot be empty'
    });
  }

  if (leads.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Maximum 100 leads per request'
    });
  }

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Topic is required and must be a string'
    });
  }

  if (topic.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Topic cannot be empty'
    });
  }

  // Validate lead structure
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    
    if (!lead.company && !lead.companyName) {
      return res.status(400).json({
        success: false,
        error: `Lead at index ${i} missing company name`,
        invalidLead: lead
      });
    }

    if (!lead.website && !lead.domain) {
      return res.status(400).json({
        success: false,
        error: `Lead at index ${i} missing website/domain`,
        invalidLead: lead
      });
    }
  }

  next();
}

/**
 * Validate website analysis request
 */
function validateWebsiteAnalysisRequest(req, res, next) {
  const { website, domain, topic } = req.body;

  const url = website || domain;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'Website or domain is required'
    });
  }

  if (typeof url !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Website/domain must be a string'
    });
  }

  // Basic URL validation
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  if (!urlRegex.test(url)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid website/domain format'
    });
  }

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Topic is required and must be a string'
    });
  }

  next();
}

/**
 * Validate batch enrichment request
 */
function validateBatchEnrichmentRequest(req, res, next) {
  const { batches } = req.body;

  if (!batches || !Array.isArray(batches)) {
    return res.status(400).json({
      success: false,
      error: 'Batches must be an array'
    });
  }

  if (batches.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Batches array cannot be empty'
    });
  }

  if (batches.length > 10) {
    return res.status(400).json({
      success: false,
      error: 'Maximum 10 batches per request'
    });
  }

  // Validate each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    if (!batch.leads || !Array.isArray(batch.leads)) {
      return res.status(400).json({
        success: false,
        error: `Batch at index ${i} must have leads array`
      });
    }

    if (batch.leads.length > 100) {
      return res.status(400).json({
        success: false,
        error: `Batch at index ${i} exceeds 100 leads limit`
      });
    }

    if (!batch.topic || typeof batch.topic !== 'string') {
      return res.status(400).json({
        success: false,
        error: `Batch at index ${i} must have topic string`
      });
    }
  }

  next();
}

/**
 * Validate pagination parameters
 */
function validatePagination(req, res, next) {
  const { limit, offset, minScore } = req.query;

  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 100'
      });
    }
  }

  if (offset !== undefined) {
    const offsetNum = parseInt(offset);
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        success: false,
        error: 'Offset must be a non-negative number'
      });
    }
  }

  if (minScore !== undefined) {
    const scoreNum = parseFloat(minScore);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10) {
      return res.status(400).json({
        success: false,
        error: 'Minimum score must be between 0 and 10'
      });
    }
  }

  next();
}

module.exports = {
  validateEnrichmentRequest,
  validateWebsiteAnalysisRequest,
  validateBatchEnrichmentRequest,
  validatePagination
};
