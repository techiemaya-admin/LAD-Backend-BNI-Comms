# Lead Enrichment Feature

## Overview

The Lead Enrichment feature is an **optional AI-powered service** that enriches company/lead data from Apollo.io, LinkedIn, or other sources with:
- **Website Content Analysis** - Scrapes and analyzes company websites
- **AI-Powered Relevance Scoring** - Uses OpenAI/Anthropic to score leads against your ICP
- **Intelligent Filtering** - Filters out irrelevant companies based on relevance scores
- **Lead Qualification Insights** - Provides reasoning for why each lead matches (or doesn't match)

## Architecture

### Feature Toggle Pattern
```
Client → Apollo Search → Raw Results → [Lead Enrichment?] → Client

If lead-enrichment ENABLED:
  Raw Results → Website Scraping → AI Analysis → Filtered Results

If lead-enrichment DISABLED:
  Raw Results → Client (no processing)
```

### Feature Independence
- **apollo-leads** - Gets raw lead data from Apollo.io API
- **lead-enrichment** - Processes any lead data (Apollo, LinkedIn, manual uploads, etc.)
- Both features work independently
- Can be enabled/disabled per organization

## API Usage

### 1. Basic Enrichment

**Endpoint:** `POST /api/lead-enrichment/enrich`

**Request:**
```json
{
  "leads": [
    {
      "name": "Acme Corp",
      "website": "https://acme.com",
      "industry": "Software",
      "estimated_num_employees": 50
    }
  ],
  "topic": "Companies using cloud infrastructure who need DevOps automation",
  "min_relevance_score": 5,
  "enable_website_scraping": true,
  "enable_ai_analysis": true
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Acme Corp",
      "website": "https://acme.com",
      "websiteContent": "Acme Corp provides cloud-based...",
      "aiAnalysis": {
        "isRelevant": true,
        "confidence": 85,
        "score": 8.5,
        "reasoning": "Company heavily uses AWS and mentions DevOps challenges in their blog",
        "keyMatches": ["cloud infrastructure", "AWS", "DevOps"],
        "concerns": []
      },
      "relevanceScore": 8.5
    }
  ],
  "metadata": {
    "total_input": 1,
    "total_enriched": 1,
    "topic": "Companies using cloud infrastructure..."
  }
}
```

### 2. Full Workflow: Apollo → Enrichment

```javascript
// Step 1: Search Apollo (requires apollo-leads feature)
const apolloResults = await fetch('http://localhost:3004/api/apollo-leads/search', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    keywords: 'healthcare,SaaS',
    location: 'USA',
    limit: 50
  })
});

const { data: rawLeads } = await apolloResults.json();

// Step 2: Enrich if feature enabled (requires lead-enrichment feature)
const enrichedResults = await fetch('http://localhost:3004/api/lead-enrichment/enrich', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    leads: rawLeads,
    topic: 'Healthcare SaaS companies with patient engagement needs',
    min_relevance_score: 6
  })
});

const { data: enrichedLeads } = await enrichedResults.json();
// enrichedLeads now contains only relevant companies with AI scores
```

### 3. Single Website Analysis

**Endpoint:** `POST /api/lead-enrichment/analyze-website`

```json
{
  "url": "https://example.com",
  "company": {
    "name": "Example Inc"
  },
  "topic": "B2B SaaS companies"
}
```

## Configuration

### Environment Variables

```bash
# AI Provider (required for enrichment)
AI_PROVIDER=openai  # or 'anthropic'
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...

# Model Selection
AI_MODEL=gpt-4o-mini  # or 'gpt-4', 'claude-3-haiku-20240307'
```

### Feature Flags (Database)

```sql
-- Enable for organization
INSERT INTO lad_LAD.feature_flags (organization_id, feature_key, is_enabled, config)
VALUES (
  'org-uuid', 
  'lead-enrichment', 
  true, 
  '{"ai_provider": "openai", "min_confidence": 50}'::jsonb
);

-- Disable for organization
UPDATE lad_LAD.feature_flags 
SET is_enabled = false 
WHERE organization_id = 'org-uuid' AND feature_key = 'lead-enrichment';
```

## Frontend Integration

### Conditional Feature Display

```typescript
// Check if enrichment is available
const hasEnrichment = user.capabilities.includes('lead-enrichment');

// Show toggle in UI
if (hasEnrichment) {
  return (
    <Switch
      label="AI-Powered Filtering"
      checked={useEnrichment}
      onChange={setUseEnrichment}
    />
  );
}

// In search handler
async function handleSearch(params) {
  // Always get Apollo results first
  const apolloResults = await apolloSearch(params);
  
  // Conditionally enrich
  if (hasEnrichment && useEnrichment) {
    const enriched = await enrichLeads({
      leads: apolloResults,
      topic: icpDescription
    });
    setResults(enriched);
  } else {
    setResults(apolloResults); // Show all results
  }
}
```

### UI Enhancements

When enrichment is enabled, show:
- **Relevance Scores** (0-10) with color coding
- **AI Reasoning** tooltip on hover
- **Key Matches** as tags
- **Concerns** as warnings
- **Enrichment badge** to indicate processed leads

## Credits & Billing

| Operation | Credits | Description |
|-----------|---------|-------------|
| Enrich (up to 50 leads) | 2 | Website scraping + AI analysis |
| Single website analysis | 0.5 | Scrape + analyze one website |
| Batch enrichment | 2 per batch | Multiple enrichment batches |

## Performance

- **Website Scraping**: ~1-2 seconds per website
- **AI Analysis**: ~0.5-1 second per company
- **Concurrent Processing**: 5 websites at a time
- **Batch Limit**: 50 companies per enrichment request
- **Total Time**: ~20-30 seconds for 20 companies

## Error Handling

```javascript
try {
  const enriched = await enrichLeads(data);
} catch (error) {
  if (error.status === 403) {
    // Feature not enabled for this organization
    console.log('Lead enrichment not available');
    // Fall back to raw results
  } else if (error.status === 402) {
    // Insufficient credits
    showUpgradeModal();
  } else {
    // Other error
    console.error('Enrichment failed:', error.message);
  }
}
```

## Feature Health Check

```bash
curl http://localhost:3004/api/lead-enrichment/health
```

**Response:**
```json
{
  "feature": "lead-enrichment",
  "status": "healthy",
  "message": "AI provider configured and ready",
  "ai_provider": "openai",
  "ai_configured": true
}
```

## Migration from vcp_sales_agent

The Python implementation has been migrated to Node.js with these improvements:

| Python Feature | Node.js Equivalent | Status |
|---------------|-------------------|---------|
| Website scraping | WebsiteScraperService | ✅ Migrated |
| AI company analysis | CompanyAnalysisService | ✅ Migrated |
| Batch processing | Concurrent promises | ✅ Improved |
| LinkedIn scraping | Separate feature (planned) | 📋 Future |
| Topic expansion | AI-ICP-Assistant | ✅ Available |

## Next Steps

1. **Add AI Provider** - Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env`
2. **Enable Feature** - Add feature flag for test organization
3. **Test Enrichment** - Use Postman/curl to test `/enrich` endpoint
4. **Frontend Integration** - Add enrichment toggle to search UI
5. **Monitor Usage** - Track credits and performance metrics
