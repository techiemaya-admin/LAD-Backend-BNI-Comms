/**
 * Apollo Leads Feature Constants
 * Feature-specific configuration constants
 */

// Apollo.io API Configuration
const APOLLO_CONFIG = {
  DEFAULT_BASE_URL: 'https://api.apollo.io/v1',
  MAX_PER_PAGE: 100,
  ENDPOINTS: {
    ORGANIZATIONS_SEARCH: '/organizations/search',
    ORGANIZATION_BY_ID: '/organizations',
    PEOPLE_SEARCH: '/people/search',
    PEOPLE_BULK_MATCH: '/people/bulk_match',
    MIXED_PEOPLE_SEARCH: '/people/search'
  }
};

// Cache Configuration
const CACHE_CONFIG = {
  FAKE_EMAIL_PATTERNS: [
    'noemail',
    'no-email',
    'unavailable',
    'not-available',
    'not_unlocked',
    'email_not_unlocked',
    'private',
    'hidden',
    'contact@',
    'info@',
    'admin@',
    'support@',
    'hello@',
    'example.com',
    'test.com',
    'sample.com'
  ]
};

// Credit Costs for billable operations
const CREDIT_COSTS = {
  EMAIL_REVEAL: 1,
  PHONE_REVEAL: 8,
  SEARCH: 1
};

// Timeout Configuration
const TIMEOUT_CONFIG = {
  DEFAULT: 30000,
  APOLLO_API: 45000,
  DATABASE: 15000
};

module.exports = {
  APOLLO_CONFIG,
  CACHE_CONFIG,
  CREDIT_COSTS,
  TIMEOUT_CONFIG
};
