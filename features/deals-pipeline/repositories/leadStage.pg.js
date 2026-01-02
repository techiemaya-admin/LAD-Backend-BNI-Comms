// PostgreSQL Lead Stages Repository
const { query: poolQuery } = require('../../../shared/database/connection');

// Try core paths first, fallback to local shared
let DEFAULT_SCHEMA, logger;
try {
  ({ DEFAULT_SCHEMA } = require('../../../../core/utils/schemaHelper'));
  logger = require('../../../../core/utils/logger');
} catch (e) {
  ({ DEFAULT_SCHEMA } = require('../../../shared/utils/schemaHelper'));
  logger = require('../../../shared/utils/logger');
}

async function getAllLeadStages(tenantId, schema = DEFAULT_SCHEMA) {
  let query = `
    SELECT key, label, display_order
    FROM ${schema}.lead_stages
  `;
  const params = [];

  if (tenantId) {
    query += `
      WHERE tenant_id = $1
         OR tenant_id IS NULL
    `;
    params.push(tenantId);
  }

  query += ' ORDER BY display_order ASC, key ASC';

  const result = await poolQuery(query, params);

  return result.rows.map(row => ({
    key: row.key,
    label: row.label,
    display_order: row.display_order,
    id: row.key,
    name: row.label,
    order: row.display_order ?? 0
  }));
}

async function getLeadStageByKey(key, tenantId, schema = DEFAULT_SCHEMA) {
  const query = `
    SELECT key, label, display_order, color, description
    FROM ${schema}.lead_stages
    WHERE key = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
  `;
  const result = await poolQuery(query, [key, tenantId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    key: row.key,
    label: row.label,
    display_order: row.display_order,
    color: row.color,
    description: row.description,
    id: row.key,
    name: row.label,
    order: row.display_order ?? 0
  };
}

async function createLeadStage(stageData, schema = DEFAULT_SCHEMA) {
  const {
    key,
    label,
    description = null,
    color = null,
    tenant_id = null,
    displayOrder = null
  } = stageData;

  logger.debug('createLeadStage - Input', { key, label, tenant_id, displayOrder });

  let effectiveOrder = displayOrder;

  // If no display order provided, get the next available order for this tenant
  if (effectiveOrder === null || effectiveOrder === undefined) {
    const maxOrderResult = await poolQuery(
      `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
       FROM ${schema}.lead_stages
       WHERE tenant_id = $1 OR tenant_id IS NULL`,
      [tenant_id]
    );
    effectiveOrder = maxOrderResult.rows[0].next_order;
    logger.debug('createLeadStage - Auto-calculated order', { effectiveOrder });
  } else {
    logger.debug('createLeadStage - Shifting existing stages', { effectiveOrder });

    // First, show current state before shifting
    const beforeShift = await poolQuery(
      `SELECT key, label, display_order
       FROM ${schema}.lead_stages
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY display_order ASC`,
      [tenant_id]
    );
    logger.debug('createLeadStage - BEFORE shifting', { stages: beforeShift.rows });

    // Shift existing stages if inserting at specific position
    const updateResult = await poolQuery(
      `UPDATE ${schema}.lead_stages
       SET display_order = display_order + 1
       WHERE (tenant_id = $1 OR tenant_id IS NULL)
         AND display_order >= $2`,
      [tenant_id, effectiveOrder]
    );
    logger.debug('createLeadStage - Shifted stages', { shiftedCount: updateResult.rowCount });

    // Show state after shifting
    const afterShift = await poolQuery(
      `SELECT key, label, display_order
       FROM ${schema}.lead_stages
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY display_order ASC`,
      [tenant_id]
    );
    logger.debug('createLeadStage - AFTER shifting', { stages: afterShift.rows });
  }

  const query = `
    INSERT INTO ${schema}.lead_stages (tenant_id, key, label, description, color, display_order)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const values = [
    tenant_id,
    key,
    label,
    description,
    color,
    effectiveOrder
  ];

  logger.debug('createLeadStage - Executing INSERT', { query: query.trim(), values });

  try {
    const result = await poolQuery(query, values);
    const newStage = result.rows[0];

    logger.debug('createLeadStage - Stage created', { newStage });

    // Show final state after insertion
    const finalState = await poolQuery(
      `SELECT key, label, display_order
       FROM ${schema}.lead_stages
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY display_order ASC`,
      [tenant_id]
    );
    logger.debug('createLeadStage - FINAL state', { stages: finalState.rows });

    // Return with consistent properties
    return {
      ...newStage,
      id: newStage.key,
      name: newStage.label,
      order: newStage.display_order || 0
    };
  } catch (insertError) {
    console.error('[createLeadStage] INSERT ERROR:', insertError.message);
    console.error('[createLeadStage] INSERT ERROR detail:', insertError.detail);
    console.error('[createLeadStage] INSERT ERROR code:', insertError.code);
    throw insertError;
  }
}

async function updateLeadStage(key, tenantId, updates, schema = DEFAULT_SCHEMA) {
  const { label, displayOrder } = updates;
  
  // Handle reordering if display_order is being updated
  if (displayOrder !== undefined) {
    // Get current stage info
    const currentStage = await poolQuery(
      `SELECT display_order FROM ${schema}.lead_stages WHERE key = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
      [key, tenantId]
    );
    
    if (currentStage.result.rows.length === 0) {
      throw new Error('Stage not found');
    }
    
    const currentOrder = currentStage.rows[0].display_order;
    
    if (currentOrder !== displayOrder) {
      // Reorder other stages
      if (displayOrder > currentOrder) {
        // Moving down - shift stages up
        await poolQuery(
          `UPDATE ${schema}.lead_stages SET display_order = display_order - 1 WHERE display_order > $1 AND display_order <= $2 AND key != $3 AND (tenant_id = $4 OR tenant_id IS NULL)`,
          [currentOrder, displayOrder, key, tenantId]
        );
      } else {
        // Moving up - shift stages down
        await poolQuery(
          `UPDATE ${schema}.lead_stages SET display_order = display_order + 1 WHERE display_order >= $1 AND display_order < $2 AND key != $3 AND (tenant_id = $4 OR tenant_id IS NULL)`,
          [displayOrder, currentOrder, key, tenantId]
        );
      }
    }
  }
  
  // Build update query dynamically
  const updateFields = [];
  const updateValues = [];
  let paramCount = 1;
  
  if (label !== undefined) {
    updateFields.push(`label = $${paramCount++}`);
    updateValues.push(label);
  }
  
  if (displayOrder !== undefined) {
    updateFields.push(`display_order = $${paramCount++}`);
    updateValues.push(displayOrder);
  }
  
  if (updateFields.length === 0) {
    throw new Error('No fields to update');
  }
  
  updateValues.push(key); // for WHERE clause
  updateValues.push(tenantId); // for tenant filtering
  
  const result = await poolQuery(
    `UPDATE ${schema}.lead_stages SET ${updateFields.join(', ')} WHERE key = $${paramCount} AND (tenant_id = $${paramCount + 1} OR tenant_id IS NULL) RETURNING *`,
    updateValues
  );
  
  if (result.rows.length === 0) {
    throw new Error('Stage not found');
  }
  
  const updatedStage = rows[0];
  return {
    ...updatedStage,
    id: updatedStage.key,
    name: updatedStage.label,
    order: updatedStage.display_order || 0
  };
}

