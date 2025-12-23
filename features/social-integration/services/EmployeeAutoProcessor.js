/**
 * Employee Auto-Processor for LinkedIn Integration
 * 
 * Background service that monitors employees_cache table and automatically:
 * 1. Detects new employees with LinkedIn URLs
 * 2. Saves them to leads table
 * 3. Sends LinkedIn connection requests
 * 4. Updates lead statuses based on results
 * 
 * Supports both real-time (PostgreSQL NOTIFY/LISTEN) and scheduled processing
 */

const LinkedInIntegration = require('./LinkedInIntegration');

class EmployeeAutoProcessor {
  constructor(db) {
    this.db = db;
    this.linkedInService = new LinkedInIntegration();
    this.isProcessing = false;
    this.lastProcessedTimestamp = null;
    this.notificationClient = null;
    this.isListening = false;
  }
  
  /**
   * Process new employees from employees_cache table
   * 
   * @param {number} batchSize - Number of employees to process at once
   * @param {number} lookbackMinutes - How many minutes back to look for new employees
   * @returns {Promise<Object>} Processing results
   */
  async processNewEmployees(batchSize = 50, lookbackMinutes = 60) {
    if (this.isProcessing) {
      console.log('[EmployeeAutoProcessor] Already processing, skipping...');
      return { skipped: true };
    }
    
    this.isProcessing = true;
    let client;
    
    try {
      client = await this.db.connect();
      console.log('[EmployeeAutoProcessor] Starting to process new employees...');
      
      // Get all active users with LinkedIn connected
      const usersQuery = `
        SELECT DISTINCT
          u.id as user_id,
          u.user_id as user_identifier,
          u.organization_id,
          COALESCE(
            ui.credentials->>'unipile_account_id',
            u.linkedin_unipile_account_id
          ) as linkedin_unipile_account_id
        FROM users_voiceagent u
        LEFT JOIN user_integrations_voiceagent ui 
          ON ui.user_id = u.id AND ui.provider = 'linkedin'
        WHERE (
          (ui.is_connected = TRUE AND ui.credentials->>'unipile_account_id' IS NOT NULL)
          OR 
          (u.linkedin_is_connected = TRUE AND u.linkedin_unipile_account_id IS NOT NULL)
        )
        AND u.organization_id IS NOT NULL
      `;
      
      const usersResult = await client.query(usersQuery);
      const users = usersResult.rows;
      
      if (users.length === 0) {
        console.log('[EmployeeAutoProcessor] No users with LinkedIn connected');
        return { processed: 0 };
      }
      
      console.log(`[EmployeeAutoProcessor] Found ${users.length} users with LinkedIn connected`);
      
      // Get new employees from employees_cache
      const employeesQuery = `
        SELECT DISTINCT
          ec.apollo_person_id as id,
          ec.employee_name as name,
          ec.employee_title as title,
          ec.employee_email as email,
          ec.employee_phone as phone,
          ec.employee_linkedin_url as linkedin_url,
          ec.employee_photo_url as photo_url,
          ec.employee_headline as headline,
          ec.employee_city as city,
          ec.employee_state as state,
          ec.employee_country as country,
          ec.company_id,
          ec.company_name,
          ec.company_domain,
          ec.employee_data,
          ec.company_sales_summary,
          ec.created_at
        FROM employees_cache ec
        WHERE ec.employee_linkedin_url IS NOT NULL
          AND ec.employee_linkedin_url != ''
          AND ec.employee_linkedin_url LIKE '%linkedin.com%'
          AND ec.created_at >= NOW() - INTERVAL '${lookbackMinutes} minutes'
          AND NOT EXISTS (
            SELECT 1
            FROM leads l
            INNER JOIN lead_social ls ON l.id = ls.lead_id
            WHERE ls.linkedin = ec.employee_linkedin_url
              AND l.is_deleted = FALSE
          )
        ORDER BY ec.created_at DESC
        LIMIT $1
      `;
      
      const employeesResult = await client.query(employeesQuery, [batchSize]);
      const newEmployees = employeesResult.rows;
      
      if (newEmployees.length === 0) {
        console.log('[EmployeeAutoProcessor] No new employees found');
        return { processed: 0 };
      }
      
      console.log(`[EmployeeAutoProcessor] Found ${newEmployees.length} new employees`);
      
      const results = {
        total: newEmployees.length,
        savedToLeads: 0,
        connectionsSent: 0,
        failed: 0
      };
      
      // Process for each user with LinkedIn connected
      for (const user of users) {
        const userId = user.user_id || user.user_identifier;
        const organizationId = user.organization_id;
        const linkedInAccountId = user.linkedin_unipile_account_id;
        
        if (!userId || !organizationId || !linkedInAccountId) {
          console.log(`[EmployeeAutoProcessor] Skipping user ${userId}: missing fields`);
          continue;
        }
        
        try {
          // Save employees to leads table
          const savedCount = await this.saveEmployeesToLeads(
            client,
            newEmployees,
            organizationId,
            userId
          );
          results.savedToLeads += savedCount;
          
          console.log(`[EmployeeAutoProcessor] Saved ${savedCount} employees for user ${userId}`);
          
          // Send LinkedIn connection requests
          if (this.linkedInService.isConfigured() && savedCount > 0) {
            const profiles = newEmployees.map(emp => ({
              name: emp.name,
              profile_url: emp.linkedin_url,
              publicIdentifier: emp.linkedin_url?.match(/linkedin\.com\/in\/([^\/\?]+)/)?.[1]
            }));
            
            const connectionResult = await this.linkedInService.batchSendConnectionRequests(
              profiles,
              linkedInAccountId,
              null, // No custom message
              2000  // 2 second delay
            );
            
            results.connectionsSent += connectionResult.successful || 0;
            results.failed += connectionResult.failed || 0;
            
            console.log(`[EmployeeAutoProcessor] Sent ${connectionResult.successful} requests for user ${userId}`);
            
            // Update lead statuses
            if (connectionResult.successful > 0) {
              await this.updateLeadStatuses(
                client,
                connectionResult.results,
                organizationId
              );
            }
          }
          
        } catch (error) {
          console.error(`[EmployeeAutoProcessor] Error for user ${userId}:`, error.message);
          results.failed++;
        }
      }
      
      // Update last processed timestamp
      if (newEmployees.length > 0) {
        this.lastProcessedTimestamp = newEmployees[0].created_at;
      }
      
      console.log('[EmployeeAutoProcessor] Processing complete:', results);
      return results;
      
    } catch (error) {
      console.error('[EmployeeAutoProcessor] Fatal error:', error.message);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
      this.isProcessing = false;
    }
  }
  
