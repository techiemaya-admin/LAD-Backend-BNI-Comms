function validateUpdateLeadTagsRequest(req) {
  const callId = req?.params?.call_id;
  const tags = req?.body?.tags;

  if (!callId || typeof callId !== 'string') {
    const err = new Error('call_id is required');
    err.status = 400;
    throw err;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(callId)) {
    const err = new Error('call_id must be a valid UUID');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(tags)) {
    const err = new Error('tags must be an array');
    err.status = 400;
    throw err;
  }

  for (const t of tags) {
    if (typeof t !== 'string' || !t.trim()) {
      const err = new Error('tags must be an array of non-empty strings');
      err.status = 400;
      throw err;
    }
  }

  return { callId, tags: tags.map((t) => t.trim()) };
}

module.exports = {
  validateUpdateLeadTagsRequest
};
