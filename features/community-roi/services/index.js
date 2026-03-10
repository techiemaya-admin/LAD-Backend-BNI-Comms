/**
 * Services Layer Index
 * Business logic layer - NO SQL
 * 
 * LAD Architecture: Services Layer
 * - Contains business logic only
 * - Calls repositories for data access
 * - No SQL queries
 * - Transforms and validates data
 */

const memberRepository = require('../repositories/MemberRepository');
const interactionRepository = require('../repositories/InteractionRepository');
const relationshipRepository = require('../repositories/RelationshipRepository');
const logger = require('../../../core/utils/logger');

const memberService = {
  /**
   * Get all members for a tenant
   */
  async getAllMembers(tenantId, req) {
    try {
      logger.debug('[MemberService] Fetching all members', { tenantId });
      
      // Call repository (no SQL here - only in repository)
      const members = await memberRepository.getAllMembers(tenantId);
      
      logger.debug('[MemberService] Found members', { tenantId, count: members.length });
      return members;
    } catch (error) {
      logger.error('[MemberService] Error fetching members', { error: error.message, tenantId });
      throw error;
    }
  },

  /**
   * Get member profile
   */
  async getMemberProfile(tenantId, memberId, req) {
    try {
      logger.debug('[MemberService] Fetching member profile', { tenantId, memberId });
      
      const member = await memberRepository.getMemberById(tenantId, memberId);
      
      if (!member) {
        throw new Error('Member not found');
      }
      
      return member;
    } catch (error) {
      logger.error('[MemberService] Error fetching member profile', { error: error.message, memberId });
      throw error;
    }
  },

  /**
   * Create a member
   */
  async createMember(tenantId, data, req) {
    try {
      logger.info('[MemberService] Creating member', { tenantId, name: data.name });
      
      const member = await memberRepository.createMember(tenantId, data);
      
      logger.info('[MemberService] Member created successfully', { 
        tenantId, 
        memberId: member.id,
        name: member.name 
      });
      
      return member;
    } catch (error) {
      logger.error('[MemberService] Error creating member', { error: error.message, tenantId });
      throw error;
    }
  },

  /**
   * Update a member
   */
  async updateMember(tenantId, memberId, data) {
    try {
      logger.info('[MemberService] Updating member', { tenantId, memberId });
      
      const member = await memberRepository.updateMember(tenantId, memberId, data);
      
      logger.info('[MemberService] Member updated successfully', { tenantId, memberId });
      
      return member;
    } catch (error) {
      logger.error('[MemberService] Error updating member', { error: error.message, memberId });
      throw error;
    }
  },

  /**
   * Delete a member
   */
  async deleteMember(tenantId, memberId) {
    try {
      logger.info('[MemberService] Deleting member', { tenantId, memberId });
      
      const success = await memberRepository.deleteMember(tenantId, memberId);
      
      if (!success) {
        throw new Error('Member not found');
      }
      
      logger.info('[MemberService] Member deleted successfully', { tenantId, memberId });
      
      return success;
    } catch (error) {
      logger.error('[MemberService] Error deleting member', { error: error.message, memberId });
      throw error;
    }
  },

  /**
   * Search members
   */
  async searchMembers(tenantId, searchQuery) {
    try {
      logger.debug('[MemberService] Searching members', { tenantId, searchQuery });
      
      const members = await memberRepository.searchMembers(tenantId, searchQuery);
      
      logger.debug('[MemberService] Found matching members', { tenantId, count: members.length });
      
      return members;
    } catch (error) {
      logger.error('[MemberService] Error searching members', { error: error.message, tenantId });
      throw error;
    }
  },

  /**
   * Calculate engagement score (business logic)
   */
  async calculateEngagementScore(tenantId, memberId) {
    try {
      logger.debug('[MemberService] Calculating engagement score', { tenantId, memberId });
      
      const member = await memberRepository.getMemberById(tenantId, memberId);
      
      if (!member) {
        throw new Error('Member not found');
      }
      
      // Business logic: calculate based on member activity (placeholder for now)
      const score = Math.floor(Math.random() * 100);
      
      return score;
    } catch (error) {
      logger.error('[MemberService] Error calculating engagement score', { error: error.message, memberId });
      throw error;
    }
  }
};

