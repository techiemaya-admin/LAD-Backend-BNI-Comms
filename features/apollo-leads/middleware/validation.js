/**
 * Validation Middleware for Apollo Leads Feature
 */

/**
 * Validate search request
 */
function validateSearchRequest(req, res, next) {
  const { query: searchQuery, filters } = req.body;

  if (!searchQuery && !filters) {
    return res.status(400).json({
      success: false,
      error: 'Search query or filters are required'
    });
  }

  if (searchQuery && typeof searchQuery !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Search query must be a string'
    });
  }

  if (filters && typeof filters !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Filters must be an object'
    });
  }

  // Validate filter structure
  if (filters) {
    const allowedFilters = [
      'location', 'industry', 'employeeCount', 
      'revenue', 'keywords', 'technologies'
    ];

    const invalidFilters = Object.keys(filters).filter(
      key => !allowedFilters.includes(key)
    );

    if (invalidFilters.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid filters: ${invalidFilters.join(', ')}`,
        allowedFilters
      });
    }
  }

  next();
}

/**
 * Validate company ID parameter
 */
function validateCompanyId(req, res, next) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Company ID is required'
    });
  }

  // Apollo IDs are typically strings
  if (typeof id !== 'string' || id.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid company ID format'
    });
  }

  next();
}

/**
 * Validate lead ID parameter
 */
function validateLeadId(req, res, next) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Lead ID is required'
    });
  }

  if (typeof id !== 'string' || id.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid lead ID format'
    });
  }

  next();
}

/**
 * Validate pagination parameters
 */
function validatePagination(req, res, next) {
  const { page, limit, offset } = req.query;

  if (page !== undefined) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Page must be a positive number'
      });
    }
  }

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

  next();
}

/**
 * Validate enrichment request
 */
function validateEnrichmentRequest(req, res, next) {
  const { domain, companyName } = req.body;

  if (!domain && !companyName) {
    return res.status(400).json({
      success: false,
      error: 'Either domain or company name is required'
    });
  }

  if (domain && typeof domain !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Domain must be a string'
    });
  }

  if (companyName && typeof companyName !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Company name must be a string'
    });
  }

  // Basic domain validation
  if (domain) {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid domain format'
      });
    }
  }

  next();
}

module.exports = {
  validateSearchRequest,
  validateCompanyId,
  validateLeadId,
  validatePagination,
  validateEnrichmentRequest
};
