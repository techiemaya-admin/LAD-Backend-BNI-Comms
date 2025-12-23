/**
 * LinkedIn Webhook Service
 * Handles Unipile webhook events and updates leads/pipeline
 * 
 * Events handled:
 * - new_relation: Connection request accepted
 * - connection.accepted: Alternative event name for acceptance
 * - connection.sent: Connection request sent
 * - connection.declined: Connection request declined
 * - AccountStatus: Account status changes (OK, ERROR, STOPPED, CREDENTIALS, etc.)
 */

const axios = require('axios');

class LinkedInWebhookService {
  constructor(db) {
    this.pool = db;
    // In-memory cache to prevent duplicate processing (clears on server restart)
    this.processedEvents = new Set();
  }

  /**
   * Handle connection accepted event
   * Updates leads table when a connection request is accepted
   * 
   * ⏱️ Timing Notes:
   * - Unipile webhook typically arrives 1-60 seconds after connection acceptance
   * - Very delayed notifications (15-30 min) can occur if account is inactive
   * - Phone reveal via Apollo takes 2-5 minutes after trigger
   * - Auto-call triggers AFTER phone is revealed (via Apollo webhook)
   * 
   * Flow:
   * 1. Connection accepted → Update lead status → Trigger phone reveal
   * 2. Phone revealed (2-5 min later) → Update leads table → Trigger auto-call
   */
  async handleConnectionAccepted(payload) {
    try {
      // Create a unique event ID to prevent duplicate processing
      const eventData = payload.data || payload;
      const eventLinkedinUrl = eventData.user_profile_url || eventData.user_public_identifier || 'unknown';
      const eventId = `${payload.timestamp || Date.now()}_${eventLinkedinUrl}`;
      
      // Check if we've already processed this event
      if (this.processedEvents.has(eventId)) {
        console.log(`[LinkedIn Webhook] ⚠️ Duplicate event detected, skipping: ${eventId}`);
        return {
          success: false,
          error: 'Duplicate event - already processed',
          eventId: eventId
        };
      }
      
      // Mark this event as processed
      this.processedEvents.add(eventId);
      
      // Clean up old events (keep only last 1000 to prevent memory leak)
      if (this.processedEvents.size > 1000) {
        const firstEvent = this.processedEvents.values().next().value;
        this.processedEvents.delete(firstEvent);
      }
      
      console.log('[LinkedIn Webhook] 📥 Raw payload:', JSON.stringify(payload, null, 2));
      const data = payload.data || payload;
      const recipient = data.recipient || {};
      // Unipile "new_relation" event sends user_profile_url directly in data
      const linkedinUrl = data.user_profile_url ||
                         recipient.linkedin_profile_url || 
                         recipient.profile_url || 
                         recipient.linkedin_url ||
                         data.linkedin_url ||
                         data.profile_url;
      
      console.log('[LinkedIn Webhook] 🔍 Extracted LinkedIn URL:', linkedinUrl);
      
      if (!linkedinUrl) {
        console.warn('[LinkedIn Webhook] ❌ No LinkedIn URL found in connection accepted event');
        console.warn('[LinkedIn Webhook] Full payload structure:', JSON.stringify(payload, null, 2));
        return;
      }
      
      console.log('[LinkedIn Webhook] ✅ Connection accepted');
      console.log('[LinkedIn Webhook] Profile URL:', linkedinUrl);
      
      // Normalize LinkedIn URL
      const normalizedUrl = this.normalizeLinkedInUrl(linkedinUrl);
      
      // Find lead by LinkedIn URL using lead_social table
      const leadQuery = `
        SELECT l.id, l.name, l.status, l.stage, l.organization_id, l.phone, l.email, l.job_title, l.company
        FROM leads l
        LEFT JOIN lead_social ls ON l.id = ls.lead_id
        WHERE (
          ls.linkedin = $1
          OR
          REPLACE(REPLACE(REPLACE(ls.linkedin, 'https://', ''), 'http://', ''), 'www.', '') = $2
          OR
          ls.linkedin LIKE $3
        )
        AND l.is_deleted = FALSE
        ORDER BY l.updated_at DESC
        LIMIT 1
      `;
      
      const urlForMatching = normalizedUrl
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '');
      
      console.log('[LinkedIn Webhook] 🔍 Searching for lead with URL:', normalizedUrl);
      
      const leadResult = await this.pool.query(leadQuery, [
        normalizedUrl,
        urlForMatching,
        `%${urlForMatching}%`
      ]);
      
      console.log('[LinkedIn Webhook] 🔍 Found', leadResult.rows.length, 'lead(s)');
      
      if (leadResult.rows.length === 0) {
        console.log('[LinkedIn Webhook] ❌ No lead found for LinkedIn URL:', normalizedUrl);
        
        // CHECK: Only auto-create lead if LinkedIn URL exists in employees_cache
        const employeeCacheCheck = await this.pool.query(`
          SELECT employee_name, employee_linkedin_url, company_name
          FROM employees_cache
          WHERE employee_linkedin_url = $1
            OR REPLACE(REPLACE(REPLACE(employee_linkedin_url, 'https://', ''), 'http://', ''), 'www.', '') = $2
          LIMIT 1
        `, [normalizedUrl, urlForMatching]);
        
        if (employeeCacheCheck.rows.length === 0) {
          console.log('[LinkedIn Webhook] ⏭️ Skipping auto-creation - LinkedIn URL not found in employees_cache');
          return {
            success: true,
            skipped: true,
            reason: 'not_in_employees_cache',
            message: 'Connection accepted but not a scraped employee - skipping lead creation'
          };
        }
        
        console.log('[LinkedIn Webhook] ✅ LinkedIn URL found in employees_cache - auto-creating lead...');
        
        // Extract name from webhook payload
        let fullName = data.user_full_name || 
                      data.full_name ||
                      data.name ||
                      recipient.full_name ||
                      recipient.name;
        
        // If no name, extract from public identifier
        if (!fullName && data.user_public_identifier) {
          const parts = data.user_public_identifier.split('-').filter(p => !/^\d+$/.test(p));
          if (parts.length > 0) {
            fullName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
          }
        }
        
        // Final fallback
        if (!fullName || fullName.trim() === '') {
          fullName = 'LinkedIn User';
        }
        
        console.log(`[LinkedIn Webhook] 📝 Using name for lead: ${fullName}`);
        
        // Get organization_id from active LinkedIn account
        let organizationId = null;
        try {
          const orgQuery = `
            SELECT DISTINCT organization_id
            FROM linkedin_integrations
            WHERE is_active = TRUE 
              AND unipile_account_id IS NOT NULL
              AND organization_id IS NOT NULL
            LIMIT 1
          `;
          const orgResult = await this.pool.query(orgQuery);
          if (orgResult.rows.length > 0) {
            organizationId = orgResult.rows[0].organization_id;
          }
        } catch (orgError) {
          console.warn('[LinkedIn Webhook] ⚠️ Could not get organization_id:', orgError.message);
        }
        
        // Auto-create lead
        const createLeadQuery = `
          INSERT INTO leads (
            name,
            status,
            stage,
            source,
            channel,
            organization_id,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          RETURNING id, name, status, stage, organization_id, phone, email, job_title, company
        `;
        
        const newLead = await this.pool.query(createLeadQuery, [
          fullName,
          'request_accepted',
          'request_accepted',
          'linkedin_connection',
          'linkedin',
          organizationId
        ]);
        
        if (newLead.rows.length > 0) {
          const createdLead = newLead.rows[0];
          console.log('[LinkedIn Webhook] ✅ Auto-created lead:', {
            id: createdLead.id,
            name: createdLead.name,
            status: createdLead.status
          });
          
          // Create lead_social entry
          await this.pool.query(`
            INSERT INTO lead_social (lead_id, linkedin)
            VALUES ($1, $2)
            ON CONFLICT (lead_id) 
            DO UPDATE SET linkedin = EXCLUDED.linkedin
          `, [createdLead.id, normalizedUrl]);
          
          leadResult.rows = [createdLead];
        } else {
          console.error('[LinkedIn Webhook] ❌ Failed to create lead');
          return;
        }
      }
      
      const lead = leadResult.rows[0];
      
      // CHECK 1: Only process recent acceptances (last 24 hours)
      let acceptanceTimestamp = null;
      const payloadTimestamp = payload.timestamp || data.timestamp;
      if (payloadTimestamp) {
        if (typeof payloadTimestamp === 'number' || /^\d+$/.test(String(payloadTimestamp))) {
          acceptanceTimestamp = new Date(parseInt(payloadTimestamp));
        } else {
          acceptanceTimestamp = new Date(payloadTimestamp);
        }
      }
      
      const TWENTY_FOUR_HOURS_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (acceptanceTimestamp && acceptanceTimestamp < TWENTY_FOUR_HOURS_AGO) {
        console.log(`[LinkedIn Webhook] ⏭️ Skipping old acceptance (${acceptanceTimestamp.toISOString()}) - older than 24 hours`);
        return {
          success: true,
          leadId: lead.id,
          skipped: true,
          reason: 'acceptance_too_old',
          timestamp: acceptanceTimestamp.toISOString()
        };
      }
      
      // CHECK 2: Check if we've already called this lead
      const existingCallQuery = `
        SELECT cl.id, cl.started_at, cl.status
        FROM voice_agent.call_logs_voiceagent cl
        WHERE cl.target::text = $1::text
          AND cl.target IS NOT NULL
          AND cl.added_context LIKE '%LinkedIn connection request%'
          AND cl.started_at > NOW() - INTERVAL '7 days'
        ORDER BY cl.started_at DESC
      `;
      
      const existingCallResult = await this.pool.query(existingCallQuery, [lead.id]);
      const callCount = existingCallResult.rows.length;
      
      if (callCount > 0) {
        const existingCall = existingCallResult.rows[0];
        console.log(`[LinkedIn Webhook] ⏭️ Skipping - call already made (call_id: ${existingCall.id}, total calls: ${callCount})`);
        return {
          success: true,
          leadId: lead.id,
          skipped: true,
          reason: 'call_already_made',
          existingCallId: existingCall.id,
          callCount: callCount
        };
      }
      
      // Also check if stage is already "call_triggered"
      if (lead.stage === 'call_triggered') {
        console.log(`[LinkedIn Webhook] ⏭️ Skipping - lead stage is already "call_triggered"`);
        return {
          success: true,
          leadId: lead.id,
          skipped: true,
          reason: 'stage_already_call_triggered'
        };
      }
      
      // Find the "request accepted" stage key
      const stageQuery = `
        SELECT key
        FROM lead_stages
        WHERE organization_id = $1
          AND (LOWER(key) LIKE '%request_accepted%' 
               OR LOWER(key) LIKE '%connection_accepted%'
               OR LOWER(key) LIKE '%accepted%')
        ORDER BY display_order ASC
        LIMIT 1
      `;
      
      const stageResult = await this.pool.query(stageQuery, [lead.organization_id]);
      const acceptedStageKey = stageResult.rows.length > 0 
        ? stageResult.rows[0].key 
        : 'request_accepted';
      
      // Update lead status
      const updateQuery = `
        UPDATE leads
        SET status = 'request_accepted',
            stage = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, status, stage, phone, email, company, job_title, organization_id
      `;
      
      const updateResult = await this.pool.query(updateQuery, [acceptedStageKey, lead.id]);
      
      if (updateResult.rows.length > 0) {
        const updatedLead = updateResult.rows[0];
        console.log('[LinkedIn Webhook] ✅ Updated lead:', {
          id: updatedLead.id,
          status: updatedLead.status,
          stage: updatedLead.stage
        });
        
        // Automatically reveal phone number - checks LinkedIn first, then Apollo
        const phoneRevealResult = await this.revealPhoneNumber(updatedLead, normalizedUrl);
        
        // Get updated lead with phone
        const updatedLeadWithPhone = await this.pool.query(
          `SELECT id, name, phone, email, company, job_title, organization_id FROM leads WHERE id = $1`,
          [updatedLead.id]
        );
        const leadWithPhone = updatedLeadWithPhone.rows[0] || updatedLead;
        
        // CHECK 3: Double-check if call was made after phone reveal
        const phoneNumber = leadWithPhone.phone || (phoneRevealResult.success ? phoneRevealResult.phone : null);
        if (phoneNumber) {
          const recentCallCheck = await this.pool.query(`
            SELECT cl.id, cl.started_at
            FROM voice_agent.call_logs_voiceagent cl
            INNER JOIN leads l ON l.id::text = cl.target::text
            WHERE l.phone = $1
              AND cl.target IS NOT NULL
              AND cl.added_context LIKE '%LinkedIn connection request%'
              AND cl.started_at > NOW() - INTERVAL '7 days'
            ORDER BY cl.started_at DESC
            LIMIT 1
          `, [phoneNumber]);
          
          if (recentCallCheck.rows.length > 0) {
            console.log(`[LinkedIn Webhook] ⏭️ Skipping - call already made for phone ${phoneNumber}`);
            return {
              success: true,
              leadId: lead.id,
              skipped: true,
              reason: 'call_already_made_for_phone'
            };
          }
        }
        
        // Trigger call if phone is available
        const autoCallEnabled = process.env.LINKEDIN_AUTO_CALL_ENABLED !== 'false';
        const batchModeEnabled = process.env.LINKEDIN_BATCH_CALL_ENABLED === 'true';
        let callResult = null;
        
        if (autoCallEnabled && !batchModeEnabled) {
          if (leadWithPhone.phone && leadWithPhone.phone.trim() !== '') {
            console.log('[LinkedIn Webhook] 📱 Phone available, triggering auto-call immediately');
            callResult = await this.triggerAutoCall(leadWithPhone, normalizedUrl);
          } else if (phoneRevealResult.success && phoneRevealResult.fromLinkedIn && phoneRevealResult.phone) {
            console.log('[LinkedIn Webhook] 📱 Phone found from LinkedIn, triggering auto-call');
            const leadForCall = { ...leadWithPhone, phone: phoneRevealResult.phone };
            callResult = await this.triggerAutoCall(leadForCall, normalizedUrl);
          } else {
            console.log('[LinkedIn Webhook] ⏳ Phone not available yet. Will auto-call after phone reveal via Apollo webhook.');
          }
        } else if (autoCallEnabled && batchModeEnabled) {
          console.log('[LinkedIn Webhook] 📦 Batch mode enabled - call will be processed in scheduled batch');
          callResult = { success: true, queued: true, message: 'Queued for batch processing' };
        } else {
          console.log('[LinkedIn Webhook] ⏭️ Auto-call is disabled (LINKEDIN_AUTO_CALL_ENABLED=false)');
        }
        
        return {
          success: true,
          leadId: lead.id,
          updatedStatus: 'request_accepted',
          phoneRevealTriggered: phoneRevealResult,
          autoCallTriggered: callResult,
          note: callResult 
            ? (phoneRevealResult.fromLinkedIn ? 'Called immediately (phone from LinkedIn)' : 'Called immediately (phone was cached)')
            : 'Will call after phone reveal'
        };
      }
      
      return {
        success: true,
        leadId: lead.id,
        updatedStatus: 'request_accepted'
      };
    } catch (error) {
      console.error('[LinkedIn Webhook] Error handling connection accepted:', error);
      throw error;
    }
  }

  /**
   * Handle connection sent event
   */
  async handleConnectionSent(payload) {
    try {
      const data = payload.data || payload;
      const recipient = data.recipient || {};
      const linkedinUrl = recipient.linkedin_profile_url || 
                         recipient.profile_url || 
                         recipient.linkedin_url ||
                         data.linkedin_url;
      
      if (!linkedinUrl) {
        console.warn('[LinkedIn Webhook] No LinkedIn URL found in connection sent event');
        return;
      }
      
      console.log('[LinkedIn Webhook] 📤 Connection request sent');
      console.log('[LinkedIn Webhook] Profile URL:', linkedinUrl);
      
      const normalizedUrl = this.normalizeLinkedInUrl(linkedinUrl);
      const urlForMatching = normalizedUrl
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '');
      
      const leadQuery = `
        SELECT l.id, l.status, l.stage, l.organization_id
        FROM leads l
        LEFT JOIN lead_social ls ON l.id = ls.lead_id
        WHERE (
          ls.linkedin = $1
          OR REPLACE(REPLACE(REPLACE(ls.linkedin, 'https://', ''), 'http://', ''), 'www.', '') = $2
          OR ls.linkedin LIKE $3
        )
        AND l.is_deleted = FALSE
        ORDER BY l.updated_at DESC
        LIMIT 1
      `;
      
      const leadResult = await this.pool.query(leadQuery, [
        normalizedUrl,
        urlForMatching,
        `%${urlForMatching}%`
      ]);
      
      if (leadResult.rows.length === 0) {
        console.log('[LinkedIn Webhook] No lead found for LinkedIn URL:', normalizedUrl);
        return;
      }
      
      const lead = leadResult.rows[0];
      
      // Find the "request sent" stage key
      const stageQuery = `
        SELECT key, name
        FROM lead_stages
        WHERE organization_id = $1
          AND (LOWER(name) LIKE '%request sent%' 
               OR LOWER(name) LIKE '%connection sent%'
               OR LOWER(name) LIKE '%sent%')
        ORDER BY display_order ASC
        LIMIT 1
      `;
      
      const stageResult = await this.pool.query(stageQuery, [lead.organization_id]);
      const sentStageKey = stageResult.rows.length > 0 
        ? stageResult.rows[0].key 
        : 'request_sent';
      
      // Update lead status
      const updateQuery = `
        UPDATE leads
        SET status = 'request_sent',
            stage = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, status, stage
      `;
      
      const updateResult = await this.pool.query(updateQuery, [sentStageKey, lead.id]);
      
      if (updateResult.rows.length > 0) {
        console.log('[LinkedIn Webhook] ✅ Updated lead:', {
          id: updateResult.rows[0].id,
          status: updateResult.rows[0].status,
          stage: updateResult.rows[0].stage
        });
      }
      
      return {
        success: true,
        leadId: lead.id,
        updatedStatus: 'request_sent'
      };
    } catch (error) {
      console.error('[LinkedIn Webhook] Error handling connection sent:', error);
      throw error;
    }
  }

  /**
   * Handle connection declined event
   */
  async handleConnectionDeclined(payload) {
    try {
      const data = payload.data || payload;
      const recipient = data.recipient || {};
      const linkedinUrl = recipient.linkedin_profile_url || 
                         recipient.profile_url || 
                         recipient.linkedin_url ||
                         data.linkedin_url;
      
      if (!linkedinUrl) {
        console.warn('[LinkedIn Webhook] No LinkedIn URL found in connection declined event');
        return;
      }
      
      console.log('[LinkedIn Webhook] ❌ Connection declined');
      console.log('[LinkedIn Webhook] Profile URL:', linkedinUrl);
      
      const normalizedUrl = this.normalizeLinkedInUrl(linkedinUrl);
      const urlForMatching = normalizedUrl
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '');
      
      const leadQuery = `
        SELECT l.id, l.status, l.stage, l.organization_id
        FROM leads l
        LEFT JOIN lead_social ls ON l.id = ls.lead_id
        WHERE (
          ls.linkedin = $1
          OR REPLACE(REPLACE(REPLACE(ls.linkedin, 'https://', ''), 'http://', ''), 'www.', '') = $2
          OR ls.linkedin LIKE $3
        )
        AND l.is_deleted = FALSE
        ORDER BY l.updated_at DESC
        LIMIT 1
      `;
      
      const leadResult = await this.pool.query(leadQuery, [
        normalizedUrl,
        urlForMatching,
        `%${urlForMatching}%`
      ]);
      
      if (leadResult.rows.length === 0) {
        console.log('[LinkedIn Webhook] No lead found for LinkedIn URL:', normalizedUrl);
        return;
      }
      
      const lead = leadResult.rows[0];
      
      // Update lead status
      const updateQuery = `
        UPDATE leads
        SET status = 'request_declined',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, status
      `;
      
      const updateResult = await this.pool.query(updateQuery, [lead.id]);
      
      if (updateResult.rows.length > 0) {
        console.log('[LinkedIn Webhook] ✅ Updated lead to declined:', {
          id: updateResult.rows[0].id,
          status: updateResult.rows[0].status
        });
      }
      
      return {
        success: true,
        leadId: lead.id,
        updatedStatus: 'request_declined'
      };
    } catch (error) {
      console.error('[LinkedIn Webhook] Error handling connection declined:', error);
      throw error;
    }
  }

  /**
   * Handle account status changed event
   * 
   * Handles Unipile AccountStatus webhook format:
   * { "AccountStatus": { "account_id": "...", "account_type": "LINKEDIN", "message": "OK|ERROR|CREDENTIALS|..." } }
   */
  async handleAccountStatusChanged(payload) {
    try {
      const unipileAccountId = payload.account_id || 
                              payload.accountId || 
                              payload.id ||
                              (payload.data && (payload.data.account_id || payload.data.accountId || payload.data.id));
      
      if (!unipileAccountId) {
        console.warn('[LinkedIn Webhook] No account ID in status changed event');
        return;
      }
      
      const statusMessage = payload.message || 
                           payload.status || 
                           payload.state || 
                           (payload.data && (payload.data.message || payload.data.status || payload.data.state)) ||
                           'unknown';
      
      console.log('[LinkedIn Webhook] 🔄 Account status changed:', unipileAccountId);
      console.log('[LinkedIn Webhook] Status message:', statusMessage);
      
      // Map Unipile status messages to our status values
      let mappedStatus = 'unknown';
      let isConnected = false;
      
      switch (statusMessage.toUpperCase()) {
        case 'OK':
        case 'CREATION_SUCCESS':
        case 'RECONNECTED':
        case 'SYNC_SUCCESS':
          mappedStatus = 'connected';
          isConnected = true;
          break;
        case 'ERROR':
        case 'STOPPED':
          mappedStatus = 'stopped';
          isConnected = false;
          break;
        case 'CREDENTIALS':
          mappedStatus = 'checkpoint';
          isConnected = false;
          break;
        case 'CONNECTING':
          mappedStatus = 'connecting';
          isConnected = false;
          break;
        case 'DELETED':
          mappedStatus = 'disconnected';
          isConnected = false;
          break;
        default:
          if (statusMessage.toLowerCase().includes('connected') || statusMessage.toLowerCase().includes('active')) {
            mappedStatus = 'connected';
            isConnected = true;
          } else if (statusMessage.toLowerCase().includes('disconnected') || statusMessage.toLowerCase().includes('stopped')) {
            mappedStatus = 'disconnected';
            isConnected = false;
          } else if (statusMessage.toLowerCase().includes('checkpoint') || statusMessage.toLowerCase().includes('credential')) {
            mappedStatus = 'checkpoint';
            isConnected = false;
          }
      }
      
      console.log('[LinkedIn Webhook] Mapped status:', statusMessage, '->', mappedStatus, '(connected:', isConnected, ')');
      
      // Update linkedin_integrations table
      const updateQuery = `
        UPDATE linkedin_integrations
        SET 
          is_active = $1,
          updated_at = CURRENT_TIMESTAMP,
          connection_data = COALESCE(connection_data, '{}'::jsonb) || jsonb_build_object(
            'status', $2,
            'status_message', $3,
            'last_status_update', $4
          )
        WHERE unipile_account_id = $5
        RETURNING user_id, profile_name, email
      `;
      
      const updateResult = await this.pool.query(updateQuery, [
        isConnected,
        mappedStatus,
        statusMessage,
        new Date().toISOString(),
        unipileAccountId
      ]);
      
      if (updateResult.rows.length > 0) {
        const { user_id, profile_name, email } = updateResult.rows[0];
        console.log('[LinkedIn Webhook] ✅ Updated linkedin_integrations:', {
          unipileAccountId,
          userId: user_id,
          profileName: profile_name || email,
          status: mappedStatus,
          isActive: isConnected
        });
      } else {
        console.warn('[LinkedIn Webhook] ⚠️ No linkedin_integrations record found for account:', unipileAccountId);
      }
      
      return {
        success: true,
        unipileAccountId,
        status: mappedStatus,
        statusMessage,
        isConnected
      };
    } catch (error) {
      console.error('[LinkedIn Webhook] Error handling account status changed:', error);
      throw error;
    }
  }

  /**
   * Reveal phone number via Apollo API when connection is accepted
   * NEW FLOW: First checks LinkedIn profile for contact details, then falls back to Apollo
   */
  async revealPhoneNumber(lead, linkedinUrl) {
    try {
      // STEP 1: Check if phone already exists
      if (lead.phone) {
        console.log(`[LinkedIn Webhook] 📱 Lead ${lead.id} already has phone: ${lead.phone}`);
        return {
          success: true,
          alreadyExists: true,
          phone: lead.phone
        };
      }
      
      // STEP 2: Check employees_cache for existing phone
      try {
        const cacheQuery = `
          SELECT employee_phone, apollo_person_id
          FROM employees_cache
          WHERE employee_linkedin_url = $1
            OR REPLACE(REPLACE(REPLACE(employee_linkedin_url, 'https://', ''), 'http://', ''), 'www.', '') = REPLACE(REPLACE(REPLACE($1, 'https://', ''), 'http://', ''), 'www.', '')
          LIMIT 1
        `;
        const cacheResult = await this.pool.query(cacheQuery, [linkedinUrl]);
        
        if (cacheResult.rows.length > 0 && cacheResult.rows[0].employee_phone) {
          const cached = cacheResult.rows[0];
          console.log(`[LinkedIn Webhook] 📱 Found existing phone in employees_cache: ${cached.employee_phone}`);
          
          await this.pool.query(`
            UPDATE leads
            SET phone = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND (phone IS NULL OR phone = '')
          `, [cached.employee_phone, lead.id]);
          
          return {
            success: true,
            fromCache: true,
            phone: cached.employee_phone
          };
        }
      } catch (cacheError) {
        console.warn(`[LinkedIn Webhook] ⚠️ Error checking employees_cache:`, cacheError.message);
      }
      
      // STEP 3: Check LinkedIn profile directly (new step)
      console.log(`[LinkedIn Webhook] 🔍 Checking LinkedIn profile for contact details`);
      console.log(`[LinkedIn Webhook] ℹ️ LinkedIn contact details check not implemented yet`);
      console.log(`[LinkedIn Webhook] ℹ️ Will proceed to Apollo fallback`);
      
      // STEP 4: Fallback to Apollo
      console.log(`[LinkedIn Webhook] ⚠️ Apollo phone reveal not implemented in this service`);
      console.log(`[LinkedIn Webhook] ℹ️ Phone will need to be revealed through Apollo integration`);
      
      return {
        success: false,
        error: 'No phone number available',
        message: 'Phone reveal requires Apollo integration'
      };
      
    } catch (error) {
      console.error('[LinkedIn Webhook] ❌ Error in phone reveal:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Trigger automatic call for a lead when connection is accepted
   */
  async triggerAutoCall(lead, linkedinUrl) {
    const autoCallEnabled = process.env.LINKEDIN_AUTO_CALL_ENABLED !== 'false';
    if (!autoCallEnabled) {
      console.log('[LinkedIn Webhook] ⏭️ Auto-call is disabled (LINKEDIN_AUTO_CALL_ENABLED=false)');
      return {
        success: false,
        error: 'Auto-call is disabled',
        leadId: lead.id
      };
    }
    
    try {
      let phoneNumber = lead.phone;
      
      // Try to get phone from employees_cache if not in lead
      if (!phoneNumber) {
        try {
          const cacheQuery = `
            SELECT employee_phone
            FROM employees_cache
            WHERE employee_linkedin_url = $1
              AND employee_phone IS NOT NULL
              AND employee_phone != ''
            LIMIT 1
          `;
          const cacheResult = await this.pool.query(cacheQuery, [linkedinUrl]);
          if (cacheResult.rows.length > 0) {
            phoneNumber = cacheResult.rows[0].employee_phone;
          }
        } catch (cacheError) {
          console.warn(`[LinkedIn Webhook] ⚠️ Error checking employees_cache:`, cacheError.message);
        }
      }
      
      if (!phoneNumber) {
        console.log(`[LinkedIn Webhook] ⚠️ Lead ${lead.id} (${lead.name}) has no phone number, skipping call`);
        return {
          success: false,
          error: 'No phone number available',
          leadId: lead.id
        };
      }
      
      // Clean phone number
      let cleanPhone = String(phoneNumber).trim()
        .replace(/\s+/g, '')
        .replace(/-/g, '')
        .replace(/[()\.]/g, '');
      
      if (cleanPhone.startsWith('+')) {
        cleanPhone = '+' + cleanPhone.substring(1).replace(/\D/g, '');
      } else {
        cleanPhone = cleanPhone.replace(/\D/g, '');
      }
      
      if (!cleanPhone || cleanPhone.length < 5) {
        console.warn(`[LinkedIn Webhook] ⚠️ Invalid phone number: ${cleanPhone}`);
        return {
          success: false,
          error: 'Invalid phone number format',
          leadId: lead.id
        };
      }
      
      // Get agent_id
      let agentId = lead.agent_id || null;
      
      if (!agentId && lead.organization_id) {
        try {
          const orgQuery = `
            SELECT os.value
            FROM organization_settings os
            WHERE os.organization_id = $1
            AND os.key = 'default_agent_id'
            LIMIT 1
          `;
          const orgResult = await this.pool.query(orgQuery, [lead.organization_id]);
          if (orgResult.rows.length > 0) {
            agentId = orgResult.rows[0].value;
          }
        } catch (orgError) {
          console.warn(`[LinkedIn Webhook] ⚠️ Error fetching organization agent:`, orgError.message);
        }
      }
      
      if (!agentId) {
        agentId = process.env.DEFAULT_VOICE_AGENT_ID || '24';
      }
      
      // Build call context
      const leadName = lead.name || 'LinkedIn Connection';
      const companyName = lead.company || '';
      const title = lead.job_title || '';
      const addedContext = `Calling ${leadName}${companyName ? ` from ${companyName}` : ''}${title ? `, ${title}` : ''} who just accepted our LinkedIn connection request.`;
      
      console.log(`[LinkedIn Webhook] 📞 Triggering automatic call for lead: ${leadName} (${cleanPhone})`);
      
      // Call the voiceagent API
      const DEFAULT_INTERNAL_API_URL = process.env.DEFAULT_INTERNAL_API_URL || 'http://localhost:3004';
      let API_BASE_URL = process.env.INTERNAL_API_URL || process.env.BASE_URL || DEFAULT_INTERNAL_API_URL;
      if (API_BASE_URL.includes('ngrok')) {
        API_BASE_URL = DEFAULT_INTERNAL_API_URL;
      }
      
      const callResponse = await axios.post(`${API_BASE_URL}/api/voiceagent/calls`, {
        agent_id: agentId,
        to_number: cleanPhone,
        lead_name: leadName,
        added_context: addedContext,
        initiated_by: 'system_auto_call',
        lead_id: lead.id,
        source: 'linkedin_connection_accepted'
      }, {
        timeout: Number(process.env.AUTO_CALL_API_TIMEOUT_MS) || 10000
      });
      
      const callInitiated = callResponse.data?.success !== false;
      
      if (callInitiated) {
        // Update lead stage to "call_triggered"
        try {
          const callTriggeredStageQuery = `
            SELECT key
            FROM lead_stages
            WHERE organization_id = $1
              AND (LOWER(key) LIKE '%call_triggered%' 
                   OR LOWER(key) LIKE '%call%triggered%'
                   OR LOWER(key) LIKE '%triggered%')
            ORDER BY display_order ASC
            LIMIT 1
          `;
          const stageResult = await this.pool.query(callTriggeredStageQuery, [lead.organization_id]);
          const callTriggeredStageKey = stageResult.rows.length > 0 
            ? stageResult.rows[0].key 
            : 'call_triggered';
          
          await this.pool.query(`
            UPDATE leads
            SET stage = $1,
                status = 'call_triggered',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [callTriggeredStageKey, lead.id]);
          
          console.log(`[LinkedIn Webhook] ✅ Updated lead stage to "${callTriggeredStageKey}"`);
        } catch (stageUpdateError) {
          console.warn(`[LinkedIn Webhook] ⚠️ Error updating lead stage:`, stageUpdateError.message);
        }
        
        console.log(`[LinkedIn Webhook] ✅ Call initiated for ${leadName}`);
      }
      
      return {
        success: callInitiated,
        leadId: lead.id,
        leadName,
        phone: cleanPhone,
        agentId,
        callData: callResponse.data
      };
    } catch (error) {
      console.error(`[LinkedIn Webhook] ❌ Error in triggerAutoCall:`, error.message);
      return {
        success: false,
        leadId: lead.id,
        error: error.message
      };
    }
  }

  /**
   * Normalize LinkedIn URL for matching
   */
  normalizeLinkedInUrl(url) {
    if (!url) return null;
    
    let normalized = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
    
    const match = normalized.match(/linkedin\.com\/in\/([^/?]+)/);
    if (match) {
      return `https://www.linkedin.com/in/${match[1]}`;
    }
    
    if (normalized.includes('linkedin.com/in/')) {
      return `https://www.${normalized.split('?')[0]}`;
    }
    
    return url;
  }
}

module.exports = LinkedInWebhookService;
