# Campaign Fixes - Testing Summary

## ✅ FIXES IMPLEMENTED

### 1. Apollo Enrichment API Key Fix
**File**: `LAD-Backend/features/campaigns/services/LeadGenerationService.js`  
**Issue**: ApolloRevealService was instantiated without API key  
**Fix**: Now reads `APOLLO_API_KEY` from environment and passes it to constructor

**Before**:
```javascript
ApolloRevealService = new ApolloRevealServiceClass();
```

**After**:
```javascript
const apiKey = process.env.APOLLO_API_KEY;
const baseUrl = process.env.APOLLO_BASE_URL || 'https://api.apollo.io/v1';
ApolloRevealService = new ApolloRevealServiceClass(apiKey, baseUrl);
```

**Verification**:
- ✓ API key configured in `.env`: `APOLLO_API_KEY=fBzLFEwNvISMZHVhKWKBjw`
- ✓ Check backend logs after restart for successful enrichment

---

### 2. Lead Limit Priority Fix
**File**: `LAD-Backend/features/campaigns/services/LeadGenerationService.js`  
**Issue**: Campaign default (10) was overriding step limit (e.g., 3 or 5)  
**Fix**: Changed priority to check step limit FIRST, then fallback to campaign config

**Before**:
```javascript
const dailyLimit = config.leads_per_day || stepLimit || 100;
```

**After**:
```javascript
const hasValidStepLimit = stepLimit && !isNaN(stepLimit) && stepLimit > 0;
const dailyLimit = hasValidStepLimit ? stepLimit : (config.leads_per_day || 100);
```

**Verification**:
- Create campaign with step limit = 3
- Should generate exactly 3 leads (not fall back to campaign default)

---

### 3. Connection Message Fix
**Files**: 
- Frontend: `LAD-Frontend/web/src/components/onboarding/GuidedFlowPanel.tsx`
- Backend: `LAD-Backend/features/campaigns/services/LinkedInStepExecutor.js`

**Issue**: Empty string `""` was saved when message disabled, causing falsy checks to fail  
**Fix**: Frontend saves `null` instead of `""`, backend properly validates with `!!message`

**Frontend Before**:
```typescript
linkedinConnectionMessage: enableConnectionMessage ? linkedinConnectionMessage : ''
```

**Frontend After**:
```typescript
linkedinConnectionMessage: enableConnectionMessage ? linkedinConnectionMessage : null
```

**Backend Fix**:
```javascript
const trimmedMessage = message?.trim() || null;
const userWantsMessage = !!trimmedMessage; // Explicitly convert to boolean
```

**Verification**:
- ✓ Database shows `message: null` (not empty string)
- Check logs for `hasMessage: false, userWantsMessage: false` when disabled
- Check logs for `hasMessage: true, userWantsMessage: true` when enabled

---

### 4. Cloud Tasks Auto-Scheduling
**File**: `LAD-Backend/features/campaigns/controllers/CampaignActionsController.js`  
**Issue**: Cloud Tasks not automatically triggered when campaign starts  
**Fix**: Added automatic scheduling check in `startCampaign()` function

**Implementation**:
```javascript
// Check if campaign has start_date and end_date for Cloud Tasks scheduling
if (campaign.campaign_start_date && campaign.campaign_end_date) {
  const taskInfo = await campaignDailyScheduler.scheduleInitialTask({
    id: campaign.id,
    tenant_id: campaign.tenant_id,
    campaign_start_date: campaign.campaign_start_date,
    campaign_end_date: campaign.campaign_end_date
  });
  
  logger.info('[CampaignActions] Cloud Task scheduled for daily execution', {
    campaignId: id,
    taskName: taskInfo.taskName,
    scheduleTime: taskInfo.scheduleTime
  });
}
```

**Verification**:
- Create campaign with `start_date` and `end_date`
- Start campaign
- Check logs for: `[CampaignActions] Cloud Task scheduled for daily execution`

---

## 🧪 TESTING GUIDE

### Test 1: Lead Limit (3 leads)
1. Create new campaign via frontend
2. Set lead generation step limit to **3**
3. Set campaign default to 10 (to verify step override)
4. Start campaign
5. Wait 15 seconds
6. Run: `node verify-fixes.js`
7. **Expected**: Actual leads = 3

### Test 2: Connection Message - WITH Message
1. Create new campaign
2. Enable connection message toggle
3. Enter message: `"Hi {{first_name}}, I'd love to connect!"`
4. Start campaign
5. Check backend logs for:
   ```
   [LinkedInAccountHelper] sendConnectionRequestWithFallback called {
     "hasMessage": true,
     "userWantsMessage": true
   }
   ```

