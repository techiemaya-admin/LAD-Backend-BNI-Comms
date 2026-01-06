require('dotenv').config();
const { query } = require('./shared/database/connection');

const bookingId = process.argv[2] || '6493bef8-4d2a-4696-9f6f-816e23a1ef8c';

console.log('Checking booking:', bookingId);

query('SELECT * FROM lad_dev.lead_bookings WHERE id = $1', [bookingId])
  .then(result => {
    if (result.rows.length === 0) {
      console.log('❌ Booking not found');
      return process.exit(0);
    }
    
    const booking = result.rows[0];
    console.log('Booking details:');
    console.log('- ID:', booking.id);
    console.log('- Tenant ID:', booking.tenant_id);
    console.log('- Booking Type:', booking.booking_type);
    console.log('- Scheduled At:', booking.scheduled_at);
    console.log('- Task Status:', booking.task_status || 'NULL');
    console.log('- Task Name:', booking.task_name || 'NULL');
    console.log('- Created At:', booking.created_at);
    
    const shouldHaveTask = ['auto_followup', 'manual_followup', 'scheduled_followup'].includes(booking.booking_type);
    console.log('Should have Cloud Task:', shouldHaveTask);
    
    if (shouldHaveTask && !booking.task_name) {
      console.log('❌ ISSUE: Missing Cloud Task for follow-up booking');
      console.log('🔧 Automatic system is not working properly');
    } else if (booking.task_name) {
      console.log('✅ Cloud Task exists:', booking.task_name);
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Query failed:', err.message);
    process.exit(1);
  });