/**
 * Apollo API Service
 * Handles Apollo API calls and Python script execution
 * LAD Architecture Compliant
 */

const axios = require('axios');
const path = require('path');
const { spawn, execSync } = require('child_process');
const logger = require('../../../core/utils/logger');

/**
 * Helper function to call Python Apollo service
 * Uses LAD_SCRIPTS_PATH environment variable (LAD architecture compliant)
 * Falls back to API endpoint if Python script is not available
 */
function callApolloService(method, params = {}) {
  return new Promise((resolve, reject) => {
    // LAD RULE: Use environment variable, NEVER guess paths
    // Path guessing is FORBIDDEN in LAD architecture
    let scriptPath = null;
    const fs = require('fs');
    
    // Priority 1: LAD_SCRIPTS_PATH (for local development with symlink)
    if (process.env.LAD_SCRIPTS_PATH) {
      const candidatePath = path.join(process.env.LAD_SCRIPTS_PATH, 'apollo_service.py');
      if (fs.existsSync(candidatePath)) {
        scriptPath = candidatePath;
        logger.debug('[Apollo API] Using script from LAD_SCRIPTS_PATH', { path: scriptPath });
      }
    }
    
    // Priority 2: APOLLO_SERVICE_SCRIPT_PATH (direct path override)
    if (!scriptPath && process.env.APOLLO_SERVICE_SCRIPT_PATH) {
      if (fs.existsSync(process.env.APOLLO_SERVICE_SCRIPT_PATH)) {
        scriptPath = process.env.APOLLO_SERVICE_SCRIPT_PATH;
        logger.debug('[Apollo API] Using script from APOLLO_SERVICE_SCRIPT_PATH', { path: scriptPath });
      }
    }
    
    // Priority 3: Standard LAD location (when merged to LAD)
    if (!scriptPath) {
      // Try standard LAD location: backend/shared/services/apollo_service.py
      // This is relative to where the service is running (LAD backend root)
      const standardPath = path.join(process.cwd(), 'backend', 'shared', 'services', 'apollo_service.py');
      if (fs.existsSync(standardPath)) {
        scriptPath = standardPath;
        logger.debug('[Apollo API] Using script from standard LAD location', { path: scriptPath });
      }
    }
    
    // If Python script not found, reject to trigger fallback
    if (!scriptPath) {
      logger.warn('[Apollo API] Python script not found. Set LAD_SCRIPTS_PATH or APOLLO_SERVICE_SCRIPT_PATH env var.');
      reject(new Error('Python script not found - will use API endpoint'));
      return;
    }
    
    // Find Python executable - try python3, python, then py (Windows)
    let pythonExec = null;
    const pythonExecs = ['python3', 'python', 'py'];
    
    for (const exec of pythonExecs) {
      try {
        execSync(`${exec} --version`, { stdio: 'ignore' });
        pythonExec = exec;
        break;
      } catch (e) {
        // Try next executable
      }
    }
    
    // If no Python executable found, reject to trigger fallback
    if (!pythonExec) {
      reject(new Error('Python not found - will use API endpoint'));
      return;
    }
    
    logger.debug('[Apollo API] Using Python executable', { exec: pythonExec, script: scriptPath });
    const pythonProcess = spawn(pythonExec, [scriptPath, method, JSON.stringify(params)]);
    
    let output = '';
    let error = '';
    
    // Handle spawn errors
    pythonProcess.on('error', (spawnError) => {
      reject(new Error(`Python process error: ${spawnError.message}`));
    });
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const errorText = data.toString();
      error += errorText;
      logger.debug('[Apollo API] Python stderr', { message: errorText.trim() });
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // Extract JSON from output
          let jsonString = output.trim();
          
          // Find the first '{' or '[' to identify where JSON starts
          const firstBrace = jsonString.indexOf('{');
          const firstBracket = jsonString.indexOf('[');
          let jsonStart = -1;
          let startChar = '';
          
          if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            jsonStart = firstBrace;
            startChar = '{';
          } else if (firstBracket !== -1) {
            jsonStart = firstBracket;
            startChar = '[';
          }
          
          if (jsonStart > 0) {
            jsonString = jsonString.substring(jsonStart);
          }
          
          // Find matching closing bracket/brace
          let depth = 0;
          let jsonEnd = -1;
          const endChar = startChar === '{' ? '}' : ']';
          
          for (let i = 0; i < jsonString.length; i++) {
            if (jsonString[i] === startChar) {
              depth++;
            } else if (jsonString[i] === endChar) {
              depth--;
              if (depth === 0) {
                jsonEnd = i;
                break;
              }
            }
          }
          
          if (jsonEnd !== -1) {
            jsonString = jsonString.substring(0, jsonEnd + 1);
          }
          
          const result = JSON.parse(jsonString);
          
          // For search_people_direct, return the full result object
          if (result.success !== undefined && result.employees) {
            resolve(result);
          } else if (result.companies) {
            resolve(result.companies);
          } else if (result.leads) {
            resolve(result.leads);
          } else if (result.employees && !result.success) {
            resolve(result.employees);
          } else if (Array.isArray(result)) {
            resolve(result);
          } else {
            resolve(result);
          }
        } catch (e) {
          logger.error('[Apollo API] JSON Parse Error', { error: e.message, output: output.substring(0, 500) });
          reject(new Error('Failed to parse Python output: ' + e.message));
        }
      } else {
        reject(new Error('Python process failed: ' + error));
      }
    });
  });
}

