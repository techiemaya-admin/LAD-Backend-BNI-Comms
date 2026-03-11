/**
 * Validation middleware for lad-feature-overview
 * Common request validators (pagination, UUIDs, payloads)
 */

function validateUuidParam(paramName = 'id') {
  return (req, res, next) => {
    const uuid = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid || !uuidRegex.test(uuid)) {
      return res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format`
      });
    }
    next();
  };
}

function validatePagination(req, res, next) {
  const { limit, offset, page } = req.query;
  if (limit !== undefined) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      return res.status(400).json({ success: false, error: 'Limit must be between 1 and 1000' });
    }
  }
  if (offset !== undefined) {
    const offsetNum = parseInt(offset, 10);
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({ success: false, error: 'Offset must be a non-negative number' });
    }
  }
  if (page !== undefined) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ success: false, error: 'Page must be a positive integer' });
    }
  }
  next();
}

function validateBookingPayload(req, res, next) {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ success: false, error: 'Request body is required' });
  }
  // Minimal checks - more detailed validation belongs in DTOs/services
  if (!payload.lead_id && !payload.leadId) {
    return res.status(400).json({ success: false, error: 'lead_id is required' });
  }
  next();
}

module.exports = {
  validateUuidParam,
  validatePagination,
  validateBookingPayload
};