  /**
   * Save employees to leads table
   */
  async saveEmployeesToLeads(client, employees, organizationId, userId) {
    let savedCount = 0;
    
    for (const emp of employees) {
      try {
        // Insert lead
        const leadQuery = `
          INSERT INTO leads (
            organization_id,
            user_id,
            name,
            title,
            email,
            phone,
            company_name,
            company_domain,
            source,
            channel,
            stage,
            status,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
          RETURNING id
        `;
        
        const leadResult = await client.query(leadQuery, [
          organizationId,
          userId,
          emp.name,
          emp.title,
          emp.email,
          emp.phone,
          emp.company_name,
          emp.company_domain,
          'linkedin_auto_connection',
          'linkedin',
          'new',
          'new'
        ]);
        
        const leadId = leadResult.rows[0].id;
        
        // Insert lead_social
        await client.query(
          'INSERT INTO lead_social (lead_id, linkedin) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [leadId, emp.linkedin_url]
        );
        
        savedCount++;
        
      } catch (error) {
        console.error(`[EmployeeAutoProcessor] Error saving ${emp.name}:`, error.message);
      }
    }
    
    return savedCount;
  }
  
  /**
   * Update lead statuses based on connection results
   */
  async updateLeadStatuses(client, results, organizationId) {
    const successfulUrls = results
      ?.filter(r => r.success && !r.alreadySent)
      .map(r => r.profile?.url)
      .filter(url => url) || [];
    
    if (successfulUrls.length === 0) {
      return;
    }
    
    const updateQuery = `
      UPDATE leads l
      SET status = 'request_sent', updated_at = CURRENT_TIMESTAMP
      FROM lead_social ls
      WHERE l.id = ls.lead_id
        AND ls.linkedin = ANY($1::text[])
        AND l.organization_id = $2
        AND l.is_deleted = FALSE
    `;
    
    await client.query(updateQuery, [successfulUrls, organizationId]);
    console.log(`[EmployeeAutoProcessor] Updated ${successfulUrls.length} lead statuses`);
  }
  