async function deleteLeadStage(key, tenantId, schema = DEFAULT_SCHEMA) {
  // Get the stage being deleted
  const stageResult = await poolQuery(
    `SELECT display_order FROM ${schema}.lead_stages WHERE key = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
    [key, tenantId]
  );
  
  if (stageResult.rows.length === 0) {
    throw new Error('Stage not found');
  }
  
  const deletedOrder = stageResult.rows[0].display_order;
  
  // Delete the stage
  await poolQuery(`DELETE FROM ${schema}.lead_stages WHERE key = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`, [key, tenantId]);
  
  // Shift remaining stages up
  await poolQuery(
    `UPDATE ${schema}.lead_stages SET display_order = display_order - 1 WHERE display_order > $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
    [deletedOrder, tenantId]
  );
  
  return true;
}

// New function to reorder stages
async function reorderStages(stageOrders, tenantId, schema = DEFAULT_SCHEMA) {
  // stageOrders is an array of {key, order} objects
  const db = require('../../../shared/database/connection');
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const { key, order } of stageOrders) {
      await client.query(
        `UPDATE ${schema}.lead_stages SET display_order = $1 WHERE key = $2 AND (tenant_id = $3 OR tenant_id IS NULL)`,
        [order, key, tenantId]
      );
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getAllLeadStages,
  getLeadStageByKey,
  createLeadStage,
  updateLeadStage,
  deleteLeadStage,
  reorderStages,
};
