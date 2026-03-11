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
const { getSocketService } = require('../shared/services/socketService');
const logger = require('./utils/logger');
const http = require('http');

class CoreApplication {
  constructor() {
    this.app = express();
    this.server = null;
    this.featureRegistry = new FeatureRegistry();
    this.featureFlagService = new FeatureFlagService();
    this.setupMiddleware();
    this.setupCoreRoutes();
  }

  setupMiddleware() {
    // Allow multiple origins for CORS
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'https://lad-frontend-3nddlneyya-uc.a.run.app',
      'https://lad-frontend-741719885039.us-central1.run.app',
      'https://lad-frontend-develop-741719885039.us-central1.run.app',
      'https://lad-frontend-develop-m33ggxz7iq-uc.a.run.app',
      'https://lad-frontend-stage-3nddlneyya-uc.a.run.app',
      'https://www.mrlads.com',
      'https://app.mrlads.com',
      'https://dev.mrlads.com',
      'https://stage.mrlads.com',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        logger.debug('[CORS] Origin check', { origin, allowedOrigins });
        
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          logger.warn('[CORS] Blocked origin', { origin });
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true, // Allow cookies to be sent
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'X-Tenant-Id',
        'Accept',
        'Origin',
        'Cache-Control',
        'Pragma',
        'Accept-Encoding',
        'Accept-Language',
        'Connection',
        'Host',
        'Referer',
        'User-Agent'
      ],
      exposedHeaders: [
        'Content-Range',
        'X-Content-Range'
      ],
      preflightContinue: false, // Let cors handle preflight
      optionsSuccessStatus: 204 // Success status for preflight
    }));
    
    // Mount Stripe webhook BEFORE json parser (needs raw body)
    // Note: Only the webhook route is mounted here, other Stripe routes mounted later
    this.app.use('/api/stripe/webhook', 
      express.raw({ type: 'application/json' }), 
      require('./billing/routes/stripe.routes')
    );
    
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser()); // Parse cookies
    
    // Explicit OPTIONS handler for complex CORS cases
    this.app.options('*', (req, res) => {
      logger.debug('[CORS] Handling OPTIONS request', { 
        url: req.url, 
        origin: req.get('Origin'),
        method: req.get('Access-Control-Request-Method')
      });
      res.status(204).end();
    });
    
    // Core middleware (always enabled)
    this.app.use(authenticateToken);
    this.app.use(trackClientFeatures);
  }

  /**
   * Create feature flag middleware for a specific feature
   */
  createFeatureMiddleware(featureKey) {
    return async (req, res, next) => {
      // Skip feature check for health endpoints
      if (req.path.includes('/health')) {
        return next();
      }

      // Skip feature check for Cloud Tasks endpoints (they have their own auth)
      if ((req.url && req.url.includes('/execute-followup')) || 
          (req.originalUrl && req.originalUrl.includes('/execute-followup')) ||
          (req.path && req.path.includes('/execute-followup'))) {
        return next();
      }

      // Skip feature check for non-authenticated requests (will be caught by auth middleware)
      if (!req.user) {
        return next();
      }
      // Double check and remove before prod deployement - Naveen

      // Allow all features in development mode (NODE_ENV=development or ALLOW_ALL_FEATURES=true)
      const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ALLOW_ALL_FEATURES === 'true';
      if (isDevelopment) {
        logger.debug(`[Development] Skipping feature flag check for ${featureKey}`, {
          NODE_ENV: process.env.NODE_ENV,
          ALLOW_ALL_FEATURES: process.env.ALLOW_ALL_FEATURES
        });
        return next();
      }

      // Handle multiple JWT token formats for better compatibility
      const organizationId = req.user?.tenantId || req.user?.organizationId;
      const userId = req.user?.userId || req.user?.id; // Support both userId and id fields
      
      logger.debug(`[FeatureMiddleware] Checking feature ${featureKey}`, {
        organizationId,
        userId,
        isDevelopment,
        NODE_ENV: process.env.NODE_ENV
      });
      
      try {
        const isEnabled = await this.featureFlagService.isEnabled(organizationId, featureKey, userId);
        
        if (!isEnabled) {
          logger.warn(`Feature ${featureKey} not enabled`, { 
            organizationId, 
            userId,
            isDevelopment,
            NODE_ENV: process.env.NODE_ENV
          });
          return res.status(403).json({
            success: false,
            error: 'Feature not available',
            feature: featureKey,
            debug: {
              organizationId,
              isDevelopment,
              NODE_ENV: process.env.NODE_ENV,
              hint: 'Set NODE_ENV=development or ALLOW_ALL_FEATURES=true to bypass feature flag check'
            }
          });
        }
        
        next();
      } catch (error) {
        logger.error(`Error checking feature flag for ${featureKey}`, { error: error.message, stack: error.stack });
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
    // Mount billing routes on /api/wallet for backward compatibility
    this.app.use('/api/wallet', billingRoutes);
    // Stripe routes (checkout requires auth, webhook is already mounted above before auth)
    const stripeRoutes = require('./billing/routes/stripe.routes');
    this.app.use('/api/stripe', stripeRoutes);
    this.app.use('/api/users', userRoutes);
    
    // Community ROI routes with authentication and feature flag check
    try {
      const communityRoiRoutes = require('../features/community-roi/routes/index');
      this.app.use('/api/community-roi', authenticateToken, this.createFeatureMiddleware('community-roi'), communityRoiRoutes);
      logger.info('[App] Community ROI routes mounted with authentication and feature flag check');
      
      // Add a diagnostic endpoint for community-roi
      this.app.get('/api/community-roi/diagnostic', authenticateToken, (req, res) => {
        return res.json({
          success: true,
          message: 'Community ROI API is properly routed and authenticated',
          timestamp: new Date().toISOString(),
          request: {
            path: req.path,
            method: req.method,
            user: req.user ? { tenantId: req.user.tenantId, userId: req.user.userId } : null
          },
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            ALLOW_ALL_FEATURES: process.env.ALLOW_ALL_FEATURES
          }
        });
      });
    } catch (error) {
      logger.warn('[App] Community ROI routes not available (routes not yet implemented):', error.message);
    }
    
    // Feature flags endpoint
    this.app.get('/api/features', async (req, res) => {
      try {
        const organizationId = req.user?.tenantId || req.user?.organizationId || req.headers['x-organization-id'];
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
    // Apply authentication middleware first so req.user is available for feature checks
    this.app.use('/api/:feature', authenticateToken, async (req, res, next) => {
      const featureKey = req.params.feature;
      try {
        const organizationId = req.user?.tenantId || req.user?.organizationId || req.headers['x-organization-id'];
        const userId = req.user?.userId;
        
        logger.debug(`Feature request: ${featureKey}`, { organizationId, userId });
        
        // Check if feature exists in registry
        if (!this.featureRegistry.getFeature(featureKey)) {
          logger.debug(`Feature not found in registry: ${featureKey}`, { organizationId });
          return res.status(404).json({
            success: false,
            error: 'Feature not found',
            feature: featureKey,
            availableFeatures: this.featureRegistry.getFeatureList()
          });
        }
        
        // Allow all features in development mode
        const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ALLOW_ALL_FEATURES === 'true';
        let isEnabled = isDevelopment;
        if (!isDevelopment) {
          isEnabled = await this.featureFlagService.isEnabled(organizationId, featureKey, userId);
        }
        logger.debug(`Feature ${featureKey} enabled: ${isEnabled}`, { organizationId, isDevelopment });

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
          // req.url comes in as '/api/voice-agent/calls', we need '/calls'
          const mountPath = `/api/${featureKey}`;
          logger.debug(`Feature router URL manipulation`, {
            originalUrl: req.url,
            mountPath,
            featureKey
          });
          
          if (req.url.startsWith(mountPath)) {
            req.url = req.url.substring(mountPath.length) || '/';
          } else if (req.url.startsWith(`/${featureKey}`)) {
            // Handle case where URL might be '/voice-agent/calls'
            req.url = req.url.substring(`/${featureKey}`.length) || '/';
          }
          req.baseUrl = mountPath;
          
          logger.debug(`After URL manipulation`, {
            modifiedUrl: req.url,
            baseUrl: req.baseUrl
          });
          
          // Use router as middleware function
          // Express routers can be called as functions: router(req, res, next)
          // If a route matches, it handles the request
          // If no route matches, it should call next() automatically, but we'll check
          featureRouter(req, res, (err) => {
            // Restore original URL
            req.url = originalUrl;
            req.baseUrl = originalBaseUrl;
            
            if (err) {
              return next(err);
            }
            
            // If router matched a route, response should be sent
            // If not, call next() to continue to next middleware
            if (!res.headersSent) {
              return next();
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
    
    return new Promise((resolve, reject) => {
      // Create HTTP server
      this.server = http.createServer(this.app);
      
      // Initialize Socket.IO
      try {
        const socketService = getSocketService();
        socketService.initialize(this.server);
        logger.info('[App] Socket.IO initialized for real-time features');
      } catch (error) {
        logger.warn('[App] Socket.IO initialization failed:', {
          error: error.message
        });
      }
      
      this.server.listen(port, '0.0.0.0', (err) => {
        if (err) return reject(err);
        logger.info(`Core Platform running on port ${port}`);
        logger.info(`Registered features: ${this.featureRegistry.getFeatureList().join(', ')}`);
        
        const socketService = getSocketService();
        const socketStatus = socketService.getStatus();
        logger.info('[App] Socket.IO status:', socketStatus);
        
        resolve();
      });
    });
  }
}

module.exports = CoreApplication;