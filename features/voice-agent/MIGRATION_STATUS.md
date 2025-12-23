# Voice Agent Feature Migration - Started ✅

## Migration Started: December 19, 2025

Migrating voice agent functionality from `sts-service/routes/voiceagent.js` (696 lines) to the new unified backend architecture.

---

## 📋 **Migration Plan**

### Phase 1: Feature Setup ✅
- [x] Create feature manifest (manifest.js)
- [ ] Create database models service
- [ ] Create VAPI service
- [ ] Create voice agent controller
- [ ] Create routes
- [ ] Create utilities (phone resolver, greeting generator)

### Phase 2: Core Features
- [ ] Single call initiation (VAPI + custom agents)
- [ ] Batch calling with per-entry context
- [ ] Call logging and lead creation
- [ ] Voice agent management

### Phase 3: Recording & Media
- [ ] Recording signed URL generation
- [ ] GCS integration
- [ ] Voice sample management

### Phase 4: User Management
- [ ] Available agents endpoint (JWT auth)
- [ ] Available numbers endpoint (JWT auth)
- [ ] Agent/voice sample signed URLs

### Phase 5: Data Management
- [ ] Phone number resolution (company/employee)
- [ ] Sales summary updates
- [ ] Lead synchronization

### Phase 6: Documentation & Testing
- [ ] API documentation
- [ ] Usage examples
- [ ] Test suite
- [ ] Integration guide

---

## 📊 **Source Analysis**

### Files in sts-service:
1. **routes/voiceagent.js** (696 lines)
   - 16 endpoints total
   - Mix of GET and POST methods
   - JWT auth on select endpoints
   - VAPI integration for agent ID "24"
   - Batch calling with context merging
   - Recording URL signing via external service
   - Phone resolution from company/employee caches

2. **models/voiceagent.pg.js** (395 lines)
   - Database query functions
   - Phone resolution logic
   - Sales summary updates
   - Voice/agent/number queries

---

## 🎯 **Feature Inventory**

### **1. Call Initiation**
**Endpoints**:
- `POST /calls` - Single call
- `POST /calls/batch` - Batch calls

**Features**:
- ✅ VAPI integration (agent_id "24" or "VAPI")
- ✅ Custom voice agent routing
- ✅ Dynamic time-based greetings (morning/afternoon/evening)
- ✅ Lead name personalization
- ✅ Per-entry context in batch calls
- ✅ Context priority: entry.added_context > entry.summary > body.added_context
- ✅ Forwarding to external API (BASE_URL/calls)
- ✅ Call logging to voice_agent.call_logs_voiceagent
- ✅ Lead auto-creation in voice_agent.leads_voiceagent

**VAPI Configuration**:
```javascript
{
  assistantId: VAPI_ASSISTANT_ID,
  phoneNumberId: VAPI_PHONE_NUMBER_ID,
  customer: { number, name },
  metadata: { initiated_by, added_context },
  assistantOverrides: { firstMessage }
}
```

**Dynamic Greeting**:
- 0:00 - 11:59: "Good morning"
- 12:00 - 16:59: "Good afternoon"
- 17:00 - 23:59: "Good evening"

**First Message Template**:
```
Hi {lead_name}. {greeting}. This is Nithya from Pluto Travels. 
Dubai's most awarded corporate travel agency. How are you doing today?
```

---

### **2. Recording Management**
**Endpoints**:
- `GET /calls/:id/recording-signed-url` - Get recording URL

**Features**:
- ✅ Fetch recording URL from call_logs_voiceagent
- ✅ Generate GCS signed URL via external service
- ✅ Configurable expiration (default: 96 hours)
- ✅ External API integration (BASE_URL/recordings/calls/:id/signed-url)

**Flow**:
```
1. Get call log by ID from voice_agent.call_logs_voiceagent
2. Extract recording_url (gs://bucket/path/file.wav)
3. Request signed URL from BASE_URL/recordings/calls/:id/signed-url
4. Return publicly accessible URL (valid for N hours)
```

---

