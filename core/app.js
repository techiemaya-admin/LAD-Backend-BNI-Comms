/**
 * Core SaaS Platform Application
 * 
 * PURPOSE:
 * This is the main application entry point for a production-grade SaaS platform.
 * It implements a feature-based architecture where:
 * 
 * 1. CORE PLATFORM: Always-available services (auth, billing, users)
 * 2. OPTIONAL FEATURES: Client-specific features loaded dynamically based on their subscription plan
 * 3. FEATURE FLAGS: Database-backed system for controlling feature access per client
 * 4. DYNAMIC LOADING: Features are registered and loaded only when clients have access
 * 
 * ARCHITECTURE BENEFITS:
 * - Multi-tenant: Each client gets features based on their plan
 * - Scalable: Add new features without touching core platform
 * - Secure: Feature access is enforced at middleware level
 * - Billing-ready: Credit tracking and usage monitoring built-in
 * - Zero-downtime: Features can be enabled/disabled without restarts
 * 
 * USAGE:
 * const CoreApplication = require('./core/app');
 * const app = new CoreApplication();
 * await app.start(3000);
 * 
 * ENDPOINTS:
 * /api/auth/*     - Authentication (always available)
 * /api/billing/*  - Billing & plans (always available) 
 * /api/users/*    - User management (always available)
 * /api/features   - Get client's enabled features
 * /api/{feature}/* - Dynamic feature routes (access controlled)
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { FeatureRegistry } = require('./feature_registry');
const { FeatureFlagService } = require('../feature_flags/service');
const authRoutes = require('./auth/routes');
const billingRoutes = require('./billing/routes');
const userRoutes = require('./users/routes');
const { authenticateToken } = require('./middleware/auth');
const { trackClientFeatures } = require('./middleware/feature_tracking');
const logger = require('./utils/logger');

class CoreApplication {
  constructor() {
    this.app = express();
    this.featureRegistry = new FeatureRegistry();
    this.featureFlagService = new FeatureFlagService();
    this.setupMiddleware();
    this.setupCoreRoutes();
  }

  setupMiddleware() {
    // Allow multiple origins for CORS
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3002',
      'https://lad-frontend-3nddlneyya-uc.a.run.app',
      'https://lad-frontend-741719885039.us-central1.run.app',
      'https://lad-frontend-develop-741719885039.us-central1.run.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          console.log(`[CORS] Blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true, // Allow cookies to be sent
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      preflightContinue: false, // Let cors handle preflight
      optionsSuccessStatus: 204 // Success status for preflight
    }));
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser()); // Parse cookies
    
    // Core middleware (always enabled)
    this.app.use(authenticateToken);
    this.app.use(trackClientFeatures);
  }

  /**
   * Create feature flag middleware for a specific feature
   */
  createFeatureMiddleware(featureKey) {
    return async (req, res, next) => {
      // Skip feature check for non-authenticated requests (will be caught by auth middleware)
      if (!req.user) {
        return next();
      }

      const organizationId = req.user?.tenantId || req.user?.organizationId;
      const userId = req.user?.userId;
      
      try {
        const isEnabled = await this.featureFlagService.isEnabled(organizationId, featureKey, userId);
        
        if (!isEnabled) {
          return res.status(403).json({
            success: false,
            error: 'Feature not available',
            feature: featureKey
          });
        }
        
        next();
      } catch (error) {
        console.error(`Error checking feature flag for ${featureKey}:`, error);
        return res.status(500).json({
          success: false,
          error: 'Error checking feature access'
        });
      }
    };
  }

  setupCoreRoutes() {
    // Health check endpoint for Docker/Cloud Run
    this.app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Platform routes (always available)
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/billing', billingRoutes);
    this.app.use('/api/users', userRoutes);
    
    // Campaigns routes with feature flag check
    const campaignsRoutes = require('../features/campaigns/routes/index');
    this.app.use('/api/campaigns', this.createFeatureMiddleware('campaigns'), campaignsRoutes);
    console.log('✅ Campaigns routes mounted with feature flag check');
    
    // Feature flags endpoint
    this.app.get('/api/features', async (req, res) => {
      try {
        const organizationId = req.user?.organizationId || req.headers['x-organization-id'];
        const userId = req.user?.userId;
        const features = await this.featureFlagService.getClientFeatures(organizationId, userId);
        res.json({ success: true, features });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  async registerFeatures() {
    // Register all available features
    await this.featureRegistry.discoverFeatures();
    
    // Setup dynamic feature loading
    this.app.use('/api/:feature', async (req, res, next) => {
      const featureKey = req.params.feature;
      try {
        const organizationId = req.user?.tenantId || req.user?.organizationId || req.headers['x-organization-id'];
        const userId = req.user?.userId;
        
        logger.debug(`Feature request: ${featureKey}`, { organizationId, userId });
        
        const isEnabled = await this.featureFlagService.isEnabled(organizationId, featureKey, userId);
        logger.debug(`Feature ${featureKey} enabled: ${isEnabled}`, { organizationId });
        
        if (!isEnabled) {
          return res.status(403).json({
            success: false,
            error: 'Feature not available',
            feature: featureKey
          });
        }
        
        // Load feature router dynamically (cached in registry after first load)
        const featureRouter = await this.featureRegistry.loadFeatureRouter(featureKey, organizationId);
        if (featureRouter) {
          // Store original URL and path
          const originalUrl = req.url;
          const originalBaseUrl = req.baseUrl;
          
          // Strip the /api/:feature prefix so router matches routes correctly
          // req.url should be relative to the mount point
          const mountPath = `/api/${featureKey}`;
          if (req.url.startsWith(mountPath)) {
            req.url = req.url.substring(mountPath.length) || '/';
          }
          req.baseUrl = mountPath;
          
          // Use router as middleware
          featureRouter(req, res, (err) => {
            // Restore original URL in case of error or no match
            req.url = originalUrl;
            req.baseUrl = originalBaseUrl;
            if (err) {
              next(err);
            } else {
              next();
            }
          });
        } else {
          next();
        }
      } catch (error) {
        logger.error('Error loading feature', { error: error.message, featureKey, stack: error.stack });
        next();
      }
    });
  }

  async start(port = 3000) {
    await this.registerFeatures();
    
    this.app.listen(port, () => {
      logger.info(`Core Platform running on port ${port}`);
      logger.info(`Registered features: ${this.featureRegistry.getFeatureList().join(', ')}`);
    });
  }
}

module.exports = CoreApplication;