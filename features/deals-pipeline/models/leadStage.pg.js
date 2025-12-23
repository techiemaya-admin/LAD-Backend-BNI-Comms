// PostgreSQL Lead Stages Model
const { query: poolQuery } = require('../../../shared/database/connection');


async function getAllLeadStages(tenantId) {
  let query = `
    SELECT key, label, display_order
    FROM lad_dev.lead_stages
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

async function createLeadStage(stageData) {
  const {
    key,
    label,
    description = null,
    color = null,
    tenant_id = null,
    displayOrder = null
  } = stageData;

  console.log('[createLeadStage] Input:', { key, label, tenant_id, displayOrder });

  let effectiveOrder = displayOrder;

  // If no display order provided, get the next available order for this tenant
  if (effectiveOrder === null || effectiveOrder === undefined) {
    const maxOrderResult = await poolQuery(
      `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
       FROM lad_dev.lead_stages
       WHERE tenant_id = $1 OR tenant_id IS NULL`,
      [tenant_id]
    );
    effectiveOrder = maxOrderResult.rows[0].next_order;
    console.log('[createLeadStage] Auto-calculated order:', effectiveOrder);
  } else {
    console.log('[createLeadStage] Shifting existing stages >= order:', effectiveOrder);

    // First, show current state before shifting
    const beforeShift = await poolQuery(
      `SELECT key, label, display_order
       FROM lad_dev.lead_stages
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY display_order ASC`,
      [tenant_id]
    );
    console.log('[createLeadStage] BEFORE shifting - Current stages:', beforeShift.rows);

    // Shift existing stages if inserting at specific position
    const updateResult = await poolQuery(
      `UPDATE lad_dev.lead_stages
       SET display_order = display_order + 1
       WHERE (tenant_id = $1 OR tenant_id IS NULL)
         AND display_order >= $2`,
      [tenant_id, effectiveOrder]
    );
    console.log('[createLeadStage] Shifted', updateResult.rowCount, 'stages');

    // Show state after shifting
    const afterShift = await poolQuery(
      `SELECT key, label, display_order
       FROM lad_dev.lead_stages
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY display_order ASC`,
      [tenant_id]
    );
    console.log('[createLeadStage] AFTER shifting - Updated stages:', afterShift.rows);
  }

  const query = `
    INSERT INTO lad_dev.lead_stages (tenant_id, key, label, description, color, display_order)
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

  console.log('[createLeadStage] About to execute INSERT query:', query.trim());
  console.log('[createLeadStage] With values:', values);

  try {
    const result = await poolQuery(query, values);
    const newStage = result.rows[0];

    console.log('[createLeadStage] New stage created:', newStage);

    // Show final state after insertion
    const finalState = await poolQuery(
      `SELECT key, label, display_order
       FROM lad_dev.lead_stages
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY display_order ASC`,
      [tenant_id]
    );
    console.log('[createLeadStage] FINAL state - All stages ordered:', finalState.rows);

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

async function updateLeadStage(key, updates) {
  const { label, displayOrder } = updates;
  
  // Handle reordering if display_order is being updated
  if (displayOrder !== undefined) {
    // Get current stage info
    const currentStage = await poolQuery(
      'SELECT display_order FROM lad_dev.lead_stages WHERE key = $1',
      [key]
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
          'UPDATE lad_dev.lead_stages SET display_order = display_order - 1 WHERE display_order > $1 AND display_order <= $2 AND key != $3',
          [currentOrder, displayOrder, key]
        );
      } else {
        // Moving up - shift stages down
        await poolQuery(
          'UPDATE lad_dev.lead_stages SET display_order = display_order + 1 WHERE display_order >= $1 AND display_order < $2 AND key != $3',
          [displayOrder, currentOrder, key]
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
  
  const result = await poolQuery(
    `UPDATE lad_dev.lead_stages SET ${updateFields.join(', ')} WHERE key = $${paramCount} RETURNING *`,
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

async function deleteLeadStage(key) {
  // Get the stage being deleted
  const stageResult = await poolQuery(
    'SELECT display_order FROM lad_dev.lead_stages WHERE key = $1',
    [key]
  );
  
  if (stageResult.rows.length === 0) {
    throw new Error('Stage not found');
  }
  
  const deletedOrder = stageResult.rows[0].display_order;
  
  // Delete the stage
  await poolQuery('DELETE FROM lad_dev.lead_stages WHERE key = $1', [key]);
  
  // Shift remaining stages up
  await poolQuery(
    'UPDATE lad_dev.lead_stages SET display_order = display_order - 1 WHERE display_order > $1',
    [deletedOrder]
  );
  
  return true;
}

// New function to reorder stages
async function reorderStages(stageOrders) {
  // stageOrders is an array of {key, order} objects
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const { key, order } of stageOrders) {
      await client.query(
        'UPDATE lad_dev.lead_stages SET display_order = $1 WHERE key = $2',
        [order, key]
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
  createLeadStage,
  updateLeadStage,
  deleteLeadStage,
  reorderStages,
};