### Test 3: Connection Message - WITHOUT Message
1. Create new campaign
2. Keep connection message toggle OFF (or leave blank)
3. Start campaign
4. Check backend logs for:
   ```
   [LinkedInAccountHelper] sendConnectionRequestWithFallback called {
     "hasMessage": false,
     "userWantsMessage": false
   }
   ```

### Test 4: Cloud Tasks Scheduling
1. Create new campaign with:
   - `start_date`: Today
   - `end_date`: 3 days from now
2. Start campaign
3. Check backend logs for:
   ```
   [CampaignActions] Cloud Task scheduled for daily execution {
     campaignId: "...",
     taskName: "...",
     scheduleTime: "..."
   }
   ```

### Test 5: Apollo Enrichment
1. Restart backend server (to pick up API key fix)
2. Create new campaign
3. Start campaign
4. Check backend logs for:
   - ✓ `[Apollo Reveal] Person enriched successfully`
   - ✗ Should NOT see: `"Apollo API key is not configured"`

---

## 📊 CURRENT STATUS

### Database Verification (Last Hour)
```
Campaign: Abudhabi Manufacturing Sales Head
- Step Limit: 10
- Campaign Limit: 10  
- Actual Leads: 5
- Connection Message: null ✓
- Cloud Tasks: Not configured (no start/end dates)
```

### What's Working
- ✅ Connection message saving `null` correctly
- ✅ Apollo API key configured in environment
- ✅ Cloud Tasks integration code added
- ✅ Lead limit priority logic fixed

### What Needs Testing
- ⏳ Create NEW campaign with step limit = 3 to verify
- ⏳ Test connection WITH and WITHOUT message
- ⏳ Test campaign with start_date and end_date
- ⏳ Verify Apollo enrichment after server restart

---

## 🔍 LOG PATTERNS TO WATCH

### Success Patterns
```
✓ [Apollo Reveal] Person enriched successfully {"hasEmail":true,"hasLinkedIn":true}
✓ [LinkedInAccountHelper] sendConnectionRequestWithFallback {"hasMessage":false,"userWantsMessage":false}
✓ [CampaignActions] Cloud Task scheduled for daily execution
✓ [LeadGeneration] Using step limit {"dailyLimit":3,"source":"step limit"}
```

### Error Patterns (Should NOT see)
```
✗ [Apollo Reveal] Enrich person error {"error":"Apollo API key is not configured"}
✗ [LinkedInAccountHelper] {"hasMessage":false} but message was configured
✗ Generated 10 leads when step limit was 3
```

---

## 📝 NEXT STEPS

1. **Restart Backend** (if not already done)
   ```bash
   # The backend should restart automatically with nodemon
   # Or manually: npm start
   ```

2. **Create Test Campaign via Frontend**
   - Go to http://localhost:3000
   - Create new campaign with limit = 3
   - Enable connection message
   - Set start_date and end_date

3. **Monitor Logs**
   - Watch terminal for log patterns above
   - Run `node verify-fixes.js` after execution

4. **Verify Results**
   - Check database for correct lead counts
   - Verify connection requests sent with/without messages
   - Check GCP Console for Cloud Tasks (if configured)

---

## 🐛 TROUBLESHOOTING

### Apollo Enrichment Still Failing
- Ensure backend restarted after fix
- Check `.env` has `APOLLO_API_KEY=fBzLFEwNvISMZHVhKWKBjw`
- Verify nodemon detected changes and restarted

### Lead Limit Not Respected
- Ensure creating NEW campaign (old ones have cached limits)
- Check `campaign_steps.config.leadGenerationLimit` in database
- Should see log: `Using step limit {"dailyLimit":3}`

### Cloud Tasks Not Triggering
- Verify campaign has both `campaign_start_date` AND `campaign_end_date`
- Check if GCP credentials configured (may fail silently in local dev)
- Look for log: `[CampaignActions] Campaign started without Cloud Task scheduling`

### Connection Message Issues
- Old campaigns have `""` - create new one to test
- Check database: `SELECT config FROM campaign_steps WHERE step_type='linkedin_connect'`
- Should be `{"message": null}` or `{"message": "Hi ..."}`

---

## ✅ SUCCESS CRITERIA

All fixes considered successful when:
1. ✓ Apollo enrichment works WITHOUT "API key is not configured" errors
2. ✓ Lead limit of 3 generates exactly 3 leads
3. ✓ Connection WITHOUT message shows `userWantsMessage: false`
4. ✓ Connection WITH message shows `userWantsMessage: true`  
5. ✓ Cloud Tasks scheduled for campaigns with dates
