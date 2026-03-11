/**
 * Feature-specific middleware for lad-feature-overview
 * Request guards and small validators used by routes/controllers
 */

function validateCallFilters(req, res, next) {
  const { startDate, endDate, status, agentId, userId } = req.query;
  // Basic typing checks
  if (startDate && isNaN(Date.parse(startDate))) {
    return res.status(400).json({ success: false, error: 'Invalid startDate' });
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    return res.status(400).json({ success: false, error: 'Invalid endDate' });
  }
  if (agentId && typeof agentId !== 'string') {
    return res.status(400).json({ success: false, error: 'agentId must be a string' });
  }
  if (userId && typeof userId !== 'string') {
    return res.status(400).json({ success: false, error: 'userId must be a string' });
  }
  if (status && typeof status !== 'string') {
    return res.status(400).json({ success: false, error: 'status must be a string' });
  }
  next();
}

function validateBookingUpdatePayload(req, res, next) {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, error: 'Update payload required' });
  }
  // Allow partial updates; ensure no unexpected fields (light touch)
  const allowed = ['status', 'scheduled_at', 'notes', 'assigned_to'];
  const invalid = Object.keys(updates).filter(k => !allowed.includes(k));
  if (invalid.length) {
    return res.status(400).json({ success: false, error: `Invalid fields: ${invalid.join(', ')}` });
  }
  next();
}

module.exports = {
  validateCallFilters,
  validateBookingUpdatePayload
};