/**
 * Call Apollo.io API directly via HTTP
 * Uses APOLLO_API_KEY and APOLLO_API_BASE_URL from environment variables
 * LAD Architecture: No hardcoded URLs - uses environment configuration
 */
async function callApolloApi(searchParams) {
  const apiKey = process.env.APOLLO_API_KEY || process.env.APOLLO_IO_API_KEY;
  
  if (!apiKey) {
    throw new Error('Apollo API key not configured. Set APOLLO_API_KEY or APOLLO_IO_API_KEY in environment variables.');
  }
  
  // LAD Architecture: Use environment variable or constants (no hardcoded URLs)
  const { APOLLO_CONFIG } = require('../constants/constants');
  // Use base URL from environment or constants
  const apolloBaseUrl = process.env.APOLLO_API_BASE_URL || APOLLO_CONFIG.DEFAULT_BASE_URL;
  
  // LAD Architecture: Use endpoint constant (no hardcoded paths)
  const apolloSearchEndpoint = `${apolloBaseUrl}${APOLLO_CONFIG.ENDPOINTS.MIXED_PEOPLE_SEARCH}`;
  
  const {
    organization_locations = [],
    person_locations = [],  // Personal location (where person lives)
    person_titles = [],
    person_seniorities = [],  // Seniority levels (director, manager, c_suite, etc.)
    organization_industries = [],  // Keep for backward compatibility
    q_organization_domains_list = [],  // Specific company domains for filtering
    per_page = 100,
    page = 1
  } = searchParams;
  
  // Build Apollo.io API request - filters go in QUERY PARAMETERS, not body
  // Apollo expects filters as query params with array syntax: param[]=value1&param[]=value2
  const apolloRequestParams = {
    per_page: 100,  // Fixed: always fetch 100 results (max per page)
    page: 1,  // Fixed: always get page 1 only
    reveal_personal_emails: true,  // Reveal emails directly in search results
    reveal_phone_number: true  // Reveal phones directly in search results
  };
  
  // Add filters (Apollo expects exact parameter names and array format)
  if (person_titles && person_titles.length > 0) {
    apolloRequestParams.person_titles = person_titles;
  }
  
  // Add seniority filter
  if (person_seniorities && person_seniorities.length > 0) {
    apolloRequestParams.person_seniorities = person_seniorities;
  }
  
  // Support both person_locations (personal) and organization_locations (company)
  if (person_locations && person_locations.length > 0) {
    apolloRequestParams.person_locations = person_locations;
  }
  if (organization_locations && organization_locations.length > 0) {
    apolloRequestParams.organization_locations = organization_locations;
  }
  
  // Company domain filtering (for specific companies)
  if (q_organization_domains_list && q_organization_domains_list.length > 0) {
    apolloRequestParams.q_organization_domains_list = q_organization_domains_list;
  }
  
  // NOTE: People API Search doesn't have direct industry filter
  // Industry filtering works better with organization search or via q_organization_domains_list
  // Keep organization_industries for backward compatibility but it may not work as expected
  if (organization_industries && organization_industries.length > 0) {
    apolloRequestParams.organization_industries = organization_industries.map(ind => 
      String(ind).toLowerCase().trim()
    );
    logger.warn('[Apollo API] Note: organization_industries may not be supported by People API Search endpoint. Consider using q_organization_domains_list for company filtering.');
  }
  
  logger.info('[Apollo API] Calling Apollo.io API directly', {
    url: apolloSearchEndpoint,
    baseUrl: apolloBaseUrl,
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'none'
  });
  logger.info('[Apollo API] Request params being sent', {
    ...apolloRequestParams,
    searchCriteria: {
      titles: person_titles?.length || 0,
      locations: organization_locations?.length || 0,
      industries: organization_industries?.length || 0
    }
  });
  
  try {
    const apolloResponse = await axios.post(
      apolloSearchEndpoint,
      {},  // Empty body - filters go in params!
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': apiKey  // Apollo uses lowercase x-api-key
        },
        params: apolloRequestParams,  // Filters as query parameters
        paramsSerializer: {
          serialize: (params) => {
            // Serialize arrays as param[]=value1&param[]=value2 (Apollo format)
            const qs = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
              if (Array.isArray(value)) {
                value.forEach((v) => qs.append(`${key}[]`, v));
              } else if (value !== undefined && value !== null) {
                qs.append(key, value);
              }
            });
            return qs.toString();
          }
        },
        timeout: 120000 // 2 minutes for Apollo API
      }
    );
    
    logger.info('[Apollo API] Apollo.io API responded', { status: apolloResponse.status });
    logger.debug('[Apollo API] Response data structure', {
      hasData: !!apolloResponse.data,
      dataKeys: apolloResponse.data ? Object.keys(apolloResponse.data) : [],
      hasPeople: !!(apolloResponse.data && apolloResponse.data.people),
      peopleCount: apolloResponse.data?.people?.length || 0,
      sampleData: apolloResponse.data ? JSON.stringify(apolloResponse.data).substring(0, 500) : 'no data'
    });
    
    if (apolloResponse.data && apolloResponse.data.people) {
      const people = apolloResponse.data.people;
      logger.info('[Apollo API] Found people from Apollo.io', { count: people.length });
      
      return {
        success: true,
        employees: people,
        pagination: apolloResponse.data.pagination || {}
      };
    } else {
      logger.warn('[Apollo API] Apollo.io API returned unexpected format', {
        hasData: !!apolloResponse.data,
        dataKeys: apolloResponse.data ? Object.keys(apolloResponse.data) : [],
        fullResponse: JSON.stringify(apolloResponse.data).substring(0, 1000)
      });
      return {
        success: false,
        employees: [],
        error: 'Unexpected response format from Apollo.io API'
      };
    }
  } catch (apiError) {
    logger.error('[Apollo API] Error calling Apollo.io API directly', {
      message: apiError.message,
      status: apiError.response?.status,
      responseData: apiError.response?.data
    });
    throw apiError;
  }
}

/**
 * Search employees from Apollo API (with fallback)
 */
async function searchEmployeesFromApollo(searchParams) {
  const {
    organization_locations = [],
    person_titles = [],
    organization_industries = [],
    per_page = 100,
    page = 1
  } = searchParams;
  
  const apolloPerPage = 100; // Always request 100 from Apollo
  
  try {
    logger.debug('[Apollo API] Attempting to call Apollo via Python script');
    const apolloResult = await callApolloService('search_people_direct', {
      organization_locations: organization_locations,
      person_titles: person_titles,
      organization_industries: organization_industries,
      per_page: apolloPerPage,
      page: page || 1
    });
    logger.info('[Apollo API] Successfully called Apollo via Python script');
    return apolloResult;
  } catch (pythonError) {
    logger.warn('[Apollo API] Python script not available, falling back to API endpoint', {
      error: pythonError.message
    });
    
    // Fallback to HTTP API
    return await callApolloApi({
      organization_locations: organization_locations,
      person_titles: person_titles,
      organization_industries: organization_industries,
      per_page: apolloPerPage,
      page: page
    });
  }
}

module.exports = {
  callApolloService,
  callApolloApi,
  searchEmployeesFromApollo
};

