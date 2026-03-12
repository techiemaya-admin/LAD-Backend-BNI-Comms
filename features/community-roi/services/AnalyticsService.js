/**
 * Analytics Service
 * Business Logic Layer - KPI calculation and aggregation
 * 
 * LAD Architecture: Service Layer
 * - Contains business logic
 * - Calls repositories for data
 * - No direct SQL
 * - Processes and transforms data
 */

const AnalyticsRepository = require('../repositories/AnalyticsRepository');
const logger = require('../../../core/utils/logger');

class AnalyticsService {
  /**
   * Get dashboard KPIs summary
   */
  async getDashboardKPIs(tenantId) {
    try {
      logger.info('[AnalyticsService] Calculating dashboard KPIs', { tenantId });

      // Fetch all analytics data in parallel
      const [networkStats, relationshipMetrics, networkDensity, businessValue] = await Promise.all([
        AnalyticsRepository.getNetworkStats(tenantId),
        AnalyticsRepository.getRelationshipMetrics(tenantId),
        AnalyticsRepository.getNetworkDensity(tenantId),
        AnalyticsRepository.getBusinessValueMetrics(tenantId)
      ]);

      const kpis = {
        // Network Breakdown (Interaction Statistics)
        networkBreakdown: {
          totalInteractions: networkStats.totalCombined,
          meetings: networkStats.totalInteractions,
          referrals: networkStats.totalReferrals,
          description: 'Meetings + Referrals combined'
        },

        // Relationship Strength (Average network connectivity)
        relationshipStrength: {
          avgStrengthScore: relationshipMetrics.avgStrength,
          maxEngagementScore: relationshipMetrics.maxStrength,
          minEngagementScore: relationshipMetrics.minStrength,
          maxPossible: 100,
          description: 'Average network connectivity'
        },

        // Connectivity Analysis (Network connectivity metrics)
        connectivityAnalysis: {
          avgConnectionsPerMember: Math.round(networkStats.avgConnections * 10) / 10,
          avgRelationshipScore: Math.round((networkStats.avgConnections / 10) * 100) / 100,
          networkDensity: networkDensity.density,
          memberCount: networkDensity.memberCount,
          description: 'Network connectivity metrics'
        },

        // Business Value
        businessValue: {
          totalReferrals: businessValue.totalReferrals,
          totalBusinessValue: businessValue.totalBusinessValue,
          avgReferralValue: businessValue.avgReferralValue,
          currency: 'AED',
          description: 'Sum of all referral values'
        },

        // Timestamp
        calculatedAt: new Date().toISOString()
      };

      logger.info('[AnalyticsService] Dashboard KPIs calculated successfully', {
        tenantId,
        totalInteractions: kpis.networkBreakdown.totalInteractions,
        avgStrength: kpis.relationshipStrength.avgStrengthScore,
        networkDensity: kpis.connectivityAnalysis.networkDensity
      });

      return kpis;
    } catch (error) {
      logger.error('[AnalyticsService] Error calculating dashboard KPIs', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get detailed member engagement report
   */
  async getMemberEngagementReport(tenantId) {
    try {
      logger.debug('[AnalyticsService] Fetching member engagement report', { tenantId });

      const members = await AnalyticsRepository.getMemberEngagementScores(tenantId);

      const report = {
        totalMembers: members.length,
        members: members.map(m => ({
          id: m.id,
          name: m.name,
          meetingsCount: m.meetings_count,
          uniqueConnections: m.unique_connections,
          engagementScore: m.engagement_score,
          engagement: this.getEngagementLevel(m.engagement_score)
        })),
        summary: {
          avgEngagement: Math.round(members.reduce((sum, m) => sum + m.engagement_score, 0) / members.length || 0),
          topEngaged: members.slice(0, 5),
          nonEngaged: members.filter(m => m.engagement_score === 0).length
        },
        calculatedAt: new Date().toISOString()
      };

      return report;
    } catch (error) {
      logger.error('[AnalyticsService] Error fetching member engagement report', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get top connectors (network hubs)
   */
  async getTopConnectors(tenantId, limit = 10) {
    try {
      logger.debug('[AnalyticsService] Fetching top connectors', { tenantId, limit });

      const connectors = await AnalyticsRepository.getTopConnectors(tenantId, limit);

      return {
        count: connectors.length,
        connectors: connectors.map(c => ({
          id: c.id,
          name: c.name,
          connectionCount: c.connection_count,
          totalMeetings: c.total_meetings || 0,
          influence: this.calculateInfluence(c.connection_count, c.total_meetings)
        })),
        calculatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('[AnalyticsService] Error fetching top connectors', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get top referrers (deal makers)
   */
  async getTopReferrers(tenantId, limit = 10) {
    try {
      logger.debug('[AnalyticsService] Fetching top referrers', { tenantId, limit });

      const referrers = await AnalyticsRepository.getTopReferrers(tenantId, limit);

      return {
        count: referrers.length,
        referrers: referrers.map(r => ({
          id: r.id,
          name: r.name,
          referralCount: r.referral_count,
          uniqueReferredTo: r.unique_referred_to,
          effectiveness: Math.round((r.unique_referred_to / (r.referral_count || 1)) * 100)
        })),
        calculatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('[AnalyticsService] Error fetching top referrers', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get network health score (0-100)
   */
  async getNetworkHealthScore(tenantId) {
    try {
      logger.debug('[AnalyticsService] Calculating network health score', { tenantId });

      // Fetch analytics data with individual error handling
      let networkStats, relationshipMetrics, networkDensity;
      
      try {
        networkStats = await AnalyticsRepository.getNetworkStats(tenantId);
        logger.debug('[AnalyticsService] getNetworkStats completed', { 
          totalMembers: networkStats.totalMembers 
        });
      } catch (err) {
        logger.error('[AnalyticsService] getNetworkStats failed', { 
          error: err.message 
        });
        throw err;
      }

      try {
        relationshipMetrics = await AnalyticsRepository.getRelationshipMetrics(tenantId);
        logger.debug('[AnalyticsService] getRelationshipMetrics completed', { 
          avgStrength: relationshipMetrics.avgStrength 
        });
      } catch (err) {
        logger.error('[AnalyticsService] getRelationshipMetrics failed', { 
          error: err.message 
        });
        throw err;
      }

      try {
        networkDensity = await AnalyticsRepository.getNetworkDensity(tenantId);
        logger.debug('[AnalyticsService] getNetworkDensity completed', { 
          density: networkDensity.density 
        });
      } catch (err) {
        logger.error('[AnalyticsService] getNetworkDensity failed', { 
          error: err.message,
          stack: err.stack
        });
        throw err;
      }

      // Calculate health score based on multiple factors
      const factors = {
        participation: Math.min(100, (networkStats.totalMembers / 100) * 20), // 0-20 points for member count
        connectivity: networkDensity.density, // 0-40 points for network density
        engagement: Math.min(40, (relationshipMetrics.avgStrength / 100) * 40), // 0-40 points for avg strength
      };

      const healthScore = Math.round(
        (factors.participation * 0.2 + 
         factors.connectivity * 0.4 + 
         factors.engagement * 0.4) * 10
      ) / 10;

      logger.info('[AnalyticsService] Network health score calculated', {
        tenantId,
        healthScore,
        factors
      });

      return {
        healthScore,
        maxScore: 100,
        factors,
        assessment: this.assessNetworkHealth(healthScore),
        recommendations: this.getHealthRecommendations(healthScore, networkStats, networkDensity),
        calculatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('[AnalyticsService] Error calculating network health score', {
        error: error.message,
        stack: error.stack,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Helper: Get engagement level text
   */
  getEngagementLevel(score) {
    if (score >= 80) return 'Highly Engaged';
    if (score >= 60) return 'Engaged';
    if (score >= 40) return 'Moderately Engaged';
    if (score >= 20) return 'Low Engagement';
    return 'Inactive';
  }

  /**
   * Helper: Calculate influence score
   */
  calculateInfluence(connections, meetings) {
    return Math.round((connections * 0.7 + (meetings || 0) * 0.3) * 10) / 10;
  }

  /**
   * Helper: Assess network health
   */
  assessNetworkHealth(score) {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Very Poor';
  }

  /**
   * Helper: Get health recommendations
   */
  getHealthRecommendations(score, networkStats, networkDensity) {
    const recommendations = [];

    if (score < 40) {
      recommendations.push('Network engagement is low. Encourage more interactions between members.');
    }

    if (networkDensity.density < 20) {
      recommendations.push('Network density is sparse. Facilitate introductions between disconnected members.');
    }

    if (networkStats.avgConnections < 5) {
      recommendations.push('Average connections per member is low. Organize networking events.');
    }

    if (networkStats.totalMembers < 20) {
      recommendations.push('Add more members to strengthen the network.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Network is performing well! Maintain current engagement levels.');
    }

    return recommendations;
  }

  /**
   * Get contribution report statistics
   * Real data: unique meetings and referrals from database
   * Mock data: impact and engagement metrics
   */
  async getContributionStats(tenantId) {
    try {
      logger.info('[AnalyticsService] Fetching contribution statistics', { tenantId });

      const stats = await AnalyticsRepository.getContributionStats(tenantId);

      return {
        success: true,
        data: {
          uniqueMeetings: stats.uniqueMeetings,
          uniqueReferrals: stats.uniqueReferrals,
          impactGenerated: stats.impactGenerated,
          avgMonthlyEngagements: stats.avgMonthlyEngagements
        }
      };
    } catch (error) {
      logger.error('[AnalyticsService] Error fetching contribution stats', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }
}

module.exports = new AnalyticsService();
