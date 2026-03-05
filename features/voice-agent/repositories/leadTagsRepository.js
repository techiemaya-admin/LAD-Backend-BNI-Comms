const { sanitizeSchema } = require('../../../core/utils/schemaHelper');

class LeadTagsRepository {
  constructor(db) {
    this.pool = db;
  }

  async getLeadIdByCallId({ schema, tenantId, callId }) {
    const safeSchema = sanitizeSchema(schema);
    const query = `
      SELECT lead_id
      FROM ${safeSchema}.voice_call_logs
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.pool.query(query, [callId, tenantId]);
    return result.rows[0]?.lead_id || null;
  }

  async replaceLeadTags({ schema, tenantId, leadId, tags }) {
    const safeSchema = sanitizeSchema(schema);
    const query = `
      UPDATE ${safeSchema}.leads
      SET tags = $1::jsonb,
          updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING id, tenant_id, tags, updated_at
    `;

    const values = [JSON.stringify(tags), leadId, tenantId];
    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }
}

module.exports = LeadTagsRepository;
