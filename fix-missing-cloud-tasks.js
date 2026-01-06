#!/usr/bin/env node
/**
 * Fix Missing Cloud Tasks
 * 
 * Find all bookings that should have Cloud Tasks but don't
 * Create Cloud Tasks for them automatically
 */

require('dotenv').config();
const { query, pool } = require('./shared/database/connection');
const FollowUpSchedulerService = require('./features/deals-pipeline/services/followUpSchedulerService');
const logger = require('./core/utils/logger');

async function fixMissingCloudTasks() {
  try {
    console.log('🔍 Finding bookings with missing Cloud Tasks...');

    // Find bookings that should have Cloud Tasks but don't
    const sql = `
      SELECT id, tenant_id, lead_id, assigned_user_id, booking_type, scheduled_at, created_at
      FROM lad_dev.lead_bookings 
      WHERE booking_type IN ('auto_followup', 'manual_followup', 'scheduled_followup')
        AND (task_name IS NULL OR task_status = 'pending')
        AND scheduled_at > NOW()
      ORDER BY created_at DESC
    `;

    const result = await query(sql);
    const bookings = result.rows;

    console.log(`Found ${bookings.length} bookings with missing Cloud Tasks`);

    if (bookings.length === 0) {
      console.log('✅ All bookings have Cloud Tasks');
      process.exit(0);
    }

    // Create Cloud Tasks for each booking
    const scheduler = new FollowUpSchedulerService(pool);
    let successCount = 0;
    let errorCount = 0;

    for (const booking of bookings) {
      try {
        console.log(`Creating Cloud Task for booking ${booking.id}...`);
        
        const params = {
          tenantId: booking.tenant_id,
          bookingId: booking.id,
          leadId: booking.lead_id,
          assignedUserId: booking.assigned_user_id,
          scheduledAt: booking.scheduled_at,
          bookingType: booking.booking_type,
          schema: 'lad_dev'
        };

        const taskName = await scheduler.scheduleFollowUpCall(params);
        
        // Update booking with task info
        await query(
          'UPDATE lad_dev.lead_bookings SET task_name = $1, task_status = $2 WHERE id = $3',
          [taskName, 'scheduled', booking.id]
        );

        console.log(`✅ Created Cloud Task for ${booking.id}: ${taskName}`);
        successCount++;

      } catch (error) {
        console.error(`❌ Failed to create Cloud Task for ${booking.id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`✅ Successfully created: ${successCount} Cloud Tasks`);
    console.log(`❌ Failed: ${errorCount} Cloud Tasks`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some Cloud Tasks failed to create. Check logs for details.');
      process.exit(1);
    } else {
      console.log('\n🎉 All missing Cloud Tasks have been created successfully!');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

fixMissingCloudTasks();