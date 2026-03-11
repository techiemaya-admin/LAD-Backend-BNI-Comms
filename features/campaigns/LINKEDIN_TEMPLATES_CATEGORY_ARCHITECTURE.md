# LinkedIn Message Templates - Category-Based Architecture

## 🎯 Overview

LinkedIn message templates use the existing `communication_templates` table with a category-based approach to store connection and followup messages as separate records.

## 📊 Database Structure

### Table: `communication_templates`

LinkedIn templates use these field mappings:

| Field | Usage for LinkedIn |
|-------|-------------------|
| `channel` | Always `'linkedin'` |
| `category` | `'linkedin_connection'` or `'linkedin_followup'` |
| `template_key` | Links connection and followup messages together |
| `content` | The message text (connection or followup) |
| `name` | Template name (connection record only) |
| `description` | Template description |
| `tags` | Array of tags for organization |
| `is_default` | Default template flag (per tenant/channel/category) |
| `usage_count` | Track usage analytics |
| `last_used_at` | Last usage timestamp |

### How Templates are Stored

Each "template" (with both connection and followup messages) is stored as **TWO separate records**:

**Record 1 - Connection Message:**
```sql
INSERT INTO communication_templates (
  channel, category, template_key,
  name, description, content, tags, is_default, ...
) VALUES (
  'linkedin', 'linkedin_connection', 'linkedin_1234567890_abc',
  'Sales Outreach', 'Template for sales', 'Hi {{first_name}}...', 
  ARRAY['sales', 'outbound'], true, ...
);
```

**Record 2 - Followup Message (Optional):**
```sql
INSERT INTO communication_templates (
  channel, category, template_key,
  name, content, ...
) VALUES (
  'linkedin', 'linkedin_followup', 'linkedin_1234567890_abc',
  'Sales Outreach (Followup)', 'Thanks for connecting!', ...
);
```

**Both records share the same `template_key` to link them together.**

## 🔄 API Behavior

### Create Template
```javascript
// API Request
POST /api/campaigns/linkedin/message-templates
{
  "name": "Sales Outreach",
  "connection_message": "Hi {{first_name}}...",
  "followup_message": "Thanks for connecting!"
}

// Creates TWO database records:
// 1. Connection record (category='linkedin_connection', content='Hi {{first_name}}...')
// 2. Followup record (category='linkedin_followup', content='Thanks for connecting!')
// Both linked by same template_key
```

### Get All Templates
```javascript
// API Request
GET /api/campaigns/linkedin/message-templates

// Response (combined view)
[
  {
    "id": "conn-uuid",
    "name": "Sales Outreach",
    "connection_message": "Hi {{first_name}}...",
    "followup_message": "Thanks for connecting!",
    "followup_id": "followup-uuid",
    "template_key": "linkedin_1234567890_abc"
  }
]

// Backend logic:
// 1. Fetch all connection records (category='linkedin_connection')
// 2. For each connection, fetch matching followup (same template_key)
// 3. Combine into single object for API response
```

### Update Template
```javascript
// API Request
PUT /api/campaigns/linkedin/message-templates/:id
{
  "connection_message": "Updated connection...",
  "followup_message": "Updated followup..."
}

// Updates BOTH records:
// 1. Update connection record's content field
// 2. Update followup record's content field (or create if doesn't exist)
// Uses template_key to find related records
```

### Delete Template
```javascript
// API Request
DELETE /api/campaigns/linkedin/message-templates/:id

// Soft deletes BOTH records:
// 1. Get template_key from the provided ID
// 2. Soft delete all records with that template_key
// Sets is_deleted=true for both connection and followup
```

## 📑 Repository Methods

### getAllForTenant()
1. Fetch all connection records (`category='linkedin_connection'`)
2. For each connection, fetch matching followup by `template_key`
3. Combine into single objects with both messages

### getById()
1. Fetch record by ID to get `template_key`
2. Fetch all records with that `template_key`
3. Combine connection and followup into single object

### getDefault()
1. Fetch default connection record (`is_default=true`, `category='linkedin_connection'`)
2. Fetch matching followup by `template_key`
3. Return combined object

### create()
1. Generate unique `template_key`
2. Create connection record with `category='linkedin_connection'`
3. If `followup_message` provided, create followup record with `category='linkedin_followup'`
4. Both use same `template_key`

### update()
1. Get `template_key` from provided ID
2. Update connection record if `connection_message` provided
3. Update/create/delete followup record based on `followup_message`
4. Return combined template

### delete()
1. Get `template_key` from provided ID
2. Soft delete ALL records with that `template_key`

### incrementUsage()
1. Increment specific record (connection or followup)
2. Used when that specific message is sent

## 🔍 Indexes

```sql
-- Connection templates
CREATE INDEX idx_comm_templates_linkedin_connection
ON communication_templates(tenant_id, channel, category) 
WHERE is_deleted = false 
  AND channel = 'linkedin' 
  AND category = 'linkedin_connection';

-- Followup templates
CREATE INDEX idx_comm_templates_linkedin_followup
ON communication_templates(tenant_id, channel, category) 
WHERE is_deleted = false 
  AND channel = 'linkedin' 
  AND category = 'linkedin_followup';

-- Default templates (unique per tenant/channel/category)
CREATE UNIQUE INDEX idx_comm_templates_default_per_category
ON communication_templates(tenant_id, channel, category, is_default) 
WHERE is_deleted = false 
  AND is_default = true;
```

## ✅ Benefits of This Approach

1. **Reuses existing table** - No new table needed
2. **Consistent with other channels** - Voice, email, SMS all use same table
3. **Flexible** - Can add more message types (e.g., 'linkedin_reminder')
4. **Separate usage tracking** - Track connection vs followup usage independently
5. **Category-based filtering** - Easy to query specific message types
6. **Scalable** - Can extend to multi-step sequences

## 🎯 Migration Path

**Old approach** (deprecated - migration 020):
- Single table `linkedin_message_templates`
- `connection_message` and `followup_message` columns

**New approach** (active - migration 021):
- Existing table `communication_templates`
- Separate records with `category` field
- Linked by `template_key`

## Example Usage in Campaign Execution

```javascript
// Get template
const template = await repository.getById(templateId, tenantId);

// Send connection request
await sendLinkedInConnection(leadId, template.connection_message);
await repository.incrementUsage(template.id, tenantId); // Track connection usage

// Later, after connection accepted...
if (template.followup_message && template.followup_id) {
  await sendLinkedInMessage(leadId, template.followup_message);
  await repository.incrementUsage(template.followup_id, tenantId); // Track followup usage
}
```

## 🔐 LAD Architecture Compliance

✅ **Multi-tenancy**: All queries filtered by `tenant_id`  
✅ **Dynamic schema**: Uses `getSchema(context)`  
✅ **No hardcoded schemas**: All queries use schema variable  
✅ **Layering**: SQL only in repository, business logic in service  
✅ **Transaction safety**: Uses BEGIN/COMMIT/ROLLBACK  
✅ **Soft delete**: Uses `is_deleted` flag  
✅ **Logging**: Centralized logger, no console statements