const relationshipService = {
  async getRelationshipScore(tenantId, memberId1, memberId2) {
    // Placeholder - real score logic would be complex
    return { score: 80, member_a_id: memberId1, member_b_id: memberId2 };
  },
  async getMemberRelationships(tenantId, memberId, options) {
    return relationshipRepository.getMemberRelationships(tenantId, memberId, options);
  },
  async getTopRelationships(tenantId, limit) {
    return [];
  },
  async getRecommendations(tenantId, memberId, limit) {
    return [];
  },
  async getTopContributors(tenantId, limit) {
    return relationshipRepository.getTopContributors(tenantId, limit);
  },
  async getMemberContributions(tenantId, memberId) {
    return { member_id: memberId, total_contributions: 0, contribution_details: [] };
  },
  async getDashboardLeaderboards(tenantId) {
    return relationshipRepository.getDashboardLeaderboards(tenantId);
  },
  async getMemberContributionReport(tenantId, memberId) {
    return relationshipRepository.getMemberContributionReport(tenantId, memberId);
  }
};

const interactionService = {
  async logMeeting(tenantId, data) {
    try {
      logger.info('[InteractionService] Logging meeting', { tenantId, memberAId: data.memberAId, memberBId: data.memberBId });

      // 1. Check if this meeting is unique for both parties BEFORE logging
      const isUnique = await interactionRepository.isUniqueMeeting(tenantId, data.memberAId, data.memberBId);

      // 2. Log the meeting in the database
      const meeting = await interactionRepository.logMeeting(tenantId, data);

      // 3. Streak Logic (Snapchat style for unique 1-to-1s)
      // Update streak for Member A
      await this.updateMemberStreak(tenantId, data.memberAId, isUnique);
      
      // Update streak for Member B (if memberB is also a chapter member)
      if (data.memberBId) {
        await this.updateMemberStreak(tenantId, data.memberBId, isUnique);
      }

      return meeting;
    } catch (error) {
      logger.error('[InteractionService] Error logging meeting', { error: error.message, tenantId });
      throw error;
    }
  },

  async updateMemberStreak(tenantId, memberId, isUnique) {
    try {
      const member = await memberRepository.getMemberById(tenantId, memberId);
      if (!member) return;

      const now = new Date();
      const lastUnique = member.last_unique_meeting_at ? new Date(member.last_unique_meeting_at) : null;
      
      let currentStreak = parseInt(member.current_streak || 0);

      if (!isUnique) {
        // Non-unique meeting: The "Snapchat" rule here is that only FIRST meetings count.
        // If a member logs a meeting with someone they've met before, it doesn't help the streak.
        // Does it RESET it or just NOT INCREMENT it?
        // User said: "if a user logs 1 unique 1 to 1 he will get 1 streak... if he doesn't log he will lose the streak"
        // Let's assume non-unique meetings don't break the streak, they just don't advance it.
        // Actually, "if he doesn't log" implies a timeframe.
        // Let's stick to the 8-day window for the CURRENT streak.
        
        // Check for expiration even on non-unique meetings
        if (lastUnique) {
          const diffDays = Math.floor((now - lastUnique) / (1000 * 60 * 60 * 24));
          if (diffDays > 8) {
            await memberRepository.resetStreak(tenantId, memberId);
            logger.info('[InteractionService] Streak expired on non-unique meeting', { memberId, diffDays });
          }
        }
        return;
      }

      // If we are here, it IS a unique meeting
      let newStreak = 1;
      
      if (lastUnique) {
        const diffDays = Math.floor((now - lastUnique) / (1000 * 60 * 60 * 24));
        if (diffDays <= 8) {
          // Inside window, increment
          newStreak = currentStreak + 1;
        } else {
          // Missed window, start over at 1
          logger.info('[InteractionService] Missed window, restarting streak at 1', { memberId, diffDays });
        }
      }

      await memberRepository.updateStreak(tenantId, memberId, {
        currentStreak: newStreak,
        lastUniqueMeetingAt: now
      });
      
      logger.info('[InteractionService] Streak updated', { memberId, newStreak });
    } catch (error) {
      logger.error('[InteractionService] Error updating member streak', { error: error.message, memberId });
    }
  },

  async logReferral(tenantId, data) {
    try {
      logger.info('[InteractionService] Logging referral', { tenantId, from: data.referredById, to: data.referredToId });
      return await interactionRepository.logReferral(tenantId, data);
    } catch (error) {
      logger.error('[InteractionService] Error logging referral', { error: error.message, tenantId });
      throw error;
    }
  },
  async getInteractionHistory(tenantId, memberId1, memberId2) {
    return [];
  },
  async getMemberReferrals(tenantId, memberId) {
    return interactionRepository.getMemberReferrals(tenantId, memberId);
  },
  async getMemberActivityHistory(tenantId, memberId) {
    return interactionRepository.getMemberActivityHistory(tenantId, memberId);
  },
  async getRecentActivity(tenantId, memberId, limit) {
    return interactionRepository.getRecentActivity(tenantId, memberId, limit);
  },
  async getNetworkStats(tenantId) {
    return interactionRepository.getNetworkStats(tenantId);
  }
};

module.exports = {
  memberService,
  relationshipService,
  interactionService
};
