#!/bin/bash
# Test Apollo API directly with the API key
curl -X POST https://api.apollo.io/v1/mixed_people/search \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: dt8Qw5IYrdVx3ZhD3AEiLA" \
  -d '{
    "per_page": 5,
    "page": 1,
    "person_titles": ["CFO"],
    "organization_locations": ["Dubai"],
    "q_organization_keyword_tags": ["Financial Services"]
  }' | jq -r '.pagination.total_entries // "API call failed"'