### **3. User-Specific Endpoints**
**Endpoints**:
- `GET /user/available-agents` - User's agents (JWT auth)
- `GET /user/available-numbers` - User's phone numbers (JWT auth)
- `GET /voices/:id/sample-signed-url` - Voice sample URL (JWT auth)
- `GET /agents/:agentId/sample-signed-url` - Agent voice sample URL (JWT auth)

**Features**:
- ✅ JWT authentication via jwtAuth middleware
- ✅ User ID from JWT token or query param (voice_agent_user_id)
- ✅ Database views: v_user_available_agents, v_user_available_numbers
- ✅ Voice sample URL signing via external service
- ✅ Agent → Voice ID resolution

**Agents Response**:
```json
{
  "success": true,
  "agents": [
    {
      "agent_id": "1",
      "agent_name": "Sales Agent",
      "agent_language": "en",
      "voice_id": "voice_123",
      "description": "Professional sales voice",
      "voice_sample_url": "gs://..."
    }
  ]
}
```

**Numbers Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "num_123",
      "phone_number": "+1234567890",
      "provider": "twilio",
      "type": "local"
    }
  ]
}
```

---

### **4. Agent/Voice Management**
**Endpoints**:
- `GET /all` - All agents (admin)
- `GET /` - All voices (legacy)
- `GET /numbers` - All phone numbers
- `GET /agent/:name` - Agent by name
- `GET /voices` - All voice profiles

**Features**:
- ✅ Query all agents from agents_voiceagent table
- ✅ Query all voices from voices_voiceagent table
- ✅ Query all numbers from numbers_voiceagent table
- ✅ Agent lookup by name
- ✅ No authentication required (internal endpoints)

---

### **5. Phone Resolution**
**Endpoints**:
- `POST /resolve-phones` - Resolve phones from caches

**Features**:
- ✅ Supports type: "company" or "employee"
- ✅ Resolves from company_search_cache for companies
- ✅ Resolves from employees_cache for employees
- ✅ Returns phone, name, sales_summary, raw data
- ✅ Handles multiple ID formats (apollo_organization_id, company_data_id, etc.)

**Company Resolution**:
- Sources: apollo_organization_id, company_data->>'id', cache row id
- Phone extraction: organization.primary_phone.sanitized_number, organization.sanitized_phone, etc.

**Employee Resolution**:
- Sources: company_id (multiple rows), apollo_person_id, employee_data_id, cache row id
- Returns multiple employees per company if querying by company_id

**Request**:
```json
{
  "ids": ["123", "456"],
  "type": "company"
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "requested_id": "123",
      "cache_row_id": "789",
      "phone": "+1234567890",
      "name": "Acme Corp",
      "sales_summary": "## Company Overview...",
      "source": "company_search_cache",
      "raw": { /* full data */ }
    }
  ]
}
```

---

### **6. Sales Summary Updates**
**Endpoints**:
- `POST /update-summary` - Update sales summary

**Features**:
- ✅ Supports type: "company" or "employee"
- ✅ Updates company_search_cache.sales_summary for companies
- ✅ Updates employees_cache.company_sales_summary for employees
- ✅ Flexible identifier matching (cache_row_id, apollo IDs, data IDs)
- ✅ Returns number of rows updated

**Request**:
```json
{
  "type": "company",
  "summary": "## Sales Summary\nKey points...",
  "apollo_organization_id": "123"
}
```

**Response**:
```json
{
  "success": true,
  "updated": 1,
  "type": "company",
  "by": "apollo_organization_id",
  "value": "123"
}
```

---

## 🗄️ **Database Schema**

### **voice_agent Schema**:

#### **agents_voiceagent**
- agent_id (PK)
- agent_name
- agent_language
- voice_id (FK → voices_voiceagent)
- created_at, updated_at

#### **voices_voiceagent**
- id (PK)
- description
- voice_sample_url (gs:// URL)
- created_at, updated_at

#### **numbers_voiceagent**
- number_id (PK)
- phone_number
- provider (twilio, etc.)
- number_type (local, toll-free, etc.)
- created_at, updated_at

#### **call_logs_voiceagent**
- id (PK)
- voice_id
- agent_id
- from_number
- to_number
- started_at
- ended_at
- status (calling, ongoing, ended, declined, failed)
- recording_url (gs:// URL)
- added_context
- target (FK → leads_voiceagent.id)
- initiated_by
- created_at, updated_at

#### **leads_voiceagent**
- id (PK)
- name
- phone
- email
- company
- created_at, updated_at

#### **v_user_available_agents** (View)
- user_id
- agent_id
- agent_name
- agent_language
- voice_id

#### **v_user_available_numbers** (View)
- user_id
- number_id
- phone_number
- provider
- number_type

### **External Tables**:

#### **public.leads**
- Used to sync lead data with voice_agent.leads_voiceagent
- Fields: name, email, company, phone

#### **company_search_cache**
- Stores company data with phone numbers
- Fields: id, apollo_organization_id, company_data (JSONB), sales_summary

#### **employees_cache**
- Stores employee data with phone numbers
- Fields: id, company_id, apollo_person_id, employee_name, employee_phone, company_sales_summary

---

## 🔧 **Environment Variables**

### Required:
```bash
# VAPI Configuration
VAPI_API_KEY=e05f06b1-dd62-4d7d-bd57-af0089077d6e
VAPI_ASSISTANT_ID=f3d9204e-3dde-477f-938a-8d908ba6f9fa
VAPI_PHONE_NUMBER_ID=cdaed2ed-000b-4835-afb0-b2cebb3c532c

