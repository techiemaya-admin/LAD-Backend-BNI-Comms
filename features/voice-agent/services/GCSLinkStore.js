let logger;
try {
  logger = require('../../../core/utils/logger');
} catch (e) {
  logger = console;
}

class GCSLinkStore {
  constructor() {
    this.store = new Map();
  }

  _nowMs() {
    return Date.now();
  }

  _getTtlMs() {
    const ttlSeconds = parseInt(process.env.GCS_LINK_TTL_SECONDS || '3600', 10);
    if (Number.isNaN(ttlSeconds) || ttlSeconds <= 0) return 3600 * 1000;
    return ttlSeconds * 1000;
  }

  _makeKey(tenantId, userId) {
    return `${tenantId || 'unknown'}:${userId || 'unknown'}`;
  }

  setLinks({ tenantId, userId, attachment_link, json_link }) {
    const key = this._makeKey(tenantId, userId);
    const now = this._nowMs();
    const ttlMs = this._getTtlMs();

    const value = {
      attachment_link: attachment_link || null,
      json_link: json_link || null,
      createdAt: now,
      expiresAt: now + ttlMs
    };

    this.store.set(key, value);
    logger.info('[GCSLinkStore] Stored GCS links', { key, hasAttachment: !!attachment_link, hasJson: !!json_link });

    return value;
  }

  getLinks({ tenantId, userId, consume = false }) {
    const key = this._makeKey(tenantId, userId);
    const value = this.store.get(key);
    if (!value) return null;

    if (value.expiresAt && value.expiresAt < this._nowMs()) {
      this.store.delete(key);
      logger.info('[GCSLinkStore] Expired GCS links removed', { key });
      return null;
    }

    if (consume) {
      this.store.delete(key);
      logger.info('[GCSLinkStore] Consumed and removed GCS links', { key });
    }

    return value;
  }
}

module.exports = new GCSLinkStore();
module.exports.GCSLinkStore = GCSLinkStore;
