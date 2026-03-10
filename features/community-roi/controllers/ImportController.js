const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const MemberRepository = require('../repositories/MemberRepository');
const InteractionRepository = require('../repositories/InteractionRepository');
const { memberValidator } = require('../validators');
const logger = require('../../../core/utils/logger');
const { getSchema } = require('../../../core/utils/schemaHelper');

class ImportController {
  /**
   * Import data from Excel file
   */
  async importExcel(req, res) {
    try {
      // Log incoming request details for debugging
      logger.debug('[ImportController] Import request received', { 
        method: req.method,
        contentType: req.get('content-type'),
        hasFile: !!req.file,
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        hasUser: !!req.user,
        userKeys: req.user ? Object.keys(req.user) : []
      });

      // Validate file was uploaded
      if (!req.file) {
        logger.warn('[ImportController] No file in request', {
          headers: req.headers,
          contentType: req.get('content-type')
        });
        return res.status(400).json({ 
          success: false, 
          error: 'No file uploaded',
          hint: 'Ensure you send the file as "file" field in multipart/form-data'
        });
      }

      // Extract tenant ID from authenticated user context
      // The tenant ID should be set by auth middleware on req.user
      const tenantId = req.user?.tenantId || req.user?.tenant_id || req.user?.organizationId;
      
      if (!tenantId) {
        logger.warn('[ImportController] Tenant ID missing from auth context', {
          user: req.user ? { 
            id: req.user.id,
            email: req.user.email,
            keys: Object.keys(req.user)
          } : 'not authenticated'
        });
        return res.status(401).json({ 
          success: false, 
          error: 'Tenant context required - user must be authenticated',
          hint: 'Ensure you are logged in with valid credentials'
        });
      }

      logger.info('[ImportController] Processing Excel file', { 
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        tenantId 
      });

      // Parse Excel file
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const stats = {
        membersProcessed: 0,
        interactionsProcessed: 0,
        sheetsFound: workbook.SheetNames.length
      };

      logger.debug('[ImportController] Workbook loaded', { 
        sheets: workbook.SheetNames,
        tenantId
      });

      // Initialize repositories
      const memberRepository = require('../repositories/MemberRepository');
      const interactionRepository = require('../repositories/InteractionRepository');

      // Extract members and interactions
      const { members, interactions, referrals } = await this.parseExcelData(
        workbook, 
        tenantId, 
        memberRepository, 
        interactionRepository
      );

      logger.info('[ImportController] Data extraction complete', { 
        memberCount: members.length,
        interactionCount: interactions,
        referralCount: referrals,
        tenantId
      });
      
      stats.membersProcessed = members.length;
      stats.interactionsProcessed = interactions;
      stats.referralsProcessed = referrals;

      // Return success response with actual import statistics
      logger.info('[ImportController] File processed successfully', { tenantId, stats });
      return res.json({
        success: true,
        message: 'File uploaded and data imported successfully',
        stats,
        tenantId,
        details: {
          uniqueMembers: members.length,
          totalInteractions: interactions,
          totalReferrals: referrals
        }
      });

    } catch (error) {
      logger.error('[ImportController] Error processing file', { 
        error: error.message,
        stack: error.stack,
        fileName: req.file?.originalname
      });
      
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        type: error.name
      });
    }
  }

  /**
   * Parse Excel workbook and extract members, interactions, and referrals
   */
  async parseExcelData(workbook, tenantId, memberRepository, interactionRepository) {
    const members = [];
    const memberMap = {}; // Map of member name -> member ID for quick lookup
    let interactionCount = 0;
    let referralCount = 0;

    try {
      // Step 1: Extract members from the Combination Matrix or One To One sheet
      logger.debug('[ImportController] Starting member extraction', { tenantId });
      
      const combinationSheetName = workbook.SheetNames.find(n => 
        n.toLowerCase().includes('combination') || 
        n.toLowerCase().includes('matrix')
      );
      
      const oneToOneSheetName = workbook.SheetNames.find(n => 
        n.toLowerCase().includes('one') && n.toLowerCase().includes('one')
      );

      let memberNames = new Set();

      // Extract members from Combination Matrix
      if (combinationSheetName) {
        logger.debug('[ImportController] Parsing Combination Matrix sheet', { sheetName: combinationSheetName, tenantId });
        const sheet = workbook.Sheets[combinationSheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet);
        
        if (Array.isArray(rawData) && rawData.length > 0) {
          // Get member names from rows (first column typically contains names)
          const firstKey = Object.keys(rawData[0])[0];
          rawData.forEach(row => {
            const memberName = row[firstKey];
            if (memberName && memberName !== 'Member' && typeof memberName === 'string') {
              memberNames.add(memberName.trim());
            }
          });

          // Get member names from columns (headers)
          Object.keys(rawData[0]).slice(1).forEach(colName => {
            if (colName && colName !== 'Member') {
              memberNames.add(colName.trim());
            }
          });
        }
      }

      // Extract members from One To One Matrix if Combination not found
      if (oneToOneSheetName && memberNames.size === 0) {
        logger.debug('[ImportController] Parsing One To One Matrix sheet', { sheetName: oneToOneSheetName, tenantId });
        const sheet = workbook.Sheets[oneToOneSheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet);
        
        if (Array.isArray(rawData) && rawData.length > 0) {
          const firstKey = Object.keys(rawData[0])[0];
          rawData.forEach(row => {
            const memberName = row[firstKey];
            if (memberName && memberName !== 'Member' && typeof memberName === 'string') {
              memberNames.add(memberName.trim());
            }
          });

          Object.keys(rawData[0]).slice(1).forEach(colName => {
            if (colName && colName !== 'Member') {
              memberNames.add(colName.trim());
            }
          });
        }
      }

      logger.info('[ImportController] Extracted member names', { 
        count: memberNames.size,
        tenantId,
        sampleNames: Array.from(memberNames).slice(0, 5)
      });

      // Filter out invalid placeholders BEFORE processing
      const validMemberNames = new Set();
      const skippedMembers = [];
      
      for (const memberName of memberNames) {
        if (memberValidator.isInvalidMemberName(memberName)) {
          skippedMembers.push(memberName);
          logger.info('[ImportController] Skipping invalid member name (placeholder data)', { 
            name: memberName,
            reason: '__EMPTY or blank name'
          });
        } else {
          validMemberNames.add(memberName);
        }
      }

      if (skippedMembers.length > 0) {
        logger.warn('[ImportController] Filtered out invalid member names', { 
          skippedCount: skippedMembers.length,
          skippedNames: skippedMembers,
          remainingCount: validMemberNames.size
        });
      }

      // Fetch all existing members once (optimization)
      const existingMembers = await memberRepository.getAllMembers(tenantId).catch(() => []);
      const existingMemberMap = {};
      existingMembers.forEach(m => {
        existingMemberMap[m.name?.toLowerCase()] = m;
      });

      logger.debug('[ImportController] Fetched existing members', { 
        count: existingMembers.length,
        tenantId
      });

      // Step 2: Create/update members in database (only valid names)
      for (const memberName of validMemberNames) {
        try {
          const normalizedName = memberName.toLowerCase();
          const existing = existingMemberMap[normalizedName];

          if (existing) {
            memberMap[memberName] = existing.id;
            logger.debug('[ImportController] Member already exists', { 
              name: memberName, 
              id: existing.id 
            });
          } else {
            // Create new member
            const created = await memberRepository.createMember(tenantId, {
              name: memberName,
              email: `${memberName.toLowerCase().replace(/\s+/g, '.')}@bni.local`
            });
            memberMap[memberName] = created.id;
            members.push(created);
            logger.debug('[ImportController] Created new member', { 
              name: memberName, 
              id: created.id 
            });
          }
        } catch (error) {
          logger.warn('[ImportController] Error creating member', { 
            name: memberName,
            error: error.message,
            tenantId
          });
        }
      }

      // Step 3: Parse interactions from One To One Matrix
      if (oneToOneSheetName) {
        logger.debug('[ImportController] Parsing interactions from One To One sheet', { tenantId });
        const sheet = workbook.Sheets[oneToOneSheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet);
        
        let invalidInteractions = 0;
        let skippedInteractions = 0;
        
        if (Array.isArray(rawData) && rawData.length > 0) {
          const firstKey = Object.keys(rawData[0])[0];

          for (const row of rawData) {
            const memberAName = row[firstKey];
            if (!memberAName || memberAName === 'Member') continue;

            // Validate member A exists and is valid
            const memberACheck = interactionValidator.validateMemberExists(memberAName, memberMap);
            if (!memberACheck.exists) {
              logger.debug('[ImportController] Skipping row (member_a not found)', { 
                name: memberAName,
                reason: memberACheck.reason
              });
              skippedInteractions++;
              continue;
            }

            const memberAId = memberACheck.memberId;

            // Process each column (every other member)
            for (const colName of Object.keys(row).slice(1)) {
              const meetingCount = row[colName];

              // Validate the cell data
              const cellValidation = interactionValidator.validateMatrixCell(memberAName, colName, meetingCount);
              if (!cellValidation.valid) {
                if (cellValidation.shouldSkip) {
                  skippedInteractions++;
                }
                continue;
              }

              // Validate member B exists
              const memberBCheck = interactionValidator.validateMemberExists(colName, memberMap);
              if (!memberBCheck.exists) {
                logger.debug('[ImportController] Skipping interaction (member_b not found)', { 
                  memberA: memberAName,
                  memberB: colName,
                  reason: memberBCheck.reason
                });
                skippedInteractions++;
                continue;
              }

              const memberBId = memberBCheck.memberId;

              // Avoid duplicate interactions (A-B and B-A)
              if (memberAId !== memberBId) {
                // Validate meeting data before creating
                const meetingValidation = interactionValidator.validateMeeting({
                  memberAId,
                  memberBId,
                  meetingCount: parseInt(meetingCount, 10)
                });

                if (!meetingValidation.valid) {
                  logger.warn('[ImportController] Invalid interaction data', { 
                    memberA: memberAName,
                    memberB: colName,
                    count: meetingCount,
                    error: meetingValidation.error
                  });
                  invalidInteractions++;
                  continue;
                }

                try {
                  // Log the meeting/interaction
                  await interactionRepository.logMeeting(tenantId, {
                    memberAId,
                    memberBId,
                    metadata: {
                      meetingCount: parseInt(meetingCount, 10),
                      importedAt: new Date().toISOString()
                    }
                  });
                  interactionCount++;
                } catch (error) {
                  logger.warn('[ImportController] Error logging interaction', { 
                    memberA: memberAName,
                    memberB: colName,
                    count: meetingCount,
                    error: error.message
                  });
                  invalidInteractions++;
                }
              }
            }
          }

          logger.info('[ImportController] Interactions imported', {
            imported: interactionCount,
            invalid: invalidInteractions,
            skipped: skippedInteractions,
            total: interactionCount + invalidInteractions + skippedInteractions
          });
        }
      }

      // Step 4: Parse referrals if Referral Matrix exists
      const referralSheetName = workbook.SheetNames.find(n => 
        n.toLowerCase().includes('referral')
      );
      
      if (referralSheetName) {
        logger.debug('[ImportController] Parsing referrals from Referral Matrix sheet', { tenantId });
        const sheet = workbook.Sheets[referralSheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet);
        
        let invalidReferrals = 0;
        let skippedReferrals = 0;
        
        if (Array.isArray(rawData) && rawData.length > 0) {
          const firstKey = Object.keys(rawData[0])[0];

          for (const row of rawData) {
            const referrerName = row[firstKey];
            if (!referrerName || referrerName === 'Member') continue;

            // Validate referrer exists
            const referrerCheck = interactionValidator.validateMemberExists(referrerName, memberMap);
            if (!referrerCheck.exists) {
              logger.debug('[ImportController] Skipping referral row (referrer not found)', { 
                name: referrerName,
                reason: referrerCheck.reason
              });
              skippedReferrals++;
              continue;
            }

            const referrerId = referrerCheck.memberId;

            for (const colName of Object.keys(row).slice(1)) {
              const referralCount_val = row[colName];

              // Validate the cell data
              const cellValidation = interactionValidator.validateMatrixCell(referrerName, colName, referralCount_val);
              if (!cellValidation.valid) {
                if (cellValidation.shouldSkip) {
                  skippedReferrals++;
                }
                continue;
              }

              // Validate recipient exists
              const recipientCheck = interactionValidator.validateMemberExists(colName, memberMap);
              if (!recipientCheck.exists) {
                logger.debug('[ImportController] Skipping referral (recipient not found)', { 
                  referrer: referrerName,
                  recipient: colName,
                  reason: recipientCheck.reason
                });
                skippedReferrals++;
                continue;
              }

              const recipientId = recipientCheck.memberId;

              // Validate referral data
              const referralValidation = interactionValidator.validateReferral({
                referrerId,
                referredId: recipientId,
                referralCount: parseInt(referralCount_val, 10)
              });

              if (!referralValidation.valid) {
                logger.warn('[ImportController] Invalid referral data', { 
                  referrer: referrerName,
                  recipient: colName,
                  count: referralCount_val,
                  error: referralValidation.error
                });
                invalidReferrals++;
                continue;
              }

              try {
                // Count valid referrals
                referralCount += parseInt(referralCount_val, 10);
              } catch (error) {
                logger.warn('[ImportController] Error processing referral', { 
                  referrer: referrerName,
                  recipient: colName,
                  count: referralCount_val,
                  error: error.message
                });
                invalidReferrals++;
              }
            }
          }

          logger.info('[ImportController] Referrals imported', {
            imported: referralCount,
            invalid: invalidReferrals,
            skipped: skippedReferrals,
            total: referralCount + invalidReferrals + skippedReferrals
          });
        }
      }

      logger.info('[ImportController] Data extraction complete', { 
        members: members.length,
        interactions: interactionCount,
        referrals: referralCount,
        tenantId
      });

      return {
        members,
        interactions: interactionCount,
        referrals: referralCount
      };

    } catch (error) {
      logger.error('[ImportController] Error parsing Excel data', { 
        error: error.message,
        stack: error.stack,
        tenantId
      });
      throw error;
    }
  }
}

module.exports = new ImportController();