  /**
   * Start listening for database notifications (real-time processing)
   */
  async startNotificationListener() {
    if (this.isListening) {
      console.log('[EmployeeAutoProcessor] Already listening');
      return;
    }
    
    try {
      // Create dedicated client for notifications
      const { Client } = require('pg');
      
      this.notificationClient = new Client({
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT) || 5432,
        database: process.env.POSTGRES_DB,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
      });
      
      await this.notificationClient.connect();
      await this.notificationClient.query('LISTEN new_employee_inserted');
      
      this.isListening = true;
      console.log('[EmployeeAutoProcessor] ✅ Listening for notifications');
      
      // Handle notifications
      this.notificationClient.on('notification', async (msg) => {
        if (msg.channel === 'new_employee_inserted') {
          console.log('[EmployeeAutoProcessor] 🔔 New employee notification received');
          
          // Batch multiple rapid inserts with a 2 second delay
          setTimeout(() => {
            this.processNewEmployees(50, 2).catch(err => {
              console.error('[EmployeeAutoProcessor] Error processing from notification:', err);
            });
          }, 2000);
        }
      });
      
      // Handle errors
      this.notificationClient.on('error', (err) => {
        console.error('[EmployeeAutoProcessor] Notification error:', err);
        this.isListening = false;
        
        // Reconnect after 5 seconds
        setTimeout(() => {
          console.log('[EmployeeAutoProcessor] Reconnecting...');
          this.startNotificationListener().catch(err => {
            console.error('[EmployeeAutoProcessor] Reconnect failed:', err);
          });
        }, 5000);
      });
      
    } catch (error) {
      console.error('[EmployeeAutoProcessor] Failed to start listener:', error);
      this.isListening = false;
    }
  }
  
  /**
   * Start the background processor
   * 
   * @param {number} intervalMinutes - Fallback interval for scheduled checks
   */
  startProcessor(intervalMinutes = 5) {
    console.log('[EmployeeAutoProcessor] Starting processor...');
    
    // Start real-time notifications
    this.startNotificationListener().catch(err => {
      console.error('[EmployeeAutoProcessor] Notification listener error:', err);
    });
    
    // Run immediately
    this.processNewEmployees().catch(err => {
      console.error('[EmployeeAutoProcessor] Initial run error:', err);
    });
    
    // Schedule fallback checks
    const intervalMs = intervalMinutes * 60 * 1000;
    this.scheduledInterval = setInterval(() => {
      console.log('[EmployeeAutoProcessor] Running scheduled check...');
      this.processNewEmployees().catch(err => {
        console.error('[EmployeeAutoProcessor] Scheduled run error:', err);
      });
    }, intervalMs);
    
    console.log(`[EmployeeAutoProcessor] ✅ Started (notifications + ${intervalMinutes}min fallback)`);
  }
  
  /**
   * Stop the processor
   */
  stopProcessor() {
    if (this.scheduledInterval) {
      clearInterval(this.scheduledInterval);
    }
    
    if (this.notificationClient) {
      this.notificationClient.end().catch(err => {
        console.error('[EmployeeAutoProcessor] Error closing notification client:', err);
      });
      this.notificationClient = null;
      this.isListening = false;
    }
    
    console.log('[EmployeeAutoProcessor] Stopped');
  }
}

module.exports = EmployeeAutoProcessor;
