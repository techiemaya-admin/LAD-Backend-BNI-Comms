/**
 * Test availability endpoint directly
 */

const BookingRepository = require('./repositories/booking.pg');

async function testAvailability() {
  try {
    console.log('[Test] Testing availability function...');
    console.log('[Test] Current time:', new Date().toISOString());
    
    const today = new Date().toISOString().split('T')[0];
    // Use business hours instead of full day
    const businessStart = '09:00';
    const businessEnd = '18:00';
    const dayStart = new Date(`${today}T${businessStart}:00Z`);
    const dayEnd = new Date(`${today}T${businessEnd}:00Z`);
    
    console.log('[Test] Day start:', dayStart.toISOString());
    console.log('[Test] Day end:', dayEnd.toISOString());
    
    const booking = new BookingRepository();
    
    console.log('[Test] Testing with GST timezone (UTC+4)...');
    const slots = await booking.calculateAvailability({
      userId: 'fe9d6368-ff1b-4133-952a-525d60d06cbe',
      dayStart: dayStart,
      dayEnd: dayEnd,
      slotMinutes: 15,
      timezone: 'GST', // Gulf Standard Time (UTC+4)
      tenant_id: '926070b5-189b-4682-9279-ea10ca090b84'
    }, process.env.POSTGRES_SCHEMA || 'lad_dev');
    
    console.log('[Test] Total slots returned:', slots.length);
    
    if (slots.length > 0) {
      console.log('[Test] First few slots:');
      slots.slice(0, 5).forEach((slot, index) => {
        const isPast = new Date(slot.start) <= new Date();
        console.log(`  ${index + 1}. ${slot.start.toISOString()} - ${slot.end.toISOString()} ${isPast ? '(PAST - Should be filtered!)' : '(Future - OK)'}`);
      });
      
      console.log('[Test] Last few slots:');
      slots.slice(-3).forEach((slot, index) => {
        const isPast = new Date(slot.start) <= new Date();
        console.log(`  ${slots.length - 2 + index}. ${slot.start.toISOString()} - ${slot.end.toISOString()} ${isPast ? '(PAST - Should be filtered!)' : '(Future - OK)'}`);
      });
      
      // Check if any past slots exist
      const now = new Date();
      const gstOffset = 4 * 60 * 60 * 1000; // GST is UTC+4
      const gstNow = new Date(now.getTime() + gstOffset);
      console.log('[Test] Current time in GST:', gstNow.toISOString());
      
      const pastSlots = slots.filter(slot => new Date(slot.start) <= gstNow);
      if (pastSlots.length > 0) {
        console.log('[Test] ERROR: Found', pastSlots.length, 'past slots that should have been filtered!');
      } else {
        console.log('[Test] SUCCESS: No past slots found - filtering is working!');
      }
    } else {
      console.log('[Test] No slots returned');
    }
    
  } catch (error) {
    console.error('[Test] Error:', error.message);
    console.error('[Test] Stack:', error.stack);
  }
  
  process.exit(0);
}

testAvailability();
