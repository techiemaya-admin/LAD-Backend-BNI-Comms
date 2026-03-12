/**
 * Validators Index
 * Request validation schemas and functions
 */

const memberValidator = {
  /**
   * Check if member name contains invalid placeholder data
   */
  isInvalidMemberName(name) {
    if (!name || typeof name !== 'string') return false;
    // Reject __EMPTY and similar placeholder patterns
    return /^__EMPTY/i.test(name.trim()) || name.trim() === '';
  },

  validateCreateMember(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid input' };
    }
    
    // Validate member name is not empty placeholder
    if (this.isInvalidMemberName(data.name)) {
      return { 
        valid: false, 
        error: `Invalid member name: "${data.name}". Cannot create members with placeholder data (e.g., __EMPTY, blank names)` 
      };
    }
    
    return { valid: true };
  },
  validateUpdateMember(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid input' };
    }
    
    // Validate member name if provided
    if (data.name && this.isInvalidMemberName(data.name)) {
      return { 
        valid: false, 
        error: `Invalid member name: "${data.name}". Cannot update to placeholder data (e.g., __EMPTY, blank names)` 
      };
    }
    
    return { valid: true };
  }
};

const interactionValidator = {
  /**
   * Validate meeting count value
   * Must be a non-negative integer
   */
  isValidMeetingCount(count) {
    const parsed = parseInt(count, 10);
    return !isNaN(parsed) && parsed >= 0 && parsed <= 999999; // reasonable upper limit
  },

  /**
   * Validate interaction meeting data
   */
  validateMeeting(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid input' };
    }

    // Check memberAId and memberBId exist
    if (!data.memberAId || !data.memberBId) {
      return { valid: false, error: 'Missing memberAId or memberBId' };
    }

    // Check they are different
    if (data.memberAId === data.memberBId) {
      return { valid: false, error: 'Cannot create interaction between same member' };
    }

    // Check meeting count if provided
    if (data.meetingCount !== undefined && !this.isValidMeetingCount(data.meetingCount)) {
      return { 
        valid: false, 
        error: `Invalid meeting count: ${data.meetingCount}. Must be a non-negative integer` 
      };
    }

    return { valid: true };
  },

  /**
   * Validate referral data
   */
  validateReferral(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid input' };
    }

    // Check referrer and referred to exist
    if (!data.referrerId || !data.referredId) {
      return { valid: false, error: 'Missing referrerId or referredId' };
    }

    // Check they are different
    if (data.referrerId === data.referredId) {
      return { valid: false, error: 'Cannot create referral to self' };
    }

    // Check referral count if provided
    if (data.referralCount !== undefined && !this.isValidMeetingCount(data.referralCount)) {
      return { 
        valid: false, 
        error: `Invalid referral count: ${data.referralCount}. Must be a non-negative integer` 
      };
    }

    return { valid: true };
  },

  /**
   * Validate interaction matrix cell data (from Excel import)
   */
  validateMatrixCell(memberA, memberB, meetingCount) {
    // Skip if no meeting count
    if (!meetingCount || isNaN(meetingCount)) {
      return { valid: false, reason: 'missing_or_invalid_count', shouldSkip: true };
    }

    // Skip self-interactions
    if (memberA?.toLowerCase() === memberB?.toLowerCase()) {
      return { valid: false, reason: 'self_interaction', shouldSkip: true };
    }

    // Validate count is non-negative
    if (!this.isValidMeetingCount(meetingCount)) {
      return { valid: false, reason: 'invalid_count_value', shouldSkip: true };
    }

    return { valid: true };
  },

  /**
   * Check if member exists before creating interaction
   */
  validateMemberExists(memberName, memberMap) {
    if (!memberName) {
      return { exists: false, reason: 'empty_name' };
    }

    const memberId = memberMap[memberName.trim()];
    if (!memberId) {
      return { exists: false, reason: 'not_found_in_map', memberName };
    }

    return { exists: true, memberId };
  }
};

module.exports = {
  memberValidator,
  interactionValidator
};
