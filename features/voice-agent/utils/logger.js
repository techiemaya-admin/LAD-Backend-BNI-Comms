// Adapter logger for the voice-agent feature.
// Delegates to LAD core logger when present; otherwise falls back to console.
// This file is infra-only and must not contain business logic.

let coreLogger = null;
try {
  // Attempt to load LAD core/shared logger if present in host app
  // From backend/features/voice-agent/utils -> project root /core/utils
  // eslint-disable-next-line global-require, import/no-unresolved
  coreLogger = require('../../../../core/utils/logger');
} catch (e) {
  coreLogger = null;
}

function getLogger() {
  if (coreLogger) {
    return coreLogger;
  }

  // Minimal fallback with log levels; in production LAD this should be replaced
  // by the shared logger implementation.
  return {
    debug: (...args) => console.debug('[voice-agent]', ...args),
    info: (...args) => console.info('[voice-agent]', ...args),
    warn: (...args) => console.warn('[voice-agent]', ...args),
    error: (...args) => console.error('[voice-agent]', ...args),
  };
}

module.exports = {
  getLogger,
};