# External API
BASE_URL=https://your-api.com
BASE_URL_FRONTEND_HEADER=your-frontend-id
BASE_URL_FRONTEND_APIKEY=your-api-key
```

### Optional:
```bash
# Custom agents
DEFAULT_FROM_NUMBER=+19513456728

# GCS signing
SIGNING_ENDPOINT_URL=https://your-api.com/recordings/signed-url
```

---

## 📁 **New Feature Structure**

```
backend/features/voice-agent/
├── manifest.js ✅ (CREATED)
├── routes.js (TODO)
├── controllers/
│   ├── VoiceAgentController.js (TODO)
│   └── CallController.js (TODO)
├── services/
│   ├── VAPIService.js (TODO)
│   ├── VoiceAgentService.js (TODO)
│   ├── CallLoggingService.js (TODO)
│   ├── RecordingService.js (TODO)
│   └── PhoneResolverService.js (TODO)
├── models/
│   ├── VoiceAgent.js (TODO)
│   ├── CallLog.js (TODO)
│   └── Lead.js (TODO)
├── utils/
│   ├── greetingGenerator.js (TODO)
│   └── phoneFormatter.js (TODO)
├── README.md (TODO)
└── IMPLEMENTATION_GUIDE.md (TODO)
```

---

## 🎯 **Next Steps**

1. **Create Models** (services/models)
   - VoiceAgentModel.js - Database queries for agents/voices/numbers
   - CallLogModel.js - Call logging queries
   - PhoneResolverModel.js - Phone resolution from caches

2. **Create Services**
   - VAPIService.js - VAPI API integration
   - VoiceAgentService.js - Agent/voice/number management
   - CallLoggingService.js - Call log creation and retrieval
   - RecordingService.js - GCS signed URL generation
   - PhoneResolverService.js - Phone resolution logic

3. **Create Controllers**
   - VoiceAgentController.js - Agent/voice/number endpoints
   - CallController.js - Call initiation and management

4. **Create Routes**
   - routes.js - Unified routing with proper auth

5. **Create Utilities**
   - greetingGenerator.js - Time-based greeting generation
   - phoneFormatter.js - Phone number cleaning and formatting

6. **Documentation**
   - README.md - Feature overview and quick start
   - IMPLEMENTATION_GUIDE.md - Detailed implementation guide

---

## ✅ **Completed**

- [x] Feature analysis (voiceagent.js - 696 lines)
- [x] Database schema documentation
- [x] manifest.js with complete configuration
- [x] Migration plan and structure

---

## 📈 **Progress**

**Phase 1**: 20% complete (1/5 files)
- ✅ manifest.js created

**Overall**: 5% complete (1/20+ files)

---

## 🚀 **Ready to Continue**

The foundation is set! Next action: Create the database models service to handle all database queries for voice agents, calls, and phone resolution.

Would you like me to:
1. Create the database models next?
2. Start with VAPI service integration?
3. Build the controller and routes first?
4. Continue with all services in parallel?
