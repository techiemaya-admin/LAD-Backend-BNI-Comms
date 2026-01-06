/**
 * Test script to manually create a Cloud Task for a booking
 */
require('dotenv').config();
const { pool } = require('./shared/database/connection');
const FollowUpSchedulerService = require('./features/deals-pipeline/services/followUpSchedulerService');
const logger = require('./core/utils/logger');

async function testCloudTask() {
  try {
    const scheduler = new FollowUpSchedulerService(pool);
    
    logger.info('Creating Cloud Task for test booking...');
    
    const result = await scheduler.scheduleFollowUpCall({
      tenantId: '926070b5-189b-4682-9279-ea10ca090b84',
      bookingId: '0d3c6efa-3e89-4a51-a580-bf6290d0715a',
      leadId: '8539b41a-d38c-4104-87f4-e8ec3f656cb1',
      assignedUserId: 'fe9d6368-ff1b-4133-952a-525d60d06cbe',
      scheduledAt: '2026-01-06T15:00:00.000+00:00',
      bookingType: 'manual_followup',
      schema: 'lad_dev'
    });
    
    console.log('\n✅ Cloud Task Result:');
    console.log(JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating Cloud Task:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testCloudTask();
